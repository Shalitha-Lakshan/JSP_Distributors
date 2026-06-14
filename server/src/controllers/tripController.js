const TripSession = require("../models/TripSession");

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
  const { actualCollections = { cash: 0, cheque: 0 } } = req.body;

  try {
    const trip = await TripSession.findOne({
      rep: req.user._id,
      status: "active"
    });

    if (!trip) {
      return res.status(404).json({ message: "No active trip session found." });
    }

    const expectedCash = Number(trip.expectedCollections?.cash || 0);
    const expectedCheque = Number(trip.expectedCollections?.cheque || 0);

    const actualCash = Number(actualCollections.cash || 0);
    const actualCheque = Number(actualCollections.cheque || 0);

    trip.actualCollections = { cash: actualCash, cheque: actualCheque };
    trip.varianceCollections = {
      cash: actualCash - expectedCash,
      cheque: actualCheque - expectedCheque
    };

    trip.status = "pending_audit";
    trip.endTime = new Date();

    await trip.save();

    return res.json(trip);
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

    return res.json(trip);
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
