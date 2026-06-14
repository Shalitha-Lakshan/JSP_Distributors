const Payment = require("../models/Payment");
const Customer = require("../models/Customer");
const Sale = require("../models/Sale");
const Order = require("../models/Order");

const receivePayment = async (req, res) => {
  const { customer, amount, paymentMethod, allocations = [] } = req.body;

  if (!customer) {
    return res.status(400).json({ message: "Customer is required" });
  }

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ message: "Payment amount must be greater than 0" });
  }

  const customerDoc = await Customer.findById(customer);
  if (!customerDoc) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const TripSession = require("../models/TripSession");
  const activeTrip = await TripSession.findOne({
    rep: req.user?._id,
    status: "active"
  });

  const paymentData = {
    ...req.body,
    paymentNo: `PAY-${Date.now()}`,
    receivedBy: req.user?._id
  };

  if (activeTrip) {
    paymentData.tripId = activeTrip._id;
  }

  // Process allocations systematically
  const processedAllocations = [];
  if (allocations && Array.isArray(allocations)) {
    for (const alloc of allocations) {
      if (!alloc.invoice || !alloc.allocatedAmount) continue;

      const sale = await Sale.findById(alloc.invoice);
      if (sale) {
        const allocAmt = Number(alloc.allocatedAmount);
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

        processedAllocations.push({
          invoice: sale._id,
          invoiceNo: sale.invoiceNo,
          allocatedAmount: allocAmt
        });
      }
    }
  }

  if (processedAllocations.length > 0) {
    paymentData.allocations = processedAllocations;
  }

  const payment = await Payment.create(paymentData);

  if (activeTrip) {
    activeTrip.paymentsCollected.push(payment._id);
    const method = paymentMethod || "cash";
    if (method === "cash") {
      activeTrip.expectedCollections.cash = (activeTrip.expectedCollections.cash || 0) + Number(amount);
    } else if (method === "cheque") {
      activeTrip.expectedCollections.cheque = (activeTrip.expectedCollections.cheque || 0) + Number(amount);
    }
    await activeTrip.save();
  }

  const nextBalance = Math.max((customerDoc.outstandingBalance || 0) - Number(amount), 0);
  customerDoc.outstandingBalance = nextBalance;
  await customerDoc.save();

  return res.status(201).json(payment);
};

const listPayments = async (req, res) => {
  const filter = {};

  if (req.user?.role === "rep" || req.query.mine === "true") {
    filter.receivedBy = req.user?._id;

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

  const payments = await Payment.find(filter)
    .sort({ createdAt: -1 })
    .populate("customer", "name")
    .populate("receivedBy", "name");
  return res.json(payments);
};

const listPaymentsByCustomer = async (req, res) => {
  const payments = await Payment.find({ customer: req.params.customerId })
    .sort({ createdAt: -1 })
    .populate("customer", "name")
    .populate("receivedBy", "name");
  return res.json(payments);
};

module.exports = { receivePayment, listPayments, listPaymentsByCustomer };
