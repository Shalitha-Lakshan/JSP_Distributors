const Sale = require("../models/Sale");
const { createSaleFromPayload } = require("../services/salesService");

const createSale = async (req, res) => {
  const {
    items = [],
    returns = [],
    discount = 0,
    paidAmount = 0,
    paymentMethod = "cash",
    customer,
    saleType = "walk-in"
  } = req.body;

  try {
    const sale = await createSaleFromPayload({
      items,
      returns,
      discount,
      paidAmount,
      paymentMethod,
      customer,
      saleType,
      cashierId: req.user?._id
    });
    return res.status(201).json(sale);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Failed to complete sale" });
  }
};

const listSales = async (req, res) => {
  const filter = {};

  if (req.user?.role === "cashier" || req.query.mine === "true") {
    filter.cashier = req.user?._id;
  }

  const sales = await Sale.find(filter)
    .populate("customer", "name")
    .populate("cashier", "name")
    .sort({ createdAt: -1 });
  return res.json(sales);
};

const getSale = async (req, res) => {
  const sale = await Sale.findById(req.params.id);
  if (!sale) {
    return res.status(404).json({ message: "Sale not found" });
  }
  return res.json(sale);
};

const getSaleByInvoice = async (req, res) => {
  const sale = await Sale.findOne({ invoiceNo: req.params.invoiceNo });
  if (!sale) {
    return res.status(404).json({ message: "Sale not found" });
  }
  return res.json(sale);
};

const cancelSale = async (req, res) => {
  const sale = await Sale.findByIdAndUpdate(
    req.params.id,
    { status: "cancelled", paymentStatus: "cancelled" },
    { new: true }
  );
  if (!sale) {
    return res.status(404).json({ message: "Sale not found" });
  }
  return res.json(sale);
};

const getSalePdf = async (_req, res) => {
  return res.status(501).json({ message: "PDF generation not implemented" });
};

module.exports = {
  createSale,
  listSales,
  getSale,
  getSaleByInvoice,
  cancelSale,
  getSalePdf
};
