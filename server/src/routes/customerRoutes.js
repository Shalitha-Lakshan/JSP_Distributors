const express = require("express");
const {
  createCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getLedger
} = require("../controllers/customerController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, listCustomers);
router.post("/", requireAuth, createCustomer);
router.get("/:id", requireAuth, getCustomer);
router.put("/:id", requireAuth, updateCustomer);
router.delete("/:id", requireAuth, requireRole(["admin", "manager"]), deleteCustomer);
router.get("/:id/ledger", requireAuth, getLedger);

module.exports = router;
