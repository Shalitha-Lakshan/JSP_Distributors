const express = require("express");
const {
  createSale,
  listSales,
  getSale,
  getSaleByInvoice,
  cancelSale,
  getSalePdf,
  tabletCleanup
} = require("../controllers/salesController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/", requireAuth, createSale);
router.get("/", requireAuth, listSales);

// ── Must be registered BEFORE /:id routes so 'tablet-cleanup' is not
//    treated as a Mongo ObjectId parameter.
router.delete("/tablet-cleanup", requireAuth, requireRole(["admin"]), tabletCleanup);

router.get("/invoice/:invoiceNo", requireAuth, getSaleByInvoice);
router.get("/:id", requireAuth, getSale);
router.patch("/:id/cancel", requireAuth, requireRole(["admin"]), cancelSale);
router.get("/:id/pdf", requireAuth, getSalePdf);

module.exports = router;
