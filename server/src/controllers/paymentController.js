const Payment = require("../models/Payment");

const receivePayment = async (req, res) => {
  const payment = await Payment.create({
    ...req.body,
    paymentNo: `PAY-${Date.now()}`,
    receivedBy: req.user?._id
  });
  return res.status(201).json(payment);
};

const listPayments = async (_req, res) => {
  const payments = await Payment.find().sort({ createdAt: -1 });
  return res.json(payments);
};

const listPaymentsByCustomer = async (req, res) => {
  const payments = await Payment.find({ customer: req.params.customerId }).sort({
    createdAt: -1
  });
  return res.json(payments);
};

module.exports = { receivePayment, listPayments, listPaymentsByCustomer };
