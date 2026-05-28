const express = require("express");
const {
  getDailyClosing,
  getMonthlySales,
  getItemWise,
  getCustomerWise,
  getCreditOutstanding,
  getPaymentCollections,
  getManagerDashboard
} = require("../controllers/reportController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/daily-closing", requireAuth, requireRole(["admin", "manager"]), getDailyClosing);
router.get("/monthly-sales", requireAuth, requireRole(["admin", "manager"]), getMonthlySales);
router.get("/item-wise", requireAuth, requireRole(["admin", "manager"]), getItemWise);
router.get("/customer-wise", requireAuth, requireRole(["admin", "manager"]), getCustomerWise);
router.get("/credit-outstanding", requireAuth, requireRole(["admin", "manager"]), getCreditOutstanding);
router.get("/payment-collections", requireAuth, requireRole(["admin", "manager"]), getPaymentCollections);
router.get(
  "/manager-dashboard",
  requireAuth,
  requireRole(["admin", "manager"]),
  getManagerDashboard
);

module.exports = router;
