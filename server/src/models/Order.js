const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    itemCode: { type: String, required: true },
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    usedBatches: {
      type: [
        {
          batchId: { type: mongoose.Schema.Types.ObjectId, ref: "StockBatch" },
          batchNo: { type: String, required: true },
          qty: { type: Number, required: true, min: 0 },
          billingPrice: { type: Number, required: true, min: 0 },
          lineTotal: { type: Number, required: true, min: 0 }
        }
      ],
      default: []
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    items: { type: [orderItemSchema], default: [] },
    orderTotal: { type: Number, required: true, min: 0 },
    returnTotal: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    netTotal: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, default: 0, min: 0 },
    orderStatus: {
      type: String,
      enum: ["pending_delivery", "delivered", "cancelled"],
      default: "pending_delivery"
    },
    paymentStatus: {
      type: String,
      enum: ["not_collected", "paid", "partial", "credit"],
      default: "not_collected"
    },
    stockReserved: { type: Boolean, default: false },
    deliveryDate: { type: Date },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
