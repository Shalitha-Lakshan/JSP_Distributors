const mongoose = require("mongoose");

const stockBatchSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    batchNo: { type: String, required: true, unique: true },
    billingPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    remainingQty: { type: Number, required: true, min: 0 },
    expiryDate: { type: Date },
    receivedDate: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

stockBatchSchema.index({ productId: 1, receivedDate: 1, remainingQty: 1 });

module.exports = mongoose.model("StockBatch", stockBatchSchema);
