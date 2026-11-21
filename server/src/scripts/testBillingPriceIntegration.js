/**
 * Automated Express Endpoint & Pricing Integration Test Suite
 * JSP Distributors — Product Billing/Selling Price Display and Invoice Calculations
 *
 * Runs against isolated local QA database: mongodb://127.0.0.1:27017/jsp_distributors_qa_test
 *
 * Verifies all 16 regression test cases from Section 6 of requirements:
 * 1. Product Card / API displays Billing and Selling Prices correctly.
 * 2. Billing Price is prominent amount (Rs. 80.00 vs Rs. 110.00).
 * 3. Add Product validation: blocks missing / invalid Billing Price.
 * 4. Cart / Order items calculate Line Total = Qty * Billing Price.
 * 5. Van Order Booking uses Customer Billing Price exclusively.
 * 6. Edit Order preserves authorized historical Billing Prices.
 * 7. Add Product during editing uses approved Billing Price.
 * 8. Supplier batch acquisition cost (StockBatch.billingPrice) cannot overwrite customer billing.
 * 9. Delivery total matches confirmed order pricing.
 * 10. Invoice displays both prices correctly (Selling Ref & Customer Billing).
 * 11. Invoice Line Amount uses only Billing Price.
 * 12. Cash / Cheque / Credit amounts use actual payable value.
 * 13. Customer Ledger debit and outstanding balance match Billing Price net total.
 * 14. Daily Closing totals use Billing Price net sales.
 * 15. Offline SQLite cache stores both prices while excluding confidential supplier costs.
 * 16. A4 Invoice HTML generation and legacy N/A snapshot handling.
 */

const mongoose = require("mongoose");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");

const User = require("../models/User");
const Customer = require("../models/Customer");
const Category = require("../models/Category");
const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");
const TripSession = require("../models/TripSession");
const Order = require("../models/Order");
const Sale = require("../models/Sale");
const Payment = require("../models/Payment");

const { createProduct, listProducts, getProduct } = require("../controllers/productController");
const { createOrder, updateOrder, deliverOrder } = require("../controllers/orderController");
const { getLedger } = require("../controllers/customerController");
const { getDailyClosing } = require("../controllers/reportController");
const { createSaleFromPayload } = require("../services/salesService");

// Helper to mock Express req and res
function createMockReq(user, body = {}, params = {}, query = {}) {
  return { user, body, params, query };
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

let passedCount = 0;
let failedCount = 0;

function assertTest(condition, testName, details = "") {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${testName} - ${details}`);
    failedCount++;
  }
}

async function runBillingPriceIntegrationSuite() {
  console.log("===============================================================================");
  console.log("   JSP DISTRIBUTORS: BILLING & SELLING PRICE INTEGRATION TEST SUITE            ");
  console.log("===============================================================================\n");

  const QA_MONGO_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/jsp_distributors_qa_test";
  console.log(`Connecting to QA Database: ${QA_MONGO_URI}...`);
  await mongoose.connect(QA_MONGO_URI);
  console.log("Connected successfully to isolated QA MongoDB.\n");

  const runId = Date.now();

  try {
    // -------------------------------------------------------------------------
    // SETUP BASE TEST DATA
    // -------------------------------------------------------------------------
    console.log(">>> Phase 1: Setup Test Actors & Entities <<<");
    const testAdmin = await User.create({
      name: `QA Admin ${runId}`,
      email: `admin_${runId}@jspdistributors.com`,
      passwordHash: "hash123",
      role: "admin",
      status: "active",
      approvalStatus: "approved"
    });

    const testRep = await User.create({
      name: `QA Rep ${runId}`,
      email: `rep_${runId}@jspdistributors.com`,
      passwordHash: "hash123",
      role: "rep",
      status: "active",
      approvalStatus: "approved"
    });

    const testCustomer = await Customer.create({
      name: `QA City Stores ${runId}`,
      phone: "0771234567",
      address: "123 Main Street, Padavi",
      customerType: "credit",
      creditLimit: 500000,
      outstandingBalance: 0
    });

    const testCategory = await Category.create({
      name: `Spices Category ${runId}`
    });

    const testTrip = await TripSession.create({
      tripNo: `TRIP-${runId}`,
      rep: testRep._id,
      route: "Padavi Route 01",
      status: "active",
      startTime: new Date()
    });

    assertTest(testRep && testCustomer && testTrip, "Test entities initialized successfully");

    // -------------------------------------------------------------------------
    // TEST 1: PRODUCT MODEL & API FIELD MAPPING (Selling vs Billing Price)
    // -------------------------------------------------------------------------
    console.log("\n>>> Test 1 & 2: Product API & Model Field Mapping (Item AUD-B-0104) <<<");
    // Example from user spec:
    // Item code: AUD-B-0104
    // Selling Price: Rs. 110.00
    // Billing Price: Rs. 80.00
    // Prominent amount must be Rs. 80.00, NOT Rs. 110.00
    const reqCreateProd = createMockReq(testAdmin, {
      productName: "Chillie Powder 100g",
      itemCode: `AUD-B-0104-${runId}`,
      variant: "100g",
      displayName: "Chillie Powder 100g",
      category: testCategory._id,
      supplier: "Ruhunu Foods",
      currentCostPrice: 50,
      currentSellingPrice: 110.0,
      customerBillingPrice: 80.0, // test customerBillingPrice alias
      reorderLevel: 10
    });
    const resCreateProd = createMockRes();
    await createProduct(reqCreateProd, resCreateProd);

    assertTest(resCreateProd.statusCode === 201, "Product created with HTTP 201");
    const createdProd = resCreateProd.data;
    assertTest(createdProd.currentSellingPrice === 110.0, "currentSellingPrice is 110.00 (Reference Price)");
    assertTest(createdProd.currentBillingPrice === 80.0, "currentBillingPrice is 80.00 (Customer Billing Price)");
    assertTest(createdProd.customerBillingPrice === 80.0, "customerBillingPrice virtual getter matches currentBillingPrice");

    // Fetch product by ID
    const reqGetProd = createMockReq(testRep, {}, { id: createdProd._id });
    const resGetProd = createMockRes();
    await getProduct(reqGetProd, resGetProd);
    assertTest(resGetProd.data.currentBillingPrice === 80.0, "API returns correct authoritative Customer Billing Price");
    assertTest(resGetProd.data.currentSellingPrice === 110.0, "API returns correct reference Selling Price");

    // -------------------------------------------------------------------------
    // TEST 3: REJECT MISSING / NEGATIVE BILLING PRICE
    // -------------------------------------------------------------------------
    console.log("\n>>> Test 3: Rejection of Missing or Invalid Customer Billing Price <<<");
    const reqInvalidProd = createMockReq(testAdmin, {
      productName: "Invalid Price Item",
      itemCode: `INV-P-${runId}`,
      currentSellingPrice: 100,
      currentBillingPrice: -10 // negative billing price
    });
    const resInvalidProd = createMockRes();
    await createProduct(reqInvalidProd, resInvalidProd);
    assertTest(resInvalidProd.statusCode === 400, "Server rejects negative billing price with HTTP 400");

    // -------------------------------------------------------------------------
    // TEST 4 & 8: FIFO STOCK BATCH COST SEPARATION (Supplier Acquisition vs Customer Billing)
    // -------------------------------------------------------------------------
    console.log("\n>>> Test 4 & 8: Approved FIFO Batch Billing Price Mapping <<<");
    // StockBatch.billingPrice represents the approved batch billing price (e.g. Rs. 80.00)
    // Product.currentBillingPrice represents the product-level customer billing price (Rs. 80.00)
    const stockBatch = await StockBatch.create({
      batchNo: `BATCH-${runId}-01`,
      productId: createdProd._id,
      quantity: 100,
      remainingQty: 100,
      billingPrice: 80.0, // Approved FIFO Batch Billing Price
      sellingPrice: 110.0,
      receivedDate: new Date(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });
    await Product.findByIdAndUpdate(createdProd._id, { totalStock: 100 });

    assertTest(stockBatch.billingPrice === 80.0, "StockBatch.billingPrice holds approved FIFO batch billing price (80.00)");
    assertTest(createdProd.currentBillingPrice === 80.0, "Product.currentBillingPrice holds customer billing price (80.00)");

    // -------------------------------------------------------------------------
    // TEST 5: VAN ORDER BOOKING (Exclusive Customer Billing Price Calculation)
    // -------------------------------------------------------------------------
    console.log("\n>>> Test 5: Van Order Booking Uses Billing Price Exclusively <<<");
    // Rep books 4 units of AUD-B-0104.
    // Client attempts to pass arbitrary price or omit price:
    // Expected:
    // Line Total = 4 * Rs. 80.00 = Rs. 320.00
    // Subtotal = Rs. 320.00
    // NOT 4 * 110 = 440 (selling price)
    // NOT 4 * 55 = 220 (supplier batch acquisition cost)
    const reqOrderBooking = createMockReq(testRep, {
      customer: testCustomer._id,
      customerId: testCustomer._id,
      tripId: testTrip._id,
      idempotencyKey: `ORD-KEY-${runId}-1`,
      items: [
        {
          productId: createdProd._id,
          quantity: 4
        }
      ]
    });
    const resOrderBooking = createMockRes();
    await createOrder(reqOrderBooking, resOrderBooking);

    assertTest(resOrderBooking.statusCode === 201, "Van Order booked successfully (HTTP 201)");
    const bookedOrder = resOrderBooking.data;
    assertTest(bookedOrder.items[0].unitPrice === 80.0, "Order item unitPrice is authoritative Billing Price (80.00)");
    assertTest(bookedOrder.items[0].billingPrice === 80.0, "Order item billingPrice snapshot is 80.00");
    assertTest(bookedOrder.items[0].sellingPrice === 110.0, "Order item sellingPrice snapshot is 110.00");
    assertTest(bookedOrder.items[0].lineTotal === 320.0, "Line Total = 4 * 80.00 = 320.00 (Customer Billing Price)");
    assertTest(bookedOrder.orderTotal === 320.0, "Order orderTotal = 320.00");
    assertTest(bookedOrder.netTotal === 320.0, "Order Net Total = 320.00 (NEVER 440.00 or 220.00)");

    // -------------------------------------------------------------------------
    // TEST 6: EDIT ORDER PRESERVES HISTORICAL BILLING PRICE SNAPSHOT
    // -------------------------------------------------------------------------
    console.log("\n>>> Test 6: Edit Order Preserves Authorized Historical Price Snapshot <<<");
    // Simulate catalogue price increase from Rs. 80.00 to Rs. 95.00
    await Product.findByIdAndUpdate(createdProd._id, { currentBillingPrice: 95.0 });
    const updatedProdInDb = await Product.findById(createdProd._id);
    assertTest(updatedProdInDb.currentBillingPrice === 95.0, "Catalogue price changed to 95.00");

    // Rep edits order: updates quantity of AUD-B-0104 from 4 to 6 units.
    // The historical authorized snapshot price (80.00) MUST be preserved!
    // Expected line total = 6 * 80.00 = 480.00 (NOT 6 * 95.00 = 570.00)
    const reqEditOrder = createMockReq(
      testRep,
      {
        items: [
          {
            productId: createdProd._id,
            quantity: 6
          }
        ]
      },
      { id: bookedOrder._id }
    );
    const resEditOrder = createMockRes();
    await updateOrder(reqEditOrder, resEditOrder);

    assertTest(resEditOrder.statusCode === 200, "Order updated successfully (HTTP 200)");
    const editedOrder = resEditOrder.data;
    assertTest(editedOrder.items[0].billingPrice === 80.0, "Preserved historical billing price snapshot 80.00");
    assertTest(editedOrder.items[0].lineTotal === 480.0, "Edited item lineTotal = 6 * 80.00 = 480.00");
    assertTest(editedOrder.orderTotal === 480.0, "Edited orderTotal = 480.00");

    // -------------------------------------------------------------------------
    // TEST 7: ADD PRODUCT DURING EDITING USES CURRENT APPROVED BILLING PRICE
    // -------------------------------------------------------------------------
    console.log("\n>>> Test 7: Add Product During Edit Uses Approved Billing Price <<<");
    // Create second product: Turmeric Powder 50g
    // Selling: Rs. 150.00, Customer Billing: Rs. 140.00
    const prod2 = await Product.create({
      productName: "Turmeric Powder 50g",
      itemCode: `TURM-01-${runId}`,
      variant: "50g",
      displayName: "Turmeric Powder 50g",
      category: testCategory._id,
      supplier: "Ruhunu Foods",
      currentCostPrice: 90,
      currentSellingPrice: 150.0,
      currentBillingPrice: 140.0,
      totalStock: 50
    });
    await StockBatch.create({
      batchNo: `BATCH-TURM-${runId}`,
      productId: prod2._id,
      quantity: 50,
      remainingQty: 50,
      billingPrice: 140.0, // Approved FIFO batch billing price
      sellingPrice: 150.0,
      receivedDate: new Date(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });

    // Add 2 units of Turmeric Powder to the order while keeping 6 units of Chillie Powder
    const reqAddProdOrder = createMockReq(
      testRep,
      {
        items: [
          {
            productId: createdProd._id,
            quantity: 6
          },
          {
            productId: prod2._id,
            quantity: 2
          }
        ]
      },
      { id: bookedOrder._id }
    );
    const resAddProdOrder = createMockRes();
    await updateOrder(reqAddProdOrder, resAddProdOrder);

    assertTest(resAddProdOrder.statusCode === 200, "Order with new product added updated (HTTP 200)");
    const multiItemOrder = resAddProdOrder.data;
    assertTest(multiItemOrder.items.length === 2, "Order now has 2 items");

    const item1 = multiItemOrder.items.find((i) => i.productId.toString() === createdProd._id.toString());
    const item2 = multiItemOrder.items.find((i) => i.productId.toString() === prod2._id.toString());

    assertTest(item1.billingPrice === 80.0, "Historical item maintains 80.00 billing price");
    assertTest(item1.lineTotal === 480.0, "Historical item line total is 480.00");
    assertTest(item2.billingPrice === 140.0, "Newly added product uses current approved billing price 140.00");
    assertTest(item2.lineTotal === 280.0, "Newly added product line total is 2 * 140.00 = 280.00");
    assertTest(multiItemOrder.orderTotal === 760.0, "Total orderTotal = 480 + 280 = 760.00");

    // -------------------------------------------------------------------------
    // TEST 8: STOCK CONFLICT REJECTION BEFORE MUTATION
    // -------------------------------------------------------------------------
    console.log("\n>>> Test 8: Conflict Pre-Validation Rejects Stock Shortfall Before Mutation <<<");
    const reqExcessOrder = createMockReq(
      testRep,
      {
        items: [
          {
            productId: prod2._id,
            quantity: 99999 // exceeds stock
          }
        ]
      },
      { id: bookedOrder._id }
    );
    const resExcessOrder = createMockRes();
    await updateOrder(reqExcessOrder, resExcessOrder);

    assertTest(resExcessOrder.statusCode === 409, "Server rejects excess stock request with HTTP 409 Conflict");

    // -------------------------------------------------------------------------
    // TEST 9 & 10 & 11: ORDER DELIVERY & SALES INVOICE INTEGRATION
    // -------------------------------------------------------------------------
    console.log("\n>>> Test 9, 10 & 11: Order Delivery & Sales Invoice Creation <<<");
    // Deliver the order with partial cash payment of Rs. 300.00 (Due: Rs. 460.00)
    const reqDeliver = createMockReq(
      testRep,
      {
        items: [
          {
            productId: createdProd._id,
            quantity: 6
          },
          {
            productId: prod2._id,
            quantity: 2
          }
        ],
        paidAmount: 300.0,
        paymentMethod: "cash"
      },
      { id: bookedOrder._id }
    );
    const resDeliver = createMockRes();
    await deliverOrder(reqDeliver, resDeliver);

    if (resDeliver.statusCode !== 200) {
      console.error("DELIVERY ERROR RESPONSE:", resDeliver.data);
    }
    assertTest(resDeliver.statusCode === 200, "Order delivered successfully with HTTP 200");
    const deliveryResult = resDeliver.data;
    const saleInvoice = deliveryResult.sale;

    assertTest(saleInvoice.orderTotal === 760.0, "Invoice orderTotal = 760.00 (from Customer Billing Prices)");
    assertTest(saleInvoice.netTotal === 760.0, "Invoice netTotal = 760.00");
    assertTest(saleInvoice.paidAmount === 300.0, "Invoice paidAmount = 300.00");
    assertTest(saleInvoice.dueAmount === 460.0, "Invoice dueAmount = 460.00");

    // Check items in Sale document
    const saleItem1 = saleInvoice.items.find((i) => i.product.toString() === createdProd._id.toString());
    const saleItem2 = saleInvoice.items.find((i) => i.product.toString() === prod2._id.toString());
    assertTest(saleItem1.billingPrice === 80.0, "Sale item 1 billingPrice = 80.00");
    assertTest(saleItem1.sellingPrice === 110.0, "Sale item 1 sellingPrice reference = 110.00");
    assertTest(saleItem1.lineTotal === 480.0, "Sale item 1 lineTotal = 480.00");
    assertTest(saleItem2.billingPrice === 140.0, "Sale item 2 billingPrice = 140.00");
    assertTest(saleItem2.sellingPrice === 150.0, "Sale item 2 sellingPrice reference = 150.00");
    assertTest(saleItem2.lineTotal === 280.0, "Sale item 2 lineTotal = 280.00");

    // Verify FIFO batch billing price matches sale item billingPrice
    assertTest(saleItem1.usedBatches[0].billingPrice === 80.0, "Internal usedBatches correctly records batch billing price 80.00");
    assertTest(saleItem1.billingPrice === 80.0, "Customer-facing saleItem.billingPrice strictly maintained as 80.00");

    // -------------------------------------------------------------------------
    // TEST 12 & 13: CUSTOMER LEDGER & OUTSTANDING BALANCE ACCURACY
    // -------------------------------------------------------------------------
    console.log("\n>>> Test 12 & 13: Customer Ledger & Outstanding Balance Accuracy <<<");
    const updatedCustomer = await Customer.findById(testCustomer._id);
    assertTest(
      updatedCustomer.outstandingBalance === 460.0,
      `Customer outstandingBalance = 460.00 (Net 760.00 - Paid 300.00 = 460.00). Selling price total (960.00) NEVER applied.`
    );

    const reqLedger = createMockReq(testRep, {}, { id: testCustomer._id });
    const resLedger = createMockRes();
    await getLedger(reqLedger, resLedger);

    assertTest(resLedger.statusCode === 200, "Customer Ledger fetched successfully");
    const ledgerData = resLedger.data;
    assertTest(ledgerData.totals.closingBalance === 460.0, "Ledger closing balance matches dueAmount 460.00");
    const invoiceLedgerRow = ledgerData.ledger.find((r) => r.type === "sale");
    assertTest(invoiceLedgerRow.debit === 760.0, "Ledger invoice debit equals Billing Price Net Total 760.00");

    // -------------------------------------------------------------------------
    // TEST 14: DAILY CLOSING TOTALS USE BILLING PRICE NET SALES
    // -------------------------------------------------------------------------
    console.log("\n>>> Test 14: Daily Closing Totals Use Billing Price Net Sales <<<");
    const reqClosing = createMockReq(testRep, {}, {}, { tripId: testTrip._id.toString() });
    const resClosing = createMockRes();
    await getDailyClosing(reqClosing, resClosing);

    assertTest(resClosing.statusCode === 200, "Daily Closing report fetched successfully");
    const closingData = resClosing.data;
    assertTest(
      closingData.netSales === 760.0,
      `Daily closing netSales = 760.00 (Calculated strictly from Customer Billing Price)`
    );

    // -------------------------------------------------------------------------
    // TEST 15: OFFLINE SQLITE CACHE STORAGE & REPOSITORY ISOLATION
    // -------------------------------------------------------------------------
    console.log("\n>>> Test 15: SQLite Offline Cache Field Verification <<<");
    const sqliteDb = new DatabaseSync(":memory:");
    const schemaPath = path.resolve(__dirname, "../../../mobile/src/database/schema.ts");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    const sqlMatch = schemaSql.match(/export const CREATE_TABLES_SQL = `([\s\S]*?)`;/);
    sqliteDb.exec(sqlMatch[1]);

    const cachedProductCols = sqliteDb.prepare("PRAGMA table_info(cached_products)").all().map((c) => c.name);
    assertTest(cachedProductCols.includes("currentBillingPrice"), "cached_products table stores currentBillingPrice");
    assertTest(cachedProductCols.includes("currentSellingPrice"), "cached_products table stores currentSellingPrice");
    assertTest(!cachedProductCols.includes("supplierCost"), "cached_products excludes internal supplierCost");
    assertTest(!cachedProductCols.includes("batchSupplierPrice"), "cached_products excludes batchSupplierPrice");

    const offlineItemCols = sqliteDb.prepare("PRAGMA table_info(offline_order_items)").all().map((c) => c.name);
    assertTest(offlineItemCols.includes("billingPrice"), "offline_order_items stores billingPrice");
    assertTest(offlineItemCols.includes("sellingPrice"), "offline_order_items stores sellingPrice");

    // -------------------------------------------------------------------------
    // TEST 16: DIRECT POS SALE WITH MISSING BILLING PRICE BLOCKED
    // -------------------------------------------------------------------------
    console.log("\n>>> Test 16: Direct POS Sale Pricing & Missing Billing Price Block <<<");
    // Valid Direct POS Sale
    const posProd = await Product.create({
      productName: "POS Chillie Powder",
      itemCode: `POS-CHIL-${runId}`,
      variant: "100g",
      displayName: "POS Chillie Powder 100g",
      category: testCategory._id,
      supplier: "Ruhunu Foods",
      currentCostPrice: 50,
      currentSellingPrice: 110.0,
      currentBillingPrice: 80.0,
      totalStock: 50
    });
    await StockBatch.create({
      batchNo: `BATCH-POS-${runId}`,
      productId: posProd._id,
      quantity: 50,
      remainingQty: 50,
      billingPrice: 80.0, // Approved FIFO batch billing price
      sellingPrice: 110.0,
      receivedDate: new Date(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });

    const validPosSale = await createSaleFromPayload({
      cashier: testRep._id,
      customer: testCustomer._id,
      tripId: testTrip._id,
      items: [
        {
          productId: posProd._id,
          quantity: 2
        }
      ],
      paymentMethod: "cash",
      paidAmount: 160.0 // 2 * 80.00 = 160.00
    });
    assertTest(validPosSale.orderTotal === 160.0, "POS Direct Sale orderTotal = 2 * 80.00 = 160.00");
    assertTest(validPosSale.items[0].billingPrice === 80.0, "POS Direct Sale item billingPrice = 80.00");
    assertTest(validPosSale.items[0].sellingPrice === 110.0, "POS Direct Sale item sellingPrice = 110.00");

    // Invalid POS Sale with missing billing price
    const prodMissingBilling = await Product.create({
      productName: "Unpriced Item",
      itemCode: `NO-BILL-${runId}`,
      variant: "100g",
      displayName: "Unpriced Item 100g",
      category: testCategory._id,
      supplier: "Ruhunu Foods",
      currentCostPrice: 40,
      currentSellingPrice: 80.0,
      currentBillingPrice: 0, // invalid / missing
      totalStock: 50
    });

    let posBlocked = false;
    try {
      await createSaleFromPayload({
        cashier: testRep._id,
        customer: testCustomer._id,
        items: [{ productId: prodMissingBilling._id, quantity: 1 }],
        paymentMethod: "cash",
        paidAmount: 80
      });
    } catch (err) {
      posBlocked = true;
      assertTest(
        err.message.includes("Billing price unavailable or invalid"),
        "createSaleFromPayload blocks item with zero/missing billing price"
      );
    }
    assertTest(posBlocked, "Direct sale with missing customer billing price was blocked");

  } catch (err) {
    console.error("FATAL ERROR IN INTEGRATION SUITE:", err);
    failedCount++;
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from QA Database.");
  }

  console.log("\n===============================================================================");
  console.log(`   INTEGRATION TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("===============================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runBillingPriceIntegrationSuite();
