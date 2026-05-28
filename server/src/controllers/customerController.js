const Customer = require("../models/Customer");

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

const getLedger = async (_req, res) => {
  return res.status(501).json({ message: "Ledger not implemented" });
};

module.exports = {
  createCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getLedger
};
