const Customer = require("../models/Customer");
const Sale = require("../models/Sale");
const Payment = require("../models/Payment");
const Return = require("../models/Return");

const createCustomer = async (req, res) => {
  try {
    const isRep = req.user && req.user.role === "rep";
    const { name, phone, address, customerType, creditLimit, status } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Customer name is required" });
    }

    // Role-aware security payload
    const payload = {
      name: name.trim(),
      phone: phone && typeof phone === "string" ? phone.trim() : undefined,
      address: address && typeof address === "string" ? address.trim() : undefined,
      customerType: ["walk-in", "retail", "wholesale", "credit"].includes(customerType)
        ? customerType
        : "walk-in",
      // Reps cannot alter status or assign credit limit on creation
      status: isRep ? "active" : (status || "active"),
      creditLimit: isRep ? 0 : Math.max(0, Number(creditLimit || 0)),
      // Financial balance cannot be initialized with arbitrary debt from client
      outstandingBalance: 0
    };

    const customer = await Customer.create(payload);
    return res.status(201).json(customer);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to create customer" });
  }
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
  try {
    const isRep = req.user && req.user.role === "rep";
    const { name, phone, address, customerType, creditLimit, status } = req.body;

    const allowedUpdates = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Customer name cannot be empty" });
      }
      allowedUpdates.name = name.trim();
    }

    if (phone !== undefined) {
      allowedUpdates.phone = typeof phone === "string" ? phone.trim() : "";
    }

    if (address !== undefined) {
      allowedUpdates.address = typeof address === "string" ? address.trim() : "";
    }

    if (customerType !== undefined) {
      if (!["walk-in", "retail", "wholesale", "credit"].includes(customerType)) {
        return res.status(400).json({ message: "Invalid customer type" });
      }
      allowedUpdates.customerType = customerType;
    }

    // Manager / Admin privileged administrative fields
    if (!isRep) {
      if (status !== undefined) {
        if (!["active", "inactive"].includes(status)) {
          return res.status(400).json({ message: "Invalid status value" });
        }
        allowedUpdates.status = status;
      }
      if (creditLimit !== undefined) {
        allowedUpdates.creditLimit = Math.max(0, Number(creditLimit || 0));
      }
    }

    // NOTE: outstandingBalance is strictly forbidden from manual client update for ALL roles.
    // Outstanding balance must only be adjusted via Sales & Payment ledger transactions.

    const customer = await Customer.findByIdAndUpdate(req.params.id, allowedUpdates, {
      new: true,
      runValidators: true
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    return res.json(customer);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to update customer" });
  }
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

  const [sales, payments, returns] = await Promise.all([
    Sale.find({ customer: customer._id, status: { $ne: "cancelled" } })
      .select("invoiceNo netTotal paidAmount dueAmount createdAt paymentStatus")
      .sort({ createdAt: 1 }),
    Payment.find({ customer: customer._id })
      .select("paymentNo amount paymentMethod createdAt note")
      .sort({ createdAt: 1 }),
    Return.find({ customer: customer._id })
      .select("invoiceNo returnTotal createdAt status")
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

  returns.forEach((ret) => {
    entries.push({
      date: ret.createdAt,
      ref: ret.invoiceNo,
      description: `Customer Return (Inv #${ret.invoiceNo})`,
      debit: 0,
      credit: ret.returnTotal || 0,
      type: "return"
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

const getUnpaidInvoices = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const unpaidSales = await Sale.find({
      customer: customer._id,
      status: "active",
      paymentStatus: { $in: ["credit", "partial"] },
      dueAmount: { $gt: 0 }
    })
      .select("invoiceNo orderId netTotal paidAmount dueAmount createdAt paymentStatus")
      .populate("orderId", "orderNo")
      .sort({ createdAt: 1 });

    return res.json(unpaidSales);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to fetch unpaid invoices" });
  }
};

module.exports = {
  createCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getLedger,
  getUnpaidInvoices
};
