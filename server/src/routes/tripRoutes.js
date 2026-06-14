const express = require("express");
const {
  startTrip,
  getActiveTrip,
  submitAudit,
  approveTrip,
  listTrips,
  getTripDetails
} = require("../controllers/tripController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/active", requireAuth, getActiveTrip);
router.post("/start", requireAuth, startTrip);
router.post("/submit-audit", requireAuth, submitAudit);
router.get("/", requireAuth, listTrips);
router.get("/:id", requireAuth, getTripDetails);
router.post("/:id/approve", requireAuth, requireRole(["manager", "admin"]), approveTrip);

module.exports = router;
