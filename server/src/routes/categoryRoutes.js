const express = require("express");
const { listCategories, createCategory } = require("../controllers/categoryController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, listCategories);
router.post("/", requireAuth, requireRole(["admin", "manager"]), createCategory);

module.exports = router;
