const Sale = require("../models/Sale");
const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");
const Return = require("../models/Return");

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

  const orderTotal = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  const returnTotal = returns.reduce(
    (sum, item) => sum + (item.returnTotal || item.quantity * item.returnPrice || 0),
    0
  );

  if (returnTotal > orderTotal) {
    return res.status(400).json({ message: "Return total cannot exceed order total" });
  }

  const netTotal = Math.max(orderTotal - returnTotal - discount, 0);
  const dueAmount = Math.max(netTotal - paidAmount, 0);
  const balance = Math.max(paidAmount - netTotal, 0);

  let paymentStatus = "paid";
  if (dueAmount > 0) {
    paymentStatus = paidAmount > 0 ? "partial" : "credit";
  }

  const sale = await Sale.create({
    invoiceNo: `INV-${Date.now()}`,
    customer,
    cashier: req.user?._id,
    items,
    returns,
    orderTotal,
    returnTotal,
    subtotal: orderTotal,
    discount,
    netTotal,
    paidAmount,
    dueAmount,
    balance,
    paymentMethod,
    paymentStatus,
    saleType
  });

  if (returns.length > 0) {
    await Return.create({
      saleId: sale._id,
      invoiceNo: sale.invoiceNo,
      customer,
      cashier: req.user?._id,
      items: returns,
      returnTotal
    });

    const resellableReturns = returns.filter(
      (item) => item.condition === "resellable" && item.productId
    );

    await Promise.all(
      resellableReturns.map(async (item) => {
        const product = await Product.findById(item.productId);
        if (!product) {
          return;
        }

        product.totalStock += item.quantity;
        await product.save();

        await StockBatch.create({
          productId: product._id,
          batchNo: `R-${Date.now()}-${item.itemCode}`,
          billingPrice: item.returnPrice,
          sellingPrice: product.currentSellingPrice,
          quantity: item.quantity,
          remainingQty: item.quantity,
          receivedDate: new Date(),
          createdBy: req.user?._id
        });
      })
    );
  }

  return res.status(201).json(sale);
};

const listSales = async (_req, res) => {
  const sales = await Sale.find().sort({ createdAt: -1 });
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
