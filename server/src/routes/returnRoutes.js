const express = require("express");
const {
  getPendingReturns,
  getDispatchHistory,
  dispatchToSupplier,
  createCustomerReturn,
  getCustomerReturns,
  getEligibleInvoices,
  getPendingInspectionReturns,
  inspectReturn,
  getInspectionHistory,
  getReturnsSummary,
  getMonthlySupplierSummary,
  receiveReturnsAtWarehouse
} = require("../controllers/returnController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Summaries & Aggregations
router.get("/summary", requireAuth, getReturnsSummary);
router.get("/monthly-supplier-summary", requireAuth, getMonthlySupplierSummary);

// Sales Rep & Field Returns
router.get("/", requireAuth, getCustomerReturns);
router.post("/", requireAuth, createCustomerReturn);
router.get("/eligible-invoices/:customerId", requireAuth, getEligibleInvoices);

// Warehouse Handover (Warehouse, Manager, Admin, Rep)
router.post("/:id/receive", requireAuth, receiveReturnsAtWarehouse);

// Warehouse Inspection Workflow (Manager / Admin only)
router.get(
  "/pending-inspection",
  requireAuth,
  requireRole(["admin", "manager"]),
  getPendingInspectionReturns
);

router.get(
  "/inspections",
  requireAuth,
  requireRole(["admin", "manager"]),
  getInspectionHistory
);

router.post(
  "/:id/inspect",
  requireAuth,
  requireRole(["admin", "manager"]),
  inspectReturn
);

// Admin / Manager Supplier Dispatches
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
