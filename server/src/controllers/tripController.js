const TripSession = require("../models/TripSession");
const Return = require("../models/Return");

// POST /api/trips/start
const startTrip = async (req, res) => {
  const { route } = req.body;

  if (!route) {
    return res.status(400).json({ message: "Route name is required" });
  }

  try {
    // Check if current user already has an active trip
    const activeTrip = await TripSession.findOne({
      rep: req.user._id,
      status: "active"
    });

    if (activeTrip) {
      return res.status(400).json({
        message: "You already have an active trip session. Please end it before starting a new one."
      });
    }

    const tripNo = `TRIP-${Date.now()}`;
    const trip = await TripSession.create({
      tripNo,
      rep: req.user._id,
      route,
      status: "active",
      startTime: new Date()
    });

    return res.status(201).json(trip);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to start trip session" });
  }
};

// GET /api/trips/active
const getActiveTrip = async (req, res) => {
  try {
    const trip = await TripSession.findOne({
      rep: req.user._id,
      status: "active"
    })
      .populate({
        path: "ordersBooked",
        populate: { path: "customer", select: "name" }
      })
      .populate({
        path: "paymentsCollected",
        populate: { path: "customer", select: "name" }
      });

    return res.json(trip);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to fetch active trip" });
  }
};

// POST /api/trips/submit-audit
const submitAudit = async (req, res) => {
  const { actualCollections = { cash: 0, cheque: 0 }, remarks } = req.body;

  try {
    let trip = await TripSession.findOne({
      rep: req.user._id,
      status: "active"
    });

    if (!trip) {
      // Graceful duplicate/retry recovery: check if already submitted
      const pendingTrip = await TripSession.findOne({
        rep: req.user._id,
        status: "pending_audit"
      }).sort({ updatedAt: -1 });

      if (pendingTrip) {
        return res.json({
          ...pendingTrip.toObject(),
          alreadySubmitted: true,
          message: "Trip session has already been submitted for manager audit."
        });
      }

      return res.status(404).json({ message: "No active trip session found." });
    }

    const rawActualCash = Number(actualCollections.cash);
    const rawActualCheque = Number(actualCollections.cheque);

    if (
      isNaN(rawActualCash) ||
      rawActualCash < 0 ||
      isNaN(rawActualCheque) ||
      rawActualCheque < 0
    ) {
      return res.status(400).json({
        message: "Actual collections must be valid non-negative numbers."
      });
    }

    const actualCash = Math.round(rawActualCash * 100) / 100;
    const actualCheque = Math.round(rawActualCheque * 100) / 100;

    const totalExpenses = (trip.expenses || []).reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0
    );
    const expectedCashGross = Number(trip.expectedCollections?.cash || 0);
    const expectedCashNet = Math.max(0, expectedCashGross - totalExpenses);
    const expectedCheque = Number(trip.expectedCollections?.cheque || 0);

    const cashVariance = Math.round((actualCash - expectedCashNet) * 100) / 100;
    const chequeVariance = Math.round((actualCheque - expectedCheque) * 100) / 100;

    // Policy 1: Cash Shortage Remarks Validation
    // Cash shortage of Rs. 1,000 or more strictly requires explanatory remarks
    const trimmedRemarks = remarks ? String(remarks).trim() : "";
    if (cashVariance <= -1000 && !trimmedRemarks) {
      return res.status(400).json({
        message: "Sales Representative explanation is mandatory for cash shortages of Rs. 1,000 or more."
      });
    }

    trip.actualCollections = { cash: actualCash, cheque: actualCheque };
    trip.varianceCollections = {
      cash: cashVariance,
      cheque: chequeVariance
    };
    trip.repRemarks = trimmedRemarks;

    // Policy 2: Unreconciled Excess Cash
    // If cash variance is positive, flag as unreconciled excess for Manager review
    // without automatically creating ledger/credit entries
    if (cashVariance > 0) {
      trip.excessHandling = {
        status: "unreconciled",
        reviewNotes: ""
      };
    } else {
      trip.excessHandling = {
        status: "none"
      };
    }

    trip.status = "pending_audit";
    trip.endTime = new Date();

    await trip.save();

    const populated = await TripSession.findById(trip._id)
      .populate("rep", "name email role")
      .populate("auditedBy", "name")
      .populate({
        path: "ordersBooked",
        populate: { path: "customer", select: "name" }
      })
      .populate({
        path: "paymentsCollected",
        populate: { path: "customer", select: "name" }
      });

    return res.json(populated);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to submit trip for audit" });
  }
};

// POST /api/trips/:id/approve
const approveTrip = async (req, res) => {
  const { auditNotes } = req.body;

  try {
    const trip = await TripSession.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ message: "Trip session not found." });
    }

    if (trip.status !== "pending_audit") {
      return res.status(400).json({ message: "Only trips pending audit can be approved." });
    }

    trip.status = "approved";
    trip.auditedBy = req.user._id;
    trip.auditedAt = new Date();
    trip.auditNotes = auditNotes || "";

    if (trip.excessHandling && trip.excessHandling.status === "unreconciled") {
      trip.excessHandling.status = "reviewed";
      trip.excessHandling.reviewedBy = req.user._id;
      trip.excessHandling.reviewedAt = new Date();
      trip.excessHandling.reviewNotes = auditNotes || "Reviewed during manager trip audit";
    }

    await trip.save();

    return res.json(trip);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to approve trip session" });
  }
};

// GET /api/trips
const listTrips = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    // Non-managers can only see their own trips
    if (req.user.role === "rep") {
      filter.rep = req.user._id;
    }

    const trips = await TripSession.find(filter)
      .populate("rep", "name email role")
      .populate("auditedBy", "name")
      .sort({ createdAt: -1 });

    return res.json(trips);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to list trip sessions" });
  }
};

// GET /api/trips/:id
const getTripDetails = async (req, res) => {
  try {
    const trip = await TripSession.findById(req.params.id)
      .populate("rep", "name email role")
      .populate("auditedBy", "name")
      .populate({
        path: "ordersBooked",
        populate: { path: "customer", select: "name" }
      })
      .populate({
        path: "paymentsCollected",
        populate: { path: "customer", select: "name" }
      });

    if (!trip) {
      return res.status(404).json({ message: "Trip session not found." });
    }

    // Security check: non-managers can only view their own trip details
    if (
      req.user.role === "rep" &&
      trip.rep._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Access forbidden" });
    }

    const returns = await Return.find({ tripId: trip._id })
      .populate("customer", "name")
      .populate("items.productId", "displayName itemCode");

    return res.json({
      ...trip.toObject(),
      returns
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to get trip details" });
  }
};

// POST /api/trips/active/expenses
const addExpense = async (req, res) => {
  const { reason, amount } = req.body;

  if (!reason || !amount || Number(amount) <= 0) {
    return res.status(400).json({ message: "Reason and a valid amount greater than 0 are required" });
  }

  try {
    const trip = await TripSession.findOne({
      rep: req.user._id,
      status: "active"
    });

    if (!trip) {
      return res.status(404).json({ message: "No active trip session found." });
    }

    trip.expenses = trip.expenses || [];
    trip.expenses.push({ reason, amount: Number(amount) });
    await trip.save();

    return res.status(201).json(trip);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to add expense" });
  }
};

// DELETE /api/trips/active/expenses/:index
const deleteExpense = async (req, res) => {
  try {
    const trip = await TripSession.findOne({
      rep: req.user._id,
      status: "active"
    });

    if (!trip) {
      return res.status(404).json({ message: "No active trip session found." });
    }

    const index = Number(req.params.index);
    if (isNaN(index) || index < 0 || index >= (trip.expenses || []).length) {
      return res.status(400).json({ message: "Invalid expense index" });
    }

    trip.expenses.splice(index, 1);
    await trip.save();

    return res.json(trip);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to delete expense" });
  }
};

module.exports = {
  startTrip,
  getActiveTrip,
  submitAudit,
  approveTrip,
  listTrips,
  getTripDetails,
  addExpense,
  deleteExpense
};
