const path = require("path");
const mongoose = require(path.join(__dirname, "../server/node_modules/mongoose"));

(async () => {
  try {
    const uri = "mongodb+srv://shalitha:1234567890@cluster0.p7p77.mongodb.net/jsp_distributors?retryWrites=true&w=majority";
    await mongoose.connect(uri);
    const StockBatch = require(path.join(__dirname, "../server/src/models/StockBatch"));

    const b1 = await StockBatch.findOne({ batchNo: "B-1795183273179" });
    const b2 = await StockBatch.findOne({ batchNo: "B-1795183579949" });

    console.log("Atlas B-1795183273179:", b1 ? {
      batchNo: b1.batchNo,
      billingPrice: b1.billingPrice,
      sellingPrice: b1.sellingPrice,
      quantity: b1.quantity,
      remainingQty: b1.remainingQty,
      receivedDate: b1.receivedDate,
      createdAt: b1.createdAt
    } : "not found");

    console.log("Atlas B-1795183579949:", b2 ? {
      batchNo: b2.batchNo,
      billingPrice: b2.billingPrice,
      sellingPrice: b2.sellingPrice,
      quantity: b2.quantity,
      remainingQty: b2.remainingQty,
      receivedDate: b2.receivedDate,
      createdAt: b2.createdAt
    } : "not found");

    if (b1) {
      const all = await StockBatch.find({ productId: b1.productId });
      console.log("\nAll batches for TP50 in Atlas:");
      all.forEach(b => console.log(`${b.batchNo} | remQty: ${b.remainingQty} | billing: ${b.billingPrice} | received: ${b.receivedDate?.toISOString()} | created: ${b.createdAt?.toISOString()}`));
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
})();

