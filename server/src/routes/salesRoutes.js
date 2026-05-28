const express = require("express");
const {
  createSale,
  listSales,
  getSale,
  getSaleByInvoice,
  cancelSale,
  getSalePdf
} = require("../controllers/salesController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/", requireAuth, createSale);
router.get("/", requireAuth, listSales);
router.get("/invoice/:invoiceNo", requireAuth, getSaleByInvoice);
router.get("/:id", requireAuth, getSale);
router.patch("/:id/cancel", requireAuth, requireRole(["admin"]), cancelSale);
router.get("/:id/pdf", requireAuth, getSalePdf);

module.exports = router;
