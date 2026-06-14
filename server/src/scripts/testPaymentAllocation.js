const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Sale = require("../models/Sale");
const Order = require("../models/Order");
const User = require("../models/User");
const Payment = require("../models/Payment");
const { receivePayment } = require("../controllers/paymentController");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI;

const runTest = async () => {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required in .env");
  }

  console.log("Connecting to database...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected successfully.");

  // 1. Find or create a test user
  let user = await User.findOne({ role: "admin" });
  if (!user) {
    user = await User.create({
      name: "Test Admin",
      email: `test-admin-${Date.now()}@test.com`,
      passwordHash: "dummyhash",
      role: "admin",
      approvalStatus: "approved",
      status: "active"
    });
    console.log("Created temporary admin user:", user.email);
  }

  // 2. Create test customer
  const customer = await Customer.create({
    name: `Test Customer ${Date.now()}`,
    phone: "1234567890",
    customerType: "credit",
    creditLimit: 5000,
    outstandingBalance: 1000,
    status: "active"
  });
  console.log("Created test customer:", customer.name, "with outstanding balance Rs. 1000");

  // 3. Create test Order
  const order = await Order.create({
    orderNo: `ORD-TEST-${Date.now()}`,
    customer: customer._id,
    cashier: user._id,
    items: [],
    orderTotal: 500,
    netTotal: 500,
    paidAmount: 0,
    dueAmount: 500,
    orderStatus: "pending_delivery",
    paymentStatus: "credit"
  });
  console.log("Created test order:", order.orderNo, "with dueAmount Rs. 500");

  // 4. Create test Sale
  const sale = await Sale.create({
    invoiceNo: `INV-TEST-${Date.now()}`,
    orderId: order._id,
    customer: customer._id,
    cashier: user._id,
    items: [],
    orderTotal: 500,
    subtotal: 500,
    netTotal: 500,
    paidAmount: 0,
    dueAmount: 500,
    paymentMethod: "cash",
    paymentStatus: "credit",
    saleType: "credit",
    status: "active"
  });
  console.log("Created test sale:", sale.invoiceNo, "with dueAmount Rs. 500");

  // Link order to sale
  order.saleId = sale._id;
  await order.save();

  // 5. Invoke receivePayment controller
  console.log("\nSimulating receivePayment call with allocations...");
  
  let statusResult = null;
  let jsonResult = null;

  const mockReq = {
    body: {
      customer: customer._id.toString(),
      amount: 500,
      paymentMethod: "cash",
      note: "Test payment allocation",
      allocations: [
        {
          invoice: sale._id.toString(),
          invoiceNo: sale.invoiceNo,
          allocatedAmount: 500
        }
      ]
    },
    user: {
      _id: user._id
    }
  };

  const mockRes = {
    status: function (code) {
      statusResult = code;
      return this;
    },
    json: function (data) {
      jsonResult = data;
      return this;
    }
  };

  await receivePayment(mockReq, mockRes);

  console.log("Response status:", statusResult);
  console.log("Response JSON paymentNo:", jsonResult?.paymentNo);

  // 6. Verify assertions
  if (statusResult !== 201) {
    throw new Error(`Expected status 201, got ${statusResult}`);
  }

  // Reload documents from DB
  const updatedCustomer = await Customer.findById(customer._id);
  const updatedSale = await Sale.findById(sale._id);
  const updatedOrder = await Order.findById(order._id);
  const createdPayment = await Payment.findOne({ customer: customer._id });

  console.log("\n--- Verification Results ---");
  console.log("Customer Outstanding Balance (Expected 500):", updatedCustomer.outstandingBalance);
  console.log("Sale Due Amount (Expected 0):", updatedSale.dueAmount);
  console.log("Sale Paid Amount (Expected 500):", updatedSale.paidAmount);
  console.log("Sale Payment Status (Expected 'paid'):", updatedSale.paymentStatus);
  console.log("Order Due Amount (Expected 0):", updatedOrder.dueAmount);
  console.log("Order Paid Amount (Expected 500):", updatedOrder.paidAmount);
  console.log("Order Payment Status (Expected 'paid'):", updatedOrder.paymentStatus);
  console.log("Payment Record Allocations (Expected 1 allocation):", JSON.stringify(createdPayment?.allocations));

  // Assertions
  let passed = true;
  if (updatedCustomer.outstandingBalance !== 500) {
    console.error("FAIL: Customer outstanding balance is not 500");
    passed = false;
  }
  if (updatedSale.dueAmount !== 0 || updatedSale.paymentStatus !== "paid" || updatedSale.paidAmount !== 500) {
    console.error("FAIL: Sale update failed");
    passed = false;
  }
  if (updatedOrder.dueAmount !== 0 || updatedOrder.paymentStatus !== "paid" || updatedOrder.paidAmount !== 500) {
    console.error("FAIL: Order update failed");
    passed = false;
  }
  if (!createdPayment || createdPayment.allocations.length !== 1 || createdPayment.allocations[0].allocatedAmount !== 500) {
    console.error("FAIL: Payment allocations incorrect");
    passed = false;
  }

  if (passed) {
    console.log("\nSUCCESS: All payment allocation verification assertions passed! 🎉");
  } else {
    throw new Error("Some assertions failed.");
  }

  // 7. Cleanup
  console.log("\nCleaning up test documents...");
  await Customer.findByIdAndDelete(customer._id);
  await Order.findByIdAndDelete(order._id);
  await Sale.findByIdAndDelete(sale._id);
  if (createdPayment) {
    await Payment.findByIdAndDelete(createdPayment._id);
  }
  // If we created a new test user, delete it
  if (user.email.startsWith("test-admin-")) {
    await User.findByIdAndDelete(user._id);
  }
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
