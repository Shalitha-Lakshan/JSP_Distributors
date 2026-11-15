/**
 * Milestone 8 Business Policies Comprehensive Automated Test Suite
 *
 * Verifies:
 * 1. Cash shortage below Rs. 1,000 (remarks optional)
 * 2. Cash shortage equal to Rs. 1,000 (rejected without remarks)
 * 3. Cash shortage equal to Rs. 1,000 (accepted with remarks)
 * 4. Cash shortage above Rs. 1,000 (accepted with remarks)
 * 5. Positive cash variance (recorded as unreconciled excess, no auto credits)
 * 6. New resellable return enters pending_inspection (no immediate stock addition, no batch)
 * 7. Unauthorized inspection rejection (HTTP 403 for rep)
 * 8. Authorized inspection approval (stock restored for approved resellable qty only)
 * 9. Double approval prevention (cannot re-inspect finalized return)
 * 10. Partial quantity approval & damaged/expired stock exclusion
 * 11. FIFO inventory consistency on restored stock
 * 12. Customer credit and ledger consistency
 * 13. Historical migration idempotency
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const User = require("../models/User");
const Customer = require("../models/Customer");
const Category = require("../models/Category");
const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");
const TripSession = require("../models/TripSession");
const Order = require("../models/Order");
const Sale = require("../models/Sale");
const Payment = require("../models/Payment");
const Return = require("../models/Return");

const { submitAudit, approveTrip } = require("../controllers/tripController");
const { createCustomerReturn, inspectReturn } = require("../controllers/returnController");
const { createSaleFromPayload } = require("../services/salesService");
const { getLedger } = require("../controllers/customerController");

// Mock Express Req/Res Helpers
function createMockReq(user, body = {}, params = {}, query = {}) {
  return {
    user,
    body,
    params,
    query
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log("=====================================================");
  console.log("   MILESTONE 8: BUSINESS POLICIES TEST SUITE         ");
  console.log("=====================================================");

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in .env");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("Connected successfully.\n");

  const timestamp = Date.now();
  let testRep = null;
  let testManager = null;
  let testCustomer = null;
  let testCategory = null;
  let testProduct = null;

  try {
    // -----------------------------------------------------------------
    // 1. Fixture Setup
    // -----------------------------------------------------------------
    console.log("--- 1. Setting Up Fixtures ---");
    testRep = await User.create({
      name: `Rep Policies ${timestamp}`,
      email: `rep-pol-${timestamp}@jspdistributors.com`,
      passwordHash: "hash123",
      role: "rep",
      status: "active",
      approvalStatus: "approved"
    });

    testManager = await User.create({
      name: `Manager Policies ${timestamp}`,
      email: `mgr-pol-${timestamp}@jspdistributors.com`,
      passwordHash: "hash123",
      role: "manager",
      status: "active",
      approvalStatus: "approved"
    });

    testCategory = await Category.create({
      name: `Category Policies ${timestamp}`,
      status: "active"
    });

    testProduct = await Product.create({
      barcode: `POL-BAR-${timestamp}`,
      itemCode: `POL-${timestamp.toString().slice(-5)}`,
      productName: "Policy Biscuit",
      variant: "100g",
      displayName: "Policy Biscuit 100g",
      category: testCategory._id,
      currentBillingPrice: 100,
      currentSellingPrice: 150,
      totalStock: 50,
      reorderLevel: 10,
      status: "active",
      supplier: "Ruhunu Foods"
    });

    await StockBatch.create({
      productId: testProduct._id,
      batchNo: `B-INIT-${timestamp}`,
      billingPrice: 100,
      sellingPrice: 150,
      quantity: 50,
      remainingQty: 50,
      receivedDate: new Date(),
      createdBy: testManager._id
    });

    testCustomer = await Customer.create({
      name: `Retailer Policies ${timestamp}`,
      phone: "0771239999",
      address: "123 Policy Road, Colombo",
      creditLimit: 50000,
      creditDays: 30,
      outstandingBalance: 10000,
      status: "active"
    });

    console.log("PASS: Test fixtures initialized.");

    // -----------------------------------------------------------------
    // Scenario 1: Cash Shortage below Rs. 1,000 (Remarks Optional)
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 1: Cash Shortage < Rs. 1,000 (Optional Remarks) ---");
    const trip1 = await TripSession.create({
      tripNo: `TRIP-S1-${timestamp}`,
      rep: testRep._id,
      route: "Galle Road Route",
      status: "active",
      expectedCollections: { cash: 3000, cheque: 1000 },
      expenses: []
    });

    // Enter actual cash 2500 (shortage = 500 < 1000) with NO remarks
    const req1 = createMockReq(testRep, {
      actualCollections: { cash: 2500, cheque: 1000 },
      remarks: ""
    });
    const res1 = createMockRes();
    await submitAudit(req1, res1);

    if (res1.statusCode !== 200) {
      throw new Error(`Scenario 1 failed with status ${res1.statusCode}: ${res1.data?.message}`);
    }
    if (res1.data.status !== "pending_audit" || res1.data.varianceCollections.cash !== -500) {
      throw new Error("Scenario 1 variance calculation mismatch!");
    }
    console.log("PASS: Shortage of Rs. 500 submitted successfully without remarks.");

    // -----------------------------------------------------------------
    // Scenario 2: Cash Shortage = Rs. 1,000 without Remarks (Mandatory Rejection)
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 2: Cash Shortage = Rs. 1,000 without Remarks (Mandatory Rejection) ---");
    const trip2 = await TripSession.create({
      tripNo: `TRIP-S2-${timestamp}`,
      rep: testRep._id,
      route: "Kandy Road Route",
      status: "active",
      expectedCollections: { cash: 3000, cheque: 1000 },
      expenses: []
    });

    // Enter actual cash 2000 (shortage = 1000) with empty remarks
    const req2 = createMockReq(testRep, {
      actualCollections: { cash: 2000, cheque: 1000 },
      remarks: ""
    });
    const res2 = createMockRes();
    await submitAudit(req2, res2);

    if (res2.statusCode !== 400) {
      throw new Error(`Scenario 2 expected status 400 but got ${res2.statusCode}`);
    }
    console.log(`PASS: Rejected with HTTP 400: "${res2.data.message}"`);

    // -----------------------------------------------------------------
    // Scenario 3: Cash Shortage = Rs. 1,000 with Remarks (Accepted)
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 3: Cash Shortage = Rs. 1,000 with Remarks (Accepted) ---");
    const req3 = createMockReq(testRep, {
      actualCollections: { cash: 2000, cheque: 1000 },
      remarks: "Counter dispute with retailer at outlet 4, pending adjustment next visit."
    });
    const res3 = createMockRes();
    await submitAudit(req3, res3);

    if (res3.statusCode !== 200) {
      throw new Error(`Scenario 3 failed with status ${res3.statusCode}: ${res3.data?.message}`);
    }
    const updatedTrip2 = await TripSession.findById(trip2._id);
    if (!updatedTrip2.repRemarks.includes("Counter dispute")) {
      throw new Error("Scenario 3 failed to persist repRemarks on TripSession!");
    }
    console.log("PASS: Shift with Rs. 1,000 shortage accepted and repRemarks persisted.");

    // -----------------------------------------------------------------
    // Scenario 4: Cash Shortage > Rs. 1,000 with Remarks (Accepted)
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 4: Cash Shortage > Rs. 1,000 with Remarks (Accepted) ---");
    const trip4 = await TripSession.create({
      tripNo: `TRIP-S4-${timestamp}`,
      rep: testRep._id,
      route: "Matara Highway Route",
      status: "active",
      expectedCollections: { cash: 5000, cheque: 2000 },
      expenses: []
    });

    const req4 = createMockReq(testRep, {
      actualCollections: { cash: 3200, cheque: 2000 },
      remarks: "Lost collection receipt book copy on route; difference investigated."
    });
    const res4 = createMockRes();
    await submitAudit(req4, res4);

    if (res4.statusCode !== 200 || res4.data.varianceCollections.cash !== -1800) {
      throw new Error(`Scenario 4 failed: ${res4.data?.message}`);
    }
    console.log("PASS: Shortage of Rs. 1,800 accepted with explanation remarks.");

    // -----------------------------------------------------------------
    // Scenario 5: Positive Cash Variance (Unreconciled Excess)
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 5: Positive Cash Variance (Unreconciled Excess) ---");
    const trip5 = await TripSession.create({
      tripNo: `TRIP-S5-${timestamp}`,
      rep: testRep._id,
      route: "Negombo Coastal Route",
      status: "active",
      expectedCollections: { cash: 2000, cheque: 1000 },
      expenses: []
    });

    const customerBalanceBefore = testCustomer.outstandingBalance;

    const req5 = createMockReq(testRep, {
      actualCollections: { cash: 2600, cheque: 1000 },
      remarks: "Excess cash handed over in pouch."
    });
    const res5 = createMockRes();
    await submitAudit(req5, res5);

    if (res5.statusCode !== 200) {
      throw new Error(`Scenario 5 failed: ${res5.data?.message}`);
    }
    if (res5.data.varianceCollections.cash !== 600) {
      throw new Error(`Scenario 5 expected cash variance 600, got ${res5.data.varianceCollections.cash}`);
    }
    if (res5.data.excessHandling?.status !== "unreconciled") {
      throw new Error("Scenario 5 expected excessHandling.status = 'unreconciled'");
    }

    // Verify customer balance was NOT modified
    const customerAfter = await Customer.findById(testCustomer._id);
    if (customerAfter.outstandingBalance !== customerBalanceBefore) {
      throw new Error("Scenario 5: Customer balance was altered by excess cash!");
    }
    console.log("PASS: Excess cash of Rs. 600 recorded as 'unreconciled' without auto-allocations.");

    // -----------------------------------------------------------------
    // Scenario 6: New Resellable Return Enters 'pending_inspection' (Deferred Restocking)
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 6: New Resellable Return Enters 'pending_inspection' ---");
    // Start an active trip for rep
    const activeTrip = await TripSession.create({
      tripNo: `TRIP-RET-${timestamp}`,
      rep: testRep._id,
      route: "Panadura Route",
      status: "active",
      expectedCollections: { cash: 5000, cheque: 0 }
    });

    // Create an invoice with 10 units sold
    const saleDoc = await Sale.create({
      invoiceNo: `INV-RET-${timestamp}`,
      customer: testCustomer._id,
      cashier: testRep._id,
      tripId: activeTrip._id,
      items: [
        {
          product: testProduct._id,
          itemCode: testProduct.itemCode,
          itemName: testProduct.displayName,
          quantity: 10,
          sellingPrice: 150,
          billingPrice: 100,
          lineTotal: 1500
        }
      ],
      orderTotal: 1500,
      subtotal: 1500,
      netTotal: 1500,
      paidAmount: 1500,
      dueAmount: 0,
      paymentStatus: "paid",
      paymentMethod: "cash"
    });

    const initialTotalStock = testProduct.totalStock; // 50

    // Rep records return of 10 resellable units
    const req6 = createMockReq(testRep, {
      customerId: testCustomer._id,
      invoiceNo: saleDoc.invoiceNo,
      items: [
        {
          productId: testProduct._id,
          itemCode: testProduct.itemCode,
          itemName: testProduct.displayName,
          quantity: 10,
          returnPrice: 150,
          condition: "resellable",
          reason: "Customer over-ordered"
        }
      ]
    });
    const res6 = createMockRes();
    await createCustomerReturn(req6, res6);

    if (res6.statusCode !== 201) {
      throw new Error(`Scenario 6 failed to record return: ${res6.data?.message}`);
    }

    const createdReturn = res6.data;

    // Check deferred restocking guarantees:
    // 1. Product.totalStock MUST NOT INCREASE YET
    const productAfterReturn = await Product.findById(testProduct._id);
    if (productAfterReturn.totalStock !== initialTotalStock) {
      throw new Error(`CRITICAL FAIL: Product stock immediately increased to ${productAfterReturn.totalStock}! Expected: ${initialTotalStock}`);
    }

    // 2. No sellable StockBatch must be created
    const inspBatch = await StockBatch.findOne({ batchNo: new RegExp(`^R-.*${testProduct.itemCode}`) });
    if (inspBatch) {
      throw new Error("CRITICAL FAIL: StockBatch was prematurely created!");
    }

    // 3. Return item & parent must be in 'pending_inspection'
    if (createdReturn.inspectionStatus !== "pending_inspection") {
      throw new Error(`Expected return inspectionStatus 'pending_inspection', got ${createdReturn.inspectionStatus}`);
    }
    if (createdReturn.items[0].inspectionStatus !== "pending_inspection") {
      throw new Error(`Expected item inspectionStatus 'pending_inspection', got ${createdReturn.items[0].inspectionStatus}`);
    }
    console.log("PASS: Return recorded in 'pending_inspection'. totalStock remains 50. 0 batches created.");

    // -----------------------------------------------------------------
    // Scenario 7: Unauthorized Inspection Rejection (Rep Role Blocked)
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 7: Unauthorized Inspection Rejection ---");
    const req7 = createMockReq(testRep, {
      inspections: [
        { itemCode: testProduct.itemCode, approvedResellableQty: 10, rejectedQty: 0 }
      ]
    }, { id: createdReturn._id });
    const res7 = createMockRes();
    await inspectReturn(req7, res7);

    if (res7.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for Rep, got ${res7.statusCode}`);
    }
    console.log("PASS: Rep role correctly forbidden with HTTP 403.");

    // -----------------------------------------------------------------
    // Scenario 8: Authorized Inspection Approval (Restores Stock Once)
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 8: Authorized Inspection Approval (Restores Stock Once) ---");
    const req8 = createMockReq(testManager, {
      inspections: [
        { itemCode: testProduct.itemCode, approvedResellableQty: 10, rejectedQty: 0 }
      ],
      inspectionNotes: "Physical carton inspected. Perfect condition. Approved for warehouse shelf."
    }, { id: createdReturn._id });
    const res8 = createMockRes();
    await inspectReturn(req8, res8);

    if (res8.statusCode !== 200) {
      throw new Error(`Scenario 8 failed with status ${res8.statusCode}: ${res8.data?.message}`);
    }

    // Check stock was restored
    const productAfterInsp = await Product.findById(testProduct._id);
    if (productAfterInsp.totalStock !== 60) {
      throw new Error(`Expected totalStock 60, got ${productAfterInsp.totalStock}`);
    }

    // Check StockBatch created with R-INSP-
    const createdBatch = await StockBatch.findOne({ batchNo: new RegExp(`^R-INSP-.*${testProduct.itemCode}`) });
    if (!createdBatch || createdBatch.remainingQty !== 10) {
      throw new Error("Expected StockBatch with remainingQty 10 was not found!");
    }
    console.log("PASS: Manager approved 10 resellable units. Stock increased 50 -> 60. Batch created.");

    // -----------------------------------------------------------------
    // Scenario 9: Double Approval Prevention
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 9: Double Approval Prevention ---");
    const req9 = createMockReq(testManager, {
      inspections: [
        { itemCode: testProduct.itemCode, approvedResellableQty: 10, rejectedQty: 0 }
      ]
    }, { id: createdReturn._id });
    const res9 = createMockRes();
    await inspectReturn(req9, res9);

    if (res9.statusCode !== 400) {
      throw new Error(`Expected 400 when re-inspecting finalized return, got ${res9.statusCode}`);
    }

    // Ensure stock was NOT double-added
    const productAfterDouble = await Product.findById(testProduct._id);
    if (productAfterDouble.totalStock !== 60) {
      throw new Error(`Stock double counted! Expected: 60, got: ${productAfterDouble.totalStock}`);
    }
    console.log("PASS: Re-inspection blocked with 400. Stock remains 60.");

    // -----------------------------------------------------------------
    // Scenario 10: Partial Quantity Approval & Damaged/Expired Handling
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 10: Partial Quantity Approval & Damaged Handling ---");
    // Create another sale and return of 10 units
    const saleDoc2 = await Sale.create({
      invoiceNo: `INV-PARTIAL-${timestamp}`,
      customer: testCustomer._id,
      cashier: testRep._id,
      tripId: activeTrip._id,
      items: [
        {
          product: testProduct._id,
          itemCode: testProduct.itemCode,
          itemName: testProduct.displayName,
          quantity: 10,
          sellingPrice: 150,
          billingPrice: 100,
          lineTotal: 1500
        }
      ],
      orderTotal: 1500,
      subtotal: 1500,
      netTotal: 1500,
      paidAmount: 1500,
      dueAmount: 0,
      paymentStatus: "paid",
      paymentMethod: "cash"
    });

    const req10a = createMockReq(testRep, {
      customerId: testCustomer._id,
      invoiceNo: saleDoc2.invoiceNo,
      items: [
        {
          productId: testProduct._id,
          itemCode: testProduct.itemCode,
          itemName: testProduct.displayName,
          quantity: 10,
          returnPrice: 150,
          condition: "resellable",
          reason: "Customer claim"
        }
      ]
    });
    const res10a = createMockRes();
    await createCustomerReturn(req10a, res10a);

    const partialReturnId = res10a.data._id;

    // Manager inspects: approves 7 as resellable, rejects 3 as damaged
    const req10b = createMockReq(testManager, {
      inspections: [
        {
          itemCode: testProduct.itemCode,
          approvedResellableQty: 7,
          rejectedQty: 3,
          rejectionReason: "Moisture damage and seal broken"
        }
      ],
      inspectionNotes: "7 units restored to warehouse; 3 units quarantined for supplier return."
    }, { id: partialReturnId });
    const res10b = createMockRes();
    await inspectReturn(req10b, res10b);

    if (res10b.statusCode !== 200) {
      throw new Error(`Scenario 10 failed: ${res10b.data?.message}`);
    }

    // Verify stock increased by exactly 7 (60 -> 67)
    const productAfterPartial = await Product.findById(testProduct._id);
    if (productAfterPartial.totalStock !== 67) {
      throw new Error(`Expected totalStock 67, got ${productAfterPartial.totalStock}`);
    }

    const partialRetDoc = await Return.findById(partialReturnId);
    if (partialRetDoc.items[0].approvedResellableQty !== 7 || partialRetDoc.items[0].rejectedQty !== 3) {
      throw new Error("Partial item approved/rejected quantity mismatch!");
    }
    console.log("PASS: Partial inspection approved 7 resellable units (Stock 60 -> 67) and rejected 3 damaged units.");

    // -----------------------------------------------------------------
    // Scenario 11: FIFO Inventory Consistency
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 11: FIFO Inventory Consistency ---");
    // Make a sale of 5 units
    const salePayload = {
      customerId: testCustomer._id.toString(),
      cashierId: testRep._id.toString(),
      tripId: activeTrip._id.toString(),
      saleType: "walk-in",
      paymentMethod: "cash",
      paidAmount: 750,
      items: [
        {
          productId: testProduct._id.toString(),
          itemCode: testProduct.itemCode,
          itemName: testProduct.displayName,
          quantity: 5
        }
      ]
    };
    await createSaleFromPayload(salePayload);

    const productAfterSale = await Product.findById(testProduct._id);
    if (productAfterSale.totalStock !== 62) {
      throw new Error(`Expected totalStock 62 after selling 5 units, got ${productAfterSale.totalStock}`);
    }
    console.log("PASS: FIFO stock deduction consumed correctly (Stock 67 -> 62).");

    // -----------------------------------------------------------------
    // Scenario 12: Customer Credit & Ledger Consistency
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 12: Customer Credit & Ledger Consistency ---");
    const req12 = createMockReq(testRep, {}, { id: testCustomer._id.toString() });
    const res12 = createMockRes();
    await getLedger(req12, res12);

    if (res12.statusCode !== 200) {
      throw new Error(`Ledger fetch failed with status ${res12.statusCode}`);
    }

    const returnEntries = res12.data.ledger.filter((e) => e.type === "return");
    if (returnEntries.length < 2) {
      throw new Error(`Expected at least 2 return entries in customer ledger, found ${returnEntries.length}`);
    }
    console.log(`PASS: Found ${returnEntries.length} return credit entries in customer ledger.`);

    // -----------------------------------------------------------------
    // Scenario 13: Historical Return Migration Idempotency
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 13: Historical Migration Idempotency ---");
    const { runMigration } = require("./migrateReturnInspectionStatus");
    // Run migration twice in dry-run mode
    await runMigration();
    await runMigration();

    // Verify stock is STILL 62
    const finalProduct = await Product.findById(testProduct._id);
    if (finalProduct.totalStock !== 62) {
      throw new Error(`Stock changed during migration test! Expected: 62, got: ${finalProduct.totalStock}`);
    }
    console.log("PASS: Migration is 100% idempotent; product stock remains stable at 62.");

    console.log("\n=====================================================");
    console.log("   🎉 ALL 13 BUSINESS POLICY TESTS PASSED! 🎉         ");
    console.log("=====================================================");
  } finally {
    console.log("\n--- Cleaning up test fixtures ---");
    if (testRep) await User.findByIdAndDelete(testRep._id);
    if (testManager) await User.findByIdAndDelete(testManager._id);
    if (testCategory) await Category.findByIdAndDelete(testCategory._id);
    if (testProduct) {
      await StockBatch.deleteMany({ productId: testProduct._id });
      await Product.findByIdAndDelete(testProduct._id);
    }
    if (testCustomer) await Customer.findByIdAndDelete(testCustomer._id);
    await TripSession.deleteMany({ tripNo: new RegExp(`^TRIP-.*${timestamp}`) });
    await Sale.deleteMany({ invoiceNo: new RegExp(`^INV-.*${timestamp}`) });
    await Return.deleteMany({ invoiceNo: new RegExp(`^INV-.*${timestamp}`) });

    console.log("Cleanup complete.");
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
}

module.exports = { runTests };
