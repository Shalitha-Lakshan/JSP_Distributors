const express = require("express");
const {
  receivePayment,
  getPayment,
  listPayments,
  listPaymentsByCustomer
} = require("../controllers/paymentController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/receive", requireAuth, receivePayment);
router.get("/", requireAuth, listPayments);
router.get("/customer/:customerId", requireAuth, listPaymentsByCustomer);
router.get("/:id", requireAuth, getPayment);

module.exports = router;
