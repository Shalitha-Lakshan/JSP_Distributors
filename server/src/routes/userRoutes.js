const express = require("express");
const {
  listPendingUsers,
  listUsers,
  approveUser,
  rejectUser,
  updateStatus,
  updateRole
} = require("../controllers/userController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/pending", requireAuth, requireRole(["admin"]), listPendingUsers);
router.get("/", requireAuth, requireRole(["admin"]), listUsers);
router.patch("/:id/approve", requireAuth, requireRole(["admin"]), approveUser);
router.patch("/:id/reject", requireAuth, requireRole(["admin"]), rejectUser);
router.patch("/:id/status", requireAuth, requireRole(["admin"]), updateStatus);
router.patch("/:id/role", requireAuth, requireRole(["admin"]), updateRole);

module.exports = router;
