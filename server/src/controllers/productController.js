const mongoose = require("mongoose");
const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");

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

/**
 * Authoritative serializer for product documents.
 * Ensures currentBillingPrice and customerBillingPrice are both populated and consistent.
 * Strictly strips internal supplier acquisition costs, batch costs, and margins.
 * Sanitizes and attaches eligible FIFO batches and price range when available.
 */
const serializeProduct = (doc) => {
  if (!doc) return null;
  const obj = typeof doc.toObject === "function" ? doc.toObject({ virtuals: true }) : { ...doc };

  const billingPrice =
    obj.currentBillingPrice !== undefined
      ? Number(obj.currentBillingPrice)
      : obj.customerBillingPrice !== undefined
      ? Number(obj.customerBillingPrice)
      : 0;

  const sellingPrice =
    obj.currentSellingPrice !== undefined ? Number(obj.currentSellingPrice) : 0;

  obj.currentBillingPrice = isNaN(billingPrice) ? 0 : billingPrice;
  obj.customerBillingPrice = obj.currentBillingPrice;
  obj.currentSellingPrice = isNaN(sellingPrice) ? 0 : sellingPrice;

  // Strict boundary: Never expose internal supplier costs or margin fields
  delete obj.currentCostPrice;
  delete obj.supplierCostPrice;
  delete obj.batchCost;
  delete obj.costPrice;
  delete obj.margin;

  // Sanitize and sort batches if attached
  if (Array.isArray(obj.batches)) {
    obj.batches = obj.batches
      .filter((b) => Number(b.remainingQty || 0) > 0)
      .map((b) => ({
        _id: b._id,
        batchNo: b.batchNo,
        productId: b.productId,
        billingPrice: Number(b.billingPrice || 0),
        sellingPrice: Number(b.sellingPrice || obj.currentSellingPrice || 0),
        quantity: Number(b.quantity || 0),
        remainingQty: Number(b.remainingQty || 0),
        expiryDate: b.expiryDate,
        receivedDate: b.receivedDate,
        createdAt: b.createdAt
      }))
      .sort((a, b) => {
        const dateA = new Date(a.receivedDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.receivedDate || b.createdAt || 0).getTime();
        if (dateA !== dateB) return dateA - dateB;
        const createdA = new Date(a.createdAt || 0).getTime();
        const createdB = new Date(b.createdAt || 0).getTime();
        if (createdA !== createdB) return createdA - createdB;
        return String(a.batchNo || a._id).localeCompare(String(b.batchNo || b._id));
      });

    if (obj.batches.length > 0) {
      const prices = obj.batches.map((b) => b.billingPrice);
      obj.minBillingPrice = Math.min(...prices);
      obj.maxBillingPrice = Math.max(...prices);
      obj.hasMultiplePrices = obj.minBillingPrice !== obj.maxBillingPrice;
    } else {
      obj.minBillingPrice = obj.currentBillingPrice;
      obj.maxBillingPrice = obj.currentBillingPrice;
      obj.hasMultiplePrices = false;
    }
  }

  return obj;
};

const attachBatchesToProducts = async (products) => {
  if (!products || !products.length) return [];
  const productIds = products.map((p) => p._id);
  const batches = await StockBatch.find({
    productId: { $in: productIds },
    remainingQty: { $gt: 0 }
  }).sort({ receivedDate: 1, createdAt: 1, _id: 1 });

  const batchesByProduct = new Map();
  for (const b of batches) {
    const key = b.productId.toString();
    if (!batchesByProduct.has(key)) batchesByProduct.set(key, []);
    batchesByProduct.get(key).push(b);
  }

  return products.map((p) => {
    const obj = typeof p.toObject === "function" ? p.toObject({ virtuals: true }) : { ...p };
    obj.batches = batchesByProduct.get(obj._id.toString()) || [];
    return serializeProduct(obj);
  });
};

const createProduct = async (req, res) => {
  const {
    barcode,
    itemCode,
    productName,
    variant,
    category,
    currentBillingPrice,
    customerBillingPrice,
    currentSellingPrice,
    reorderLevel,
    status,
    isFastMoving,
    supplier
  } = req.body;

  if (!itemCode || !productName || !variant || !category) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const effectiveBillingPrice = currentBillingPrice !== undefined ? currentBillingPrice : customerBillingPrice;

  if (effectiveBillingPrice === undefined || currentSellingPrice === undefined) {
    return res.status(400).json({ message: "Prices are required" });
  }

  const numBillingPrice = Number(effectiveBillingPrice);
  const numSellingPrice = Number(currentSellingPrice);
  if (isNaN(numBillingPrice) || numBillingPrice < 0 || isNaN(numSellingPrice) || numSellingPrice < 0) {
    return res.status(400).json({ message: "Prices must be valid non-negative numbers" });
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
    currentBillingPrice: numBillingPrice,
    currentSellingPrice: numSellingPrice,
    reorderLevel: Number(reorderLevel || 0),
    isFastMoving: Boolean(isFastMoving),
    status: status || "active",
    supplier: supplier || "Ruhunu Foods"
  });

  return res.status(201).json(serializeProduct(product));
};

const listProducts = async (req, res) => {
  const filter = {};

  if (req.user?.role === "rep") {
    filter.status = "active";
  } else if (req.query.status) {
    filter.status = req.query.status;
  }

  const products = await Product.find(filter).sort({ createdAt: -1 });
  return res.json(await attachBatchesToProducts(products));
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

  if (req.user?.role === "rep") {
    filter.status = "active";
  }

  if (mongoose.isValidObjectId(q)) {
    filter.$or.push({ category: q });
  }

  const products = await Product.find(filter).limit(50);

  return res.json(await attachBatchesToProducts(products));
};

const getProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }
  const [attached] = await attachBatchesToProducts([product]);
  return res.json(attached);
};

const updateProduct = async (req, res) => {
  const updates = { ...req.body };

  if (updates.customerBillingPrice !== undefined && updates.currentBillingPrice === undefined) {
    updates.currentBillingPrice = updates.customerBillingPrice;
  }

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
  return res.json(serializeProduct(product));
};

const getProductByBarcode = async (req, res) => {
  const barcode = String(req.params.barcode || "").trim();
  const product = await Product.findOne({ barcode });

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  if (product.status !== "active" && req.user?.role === "rep") {
    return res.status(403).json({ message: "Product inactive" });
  }

  const [attached] = await attachBatchesToProducts([product]);
  return res.json(attached);
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
