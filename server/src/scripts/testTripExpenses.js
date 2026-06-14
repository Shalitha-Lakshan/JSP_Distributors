const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
const User = require("../models/User");
const TripSession = require("../models/TripSession");
const { addExpense, deleteExpense } = require("../controllers/tripController");

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
    name: `Test Rep Expenses ${Date.now()}`,
    email: `test-rep-exp-${Date.now()}@test.com`,
    passwordHash: "dummyhash",
    role: "rep",
    approvalStatus: "approved",
    status: "active"
  });
  console.log("Created test rep:", repUser.email);

  // 2. Start a Trip Session for the Rep
  const trip = await TripSession.create({
    tripNo: `TRIP-EXP-${Date.now()}`,
    rep: repUser._id,
    route: "Negombo Expenses Route",
    status: "active",
    startTime: new Date()
  });
  console.log("Created active trip session:", trip.tripNo);

  // 3. Test validation check (No reason, negative price/amount)
  console.log("\n--- Testing validations ---");
  let statusVal = null;
  let jsonVal = null;

  const mockResVal = {
    status: function (code) {
      statusVal = code;
      return this;
    },
    json: function (data) {
      jsonVal = data;
      return this;
    }
  };

  const mockReqVal = {
    body: { reason: "", amount: -50 },
    user: repUser
  };

  await addExpense(mockReqVal, mockResVal);
  console.log("Validation failure response code (Expected 400):", statusVal);
  console.log("Validation failure response message:", jsonVal?.message);

  if (statusVal !== 400) {
    throw new Error("Validation assertion failed! Expected 400");
  }

  // 4. Test Add Expense successfully
  console.log("\n--- Testing successful Add Expense ---");
  let statusAdd = null;
  let jsonAdd = null;

  const mockResAdd = {
    status: function (code) {
      statusAdd = code;
      return this;
    },
    json: function (data) {
      jsonAdd = data;
      return this;
    }
  };

  const mockReqAdd = {
    body: { reason: "Fuel refill Negombo", amount: 2500 },
    user: repUser
  };

  await addExpense(mockReqAdd, mockResAdd);
  console.log("Add expense response code (Expected 201):", statusAdd);
  console.log("Active trip expenses length after add (Expected 1):", jsonAdd?.expenses?.length);
  console.log("First expense reason:", jsonAdd?.expenses?.[0]?.reason);
  console.log("First expense amount:", jsonAdd?.expenses?.[0]?.amount);

  if (statusAdd !== 201) {
    throw new Error("Add expense assertion failed! Expected 201");
  }

  const updatedTripAfterAdd = await TripSession.findById(trip._id);
  if (updatedTripAfterAdd.expenses.length !== 1 || updatedTripAfterAdd.expenses[0].amount !== 2500) {
    throw new Error("DB verification for Add Expense failed!");
  }
  console.log("PASS: Add expense verified in database.");

  // 5. Test Delete Expense successfully
  console.log("\n--- Testing successful Delete Expense ---");
  let statusDel = null;
  let jsonDel = null;

  const mockResDel = {
    status: function (code) {
      statusDel = code;
      return this;
    },
    json: function (data) {
      jsonDel = data;
      return this;
    }
  };

  const mockReqDel = {
    params: { index: 0 },
    user: repUser
  };

  await deleteExpense(mockReqDel, mockResDel);
  console.log("Delete expense response code:", statusDel || 200);
  console.log("Active trip expenses length after delete (Expected 0):", jsonDel?.expenses?.length);

  const updatedTripAfterDel = await TripSession.findById(trip._id);
  if (updatedTripAfterDel.expenses.length !== 0) {
    throw new Error("DB verification for Delete Expense failed! Expenses still exist.");
  }
  console.log("PASS: Delete expense verified in database.");

  console.log("\nSUCCESS: All Trip Expenses verification assertions passed! 🎉");

  // 6. Cleanup
  console.log("\nCleaning up test documents...");
  await User.findByIdAndDelete(repUser._id);
  await TripSession.findByIdAndDelete(trip._id);
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
