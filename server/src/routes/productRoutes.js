const express = require("express");
const {
  createProduct,
  listProducts,
  searchProducts,
  getProduct,
  updateProduct,
  deleteProduct
} = require("../controllers/productController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/search", requireAuth, searchProducts);
router.get("/", requireAuth, listProducts);
router.post("/", requireAuth, requireRole(["admin", "manager"]), createProduct);
router.get("/:id", requireAuth, getProduct);
router.put("/:id", requireAuth, requireRole(["admin", "manager"]), updateProduct);
router.delete("/:id", requireAuth, requireRole(["admin"]), deleteProduct);

module.exports = router;
