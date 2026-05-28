const express = require("express");
const {
  addStock,
  listBatches,
  listBatchesForProduct,
  lowStock
} = require("../controllers/stockController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/add", requireAuth, addStock);
router.get("/batches", requireAuth, listBatches);
router.get("/product/:productId", requireAuth, listBatchesForProduct);
router.get("/low-stock", requireAuth, lowStock);

module.exports = router;
