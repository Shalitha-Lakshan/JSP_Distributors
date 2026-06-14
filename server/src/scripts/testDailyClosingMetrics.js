const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
const User = require("../models/User");
const TripSession = require("../models/TripSession");
const Sale = require("../models/Sale");
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
    name: `Test Rep Metrics ${Date.now()}`,
    email: `test-rep-metrics-${Date.now()}@test.com`,
    passwordHash: "dummyhash",
    role: "rep",
    approvalStatus: "approved",
    status: "active"
  });
  console.log("Created test rep:", repUser.email);

  // 2. Start a Trip Session for the Rep
  const trip = await TripSession.create({
    tripNo: `TRIP-MET-${Date.now()}`,
    rep: repUser._id,
    route: "Gampaha Delivery Route",
    status: "active",
    startTime: new Date(),
    expectedCollections: {
      cash: 2300, // Simulated collections from sales
      cheque: 0
    },
    expenses: [
      { reason: "Fuel refill", amount: 300 }
    ]
  });
  console.log("Created active trip session:", trip.tripNo);

  // 3. Create a simulated Sale document linked to the Trip Session
  // orderTotal (Gross) = 3000, returns = 500, discount = 200, netTotal = 2300
  const sale = await Sale.create({
    invoiceNo: `INV-TEST-${Date.now()}`,
    customer: new mongoose.Types.ObjectId(),
    cashier: repUser._id,
    tripId: trip._id,
    orderTotal: 3000,
    returnTotal: 500,
    subtotal: 3000,
    discount: 200,
    netTotal: 2300,
    paidAmount: 2300,
    dueAmount: 0,
    balance: 0,
    paymentMethod: "cash",
    paymentStatus: "paid",
    saleType: "walk-in"
  });
  console.log("Created simulated sale:", sale.invoiceNo);

  // 4. Invoke the getDailyClosing controller method using a mock req/res
  console.log("\n--- Testing getDailyClosing report metrics aggregation ---");
  let responseStatus = null;
  let responseData = null;

  const mockReq = {
    user: repUser,
    query: {}
  };

  const mockRes = {
    status: function (code) {
      responseStatus = code;
      return this;
    },
    json: function (data) {
      responseData = data;
      return this;
    }
  };

  await getDailyClosing(mockReq, mockRes);

  console.log("Response data received:");
  console.log(JSON.stringify(responseData, null, 2));

  // Assert all mandatory metrics are calculated correctly
  const { grossSales, returns, expenses, netSales, discounts, netCashCollection } = responseData;

  console.log("\n--- Verification Assertions ---");
  console.log("Assert Gross Sales (Expected 3000):", grossSales);
  console.log("Assert Returns (Expected 500):", returns);
  console.log("Assert Discounts (Expected 200):", discounts);
  console.log("Assert Expenses (Expected 300):", expenses);
  console.log("Assert Net Sales (Expected 2300):", netSales);
  console.log("Assert Net Cash Collection (Expected 2000):", netCashCollection);

  if (grossSales !== 3000) throw new Error("Gross Sales assertion failed!");
  if (returns !== 500) throw new Error("Returns assertion failed!");
  if (discounts !== 200) throw new Error("Discounts assertion failed!");
  if (expenses !== 300) throw new Error("Expenses assertion failed!");
  if (netSales !== 2300) throw new Error("Net Sales assertion failed!");
  if (netCashCollection !== 2000) throw new Error("Net Cash Collection assertion failed!");

  console.log("\nPASS: All Daily Closing Report aggregation calculations are perfectly correct! 🎉");

  // 5. Cleanup
  console.log("\nCleaning up test documents...");
  await User.findByIdAndDelete(repUser._id);
  await TripSession.findByIdAndDelete(trip._id);
  await Sale.findByIdAndDelete(sale._id);
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
