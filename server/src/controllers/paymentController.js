const Payment = require("../models/Payment");
const Customer = require("../models/Customer");
const Sale = require("../models/Sale");
const Order = require("../models/Order");

const receivePayment = async (req, res) => {
  try {
    const {
      customer,
      amount,
      paymentMethod = "cash",
      allocations = [],
      chequeNo,
      bankName,
      chequeDate,
      chequeStatus,
      note,
      idempotencyKey
    } = req.body;

    // 1. Idempotency Check: prevent duplicate financial transactions on network retries
    if (idempotencyKey && typeof idempotencyKey === "string" && idempotencyKey.trim()) {
      const existingPayment = await Payment.findOne({ idempotencyKey: idempotencyKey.trim() })
        .populate("customer", "name phone address")
        .populate("receivedBy", "name");
      if (existingPayment) {
        return res.status(200).json(existingPayment);
      }
    }

    // 2. Validate Customer
    if (!customer) {
      return res.status(400).json({ message: "Customer is required" });
    }

    const customerDoc = await Customer.findById(customer);
    if (!customerDoc) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // 3. Validate Amount
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than 0" });
    }

    // 4. Validate Active Trip for Sales Reps
    const TripSession = require("../models/TripSession");
    const activeTrip = await TripSession.findOne({
      rep: req.user?._id,
      status: "active"
    });

    if (req.user?.role === "rep" && !activeTrip) {
      return res.status(400).json({
        message: "An active route trip is required to collect payments. Please start a trip before receiving payments."
      });
    }

    // 5. Validate Cheque Details
    if (paymentMethod === "cheque") {
      if (!chequeNo || typeof chequeNo !== "string" || !chequeNo.trim()) {
        return res.status(400).json({ message: "Cheque number is required for cheque payments." });
      }
      if (!bankName || typeof bankName !== "string" || !bankName.trim()) {
        return res.status(400).json({ message: "Bank name is required for cheque payments." });
      }
    }

    // 6. Validate Invoice Allocations
    const processedAllocations = [];
    if (allocations && Array.isArray(allocations) && allocations.length > 0) {
      let totalAllocated = 0;

      for (const alloc of allocations) {
        if (!alloc.invoice || !alloc.allocatedAmount) continue;

        const allocAmt = Number(alloc.allocatedAmount);
        if (isNaN(allocAmt) || allocAmt <= 0) {
          return res.status(400).json({ message: "Allocated amount on each invoice must be greater than 0." });
        }

        totalAllocated += allocAmt;

        const sale = await Sale.findById(alloc.invoice);
        if (!sale) {
          return res.status(404).json({ message: `Invoice not found for ID: ${alloc.invoice}` });
        }

        if (String(sale.customer) !== String(customerDoc._id)) {
          return res.status(400).json({
            message: `Invoice ${sale.invoiceNo} does not belong to the selected customer.`
          });
        }

        if (allocAmt > sale.dueAmount) {
          return res.status(400).json({
            message: `Allocated amount (Rs. ${allocAmt}) exceeds the outstanding balance (Rs. ${sale.dueAmount}) on invoice ${sale.invoiceNo}.`
          });
        }

        processedAllocations.push({
          saleDoc: sale,
          invoiceId: sale._id,
          invoiceNo: sale.invoiceNo,
          allocatedAmount: allocAmt
        });
      }

      if (totalAllocated > numericAmount) {
        return res.status(400).json({
          message: `Total allocated amount (Rs. ${totalAllocated.toFixed(2)}) cannot exceed the payment amount received (Rs. ${numericAmount.toFixed(2)}).`
        });
      }
    }

    // 7. Prepare Payment Document Data
    const paymentData = {
      paymentNo: `PAY-${Date.now()}`,
      customer: customerDoc._id,
      amount: numericAmount,
      paymentMethod,
      receivedBy: req.user?._id,
      note: note && typeof note === "string" ? note.trim() : undefined,
      idempotencyKey: idempotencyKey && typeof idempotencyKey === "string" ? idempotencyKey.trim() : undefined
    };

    if (activeTrip) {
      paymentData.tripId = activeTrip._id;
    }

    if (paymentMethod === "cheque") {
      paymentData.chequeNo = chequeNo.trim();
      paymentData.bankName = bankName.trim();
      paymentData.chequeDate = chequeDate ? new Date(chequeDate) : new Date();
      paymentData.chequeStatus = chequeStatus || "pending";
    }

    // 8. Apply Invoice Allocations to Sales and Orders
    if (processedAllocations.length > 0) {
      paymentData.allocations = [];
      for (const item of processedAllocations) {
        const sale = item.saleDoc;
        const allocAmt = item.allocatedAmount;

        sale.dueAmount = Math.max(sale.dueAmount - allocAmt, 0);
        sale.paidAmount = (sale.paidAmount || 0) + allocAmt;
        sale.paymentStatus = sale.dueAmount <= 0 ? "paid" : "partial";
        await sale.save();

        if (sale.orderId) {
          const order = await Order.findById(sale.orderId);
          if (order) {
            order.dueAmount = Math.max(order.dueAmount - allocAmt, 0);
            order.paidAmount = (order.paidAmount || 0) + allocAmt;
            order.paymentStatus = sale.paymentStatus;
            await order.save();
          }
        }

        paymentData.allocations.push({
          invoice: sale._id,
          invoiceNo: sale.invoiceNo,
          allocatedAmount: allocAmt
        });
      }
    }

    // 9. Persist Payment Record
    const payment = await Payment.create(paymentData);

    // 10. Update Active Trip Session Expected Collections
    if (activeTrip) {
      activeTrip.paymentsCollected.push(payment._id);
      if (paymentMethod === "cash") {
        activeTrip.expectedCollections.cash =
          (activeTrip.expectedCollections.cash || 0) + numericAmount;
      } else if (paymentMethod === "cheque") {
        activeTrip.expectedCollections.cheque =
          (activeTrip.expectedCollections.cheque || 0) + numericAmount;
      }
      await activeTrip.save();
    }

    // 11. Update Authoritative Customer Outstanding Balance
    const nextBalance = Math.max((customerDoc.outstandingBalance || 0) - numericAmount, 0);
    customerDoc.outstandingBalance = nextBalance;
    await customerDoc.save();

    // Populate customer details for immediate mobile receipt rendering
    const populatedPayment = await Payment.findById(payment._id)
      .populate("customer", "name phone address customerType")
      .populate("receivedBy", "name")
      .populate("tripId", "tripNo route");

    return res.status(201).json(populatedPayment || payment);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to process payment." });
  }
};

const getPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("customer", "name phone address customerType")
      .populate("receivedBy", "name")
      .populate("tripId", "tripNo route");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (
      req.user?.role === "rep" &&
      String(payment.receivedBy?._id || payment.receivedBy) !== String(req.user._id)
    ) {
      return res.status(403).json({ message: "Forbidden: Not your payment record." });
    }

    return res.json(payment);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to fetch payment." });
  }
};

const listPayments = async (req, res) => {
  const filter = {};

  if (req.user?.role === "rep" || req.query.mine === "true") {
    filter.receivedBy = req.user?._id;

    if (req.query.scope !== "all") {
      const TripSession = require("../models/TripSession");
      const activeTrip = await TripSession.findOne({
        rep: req.user?._id,
        status: "active"
      });
      if (activeTrip) {
        filter.tripId = activeTrip._id;
      } else if (req.user?.role === "rep") {
        filter.tripId = new (require("mongoose")).Types.ObjectId();
      }
    }
  }

  const payments = await Payment.find(filter)
    .sort({ createdAt: -1 })
    .populate("customer", "name phone")
    .populate("receivedBy", "name");
  return res.json(payments);
};

const listPaymentsByCustomer = async (req, res) => {
  const payments = await Payment.find({ customer: req.params.customerId })
    .sort({ createdAt: -1 })
    .populate("customer", "name phone")
    .populate("receivedBy", "name");
  return res.json(payments);
};

module.exports = { receivePayment, getPayment, listPayments, listPaymentsByCustomer };
