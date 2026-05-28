const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");

const addStock = async (req, res) => {
  const {
    barcode,
    productId,
    billingPrice,
    sellingPrice,
    quantity,
    expiryDate,
    receivedDate
  } = req.body;

  let product = null;
  if (productId) {
    product = await Product.findById(productId);
  } else if (barcode) {
    product = await Product.findOne({ barcode });
  }

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const batchNo = `B-${Date.now()}`;
  const batch = await StockBatch.create({
    productId: product._id,
    batchNo,
    billingPrice,
    sellingPrice,
    quantity,
    remainingQty: quantity,
    expiryDate,
    receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
    createdBy: req.user?._id
  });

  product.totalStock += quantity;
  product.currentBillingPrice = billingPrice;
  product.currentSellingPrice = sellingPrice;
  await product.save();

  return res.status(201).json(batch);
};

const listBatches = async (_req, res) => {
  const batches = await StockBatch.find().sort({ receivedDate: -1 });
  return res.json(batches);
};

const listBatchesForProduct = async (req, res) => {
  const batches = await StockBatch.find({ productId: req.params.productId }).sort({
    receivedDate: 1
  });
  return res.json(batches);
};

const lowStock = async (_req, res) => {
  const products = await Product.find({ $expr: { $lte: ["$totalStock", "$reorderLevel"] } });
  return res.json(products);
};

module.exports = { addStock, listBatches, listBatchesForProduct, lowStock };
