const path = require("path");
const mongoose = require(path.join(__dirname, "../server/node_modules/mongoose"));

(async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/jsp_distributors_qa_test");
    const StockBatch = require(path.join(__dirname, "../server/src/models/StockBatch"));

    const b1 = await StockBatch.findOne({ batchNo: "B-1795183273179" });
    const b2 = await StockBatch.findOne({ batchNo: "B-1795183579949" });
    console.log("B-1795183273179:", b1 ? {
      _id: b1._id,
      batchNo: b1.batchNo,
      billingPrice: b1.billingPrice,
      sellingPrice: b1.sellingPrice,
      quantity: b1.quantity,
      remainingQty: b1.remainingQty,
      receivedDate: b1.receivedDate,
      createdAt: b1.createdAt
    } : "null");

    console.log("B-1795183579949:", b2 ? {
      _id: b2._id,
      batchNo: b2.batchNo,
      billingPrice: b2.billingPrice,
      sellingPrice: b2.sellingPrice,
      quantity: b2.quantity,
      remainingQty: b2.remainingQty,
      receivedDate: b2.receivedDate,
      createdAt: b2.createdAt
    } : "null");

    const queryResult = await StockBatch.find({ productId: b1.productId }).sort({ receivedDate: 1 });
    console.log("\nQuery with .sort({ receivedDate: 1 }):");
    queryResult.forEach(b => console.log(`${b.batchNo} | received: ${b.receivedDate.toISOString()} | created: ${b.createdAt.toISOString()}`));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
})();

