const path = require("path");
const mongoose = require(path.join(__dirname, "../server/node_modules/mongoose"));

(async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/jsp_distributors_qa_test");
    const Product = require(path.join(__dirname, "../server/src/models/Product"));
    const StockBatch = require(path.join(__dirname, "../server/src/models/StockBatch"));

    const products = await Product.find({});
    console.log("Total Products in QA DB:", products.length);
    products.forEach((p) => {
      console.log(`Product: ${p.itemCode} | ${p.displayName} | Stock: ${p.totalStock} | ID: ${p._id}`);
    });

    const batches = await StockBatch.find({}).sort({ receivedDate: 1, createdAt: 1 });
    console.log("\nTotal Batches in QA DB:", batches.length);
    batches.forEach((b) => {
      console.log(`Batch: ${b.batchNo} | Prod: ${b.productId} | RemQty: ${b.remainingQty} | Billing: ${b.billingPrice} | Selling: ${b.sellingPrice} | Received: ${b.receivedDate?.toISOString()}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
})();
