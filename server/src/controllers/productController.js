const mongoose = require("mongoose");
const Product = require("../models/Product");

const normalizeKeywords = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((keyword) => String(keyword).trim().toLowerCase())
      .filter((keyword) => keyword.length > 0);
  }

  return String(value)
    .split(",")
    .map((keyword) => keyword.trim().toLowerCase())
    .filter((keyword) => keyword.length > 0);
};

const buildDisplayName = (productName, variant) =>
  `${productName || ""} ${variant || ""}`.trim();

const createProduct = async (req, res) => {
  const {
    barcode,
    itemCode,
    productName,
    variant,
    category,
    currentBillingPrice,
    currentSellingPrice,
    reorderLevel,
    status,
    isFastMoving
  } = req.body;

  if (!itemCode || !productName || !variant || !category) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (currentBillingPrice === undefined || currentSellingPrice === undefined) {
    return res.status(400).json({ message: "Prices are required" });
  }

  const normalizedItemCode = String(itemCode).trim().toUpperCase();
  const normalizedBarcode = barcode ? String(barcode).trim() : "";

  const duplicateCode = await Product.findOne({ itemCode: normalizedItemCode });
  if (duplicateCode) {
    return res.status(409).json({ message: "Item code already exists" });
  }

  if (normalizedBarcode) {
    const duplicateBarcode = await Product.findOne({ barcode: normalizedBarcode });
    if (duplicateBarcode) {
      return res.status(409).json({ message: "Barcode already exists" });
    }
  }

  const product = await Product.create({
    barcode: normalizedBarcode || undefined,
    itemCode: normalizedItemCode,
    productName: String(productName).trim(),
    variant: String(variant).trim(),
    displayName: buildDisplayName(productName, variant),
    category,
    searchKeywords: normalizeKeywords(req.body.searchKeywords),
    currentBillingPrice: Number(currentBillingPrice),
    currentSellingPrice: Number(currentSellingPrice),
    reorderLevel: Number(reorderLevel || 0),
    isFastMoving: Boolean(isFastMoving),
    status: status || "active"
  });

  return res.status(201).json(product);
};

const listProducts = async (req, res) => {
  const filter = {};

  if (req.user?.role === "cashier") {
    filter.status = "active";
  } else if (req.query.status) {
    filter.status = req.query.status;
  }

  const products = await Product.find(filter).sort({ createdAt: -1 });
  return res.json(products);
};

const searchProducts = async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) {
    return res.json([]);
  }

  const regex = new RegExp(q.split(" ").join("|"), "i");
  const filter = {
    $or: [
      { itemCode: regex },
      { barcode: regex },
      { productName: regex },
      { variant: regex },
      { displayName: regex },
      { searchKeywords: regex }
    ]
  };

  if (req.user?.role === "cashier") {
    filter.status = "active";
  }

  if (mongoose.isValidObjectId(q)) {
    filter.$or.push({ category: q });
  }

  const products = await Product.find(filter).limit(50);

  return res.json(products);
};

const getProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }
  return res.json(product);
};

const updateProduct = async (req, res) => {
  const updates = { ...req.body };

  if (updates.itemCode) {
    updates.itemCode = String(updates.itemCode).trim().toUpperCase();
    const duplicateCode = await Product.findOne({
      itemCode: updates.itemCode,
      _id: { $ne: req.params.id }
    });
    if (duplicateCode) {
      return res.status(409).json({ message: "Item code already exists" });
    }
  }

  if (updates.barcode !== undefined) {
    updates.barcode = String(updates.barcode).trim();
    if (updates.barcode.length === 0) {
      updates.barcode = undefined;
    } else {
      const duplicateBarcode = await Product.findOne({
        barcode: updates.barcode,
        _id: { $ne: req.params.id }
      });
      if (duplicateBarcode) {
        return res.status(409).json({ message: "Barcode already exists" });
      }
    }
  }

  if (updates.productName || updates.variant) {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    updates.displayName = buildDisplayName(
      updates.productName || product.productName,
      updates.variant || product.variant
    );
  }

  if (updates.searchKeywords) {
    updates.searchKeywords = normalizeKeywords(updates.searchKeywords);
  }

  const product = await Product.findByIdAndUpdate(req.params.id, updates, {
    new: true
  });
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }
  return res.json(product);
};

const getProductByBarcode = async (req, res) => {
  const barcode = String(req.params.barcode || "").trim();
  const product = await Product.findOne({ barcode });

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  if (product.status !== "active" && req.user?.role === "cashier") {
    return res.status(403).json({ message: "Product inactive" });
  }

  return res.json(product);
};

const deleteProduct = async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }
  return res.json({ message: "Deleted" });
};

module.exports = {
  createProduct,
  listProducts,
  searchProducts,
  getProduct,
  getProductByBarcode,
  updateProduct,
  deleteProduct
};
