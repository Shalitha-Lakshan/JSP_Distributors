const express = require("express");
const {
  startTrip,
  getActiveTrip,
  submitAudit,
  approveTrip,
  listTrips,
  getTripDetails,
  addExpense,
  deleteExpense
} = require("../controllers/tripController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/active", requireAuth, getActiveTrip);
router.post("/start", requireAuth, startTrip);
router.post("/submit-audit", requireAuth, submitAudit);
router.post("/active/expenses", requireAuth, addExpense);
router.delete("/active/expenses/:index", requireAuth, deleteExpense);
router.get("/", requireAuth, listTrips);
router.get("/:id", requireAuth, getTripDetails);
router.post("/:id/approve", requireAuth, requireRole(["manager", "admin"]), approveTrip);

module.exports = router;
