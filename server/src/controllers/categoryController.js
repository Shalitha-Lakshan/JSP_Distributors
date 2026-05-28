const Category = require("../models/Category");

const listCategories = async (req, res) => {
  const filter = {};

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const categories = await Category.find(filter).sort({ name: 1 });
  return res.json(categories);
};

const createCategory = async (req, res) => {
  const { name, status } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Category name is required" });
  }

  const normalized = String(name).trim();
  const existing = await Category.findOne({ name: normalized });
  if (existing) {
    return res.status(409).json({ message: "Category already exists" });
  }

  const category = await Category.create({
    name: normalized,
    status: status || "active"
  });

  return res.status(201).json(category);
};

module.exports = { listCategories, createCategory };
