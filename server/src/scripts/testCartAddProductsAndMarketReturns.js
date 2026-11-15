/**
 * Comprehensive Automated Test Suite:
 * Critical Enhancements: Cart Product Addition & Market Returns Integration
 *
 * Verifies:
 * 1. Booking Van Order with proposed market returns:
 *    - Order Subtotal, Returns Total, Adjusted Base Total, Discount, Net Total
 *    - Proposed returns stored in order.returns
 *    - No inventory mutation or Return document creation during booking
 * 2. Idempotency & Conflict checking with returns
 * 3. Delivering Van Order with confirmed market returns:
 *    - Physical returns confirmed and recorded
 *    - Official Return created with inspectionStatus: "pending_inspection"
 *    - Returned stock NOT immediately added to Product.totalStock (Warehouse Inspection policy)
 *    - Net sale invoice generated with orderTotal, returnTotal, discount, netTotal
 *    - Customer balance updated by net dueAmount without double-subtraction
 * 4. Delivery with adjusted return items & quantities
 * 5. Delivery payment collection and trip session reconciliation with returns
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

const { createOrder, deliverOrder } = require("../controllers/orderController");
const { createCustomerReturn } = require("../controllers/returnController");

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

let testPassed = 0;
let testFailed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    testPassed++;
  } else {
    console.error(`  [FAIL] ${testName} - ${details}`);
    testFailed++;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("   CART PRODUCT ADDITION & MARKET RETURNS TEST SUITE   ");
  console.log("=======================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/jsp_distributors";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB successfully.\n");

  const runId = Date.now();

  try {
    // 0. Setup Test Entities
    console.log("--- Setup Test Data ---");
    const testRep = await User.create({
      name: `Test Rep ${runId}`,
      email: `rep_${runId}@jspdistributors.com`,
      passwordHash: "hash123",
      role: "rep",
      status: "active",
      approvalStatus: "approved"
    });

    const testCustomer = await Customer.create({
      name: `Test Pharmacy ${runId}`,
      phone: "0771234567",
      address: "123 Colombo Road",
      customerType: "wholesale",
      creditLimit: 500000,
      outstandingBalance: 0
    });

    const testCategory = await Category.create({
      name: `Test Category ${runId}`
    });

    // Product 1: For order purchase (Price: Rs. 100, Stock: 50)
    const orderProduct = await Product.create({
      barcode: `ORD-BAR-${runId}`,
      productName: `Order Biscuit ${runId}`,
      variant: "100g",
      displayName: `Order Biscuit ${runId} 100g`,
      itemCode: `ORD-P-${runId.toString().slice(-5)}`,
      category: testCategory._id,
      supplier: "Ruhunu Foods",
      currentCostPrice: 70,
      currentBillingPrice: 100,
      currentSellingPrice: 100,
      totalStock: 50,
      reorderLevel: 10,
      status: "active"
    });

    await StockBatch.create({
      productId: orderProduct._id,
      batchNo: `BATCH-ORD-${runId}`,
      billingPrice: 100,
      sellingPrice: 100,
      quantity: 50,
      remainingQty: 50,
      receivedDate: new Date(),
      expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      createdBy: testRep._id
    });

    // Product 2: For market return (Return Price: Rs. 80, Stock: 10)
    const returnProduct = await Product.create({
      barcode: `RET-BAR-${runId}`,
      productName: `Return Juice ${runId}`,
      variant: "200ml",
      displayName: `Return Juice ${runId} 200ml`,
      itemCode: `RET-P-${runId.toString().slice(-5)}`,
      category: testCategory._id,
      supplier: "Gajamuthu Foods",
      currentCostPrice: 50,
      currentBillingPrice: 80,
      currentSellingPrice: 80,
      totalStock: 10,
      reorderLevel: 5,
      status: "active"
    });

    // Active Trip Session
    const activeTrip = await TripSession.create({
      rep: testRep._id,
      tripNo: `TRIP-TEST-${runId}`,
      route: "Southern Coastal Route",
      status: "active",
      startTime: new Date(),
      startMileage: 10000,
      expectedCollections: { cash: 0, cheque: 0 }
    });

    console.log(`Created Rep: ${testRep.name}, Customer: ${testCustomer.name}, Trip: ${activeTrip.tripNo}\n`);

    // ==============================================================
    // TEST SCENARIO 1: Booking Van Order with Proposed Market Returns
    // ==============================================================
    console.log("--- SCENARIO 1: Booking Van Order with Proposed Market Returns ---");
    // Order: 10 units @ Rs. 100 = Rs. 1,000
    // Return: 2 units @ Rs. 80 = Rs. 160
    // Adjusted Base Total = Rs. 1,000 - Rs. 160 = Rs. 840
    // Discount: 10% on Rs. 840 = Rs. 84
    // Net Total = Rs. 840 - Rs. 84 = Rs. 756
    const bookReq = createMockReq(testRep, {
      customer: testCustomer._id.toString(),
      items: [{ productId: orderProduct._id.toString(), quantity: 10 }],
      returns: [
        {
          productId: returnProduct._id.toString(),
          itemCode: returnProduct.itemCode,
          itemName: returnProduct.productName,
          quantity: 2,
          returnPrice: 80,
          returnTotal: 160,
          condition: "resellable",
          reason: "Damaged packaging in transit"
        }
      ],
      discountPercent: 10
    });
    const bookRes = createMockRes();

    await createOrder(bookReq, bookRes);

    assert(bookRes.statusCode === 201, "Booking order returned HTTP 201 Created");
    const bookedOrder = bookRes.data;

    assert(bookedOrder.orderTotal === 1000, "Order Total is Rs. 1,000", `Got: ${bookedOrder.orderTotal}`);
    assert(bookedOrder.returnTotal === 160, "Return Total is Rs. 160", `Got: ${bookedOrder.returnTotal}`);
    assert(bookedOrder.discount === 84, "Discount is Rs. 84 (10% on Adjusted Base Rs. 840)", `Got: ${bookedOrder.discount}`);
    assert(bookedOrder.netTotal === 756, "Net Total is Rs. 756", `Got: ${bookedOrder.netTotal}`);
    assert(bookedOrder.returns && bookedOrder.returns.length === 1, "Proposed returns array stored with order");
    assert(bookedOrder.orderStatus === "pending_delivery", "Order status is pending_delivery");

    // Stock verification: Order items stock was reserved (50 - 10 = 40)
    const freshOrderProd = await Product.findById(orderProduct._id);
    assert(freshOrderProd.totalStock === 40, "Warehouse stock for purchased item reserved to 40", `Got: ${freshOrderProd.totalStock}`);

    // Return item stock verification: Proposed returns MUST NOT touch inventory during booking
    const freshReturnProd = await Product.findById(returnProduct._id);
    assert(freshReturnProd.totalStock === 10, "Warehouse stock for return item remains untouched at 10 during booking", `Got: ${freshReturnProd.totalStock}`);

    // Return documents verification: Zero return records created during booking
    const returnDocsDuringBooking = await Return.find({ customer: testCustomer._id });
    assert(returnDocsDuringBooking.length === 0, "Zero Return documents created during booking", `Count: ${returnDocsDuringBooking.length}`);

    // Customer ledger verification: Zero ledger / balance mutation during booking
    const freshCustDuringBooking = await Customer.findById(testCustomer._id);
    assert(freshCustDuringBooking.outstandingBalance === 0, "Customer outstanding balance remains 0 during booking");

    // ==============================================================
    // TEST SCENARIO 2: Idempotency with Market Returns
    // ==============================================================
    console.log("\n--- SCENARIO 2: Idempotency with Market Returns ---");
    const idemKey = `IDEM-ORDER-${runId}`;
    const idemReq1 = createMockReq(testRep, {
      customer: testCustomer._id.toString(),
      items: [{ productId: orderProduct._id.toString(), quantity: 2 }],
      returns: [
        {
          productId: returnProduct._id.toString(),
          itemCode: returnProduct.itemCode,
          itemName: returnProduct.productName,
          quantity: 1,
          returnPrice: 80,
          returnTotal: 80,
          condition: "resellable"
        }
      ],
      discountPercent: 5,
      idempotencyKey: idemKey
    });
    const idemRes1 = createMockRes();
    await createOrder(idemReq1, idemRes1);
    assert(idemRes1.statusCode === 201, "First idempotent order created with HTTP 201");

    // Retry same request
    const idemReq2 = createMockReq(testRep, {
      customer: testCustomer._id.toString(),
      items: [{ productId: orderProduct._id.toString(), quantity: 2 }],
      returns: [
        {
          productId: returnProduct._id.toString(),
          itemCode: returnProduct.itemCode,
          itemName: returnProduct.productName,
          quantity: 1,
          returnPrice: 80,
          returnTotal: 80,
          condition: "resellable"
        }
      ],
      discountPercent: 5,
      idempotencyKey: idemKey
    });
    const idemRes2 = createMockRes();
    await createOrder(idemReq2, idemRes2);
    assert(idemRes2.statusCode === 200, "Duplicate request returned HTTP 200 with existing order");
    assert(idemRes2.data._id.toString() === idemRes1.data._id.toString(), "Returns exact same order document");

    // ==============================================================
    // TEST SCENARIO 3: Delivering Order with Confirmed Market Returns
    // ==============================================================
    console.log("\n--- SCENARIO 3: Delivering Order with Confirmed Market Returns ---");
    // Let's deliver bookedOrder from Scenario 1:
    // Order Items: 10 units @ 100 = 1,000
    // Confirmed Returns: 2 units @ 80 = 160
    // Base Total = 840
    // Discount: 10% = 84
    // Net Total = 756
    // Payment Method: Credit -> Customer billed full net total Rs. 756
    const deliverReq = createMockReq(
      testRep,
      {
        paymentMethod: "credit",
        paidAmount: 0,
        discountPercent: 10,
        returns: bookedOrder.returns
      },
      { id: bookedOrder._id.toString() }
    );
    const deliverRes = createMockRes();

    await deliverOrder(deliverReq, deliverRes);

    assert(deliverRes.statusCode === 200, "Deliver order returned HTTP 200 OK");
    const deliveryResult = deliverRes.data;

    assert(deliveryResult.sale !== undefined, "Delivery generated an official Sale invoice");
    const deliveredSale = deliveryResult.sale;

    assert(deliveredSale.orderTotal === 1000, "Sale invoice orderTotal is Rs. 1,000", `Got: ${deliveredSale.orderTotal}`);
    assert(deliveredSale.returnTotal === 160, "Sale invoice returnTotal is Rs. 160", `Got: ${deliveredSale.returnTotal}`);
    assert(deliveredSale.discount === 84, "Sale invoice discount is Rs. 84", `Got: ${deliveredSale.discount}`);
    assert(deliveredSale.netTotal === 756, "Sale invoice netTotal is Rs. 756", `Got: ${deliveredSale.netTotal}`);
    assert(deliveredSale.dueAmount === 756, "Due amount billed is Rs. 756", `Got: ${deliveredSale.dueAmount}`);

    // Customer balance verification: Balance increased strictly by dueAmount Rs. 756
    const custAfterDelivery = await Customer.findById(testCustomer._id);
    assert(
      custAfterDelivery.outstandingBalance === 756,
      "Customer outstanding balance increased strictly by net total Rs. 756 without double-counting",
      `Got: ${custAfterDelivery.outstandingBalance}`
    );

    // Official Return record created in pending_inspection status
    const officialReturns = await Return.find({ saleId: deliveredSale._id });
    assert(officialReturns.length === 1, "Official Return document created upon delivery confirmation", `Count: ${officialReturns.length}`);
    const officialReturn = officialReturns[0];
    assert(officialReturn.inspectionStatus === "pending_inspection", "Official return status is pending_inspection (Warehouse Inspection policy)");
    assert(officialReturn.returnTotal === 160, "Official return total is Rs. 160", `Got: ${officialReturn.returnTotal}`);

    // Warehouse stock inspection policy verification:
    // Physical returned stock must NOT be added to Product.totalStock until Manager inspection!
    const returnProdAfterDelivery = await Product.findById(returnProduct._id);
    assert(
      returnProdAfterDelivery.totalStock === 10,
      "Returned product totalStock remains 10 (awaiting manager warehouse inspection)",
      `Got: ${returnProdAfterDelivery.totalStock}`
    );

    // ==============================================================
    // TEST SCENARIO 4: Delivery with Adjusted Market Returns
    // ==============================================================
    console.log("\n--- SCENARIO 4: Delivery with Adjusted Market Returns ---");
    // Rep books order with 2 returns, but upon delivery physically receives 3 returns!
    const bookReqAdj = createMockReq(testRep, {
      customer: testCustomer._id.toString(),
      items: [{ productId: orderProduct._id.toString(), quantity: 5 }], // 5 * 100 = 500
      returns: [
        {
          productId: returnProduct._id.toString(),
          itemCode: returnProduct.itemCode,
          itemName: returnProduct.productName,
          quantity: 2,
          returnPrice: 80,
          returnTotal: 160,
          condition: "resellable"
        }
      ],
      discountPercent: 0
    });
    const bookResAdj = createMockRes();
    await createOrder(bookReqAdj, bookResAdj);
    const orderToAdjust = bookResAdj.data;

    // During physical delivery on van: Rep receives 3 units of returns instead of 2:
    // Order Subtotal: 500
    // Adjusted Return: 3 units @ 80 = 240
    // Base Total: 500 - 240 = 260
    // Discount: 0
    // Net: 260
    // Paid in cash: Rs. 260
    const deliverReqAdj = createMockReq(
      testRep,
      {
        paymentMethod: "cash",
        paidAmount: 260,
        discountPercent: 0,
        returns: [
          {
            productId: returnProduct._id.toString(),
            itemCode: returnProduct.itemCode,
            itemName: returnProduct.productName,
            quantity: 3,
            returnPrice: 80,
            returnTotal: 240,
            condition: "resellable",
            reason: "Adjusted upon physical inspection"
          }
        ]
      },
      { id: orderToAdjust._id.toString() }
    );
    const deliverResAdj = createMockRes();
    await deliverOrder(deliverReqAdj, deliverResAdj);

    assert(deliverResAdj.statusCode === 200, "Delivered order with adjusted returns HTTP 200");
    const adjSale = deliverResAdj.data.sale;
    assert(adjSale.returnTotal === 240, "Adjusted sale returnTotal is Rs. 240", `Got: ${adjSale.returnTotal}`);
    assert(adjSale.netTotal === 260, "Adjusted sale netTotal is Rs. 260", `Got: ${adjSale.netTotal}`);
    assert(adjSale.dueAmount === 0, "Paid in full: dueAmount is 0");
    assert(adjSale.paymentStatus === "paid", "Payment status is paid");

    // Trip expected cash collection updated with Rs. 260
    const freshTrip = await TripSession.findById(activeTrip._id);
    assert(freshTrip.expectedCollections.cash === 260, "Trip expected cash updated with Rs. 260 net collected", `Got: ${freshTrip.expectedCollections.cash}`);

    // Customer balance should NOT have changed (paid in cash)
    const custAfterCash = await Customer.findById(testCustomer._id);
    assert(custAfterCash.outstandingBalance === 756, "Customer balance unchanged after cash sale with returns", `Got: ${custAfterCash.outstandingBalance}`);

    // ==============================================================
    // TEST SCENARIO 5: Return Total Exceeding Order Total Rejection
    // ==============================================================
    console.log("\n--- SCENARIO 5: Return Total Exceeding Order Total Rejection ---");
    const exceedReq = createMockReq(testRep, {
      customer: testCustomer._id.toString(),
      items: [{ productId: orderProduct._id.toString(), quantity: 1 }], // 100
      returns: [
        {
          productId: returnProduct._id.toString(),
          itemCode: returnProduct.itemCode,
          itemName: returnProduct.productName,
          quantity: 2,
          returnPrice: 80,
          returnTotal: 160 // 160 > 100!
        }
      ]
    });
    const exceedRes = createMockRes();
    // Booking clamps base to 0, but deliverOrder checks returnTotal cannot exceed orderTotal
    await createOrder(exceedReq, exceedRes);
    const orderWithBigReturn = exceedRes.data;

    const deliverExceedReq = createMockReq(
      testRep,
      {
        paymentMethod: "cash",
        paidAmount: 0,
        returns: [
          {
            productId: returnProduct._id.toString(),
            itemCode: returnProduct.itemCode,
            itemName: returnProduct.productName,
            quantity: 2,
            returnPrice: 80,
            returnTotal: 160
          }
        ]
      },
      { id: orderWithBigReturn._id.toString() }
    );
    const deliverExceedRes = createMockRes();
    await deliverOrder(deliverExceedReq, deliverExceedRes);
    assert(deliverExceedRes.statusCode === 400, "Delivery rejects return total exceeding order total with HTTP 400", `Got: ${deliverExceedRes.statusCode}`);

    // ==============================================================
    // TEST SCENARIO 6: Editable Return Price Validation & Ceilings
    // ==============================================================
    console.log("\n--- SCENARIO 6: Editable Return Price Validation & Ceilings ---");

    // 6.1: Reject zero or negative returnPrice during booking
    const negPriceReq = createMockReq(testRep, {
      customer: testCustomer._id.toString(),
      items: [{ productId: orderProduct._id.toString(), quantity: 1 }],
      returns: [
        {
          productId: returnProduct._id.toString(),
          itemCode: returnProduct.itemCode,
          itemName: returnProduct.productName,
          quantity: 1,
          returnPrice: -10
        }
      ]
    });
    const negPriceRes = createMockRes();
    await createOrder(negPriceReq, negPriceRes);
    assert(negPriceRes.statusCode === 400, "createOrder rejects negative returnPrice with HTTP 400", `Got: ${negPriceRes.statusCode}`);

    // 6.2: Reject returnPrice exceeding catalogue selling price in createOrder
    const exceedCatPriceReq = createMockReq(testRep, {
      customer: testCustomer._id.toString(),
      items: [{ productId: orderProduct._id.toString(), quantity: 2 }],
      returns: [
        {
          productId: returnProduct._id.toString(),
          itemCode: returnProduct.itemCode,
          itemName: returnProduct.productName,
          quantity: 1,
          returnPrice: 120 // catalogue price is 80!
        }
      ]
    });
    const exceedCatPriceRes = createMockRes();
    await createOrder(exceedCatPriceReq, exceedCatPriceRes);
    assert(exceedCatPriceRes.statusCode === 400, "createOrder rejects returnPrice exceeding catalogue selling price (120 > 80)", `Got: ${exceedCatPriceRes.statusCode}`);

    // 6.3: Reject returnPrice exceeding catalogue selling price in deliverOrder
    const validBookReq = createMockReq(testRep, {
      customer: testCustomer._id.toString(),
      items: [{ productId: orderProduct._id.toString(), quantity: 5 }], // 5 * 100 = 500
      returns: [
        {
          productId: returnProduct._id.toString(),
          itemCode: returnProduct.itemCode,
          itemName: returnProduct.productName,
          quantity: 1,
          returnPrice: 80
        }
      ]
    });
    const validBookRes = createMockRes();
    await createOrder(validBookReq, validBookRes);
    assert(validBookRes.statusCode === 201, "createOrder accepts valid catalogue returnPrice", `Got: ${validBookRes.statusCode}`);
    const validBookOrder = validBookRes.data;

    const exceedDeliverReq = createMockReq(
      testRep,
      {
        paymentMethod: "credit",
        paidAmount: 0,
        returns: [
          {
            productId: returnProduct._id.toString(),
            itemCode: returnProduct.itemCode,
            itemName: returnProduct.productName,
            quantity: 1,
            returnPrice: 95 // 95 > 80 catalogue!
          }
        ]
      },
      { id: validBookOrder._id.toString() }
    );
    const exceedDeliverRes = createMockRes();
    await deliverOrder(exceedDeliverReq, exceedDeliverRes);
    assert(exceedDeliverRes.statusCode === 400, "deliverOrder rejects returnPrice exceeding catalogue selling price (95 > 80)", `Got: ${exceedDeliverRes.statusCode}`);

    // 6.4: Accept custom adjusted return price (e.g. Rs. 50 instead of Rs. 80 for damaged return)
    const customPriceDeliverReq = createMockReq(
      testRep,
      {
        paymentMethod: "credit",
        paidAmount: 0,
        discountPercent: 10,
        returns: [
          {
            productId: returnProduct._id.toString(),
            itemCode: returnProduct.itemCode,
            itemName: returnProduct.productName,
            quantity: 2,
            returnPrice: 50 // Custom edited return price (below 80)
          }
        ]
      },
      { id: validBookOrder._id.toString() }
    );
    const customPriceDeliverRes = createMockRes();
    await deliverOrder(customPriceDeliverReq, customPriceDeliverRes);
    assert(customPriceDeliverRes.statusCode === 200, "deliverOrder accepts custom adjusted returnPrice (Rs. 50)", `Got: ${customPriceDeliverRes.statusCode}`);

    // Verify calculation with custom return price:
    // Subtotal: 5 * 100 = 500
    // Returns: 2 * 50 = 100
    // Base Total: 500 - 100 = 400
    // 10% Discount on Base: 40
    // Net Total: 400 - 40 = 360
    const customSale = customPriceDeliverRes.data.sale;
    assert(customSale.orderTotal === 500, "Sale orderTotal is Rs. 500", `Got: ${customSale.orderTotal}`);
    assert(customSale.returnTotal === 100, "Sale returnTotal is Rs. 100 (2 * 50)", `Got: ${customSale.returnTotal}`);
    assert(customSale.discount === 40, "Sale discount is Rs. 40 (10% of 400)", `Got: ${customSale.discount}`);
    assert(customSale.netTotal === 360, "Sale netTotal is Rs. 360", `Got: ${customSale.netTotal}`);

    // ==============================================================
    // TEST SCENARIO 7: Invoice-Linked Customer Returns Price Validation
    // ==============================================================
    console.log("\n--- SCENARIO 7: Invoice-Linked Customer Returns Price Validation ---");

    // 7.1: Reject return unit price exceeding original invoiced selling price
    const linkedReturnExceedReq = createMockReq(testRep, {
      customerId: testCustomer._id.toString(),
      invoiceNo: customSale.invoiceNo,
      items: [
        {
          productId: orderProduct._id.toString(),
          itemCode: orderProduct.itemCode,
          itemName: orderProduct.productName,
          quantity: 1,
          returnPrice: 150 // Original invoiced was 100!
        }
      ]
    });
    const linkedReturnExceedRes = createMockRes();
    await createCustomerReturn(linkedReturnExceedReq, linkedReturnExceedRes);
    assert(linkedReturnExceedRes.statusCode === 400, "createCustomerReturn rejects returnPrice exceeding invoice selling price (150 > 100)", `Got: ${linkedReturnExceedRes.statusCode}`);

    // 7.2: Accept return unit price <= original invoiced selling price
    const linkedReturnValidReq = createMockReq(testRep, {
      customerId: testCustomer._id.toString(),
      invoiceNo: customSale.invoiceNo,
      items: [
        {
          productId: orderProduct._id.toString(),
          itemCode: orderProduct.itemCode,
          itemName: orderProduct.productName,
          quantity: 1,
          returnPrice: 90 // <= 100
        }
      ]
    });
    const linkedReturnValidRes = createMockRes();
    await createCustomerReturn(linkedReturnValidReq, linkedReturnValidRes);
    assert(linkedReturnValidRes.statusCode === 201, "createCustomerReturn accepts valid edited returnPrice (90 <= 100)", `Got: ${linkedReturnValidRes.statusCode}`);
    assert(linkedReturnValidRes.data.returnTotal === 90, "CustomerReturn total is Rs. 90", `Got: ${linkedReturnValidRes.data?.returnTotal}`);

    console.log("\n=======================================================");
    console.log(`   TEST RESULTS: ${testPassed} Passed, ${testFailed} Failed   `);
    console.log("=======================================================\n");

    if (testFailed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
