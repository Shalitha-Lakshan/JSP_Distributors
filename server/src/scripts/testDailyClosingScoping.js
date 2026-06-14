const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Sale = require("../models/Sale");
const User = require("../models/User");
const TripSession = require("../models/TripSession");
const { getDailyClosing } = require("../controllers/reportController");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI;

const runTest = async () => {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required in .env");
  }

  console.log("Connecting to database...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected successfully.");

  // 1. Create a test Rep user
  const repUser = await User.create({
    name: `Test Rep ${Date.now()}`,
    email: `test-rep-${Date.now()}@test.com`,
    passwordHash: "dummyhash",
    role: "rep",
    approvalStatus: "approved",
    status: "active"
  });
  console.log("Created test rep:", repUser.email);

  // 2. Create a test Admin user
  const adminUser = await User.create({
    name: `Test Admin ${Date.now()}`,
    email: `test-admin-${Date.now()}@test.com`,
    passwordHash: "dummyhash",
    role: "admin",
    approvalStatus: "approved",
    status: "active"
  });
  console.log("Created test admin:", adminUser.email);

  // 3. Start a Trip Session for the Rep
  const trip = await TripSession.create({
    tripNo: `TRIP-TEST-${Date.now()}`,
    rep: repUser._id,
    route: "Test Route",
    status: "active",
    startTime: new Date()
  });
  console.log("Created active trip session:", trip.tripNo);

  // 4. Create a test Sale associated with the active trip session (Rep sale)
  const repSale = await Sale.create({
    invoiceNo: `INV-TEST-REP-${Date.now()}`,
    customer: new mongoose.Types.ObjectId(),
    cashier: repUser._id,
    items: [],
    orderTotal: 3000,
    subtotal: 3000,
    netTotal: 3000,
    paidAmount: 3000,
    dueAmount: 0,
    paymentMethod: "cash",
    paymentStatus: "paid",
    saleType: "walk-in",
    status: "active",
    tripId: trip._id
  });
  console.log("Created Rep sale under active trip:", repSale.invoiceNo, "(Rs. 3,000)");

  // 5. Create a test Sale NOT associated with the active trip session (Admin sale)
  const adminSale = await Sale.create({
    invoiceNo: `INV-TEST-ADMIN-${Date.now()}`,
    customer: new mongoose.Types.ObjectId(),
    cashier: adminUser._id,
    items: [],
    orderTotal: 5000,
    subtotal: 5000,
    netTotal: 5000,
    paidAmount: 5000,
    dueAmount: 0,
    paymentMethod: "cash",
    paymentStatus: "paid",
    saleType: "walk-in",
    status: "active"
  });
  console.log("Created Admin global sale:", adminSale.invoiceNo, "(Rs. 5,000)");

  // 6. Simulate getDailyClosing for Rep
  console.log("\n--- Simulating Daily Closing for Rep ---");
  let statusResultRep = null;
  let jsonResultRep = null;

  const mockReqRep = {
    query: { date: new Date().toISOString().slice(0, 10) },
    user: repUser
  };

  const mockResRep = {
    status: function (code) {
      statusResultRep = code;
      return this;
    },
    json: function (data) {
      jsonResultRep = data;
      return this;
    }
  };

  await getDailyClosing(mockReqRep, mockResRep);
  console.log("Rep daily closing summary:", JSON.stringify(jsonResultRep));

  // 7. Simulate getDailyClosing for Admin
  console.log("\n--- Simulating Daily Closing for Admin (Global) ---");
  let statusResultAdmin = null;
  let jsonResultAdmin = null;

  const mockReqAdmin = {
    query: { date: new Date().toISOString().slice(0, 10) },
    user: adminUser
  };

  const mockResAdmin = {
    status: function (code) {
      statusResultAdmin = code;
      return this;
    },
    json: function (data) {
      jsonResultAdmin = data;
      return this;
    }
  };

  await getDailyClosing(mockReqAdmin, mockResAdmin);
  console.log("Admin daily closing summary:", JSON.stringify(jsonResultAdmin));

  // 8. Assertions
  console.log("\n--- Running Assertions ---");
  let passed = true;

  // Rep should only see their own active trip's sale (Rs. 3000)
  if (jsonResultRep.grossSales !== 3000 || jsonResultRep.netSales !== 3000) {
    console.error("FAIL: Rep daily closing is not scoped to active trip session!");
    passed = false;
  } else {
    console.log("PASS: Rep daily closing correctly scoped to Rs. 3,000");
  }

  // Admin should see both active sales (at least Rs. 8000 due to other potential today's sales)
  if (jsonResultAdmin.grossSales < 8000 || jsonResultAdmin.netSales < 8000) {
    console.error("FAIL: Admin daily closing is not aggregating globally!");
    passed = false;
  } else {
    console.log("PASS: Admin daily closing correctly aggregated global sales (value >= Rs. 8,000)");
  }

  if (passed) {
    console.log("\nSUCCESS: All daily closing scoping verification assertions passed! 🎉");
  } else {
    throw new Error("Some assertions failed.");
  }

  // 9. Cleanup
  console.log("\nCleaning up test documents...");
  await User.findByIdAndDelete(repUser._id);
  await User.findByIdAndDelete(adminUser._id);
  await TripSession.findByIdAndDelete(trip._id);
  await Sale.findByIdAndDelete(repSale._id);
  await Sale.findByIdAndDelete(adminSale._id);
  console.log("Cleanup complete.");

  await mongoose.disconnect();
  console.log("Disconnected from database.");
};

runTest().catch(async (error) => {
  console.error("Test execution failed:", error);
  try {
    await mongoose.disconnect();
  } catch (e) {}
  process.exit(1);
});
