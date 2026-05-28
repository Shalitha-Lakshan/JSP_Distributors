const Product = require("../models/Product");

const createProduct = async (req, res) => {
  const product = await Product.create(req.body);
  return res.status(201).json(product);
};

const listProducts = async (_req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  return res.json(products);
};

const searchProducts = async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) {
    return res.json([]);
  }

  const regex = new RegExp(q.split(" ").join("|"), "i");
  const products = await Product.find({
    $or: [
      { itemCode: regex },
      { productName: regex },
      { variant: regex },
      { displayName: regex },
      { searchKeywords: regex }
    ]
  }).limit(50);

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
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true
  });
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
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
  updateProduct,
  deleteProduct
};
