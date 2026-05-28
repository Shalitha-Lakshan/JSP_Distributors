const express = require("express");
const {
  createOrder,
  listOrders,
  getOrder,
  updateOrder,
  cancelOrder,
  deliverOrder
} = require("../controllers/orderController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, listOrders);
router.post("/", requireAuth, requireRole(["admin", "manager", "cashier"]), createOrder);
router.get("/:id", requireAuth, getOrder);
router.put("/:id", requireAuth, requireRole(["admin", "manager", "cashier"]), updateOrder);
router.patch("/:id/cancel", requireAuth, cancelOrder);
router.post("/:id/deliver", requireAuth, deliverOrder);

module.exports = router;
