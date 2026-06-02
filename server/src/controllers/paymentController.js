const Payment = require("../models/Payment");
const Customer = require("../models/Customer");

const receivePayment = async (req, res) => {
  const { customer, amount } = req.body;

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

  const payment = await Payment.create({
    ...req.body,
    paymentNo: `PAY-${Date.now()}`,
    receivedBy: req.user?._id
  });

  const nextBalance = Math.max((customerDoc.outstandingBalance || 0) - Number(amount), 0);
  customerDoc.outstandingBalance = nextBalance;
  await customerDoc.save();

  return res.status(201).json(payment);
};

const listPayments = async (_req, res) => {
  const payments = await Payment.find()
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
