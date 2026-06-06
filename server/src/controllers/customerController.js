const Customer = require("../models/Customer");
const Sale = require("../models/Sale");
const Payment = require("../models/Payment");

const createCustomer = async (req, res) => {
  const customer = await Customer.create(req.body);
  return res.status(201).json(customer);
};

const listCustomers = async (_req, res) => {
  const customers = await Customer.find().sort({ createdAt: -1 });
  return res.json(customers);
};

const getCustomer = async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }
  return res.json(customer);
};

const updateCustomer = async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
    new: true
  });
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }
  return res.json(customer);
};

const deleteCustomer = async (req, res) => {
  const customer = await Customer.findByIdAndDelete(req.params.id);
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }
  return res.json({ message: "Deleted" });
};

const getLedger = async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  const [sales, payments] = await Promise.all([
    Sale.find({ customer: customer._id, status: { $ne: "cancelled" } })
      .select("invoiceNo netTotal paidAmount dueAmount createdAt paymentStatus")
      .sort({ createdAt: 1 }),
    Payment.find({ customer: customer._id })
      .select("paymentNo amount paymentMethod createdAt note")
      .sort({ createdAt: 1 })
  ]);

  const entries = [];

  sales.forEach((sale) => {
    entries.push({
      date: sale.createdAt,
      ref: sale.invoiceNo,
      description: `Invoice ${sale.invoiceNo}`,
      debit: sale.netTotal || 0,
      credit: 0,
      type: "sale",
      paymentStatus: sale.paymentStatus
    });
  });

  payments.forEach((payment) => {
    entries.push({
      date: payment.createdAt,
      ref: payment.paymentNo,
      description: `Payment ${payment.paymentNo}`,
      debit: 0,
      credit: payment.amount || 0,
      type: "payment",
      paymentMethod: payment.paymentMethod,
      note: payment.note
    });
  });

  entries.sort((a, b) => new Date(a.date) - new Date(b.date));

  let runningBalance = 0;
  const ledger = entries.map((entry) => {
    runningBalance += (entry.debit || 0) - (entry.credit || 0);
    return { ...entry, balance: runningBalance };
  });

  const totals = {
    totalDebit: ledger.reduce((sum, row) => sum + (row.debit || 0), 0),
    totalCredit: ledger.reduce((sum, row) => sum + (row.credit || 0), 0),
    closingBalance: runningBalance
  };

  return res.json({
    customer: {
      id: customer._id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      customerType: customer.customerType,
      outstandingBalance: customer.outstandingBalance
    },
    ledger,
    totals
  });
};

module.exports = {
  createCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getLedger
};
