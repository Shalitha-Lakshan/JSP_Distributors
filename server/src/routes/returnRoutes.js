const express = require("express");
const {
  getPendingReturns,
  getDispatchHistory,
  dispatchToSupplier
} = require("../controllers/returnController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// All return routes require authentication and manager or admin roles
router.get(
  "/pending",
  requireAuth,
  requireRole(["admin", "manager"]),
  getPendingReturns
);

router.get(
  "/dispatched",
  requireAuth,
  requireRole(["admin", "manager"]),
  getDispatchHistory
);

router.post(
  "/dispatch",
  requireAuth,
  requireRole(["admin", "manager"]),
  dispatchToSupplier
);

module.exports = router;
