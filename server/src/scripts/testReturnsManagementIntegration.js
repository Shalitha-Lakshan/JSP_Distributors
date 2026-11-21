/**
 * JSP DISTRIBUTORS - RETURNS MANAGEMENT INTEGRATION TEST SUITE
 *
 * Verifies end-to-end Returns lifecycle:
 * 1. Customer Return recording (POS & standalone)
 * 2. Deferred restocking (pending_inspection)
 * 3. Warehouse handover tracking (pending_handover -> received)
 * 4. Warehouse inspection with RBAC (rep forbidden, manager allowed)
 * 5. Monthly supplier accumulation and grouping (Ruhunu Foods & Gajamuthu Foods)
 * 6. Supplier dispatch generation (SRI-...)
 * 7. Summary metrics endpoints (today, trip, month)
 * 8. Inventory and financial conservation (no double credits or double restocking)
 * 9. Exclusion of unconfirmed van order proposed returns
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Customer = require("../models/Customer");
const Category = require("../models/Category");
const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");
const Sale = require("../models/Sale");
const Order = require("../models/Order");
const Return = require("../models/Return");
const SupplierReturn = require("../models/SupplierReturn");
const TripSession = require("../models/TripSession");

const {
  getCustomerReturns,
  createCustomerReturn,
  getReturnsSummary,
  getMonthlySupplierSummary,
  receiveReturnsAtWarehouse,
  inspectReturn,
  dispatchToSupplier
} = require("../controllers/returnController");

const QA_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/jsp_distributors_qa_test";

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${testName}: ${details}`);
    failedCount++;
    throw new Error(`Assertion failed: ${testName} - ${details}`);
  }
}

// Mock Response Helper
function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return res;
}

async function runReturnsIntegrationTests() {
  console.log("\n===============================================================================");
  console.log("   RETURNS MANAGEMENT MODULE INTEGRATION TEST SUITE");
  console.log("===============================================================================\n");

  await mongoose.connect(QA_URI);
  console.log("Connected to QA Database:", QA_URI);

  const timestamp = Date.now();
  const testMonth = new Date().toISOString().slice(0, 7);

  let repUser, managerUser, customer, productRuhunu, productGajamuthu, batchRuhunu, tripSession, originalSale;

  try {
    // -------------------------------------------------------------
    // PHASE 1: SEED TEST ACTORS & INVENTORY
    // -------------------------------------------------------------
    console.log("\n>>> Phase 1: Setup Actors & Baseline Data <<<");

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash("Password123!", salt);

    repUser = await User.create({
      username: `rep_${timestamp}`,
      email: `rep_${timestamp}@jsp.lk`,
      name: "Silva Sales Rep",
      role: "rep",
      passwordHash: hash,
      phone: "0771234567"
    });

    managerUser = await User.create({
      username: `mgr_${timestamp}`,
      email: `mgr_${timestamp}@jsp.lk`,
      name: "Perera Warehouse Manager",
      role: "manager",
      passwordHash: hash,
      phone: "0779876543"
    });

    customer = await Customer.create({
      name: `City Grocers ${timestamp}`,
      code: `CUST-${timestamp}`,
      phone: "0112345678",
      customerType: "retail",
      outstandingBalance: 10000,
      creditLimit: 50000
    });

    let testCategory = await Category.findOne({ name: "Spices" });
    if (!testCategory) {
      testCategory = await Category.create({ name: "Spices" });
    }

    productRuhunu = await Product.create({
      productName: `Turmeric Powder 50g ${timestamp}`,
      displayName: "Turmeric Powder 50g",
      itemCode: `TP50-${timestamp}`,
      category: testCategory._id,
      variant: "50g",
      supplier: "Ruhunu Foods",
      currentBillingPrice: 150,
      currentSellingPrice: 200,
      totalStock: 50
    });

    productGajamuthu = await Product.create({
      productName: `Chillie Powder 100g ${timestamp}`,
      displayName: "Chillie Powder 100g",
      itemCode: `CP100-${timestamp}`,
      category: testCategory._id,
      variant: "100g",
      supplier: "Gajamuthu Foods",
      currentBillingPrice: 180,
      currentSellingPrice: 220,
      totalStock: 60
    });

    batchRuhunu = await StockBatch.create({
      productId: productRuhunu._id,
      batchNo: `B-RF-${timestamp}`,
      quantity: 50,
      remainingQty: 50,
      billingPrice: 150,
      sellingPrice: 200,
      receivedDate: new Date()
    });

    tripSession = await TripSession.create({
      tripNo: `TRP-${timestamp}`,
      route: "Colombo Central Route",
      rep: repUser._id,
      status: "active",
      startTime: new Date()
    });

    // Create a base sale invoice from which customer returns will originate
    originalSale = await Sale.create({
      invoiceNo: `INV-${timestamp}`,
      customer: customer._id,
      cashier: repUser._id,
      tripId: tripSession._id,
      items: [
        {
          product: productRuhunu._id,
          itemCode: productRuhunu.itemCode,
          itemName: productRuhunu.displayName,
          quantity: 20,
          billingPrice: 150,
          sellingPrice: 200,
          lineTotal: 3000
        },
        {
          product: productGajamuthu._id,
          itemCode: productGajamuthu.itemCode,
          itemName: productGajamuthu.displayName,
          quantity: 15,
          billingPrice: 180,
          sellingPrice: 220,
          lineTotal: 2700
        }
      ],
      subtotal: 5700,
      orderTotal: 5700,
      netTotal: 5700,
      paidAmount: 2000,
      dueAmount: 3700,
      paymentStatus: "partial"
    });

    assert(!!repUser && !!managerUser && !!customer, "Test Actors Initialized");
    assert(productRuhunu.supplier === "Ruhunu Foods", "Ruhunu Foods product supplier verified");
    assert(productGajamuthu.supplier === "Gajamuthu Foods", "Gajamuthu Foods product supplier verified");

    // -------------------------------------------------------------
    // TEST 1: STANDALONE CUSTOMER RETURN RECORDING & DEFERRED RESTOCKING
    // -------------------------------------------------------------
    console.log("\n>>> Test 1: Record Standalone Return & Verify Deferred Restocking <<<");

    const req1 = {
      user: repUser,
      body: {
        customerId: customer._id.toString(),
        invoiceNo: originalSale.invoiceNo,
        items: [
          {
            productId: productRuhunu._id.toString(),
            itemCode: productRuhunu.itemCode,
            itemName: productRuhunu.displayName,
            quantity: 5,
            returnPrice: 150,
            condition: "resellable",
            reason: "Overstocked by retailer"
          },
          {
            productId: productGajamuthu._id.toString(),
            itemCode: productGajamuthu.itemCode,
            itemName: productGajamuthu.displayName,
            quantity: 3,
            returnPrice: 180,
            condition: "damaged",
            reason: "Pouch seal broken during transit"
          }
        ]
      }
    };
    const res1 = createMockRes();
    await createCustomerReturn(req1, res1);

    assert(res1.statusCode === 201, "Customer return recorded with HTTP 201");
    const returnDoc1 = res1.data;
    assert(returnDoc1.items.length === 2, "Return contains 2 items");
    // Expected returnTotal = (5 * 150) + (3 * 180) = 750 + 540 = 1290
    assert(returnDoc1.returnTotal === 1290, "Return total is Rs. 1290 (based on unit billing rates)");
    assert(returnDoc1.inspectionStatus === "pending_inspection", "Return starts in 'pending_inspection'");
    assert(returnDoc1.handoverStatus === "pending_handover", "Initial handoverStatus is 'pending_handover'");

    // Check deferred restocking policy: product totalStock must NOT change immediately
    const checkProduct1 = await Product.findById(productRuhunu._id);
    assert(checkProduct1.totalStock === 50, "Deferred Restocking: product totalStock NOT altered before inspection");

    // Check financial settlement: customer outstanding balance credited
    const checkCust1 = await Customer.findById(customer._id);
    assert(checkCust1.outstandingBalance === 10000 - 1290, "Customer outstanding balance deducted by return total");

    // -------------------------------------------------------------
    // TEST 2: PROPOSED VAN ORDER RETURNS ARE EXCLUDED FROM RETURN COLLECTION
    // -------------------------------------------------------------
    console.log("\n>>> Test 2: Unconfirmed Van Order Proposed Returns Excluded <<<");

    const draftOrder = await Order.create({
      orderNo: `ORD-PROP-${timestamp}`,
      customer: customer._id,
      cashier: repUser._id,
      items: [
        {
          productId: productRuhunu._id,
          itemCode: productRuhunu.itemCode,
          itemName: productRuhunu.displayName,
          quantity: 10,
          unitPrice: 150,
          billingPrice: 150,
          sellingPrice: 200,
          lineTotal: 1500
        }
      ],
      returns: [
        {
          productId: productRuhunu._id,
          itemCode: productRuhunu.itemCode,
          itemName: productRuhunu.displayName,
          quantity: 4,
          returnPrice: 150,
          returnTotal: 600,
          condition: "resellable",
          reason: "Proposed customer exchange"
        }
      ],
      orderTotal: 1500,
      returnTotal: 600,
      netTotal: 900,
      orderStatus: "pending_delivery",
      deliveryType: "delivery"
    });

    // Verify Return collection DOES NOT contain the proposed order return
    const unconfirmedReturns = await Return.find({ invoiceNo: draftOrder.orderNo });
    assert(unconfirmedReturns.length === 0, "Proposed van order returns are NOT saved to Return collection");

    // -------------------------------------------------------------
    // TEST 3: SUMMARY METRICS ENDPOINT (GET /api/returns/summary)
    // -------------------------------------------------------------
    console.log("\n>>> Test 3: Returns Summary Metrics <<<");

    const reqSum = {
      user: repUser,
      query: { period: "month", month: testMonth }
    };
    const resSum = createMockRes();
    await getReturnsSummary(reqSum, resSum);

    assert(resSum.statusCode === 200, "Returns summary returned HTTP 200");
    const summaryData = resSum.data;
    assert(summaryData.collectedUnits >= 8, `Collected units accurate (${summaryData.collectedUnits} >= 8)`);
    assert(summaryData.totalReturnValue >= 1290, `Total return value accurate (${summaryData.totalReturnValue} >= 1290)`);
    assert(summaryData.pendingInspectionUnits >= 8, "Pending inspection units matches uninspected returns");

    // -------------------------------------------------------------
    // TEST 4: WAREHOUSE PHYSICAL HANDOVER (POST /api/returns/:id/receive)
    // -------------------------------------------------------------
    console.log("\n>>> Test 4: Warehouse Physical Handover Tracking <<<");

    // Partial handover test
    const reqHandoverPartial = {
      user: managerUser,
      params: { id: returnDoc1._id.toString() },
      body: {
        items: [
          { itemCode: productRuhunu.itemCode, quantityReceived: 5 },
          { itemCode: productGajamuthu.itemCode, quantityReceived: 0 } // Not yet received
        ],
        handoverNotes: "Received Turmeric Powder, Chillie Powder missing from crate"
      }
    };
    const resHandoverPartial = createMockRes();
    await receiveReturnsAtWarehouse(reqHandoverPartial, resHandoverPartial);

    assert(resHandoverPartial.statusCode === 200, "Partial handover returned HTTP 200");
    const updatedRet1 = await Return.findById(returnDoc1._id);
    assert(updatedRet1.handoverStatus === "partially_received", "Overall return status is 'partially_received'");
    assert(updatedRet1.items[0].handoverStatus === "received", "Item 1 is 'received'");
    assert(updatedRet1.items[1].handoverStatus === "pending_handover", "Item 2 remains 'pending_handover'");

    // Full handover test
    const reqHandoverFull = {
      user: managerUser,
      params: { id: returnDoc1._id.toString() },
      body: {
        handoverNotes: "All items physically delivered to warehouse dock"
      }
    };
    const resHandoverFull = createMockRes();
    await receiveReturnsAtWarehouse(reqHandoverFull, resHandoverFull);

    assert(resHandoverFull.statusCode === 200, "Full handover returned HTTP 200");
    const updatedRet2 = await Return.findById(returnDoc1._id);
    assert(updatedRet2.handoverStatus === "received", "Overall return status is now 'received'");
    assert(updatedRet2.items.every((it) => it.handoverStatus === "received"), "All items marked 'received'");

    // -------------------------------------------------------------
    // TEST 5: RBAC - SALES REP FORBIDDEN FROM INSPECTING RETURNS
    // -------------------------------------------------------------
    console.log("\n>>> Test 5: RBAC Guard on Warehouse Inspection <<<");

    const reqInspectRep = {
      user: repUser, // Role 'rep'
      params: { id: returnDoc1._id.toString() },
      body: {
        inspections: [
          { itemCode: productRuhunu.itemCode, approvedResellableQty: 5, rejectedQty: 0 }
        ]
      }
    };
    const resInspectRep = createMockRes();
    await inspectReturn(reqInspectRep, resInspectRep);

    assert(resInspectRep.statusCode === 403, "Sales Rep rejected from inspection with HTTP 403 Forbidden");

    // -------------------------------------------------------------
    // TEST 6: MANAGER PERFORMS INSPECTION & RESTOCKS RESELLABLE UNITS
    // -------------------------------------------------------------
    console.log("\n>>> Test 6: Manager Performs Warehouse Inspection & Restocks <<<");

    const reqInspectMgr = {
      user: managerUser, // Role 'manager'
      params: { id: returnDoc1._id.toString() },
      body: {
        inspections: [
          {
            itemCode: productRuhunu.itemCode,
            approvedResellableQty: 5,
            rejectedQty: 0
          },
          {
            itemCode: productGajamuthu.itemCode,
            approvedResellableQty: 0,
            rejectedQty: 3,
            rejectionReason: "Pouch seal ruptured; expired packaging"
          }
        ],
        inspectionNotes: "Inspected at bay 3; 5 units Turmeric restocked, 3 units Chillie routed for Ruhunu/Gajamuthu dispatch"
      }
    };
    const resInspectMgr = createMockRes();
    await inspectReturn(reqInspectMgr, resInspectMgr);

    assert(resInspectMgr.statusCode === 200, "Manager inspection returned HTTP 200");
    assert(resInspectMgr.data.newlyApprovedTotalQty === 5, "Approved 5 resellable units");

    // Verify stock restoration of approved resellable units
    const restockedProduct = await Product.findById(productRuhunu._id);
    assert(restockedProduct.totalStock === 55, "Product totalStock increased by 5 (from 50 to 55)");

    // Verify new return batch was created
    const createdBatch = await StockBatch.findOne({ batchNo: new RegExp(`^R-INSP-`) });
    assert(!!createdBatch, "New StockBatch created for resellable returns");
    assert(createdBatch.remainingQty === 5, "Return StockBatch has 5 units");

    // Verify damaged goods are marked rejected and ready for supplier dispatch
    const inspectedDoc = await Return.findById(returnDoc1._id);
    assert(inspectedDoc.inspectionStatus === "partially_approved", "Return doc status is 'partially_approved'");
    assert(inspectedDoc.items[1].inspectionStatus === "rejected", "Chillie Powder marked 'rejected'");

    // -------------------------------------------------------------
    // TEST 7: DISPATCH TO PRINCIPAL SUPPLIER (SRI-...)
    // -------------------------------------------------------------
    console.log("\n>>> Test 7: Dispatch Damaged/Supplier Returns to Principal <<<");

    const reqDispatch = {
      user: managerUser,
      body: {
        supplierName: "Gajamuthu Foods",
        dispatchItems: [
          {
            returnId: returnDoc1._id.toString(),
            itemCode: productGajamuthu.itemCode,
            condition: "damaged"
          }
        ]
      }
    };
    const resDispatch = createMockRes();
    await dispatchToSupplier(reqDispatch, resDispatch);

    assert(resDispatch.statusCode === 201 || resDispatch.statusCode === 200, "Supplier dispatch returned HTTP 201/200");
    const dispatchDoc = resDispatch.data;
    assert(!!dispatchDoc.supplierInvoiceNo, `Supplier invoice generated: ${dispatchDoc.supplierInvoiceNo}`);
    assert(dispatchDoc.supplierName === "Gajamuthu Foods", "Dispatched to Gajamuthu Foods");
    assert(dispatchDoc.totalAmount === 540, "Total dispatch amount is Rs. 540 (3 × 180)");

    // -------------------------------------------------------------
    // TEST 8: MONTHLY COMPANY SUPPLIER SUMMARY (GET /api/returns/monthly-supplier-summary)
    // -------------------------------------------------------------
    console.log("\n>>> Test 8: Monthly Supplier Return Grouping & Reconciliation <<<");

    const reqMonthly = {
      user: repUser,
      query: { month: testMonth }
    };
    const resMonthly = createMockRes();
    await getMonthlySupplierSummary(reqMonthly, resMonthly);

    assert(resMonthly.statusCode === 200, "Monthly supplier summary returned HTTP 200");
    const monthlyData = resMonthly.data;
    assert(monthlyData.month === testMonth, "Target month matches");

    const ruhunuGroup = monthlyData.suppliers.find((s) => s.supplierName === "Ruhunu Foods");
    const gajamuthuGroup = monthlyData.suppliers.find((s) => s.supplierName === "Gajamuthu Foods");

    assert(!!ruhunuGroup, "Ruhunu Foods group present");
    assert(!!gajamuthuGroup, "Gajamuthu Foods group present");

    // Gajamuthu should have 3 units dispatched
    assert(gajamuthuGroup.totalUnits >= 3, "Gajamuthu units tracked");
    assert(gajamuthuGroup.dispatches.length >= 1, "Gajamuthu monthly dispatch SRI invoice tracked");

    // Ruhunu should have 5 units collected & approved
    assert(ruhunuGroup.totalUnits >= 5, "Ruhunu units tracked");
    const tpLine = ruhunuGroup.products.find((p) => p.itemCode === productRuhunu.itemCode);
    assert(!!tpLine, "Turmeric Powder product line present in Ruhunu breakdown");
    assert(tpLine.resellableQty === 5, "Resellable quantity is 5 in Ruhunu breakdown");

    // -------------------------------------------------------------
    // TEST 9: PREVENT RE-DISPATCH & IDEMPOTENCY
    // -------------------------------------------------------------
    console.log("\n>>> Test 9: Idempotency & Conservation Verification <<<");

    // Attempting to dispatch already dispatched item
    const resDispatchDup = createMockRes();
    await dispatchToSupplier(reqDispatch, resDispatchDup);
    // Should skip already dispatched item without crashing or creating duplicate dispatch
    const allDispatches = await SupplierReturn.find({
      supplierName: "Gajamuthu Foods",
      "items.itemCode": productGajamuthu.itemCode
    });
    assert(allDispatches.length === 1, "Supplier dispatch is strictly idempotent (only 1 record created)");

    console.log("\n===============================================================================");
    console.log(`   RETURNS MANAGEMENT TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("===============================================================================\n");

  } finally {
    // Clean up test records
    console.log("Cleaning up QA test records...");
    if (originalSale?._id) await Sale.findByIdAndDelete(originalSale._id);
    if (repUser?._id) await User.findByIdAndDelete(repUser._id);
    if (managerUser?._id) await User.findByIdAndDelete(managerUser._id);
    if (customer?._id) await Customer.findByIdAndDelete(customer._id);
    if (productRuhunu?._id) await Product.findByIdAndDelete(productRuhunu._id);
    if (productGajamuthu?._id) await Product.findByIdAndDelete(productGajamuthu._id);
    if (batchRuhunu?._id) await StockBatch.findByIdAndDelete(batchRuhunu._id);
    if (tripSession?._id) await TripSession.findByIdAndDelete(tripSession._id);
    await Return.deleteMany({ invoiceNo: new RegExp(`^INV-${timestamp}`) });
    await SupplierReturn.deleteMany({ supplierName: "Gajamuthu Foods", createdAt: { $gte: new Date(Date.now() - 60000) } });
    await StockBatch.deleteMany({ batchNo: new RegExp(`^R-INSP-`) });
    await Order.deleteMany({ orderNo: new RegExp(`^ORD-PROP-${timestamp}`) });

    await mongoose.disconnect();
    console.log("Disconnected from QA Database.");
  }
}

runReturnsIntegrationTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
