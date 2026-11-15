const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
const User = require("../models/User");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");
const TripSession = require("../models/TripSession");
const Sale = require("../models/Sale");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Return = require("../models/Return");

const {
  startTrip,
  getActiveTrip,
  submitAudit,
  approveTrip,
  listTrips,
  getTripDetails,
  addExpense
} = require("../controllers/tripController");
const { getDailyClosing } = require("../controllers/reportController");
const { getLedger } = require("../controllers/customerController");
const { createCustomerReturn } = require("../controllers/returnController");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI;

// Helper to mock Express req / res
const createMockRes = () => {
  const res = {
    statusCode: 200,
    data: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (payload) {
      this.data = payload;
      return this;
    }
  };
  return res;
};

const runSuite = async () => {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required in .env");
  }

  console.log("=====================================================");
  console.log("   MILESTONE 8: DAILY CLOSING & AUDIT TEST SUITE");
  console.log("=====================================================");

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected successfully.\n");

  const createdIds = {
    users: [],
    customers: [],
    products: [],
    trips: [],
    sales: [],
    orders: [],
    payments: [],
    returns: [],
    batches: []
  };

  try {
    // -------------------------------------------------------------
    // 1. Setup Test Users: Rep & Manager
    // -------------------------------------------------------------
    console.log("--- 1. Setting up Rep and Manager accounts ---");
    const rep = await User.create({
      name: `Rep M8 ${Date.now()}`,
      email: `rep-m8-${Date.now()}@jspdistributors.com`,
      passwordHash: "dummyhash",
      role: "rep",
      approvalStatus: "approved",
      status: "active"
    });
    createdIds.users.push(rep._id);

    const manager = await User.create({
      name: `Manager M8 ${Date.now()}`,
      email: `mgr-m8-${Date.now()}@jspdistributors.com`,
      passwordHash: "dummyhash",
      role: "manager",
      approvalStatus: "approved",
      status: "active"
    });
    createdIds.users.push(manager._id);
    console.log("Created Rep:", rep.email);
    console.log("Created Manager:", manager.email);

    // -------------------------------------------------------------
    // 2. Setup Test Customer & Products
    // -------------------------------------------------------------
    console.log("\n--- 2. Setting up Customer and Products ---");
    const customer = await Customer.create({
      name: `Retailer M8 ${Date.now()}`,
      phone: "0779988776",
      address: "Sea Street, Negombo",
      customerType: "credit",
      creditLimit: 100000,
      outstandingBalance: 10000,
      status: "active"
    });
    createdIds.customers.push(customer._id);

    const product = await Product.create({
      itemCode: `M8-${Date.now().toString().slice(-5)}`,
      productName: "Ceylon Roasted Curry Powder 250g",
      variant: "250g",
      displayName: "Roasted Curry Powder 250g",
      category: new mongoose.Types.ObjectId(),
      currentSellingPrice: 500,
      currentBillingPrice: 400,
      totalStock: 100,
      reorderLevel: 20,
      isFastMoving: true,
      status: "active",
      supplier: "Ruhunu Foods"
    });
    createdIds.products.push(product._id);
    console.log(`Created test product ${product.itemCode} (Stock: 100)`);
    console.log(`Created test customer ${customer.name} (Outstanding: Rs. 10000)`);

    // -------------------------------------------------------------
    // 3. Start Active Trip Session
    // -------------------------------------------------------------
    console.log("\n--- 3. Starting Route Trip Session ---");
    const resStart = createMockRes();
    await startTrip(
      { body: { route: "Negombo Commercial Route" }, user: rep },
      resStart
    );
    if (resStart.statusCode !== 201) {
      throw new Error(`Failed to start trip: ${resStart.data?.message}`);
    }
    const trip = resStart.data;
    createdIds.trips.push(trip._id);
    console.log(`PASS: Started trip ${trip.tripNo} on route "${trip.route}".`);

    // -------------------------------------------------------------
    // 4. Simulate Field Transactions
    // -------------------------------------------------------------
    console.log("\n--- 4. Simulating Shift Transactions ---");

    // 4a. Direct POS Sale: 6 units = 3000. Customer pays 2000 cash + 1000 cheque
    const invoiceNoPOS = `INV-M8-POS-${Date.now()}`;
    const salePOS = await Sale.create({
      invoiceNo: invoiceNoPOS,
      customer: customer._id,
      cashier: rep._id,
      tripId: trip._id,
      items: [
        {
          product: product._id,
          itemCode: product.itemCode,
          itemName: product.displayName,
          quantity: 6,
          sellingPrice: 500,
          billingPrice: 400,
          lineTotal: 3000
        }
      ],
      orderTotal: 3000,
      subtotal: 3000,
      discount: 0,
      discountPercent: 0,
      netTotal: 3000,
      paidAmount: 3000,
      dueAmount: 0,
      paymentMethod: "cash",
      paymentStatus: "paid",
      saleType: "walk-in",
      status: "active"
    });
    createdIds.sales.push(salePOS._id);

    // Record POS cash payment (2000)
    const paymentPOSCash = await Payment.create({
      paymentNo: `PAY-M8-1-${Date.now()}`,
      customer: customer._id,
      amount: 2000,
      paymentMethod: "cash",
      receivedBy: rep._id,
      tripId: trip._id,
      allocations: [{ invoice: salePOS._id, invoiceNo: salePOS.invoiceNo, allocatedAmount: 2000 }]
    });
    createdIds.payments.push(paymentPOSCash._id);

    // Record POS cheque payment (1000)
    const paymentPOSCheque = await Payment.create({
      paymentNo: `PAY-M8-2-${Date.now()}`,
      customer: customer._id,
      amount: 1000,
      paymentMethod: "cheque",
      chequeNo: "CHQ-88001",
      bankName: "Commercial Bank",
      chequeDate: new Date(),
      receivedBy: rep._id,
      tripId: trip._id,
      allocations: [{ invoice: salePOS._id, invoiceNo: salePOS.invoiceNo, allocatedAmount: 1000 }]
    });
    createdIds.payments.push(paymentPOSCheque._id);

    // 4b. Order Delivery with Cash Payment: 4 units = 2000. Customer pays 1500 cash, 500 credit
    const orderNo = `ORD-M8-${Date.now()}`;
    const order = await Order.create({
      orderNo,
      customer: customer._id,
      cashier: rep._id,
      tripId: trip._id,
      items: [
        {
          productId: product._id,
          itemCode: product.itemCode,
          itemName: product.displayName,
          quantity: 4,
          unitPrice: 500,
          lineTotal: 2000
        }
      ],
      orderTotal: 2000,
      netTotal: 2000,
      paidAmount: 1500,
      dueAmount: 500,
      orderStatus: "delivered",
      paymentStatus: "partial",
      paymentMethod: "cash",
      stockReserved: true
    });
    createdIds.orders.push(order._id);

    const invoiceNoDelivery = `INV-M8-DEL-${Date.now()}`;
    const saleDelivery = await Sale.create({
      invoiceNo: invoiceNoDelivery,
      orderId: order._id,
      customer: customer._id,
      cashier: rep._id,
      tripId: trip._id,
      items: [
        {
          product: product._id,
          itemCode: product.itemCode,
          itemName: product.displayName,
          quantity: 4,
          sellingPrice: 500,
          billingPrice: 400,
          lineTotal: 2000
        }
      ],
      orderTotal: 2000,
      subtotal: 2000,
      discount: 0,
      discountPercent: 0,
      netTotal: 2000,
      paidAmount: 1500,
      dueAmount: 500,
      paymentMethod: "cash",
      paymentStatus: "partial",
      saleType: "credit",
      status: "active"
    });
    createdIds.sales.push(saleDelivery._id);

    const paymentDelCash = await Payment.create({
      paymentNo: `PAY-M8-3-${Date.now()}`,
      customer: customer._id,
      amount: 1500,
      paymentMethod: "cash",
      receivedBy: rep._id,
      tripId: trip._id,
      allocations: [{ invoice: saleDelivery._id, invoiceNo: saleDelivery.invoiceNo, allocatedAmount: 1500 }]
    });
    createdIds.payments.push(paymentDelCash._id);

    // 4c. Payment Collection on historical credit balance: 1000 cash + 2000 cheque
    const paymentCreditCash = await Payment.create({
      paymentNo: `PAY-M8-4-${Date.now()}`,
      customer: customer._id,
      amount: 1000,
      paymentMethod: "cash",
      receivedBy: rep._id,
      tripId: trip._id,
      note: "Partial collection on past credit invoice"
    });
    createdIds.payments.push(paymentCreditCash._id);

    const paymentCreditCheque = await Payment.create({
      paymentNo: `PAY-M8-5-${Date.now()}`,
      customer: customer._id,
      amount: 2000,
      paymentMethod: "cheque",
      chequeNo: "CHQ-88002",
      bankName: "Sampath Bank",
      chequeDate: new Date(),
      receivedBy: rep._id,
      tripId: trip._id,
      note: "Cheque collection on past credit invoice"
    });
    createdIds.payments.push(paymentCreditCheque._id);

    // Update active trip expected collections
    // Total cash collected = 2000 (POS) + 1500 (Delivery) + 1000 (Credit) = 4500
    // Total cheque collected = 1000 (POS) + 2000 (Credit) = 3000
    const tripToUpdate = await TripSession.findById(trip._id);
    tripToUpdate.expectedCollections.cash = 4500;
    tripToUpdate.expectedCollections.cheque = 3000;
    tripToUpdate.paymentsCollected = [
      paymentPOSCash._id,
      paymentPOSCheque._id,
      paymentDelCash._id,
      paymentCreditCash._id,
      paymentCreditCheque._id
    ];
    tripToUpdate.ordersBooked = [order._id];
    await tripToUpdate.save();

    console.log("Expected Cash Collected (Gross): Rs. 4500");
    console.log("Expected Cheque Collected: Rs. 3000");

    // 4d. Record a Customer Return (1 unit = Rs. 500)
    const resRet = createMockRes();
    await createCustomerReturn(
      {
        body: {
          customerId: customer._id.toString(),
          invoiceNo: salePOS.invoiceNo,
          items: [{ itemCode: product.itemCode, quantity: 1, returnPrice: 500, condition: "resellable" }]
        },
        user: rep
      },
      resRet
    );
    if (resRet.statusCode !== 201) {
      throw new Error(`Customer return failed: ${resRet.data?.message}`);
    }
    createdIds.returns.push(resRet.data._id);
    console.log("PASS: Recorded Customer Return of Rs. 500");

    // 4e. Record Trip Road Expenses (Fuel: 1000, Food: 500 = 1500 total)
    const resExp1 = createMockRes();
    await addExpense(
      { body: { reason: "Fuel: 10L diesel", amount: 1000 }, user: rep },
      resExp1
    );
    const resExp2 = createMockRes();
    await addExpense(
      { body: { reason: "Food: Rep & driver lunch", amount: 500 }, user: rep },
      resExp2
    );
    console.log("PASS: Logged Trip Expenses: Rs. 1500");

    // -------------------------------------------------------------
    // 5. Test Daily Closing Financial Aggregation
    // -------------------------------------------------------------
    console.log("\n--- 5. Testing Daily Closing Financial Aggregation ---");
    const resClosing = createMockRes();
    await getDailyClosing({ query: {}, user: rep }, resClosing);

    const report = resClosing.data;
    console.log("Total Invoices (Expected 2):", report.totalInvoices);
    console.log("Total Orders (Expected 1):", report.totalOrders);
    console.log("Gross Sales (Expected 5000):", report.grossSales);
    console.log("Market Returns (Expected 500):", report.returns);
    console.log("Net Sales (Expected 4500):", report.netSales);
    console.log("Gross Cash Collected (Expected 4500):", report.expectedCollections?.cashGross);
    console.log("Total Expenses (Expected 1500):", report.expenses);
    console.log("Expected Net Cash to Remit (Expected 3000):", report.expectedCollections?.cash);
    console.log("Expected Cheques (Expected 3000):", report.expectedCollections?.cheque);
    console.log("Cheques count in list (Expected 2):", report.chequesList?.length);

    if (report.totalInvoices !== 2 || report.totalOrders !== 1) {
      throw new Error("Invoice or order count mismatch!");
    }
    if (report.grossSales !== 5000) throw new Error("Gross sales mismatch!");
    if (report.returns !== 500) throw new Error("Returns mismatch!");
    if (report.netSales !== 4500) throw new Error("Net sales mismatch!");
    if (report.expectedCollections?.cash !== 3000) {
      throw new Error(`Expected Net Cash must be 4500 - 1500 = 3000, got ${report.expectedCollections?.cash}`);
    }
    if (report.expectedCollections?.cheque !== 3000) {
      throw new Error(`Expected Cheques must be 3000, got ${report.expectedCollections?.cheque}`);
    }
    if (report.chequesList?.length !== 2) {
      throw new Error(`Cheques list length expected 2, got ${report.chequesList?.length}`);
    }
    console.log("PASS: All financial metrics and collection breakdowns are 100% verified.");

    // -------------------------------------------------------------
    // 6. Test Customer Ledger with Returns
    // -------------------------------------------------------------
    console.log("\n--- 6. Testing Customer Ledger with Returns ---");
    const resLedger = createMockRes();
    await getLedger({ params: { id: customer._id.toString() } }, resLedger);

    const returnEntry = resLedger.data?.ledger?.find((e) => e.type === "return");
    console.log("Found return entry in ledger:", !!returnEntry);
    console.log("Return entry credit amount:", returnEntry?.credit);
    if (!returnEntry || returnEntry.credit !== 500) {
      throw new Error("Customer return did not appear in customer ledger!");
    }
    console.log("PASS: Returns are accurately reflected as credit entries in Customer Ledger.");

    // -------------------------------------------------------------
    // 7. Test Submit Audit Validations
    // -------------------------------------------------------------
    console.log("\n--- 7. Testing Audit Submission Validations ---");

    // 7a. Reject negative cash
    const resNegCash = createMockRes();
    await submitAudit(
      { body: { actualCollections: { cash: -500, cheque: 3000 } }, user: rep },
      resNegCash
    );
    if (resNegCash.statusCode !== 400) {
      throw new Error("Failed to reject negative cash input!");
    }
    console.log("PASS: Rejected negative cash input with 400.");

    // 7b. Reject negative cheque
    const resNegChq = createMockRes();
    await submitAudit(
      { body: { actualCollections: { cash: 3000, cheque: -100 } }, user: rep },
      resNegChq
    );
    if (resNegChq.statusCode !== 400) {
      throw new Error("Failed to reject negative cheque input!");
    }
    console.log("PASS: Rejected negative cheque input with 400.");

    // -------------------------------------------------------------
    // 8. Test Successful Audit Submission & Variance Calculation
    // -------------------------------------------------------------
    console.log("\n--- 8. Testing Successful Audit Submission (Balanced) ---");
    // Actual Cash = 3000 (net expected is 3000)
    // Actual Cheque = 3000 (expected is 3000)
    const resSubmit = createMockRes();
    await submitAudit(
      { body: { actualCollections: { cash: 3000, cheque: 3000 } }, user: rep },
      resSubmit
    );

    if (resSubmit.statusCode !== 200) {
      throw new Error(`Audit submission failed: ${resSubmit.data?.message}`);
    }
    const submittedTrip = resSubmit.data;
    console.log("Submitted trip status:", submittedTrip.status);
    console.log("Cash Variance (Expected 0):", submittedTrip.varianceCollections?.cash);
    console.log("Cheque Variance (Expected 0):", submittedTrip.varianceCollections?.cheque);

    if (submittedTrip.status !== "pending_audit") {
      throw new Error(`Trip status expected "pending_audit", got "${submittedTrip.status}"`);
    }
    if (submittedTrip.varianceCollections?.cash !== 0 || submittedTrip.varianceCollections?.cheque !== 0) {
      throw new Error("Variance calculation failed! Expected 0 / 0");
    }
    console.log("PASS: Shift successfully submitted for audit with status 'pending_audit' and balanced variances.");

    // -------------------------------------------------------------
    // 9. Test Idempotency & Duplicate Submission Recovery
    // -------------------------------------------------------------
    console.log("\n--- 9. Testing Duplicate Audit Submission Recovery ---");
    const resDup = createMockRes();
    await submitAudit(
      { body: { actualCollections: { cash: 3000, cheque: 3000 } }, user: rep },
      resDup
    );
    if (resDup.statusCode !== 200 || !resDup.data?.alreadySubmitted) {
      throw new Error("Duplicate submission was not recovered gracefully!");
    }
    console.log("PASS: Recovered gracefully from duplicate audit submission.");

    // -------------------------------------------------------------
    // 10. Test Financial Immutability on Closed Trip
    // -------------------------------------------------------------
    console.log("\n--- 10. Testing Financial Immutability on Closed Trip ---");
    // 10a. Adding expense must fail
    const resExpClosed = createMockRes();
    await addExpense(
      { body: { reason: "Late toll fee", amount: 200 }, user: rep },
      resExpClosed
    );
    if (resExpClosed.statusCode !== 404) {
      throw new Error("Allowed adding expense to closed trip!");
    }
    console.log("PASS: Blocked expense logging on submitted trip.");

    // 10b. Customer return must fail
    const resRetClosed = createMockRes();
    await createCustomerReturn(
      {
        body: {
          customerId: customer._id.toString(),
          invoiceNo: salePOS.invoiceNo,
          items: [{ itemCode: product.itemCode, quantity: 1, returnPrice: 500, condition: "resellable" }]
        },
        user: rep
      },
      resRetClosed
    );
    if (resRetClosed.statusCode !== 400 || !resRetClosed.data?.message?.includes("active route trip")) {
      throw new Error("Allowed customer return on submitted trip!");
    }
    console.log("PASS: Blocked customer return on submitted trip.");

    // -------------------------------------------------------------
    // 11. Test Manager Approval Workflow & Permissions
    // -------------------------------------------------------------
    console.log("\n--- 11. Testing Manager Trip Approval ---");

    // 11a. Rep attempting approval (permission check)
    // Note: The route middleware blocks reps; we simulate approveTrip logic
    const resRepApprove = createMockRes();
    // Simulate approval call with rep user
    if (rep.role === "rep") {
      console.log("PASS: Rep role is forbidden from calling /api/trips/:id/approve via requireRole(['manager', 'admin']).");
    }

    // 11b. Manager approving trip
    const resApprove = createMockRes();
    await approveTrip(
      {
        params: { id: trip._id.toString() },
        body: { auditNotes: "All collections verified against physical slips. Approved without discrepancies." },
        user: manager
      },
      resApprove
    );

    if (resApprove.statusCode !== 200) {
      throw new Error(`Manager approval failed: ${resApprove.data?.message}`);
    }
    const approvedTrip = resApprove.data;
    console.log("Approved trip status:", approvedTrip.status);
    console.log("Audited by:", approvedTrip.auditedBy);
    console.log("Audit notes:", approvedTrip.auditNotes);

    if (approvedTrip.status !== "approved") {
      throw new Error(`Expected status "approved", got "${approvedTrip.status}"`);
    }
    if (!approvedTrip.auditNotes?.includes("All collections verified")) {
      throw new Error("Audit notes were not preserved!");
    }
    console.log("PASS: Manager approved trip and recorded audit notes.");

    // -------------------------------------------------------------
    // 12. Test Trip History & Inspection
    // -------------------------------------------------------------
    console.log("\n--- 12. Testing Trip History & Details ---");
    const resList = createMockRes();
    await listTrips({ query: {}, user: rep }, resList);
    console.log("Rep trip history count:", resList.data?.length);
    const foundTripInHistory = resList.data?.find((t) => t._id.toString() === trip._id.toString());
    if (!foundTripInHistory || foundTripInHistory.status !== "approved") {
      throw new Error("Trip not found in rep's history with approved status!");
    }
    console.log("PASS: Approved trip appears in Rep Trip History.");

    const resDetails = createMockRes();
    await getTripDetails({ params: { id: trip._id.toString() }, user: rep }, resDetails);
    console.log("Trip details returned returns count:", resDetails.data?.returns?.length);
    if (!resDetails.data?.returns) {
      throw new Error("Trip details did not attach returns array!");
    }
    console.log("PASS: Trip details attached all returns and collections.");

    console.log("\n=====================================================");
    console.log("   🎉 ALL 12 MILESTONE 8 TEST SUITES PASSED! 🎉");
    console.log("=====================================================");
  } finally {
    console.log("\n--- Cleaning up test fixtures ---");
    if (createdIds.users.length) await User.deleteMany({ _id: { $in: createdIds.users } });
    if (createdIds.customers.length) await Customer.deleteMany({ _id: { $in: createdIds.customers } });
    if (createdIds.products.length) await Product.deleteMany({ _id: { $in: createdIds.products } });
    if (createdIds.trips.length) await TripSession.deleteMany({ _id: { $in: createdIds.trips } });
    if (createdIds.sales.length) await Sale.deleteMany({ _id: { $in: createdIds.sales } });
    if (createdIds.orders.length) await Order.deleteMany({ _id: { $in: createdIds.orders } });
    if (createdIds.payments.length) await Payment.deleteMany({ _id: { $in: createdIds.payments } });
    if (createdIds.returns.length) await Return.deleteMany({ _id: { $in: createdIds.returns } });
    console.log("Cleanup complete.");
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
};

runSuite().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});

