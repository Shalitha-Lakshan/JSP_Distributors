const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
const User = require("../models/User");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");
const TripSession = require("../models/TripSession");
const Sale = require("../models/Sale");
const Return = require("../models/Return");
const {
  addExpense,
  deleteExpense
} = require("../controllers/tripController");
const {
  createCustomerReturn,
  getCustomerReturns,
  getEligibleInvoices,
  inspectReturn
} = require("../controllers/returnController");
const { getDailyClosing } = require("../controllers/reportController");

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
  console.log("   MILESTONE 7: RETURNS & EXPENSES TEST SUITE");
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
    returns: [],
    batches: []
  };

  try {
    // -------------------------------------------------------------
    // SETUP: Test Rep, Customer, Product
    // -------------------------------------------------------------
    console.log("--- 1. Setting up test fixtures ---");
    const rep = await User.create({
      name: `Rep M7 ${Date.now()}`,
      email: `rep-m7-${Date.now()}@jspdistributors.com`,
      passwordHash: "dummyhash",
      role: "rep",
      approvalStatus: "approved",
      status: "active"
    });
    createdIds.users.push(rep._id);
    console.log("Created test rep:", rep.email);

    const manager = await User.create({
      name: `Manager M7 ${Date.now()}`,
      email: `mgr-m7-${Date.now()}@jspdistributors.com`,
      passwordHash: "dummyhash",
      role: "manager",
      approvalStatus: "approved",
      status: "active"
    });
    createdIds.users.push(manager._id);
    console.log("Created test manager:", manager.email);

    const customer = await Customer.create({
      name: `Customer M7 ${Date.now()}`,
      phone: "0771234567",
      address: "123 Main St, Negombo",
      customerType: "credit",
      creditLimit: 50000,
      outstandingBalance: 5000,
      status: "active"
    });
    createdIds.customers.push(customer._id);
    console.log("Created test customer with outstandingBalance: Rs. 5000");

    const product = await Product.create({
      itemCode: `M7-${Date.now().toString().slice(-5)}`,
      productName: "Chili Powder 100g",
      variant: "100g",
      displayName: "Chili Powder 100g - Ruhunu",
      category: new mongoose.Types.ObjectId(),
      currentSellingPrice: 400,
      currentBillingPrice: 320,
      totalStock: 50,
      reorderLevel: 10,
      isFastMoving: true,
      status: "active",
      supplier: "Ruhunu Foods"
    });
    createdIds.products.push(product._id);
    console.log(`Created test product ${product.itemCode} with initial stock: ${product.totalStock} units`);

    // -------------------------------------------------------------
    // TEST 2: Active Trip Gatekeeper for Field Returns
    // -------------------------------------------------------------
    console.log("\n--- 2. Testing Active Trip Gatekeeper for Field Returns ---");
    const resNoTrip = createMockRes();
    await createCustomerReturn(
      {
        body: {
          customerId: customer._id.toString(),
          invoiceNo: "INV-DUMMY",
          items: [{ itemCode: product.itemCode, quantity: 1, condition: "resellable" }]
        },
        user: rep
      },
      resNoTrip
    );
    console.log("Response status with no active trip:", resNoTrip.statusCode);
    console.log("Response message:", resNoTrip.data?.message);
    if (resNoTrip.statusCode !== 400 || !resNoTrip.data?.message?.includes("active route trip")) {
      throw new Error("Active trip gatekeeper test failed!");
    }
    console.log("PASS: Blocked return submission when no trip is active.");

    // -------------------------------------------------------------
    // TEST 3: Start Active Trip & Test Trip Expenses Management
    // -------------------------------------------------------------
    console.log("\n--- 3. Testing Trip Expenses Management ---");
    const trip = await TripSession.create({
      tripNo: `TRIP-M7-${Date.now()}`,
      rep: rep._id,
      route: "Negombo Coastal Route",
      status: "active",
      startTime: new Date(),
      expectedCollections: { cash: 10000, cheque: 0 },
      expenses: []
    });
    createdIds.trips.push(trip._id);
    console.log("Created active trip session:", trip.tripNo);

    // 3a. Add invalid expense (empty reason / negative amount)
    const resInvExp = createMockRes();
    await addExpense(
      { body: { reason: "", amount: -100 }, user: rep },
      resInvExp
    );
    if (resInvExp.statusCode !== 400) {
      throw new Error("Invalid expense assertion failed! Expected 400");
    }
    console.log("PASS: Invalid expense rejected with 400.");

    // 3b. Add 3 valid expenses across categories
    const resExp1 = createMockRes();
    await addExpense(
      { body: { reason: "Fuel: Shell Station 15L Diesel", amount: 2500 }, user: rep },
      resExp1
    );
    const resExp2 = createMockRes();
    await addExpense(
      { body: { reason: "Food: Rep & driver lunch", amount: 600 }, user: rep },
      resExp2
    );
    const resExp3 = createMockRes();
    await addExpense(
      { body: { reason: "Toll: Expressway entrance fee", amount: 400 }, user: rep },
      resExp3
    );

    const tripAfterExpenses = await TripSession.findById(trip._id);
    const expTotal = tripAfterExpenses.expenses.reduce((s, e) => s + e.amount, 0);
    console.log(`Trip expenses count: ${tripAfterExpenses.expenses.length}, Total amount: Rs. ${expTotal}`);
    if (tripAfterExpenses.expenses.length !== 3 || expTotal !== 3500) {
      throw new Error(`Expense addition failed! Expected count 3 and total 3500, got ${expTotal}`);
    }
    console.log("PASS: 3 expenses logged successfully (Total: Rs. 3500).");

    // 3c. Delete expense by index (Delete index 1: Food 600)
    const resDelExp = createMockRes();
    await deleteExpense(
      { params: { index: 1 }, user: rep },
      resDelExp
    );
    const tripAfterDel = await TripSession.findById(trip._id);
    const expTotalAfterDel = tripAfterDel.expenses.reduce((s, e) => s + e.amount, 0);
    console.log(`After deleting index 1 -> Count: ${tripAfterDel.expenses.length}, New Total: Rs. ${expTotalAfterDel}`);
    if (tripAfterDel.expenses.length !== 2 || expTotalAfterDel !== 2900) {
      throw new Error(`Expense deletion failed! Expected 2 items and total 2900, got ${expTotalAfterDel}`);
    }
    console.log("PASS: Expense deleted successfully with index tracking.");

    // -------------------------------------------------------------
    // TEST 4: Original Sale Creation for Return Testing
    // -------------------------------------------------------------
    console.log("\n--- 4. Creating original credit sale ---");
    const originalInvoiceNo = `INV-M7-${Date.now()}`;
    const sale = await Sale.create({
      invoiceNo: originalInvoiceNo,
      customer: customer._id,
      cashier: rep._id,
      tripId: trip._id,
      items: [
        {
          product: product._id,
          itemCode: product.itemCode,
          itemName: product.displayName,
          quantity: 10,
          sellingPrice: 400,
          billingPrice: 320,
          lineTotal: 4000
        }
      ],
      orderTotal: 4000,
      returnTotal: 0,
      subtotal: 4000,
      discount: 0,
      discountPercent: 0,
      netTotal: 4000,
      paidAmount: 0,
      dueAmount: 4000,
      paymentMethod: "credit",
      paymentStatus: "credit",
      saleType: "credit",
      status: "active"
    });
    createdIds.sales.push(sale._id);
    console.log(`Created original sale ${sale.invoiceNo}: 10 units @ Rs. 400 (Net Total: Rs. 4000, Due: Rs. 4000)`);

    // -------------------------------------------------------------
    // TEST 5: Return Validation - Non-existent item & Quantity Exceeding
    // -------------------------------------------------------------
    console.log("\n--- 5. Testing Return Item Validations & Capping ---");

    // 5a. Item not on original invoice
    const resWrongItem = createMockRes();
    await createCustomerReturn(
      {
        body: {
          customerId: customer._id.toString(),
          invoiceNo: originalInvoiceNo,
          items: [{ itemCode: "NON-EXISTENT", quantity: 2, condition: "resellable" }]
        },
        user: rep
      },
      resWrongItem
    );
    if (resWrongItem.statusCode !== 400) {
      throw new Error("Expected 400 when returning item not on invoice.");
    }
    console.log("PASS: Rejected item not present on invoice.");

    // 5b. Quantity exceeding sold quantity (15 > 10)
    const resExcessQty = createMockRes();
    await createCustomerReturn(
      {
        body: {
          customerId: customer._id.toString(),
          invoiceNo: originalInvoiceNo,
          items: [{ itemCode: product.itemCode, quantity: 15, condition: "resellable" }]
        },
        user: resExcessQty
      },
      resExcessQty
    );
    if (resExcessQty.statusCode !== 400 || !resExcessQty.data?.message?.includes("exceeds remaining")) {
      throw new Error("Expected 400 when return quantity exceeds purchased quantity.");
    }
    console.log("PASS: Blocked return quantity exceeding sold quantity (15 > 10).");

    // -------------------------------------------------------------
    // TEST 6: Resellable Customer Return (Restock & Ledger Adjustment)
    // -------------------------------------------------------------
    console.log("\n--- 6. Testing Resellable Return (Stock Restoral + Ledger Adjustment) ---");
    const initialProductStock = product.totalStock; // 50
    const initialCustomerBalance = customer.outstandingBalance; // 5000
    const initialSaleDue = sale.dueAmount; // 4000

    const returnQty1 = 4;
    const returnVal1 = returnQty1 * 400; // 1600

    const resRet1 = createMockRes();
    await createCustomerReturn(
      {
        body: {
          customerId: customer._id.toString(),
          invoiceNo: originalInvoiceNo,
          items: [
            {
              itemCode: product.itemCode,
              quantity: returnQty1,
              returnPrice: 400,
              condition: "resellable",
              reason: "Excess stock requested by retailer"
            }
          ]
        },
        user: rep
      },
      resRet1
    );

    if (resRet1.statusCode !== 201) {
      throw new Error(`Failed to create resellable return! Status: ${resRet1.statusCode}, message: ${resRet1.data?.message}`);
    }
    createdIds.returns.push(resRet1.data._id);
    console.log(`Created resellable return record: ${resRet1.data._id}, Return Total: Rs. ${resRet1.data.returnTotal}`);

    // Verify Stock remains unmutated prior to inspection (Milestone 8 policy)
    const productBeforeInspection = await Product.findById(product._id);
    console.log(`Product stock before inspection: ${productBeforeInspection.totalStock} (Awaiting manager approval)`);
    if (productBeforeInspection.totalStock !== initialProductStock) {
      throw new Error(`Stock should not increase until manager inspection! Got: ${productBeforeInspection.totalStock}`);
    }

    // Manager performs warehouse return inspection & approves resellable stock
    const resInsp1 = createMockRes();
    await inspectReturn(
      {
        params: { id: resRet1.data._id.toString() },
        body: {
          inspections: [
            {
              itemCode: product.itemCode,
              approvedResellableQty: returnQty1,
              rejectedQty: 0
            }
          ],
          inspectionNotes: "Inspected and approved for stock restoration."
        },
        user: manager
      },
      resInsp1
    );

    if (resInsp1.statusCode !== 200) {
      throw new Error(`Inspection failed! Status: ${resInsp1.statusCode}, message: ${resInsp1.data?.message}`);
    }

    // Verify Stock increased for resellable AFTER inspection approval
    const updatedProduct1 = await Product.findById(product._id);
    console.log(`Product stock after manager inspection: ${updatedProduct1.totalStock} (Restored to 54)`);
    if (updatedProduct1.totalStock !== initialProductStock + returnQty1) {
      throw new Error(`Stock was not restored properly after inspection! Expected ${initialProductStock + returnQty1}, got ${updatedProduct1.totalStock}`);
    }

    // Verify StockBatch was created
    const createdBatch = await StockBatch.findOne({ productId: product._id, quantity: returnQty1 });
    if (!createdBatch || !createdBatch.batchNo.startsWith("R-")) {
      throw new Error("StockBatch was not created for resellable return!");
    }
    createdIds.batches.push(createdBatch._id);
    console.log("PASS: Created StockBatch for resellable return:", createdBatch.batchNo);

    // Verify Customer Ledger adjustment
    const updatedCustomer1 = await Customer.findById(customer._id);
    console.log(`Customer balance before: Rs. ${initialCustomerBalance}, after return: Rs. ${updatedCustomer1.outstandingBalance}`);
    if (updatedCustomer1.outstandingBalance !== initialCustomerBalance - returnVal1) {
      throw new Error(`Customer balance not decremented! Expected ${initialCustomerBalance - returnVal1}, got ${updatedCustomer1.outstandingBalance}`);
    }

    // Verify Sale dueAmount adjustment
    const updatedSale1 = await Sale.findById(sale._id);
    console.log(`Sale due before: Rs. ${initialSaleDue}, after return: Rs. ${updatedSale1.dueAmount}`);
    if (updatedSale1.dueAmount !== initialSaleDue - returnVal1) {
      throw new Error(`Sale dueAmount not adjusted! Expected ${initialSaleDue - returnVal1}, got ${updatedSale1.dueAmount}`);
    }
    console.log("PASS: Resellable return stock restocked and ledger decremented accurately.");

    // -------------------------------------------------------------
    // TEST 7: Damaged Return (Held for Supplier, NO Stock Restoration)
    // -------------------------------------------------------------
    console.log("\n--- 7. Testing Damaged Return & Cumulative Capping ---");
    // Remaining available: 10 - 4 = 6
    // Attempt 7 units -> should fail
    const resExcess2 = createMockRes();
    await createCustomerReturn(
      {
        body: {
          customerId: customer._id.toString(),
          invoiceNo: originalInvoiceNo,
          items: [{ itemCode: product.itemCode, quantity: 7, condition: "damaged" }]
        },
        user: rep
      },
      resExcess2
    );
    if (resExcess2.statusCode !== 400 || !resExcess2.data?.message?.includes("exceeds remaining eligible quantity (6)")) {
      throw new Error("Cumulative capping test failed! Allowed returning more than remaining eligible quantity.");
    }
    console.log("PASS: Cumulative capping enforced! Blocked 7 units when only 6 remaining.");

    // Now return 3 units as 'damaged'
    const returnQty2 = 3;
    const returnVal2 = returnQty2 * 400; // 1200
    const stockBeforeDamaged = updatedProduct1.totalStock; // 54

    const resRet2 = createMockRes();
    await createCustomerReturn(
      {
        body: {
          customerId: customer._id.toString(),
          invoiceNo: originalInvoiceNo,
          items: [
            {
              itemCode: product.itemCode,
              quantity: returnQty2,
              returnPrice: 400,
              condition: "damaged",
              reason: "Packaging burst during storage"
            }
          ]
        },
        user: rep
      },
      resRet2
    );

    if (resRet2.statusCode !== 201) {
      throw new Error(`Failed to create damaged return! Status: ${resRet2.statusCode}, message: ${resRet2.data?.message}`);
    }
    createdIds.returns.push(resRet2.data._id);
    console.log(`Created damaged return record: ${resRet2.data._id}, Return Total: Rs. ${resRet2.data.returnTotal}`);

    // Verify Stock was NOT restored for damaged item
    const updatedProduct2 = await Product.findById(product._id);
    console.log(`Product stock before damaged: ${stockBeforeDamaged}, after damaged: ${updatedProduct2.totalStock}`);
    if (updatedProduct2.totalStock !== stockBeforeDamaged) {
      throw new Error("Damaged stock was erroneously added to sellable stock!");
    }
    console.log("PASS: Damaged items are NOT restored to sellable inventory.");

    // Verify item has pending status for supplier return
    const savedRet2 = await Return.findById(resRet2.data._id);
    if (savedRet2.items[0].status !== "pending") {
      throw new Error("Damaged item status should be 'pending' for manager dispatch!");
    }
    console.log("PASS: Damaged item is stored as 'pending' for supplier dispatch.");

    // Verify Customer balance updated again
    const updatedCustomer2 = await Customer.findById(customer._id);
    console.log(`Customer balance after second return: Rs. ${updatedCustomer2.outstandingBalance}`);
    if (updatedCustomer2.outstandingBalance !== initialCustomerBalance - returnVal1 - returnVal2) {
      throw new Error(`Customer balance expected ${initialCustomerBalance - returnVal1 - returnVal2}, got ${updatedCustomer2.outstandingBalance}`);
    }
    console.log("PASS: Customer ledger credited for damaged return.");

    // -------------------------------------------------------------
    // TEST 8: Eligible Invoices Endpoint
    // -------------------------------------------------------------
    console.log("\n--- 8. Testing Eligible Invoices Endpoint ---");
    const resEligible = createMockRes();
    await getEligibleInvoices(
      { params: { customerId: customer._id.toString() }, user: rep },
      resEligible
    );
    console.log("Eligible invoices count:", resEligible.data?.length);
    const matchedInvoice = resEligible.data?.find((i) => i.invoiceNo === originalInvoiceNo);
    if (!matchedInvoice) {
      throw new Error("Original invoice not found in eligible invoices list!");
    }
    const eligibleItem = matchedInvoice.items.find((i) => i.itemCode === product.itemCode);
    console.log(`Invoice ${originalInvoiceNo} eligible quantity remaining: ${eligibleItem?.eligibleQty} (Expected 3)`);
    if (eligibleItem?.eligibleQty !== 3) {
      throw new Error(`Eligible quantity calculation failed! Expected 3, got ${eligibleItem?.eligibleQty}`);
    }
    console.log("PASS: Eligible invoices endpoint returns correct remaining returnable units (3).");

    // -------------------------------------------------------------
    // TEST 9: Return History & Filtering
    // -------------------------------------------------------------
    console.log("\n--- 9. Testing Return History & Filtering ---");
    // 9a. Filter by customer
    const resHistAll = createMockRes();
    await getCustomerReturns(
      { query: { customerId: customer._id.toString() }, user: rep },
      resHistAll
    );
    console.log("Total returns for customer:", resHistAll.data?.length);
    if (resHistAll.data?.length < 2) {
      throw new Error(`Expected at least 2 returns for customer, got ${resHistAll.data?.length}`);
    }

    // 9b. Filter by condition: 'resellable'
    const resHistResellable = createMockRes();
    await getCustomerReturns(
      { query: { customerId: customer._id.toString(), condition: "resellable" }, user: rep },
      resHistResellable
    );
    console.log("Resellable returns count:", resHistResellable.data?.length);
    if (resHistResellable.data?.length !== 1) {
      throw new Error(`Expected 1 resellable return, got ${resHistResellable.data?.length}`);
    }

    // 9c. Filter by condition: 'damaged'
    const resHistDamaged = createMockRes();
    await getCustomerReturns(
      { query: { customerId: customer._id.toString(), condition: "damaged" }, user: rep },
      resHistDamaged
    );
    console.log("Damaged returns count:", resHistDamaged.data?.length);
    if (resHistDamaged.data?.length !== 1) {
      throw new Error(`Expected 1 damaged return, got ${resHistDamaged.data?.length}`);
    }
    console.log("PASS: Return history filters work seamlessly.");

    // -------------------------------------------------------------
    // TEST 10: Daily Closing Report Integration
    // -------------------------------------------------------------
    console.log("\n--- 10. Testing Daily Closing Integration (Expenses & Returns) ---");
    const resClosing = createMockRes();
    await getDailyClosing(
      { query: {}, user: rep },
      resClosing
    );

    console.log("Daily Closing Expenses (Expected 2900):", resClosing.data?.expenses);
    console.log("Daily Closing Returns (Expected 2800):", resClosing.data?.returns);

    if (resClosing.data?.expenses !== 2900) {
      throw new Error(`Daily closing expenses expected 2900, got ${resClosing.data?.expenses}`);
    }
    if (resClosing.data?.returns !== 2800) {
      throw new Error(`Daily closing returns expected 2800 (1600 + 1200), got ${resClosing.data?.returns}`);
    }
    console.log("PASS: Daily closing correctly reflects both trip expenses and field customer returns!");

    console.log("\n=====================================================");
    console.log("   🎉 ALL 10 MILESTONE 7 TEST SUITES PASSED! 🎉");
    console.log("=====================================================");
  } finally {
    console.log("\n--- Cleaning up test fixtures ---");
    if (createdIds.users.length) await User.deleteMany({ _id: { $in: createdIds.users } });
    if (createdIds.customers.length) await Customer.deleteMany({ _id: { $in: createdIds.customers } });
    if (createdIds.products.length) await Product.deleteMany({ _id: { $in: createdIds.products } });
    if (createdIds.trips.length) await TripSession.deleteMany({ _id: { $in: createdIds.trips } });
    if (createdIds.sales.length) await Sale.deleteMany({ _id: { $in: createdIds.sales } });
    if (createdIds.returns.length) await Return.deleteMany({ _id: { $in: createdIds.returns } });
    if (createdIds.batches.length) await StockBatch.deleteMany({ _id: { $in: createdIds.batches } });
    console.log("Cleanup completed.");
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
};

runSuite().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});

