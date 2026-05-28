const mongoose = require("mongoose");

const usedBatchSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "StockBatch" },
    batchNo: { type: String, required: true },
    qty: { type: Number, required: true, min: 0 },
    billingPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    sellingLineTotal: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    itemCode: { type: String, required: true },
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    billingPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    usedBatches: { type: [usedBatchSchema], default: [] }
  },
  { _id: false }
);

const returnItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    itemCode: { type: String, required: true },
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    returnPrice: { type: Number, required: true, min: 0 },
    returnTotal: { type: Number, required: true, min: 0 },
    condition: {
      type: String,
      enum: ["resellable", "damaged", "expired"],
      default: "resellable"
    },
    originalInvoiceNo: { type: String, trim: true },
    reason: { type: String, trim: true }
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    items: { type: [saleItemSchema], default: [] },
    returns: { type: [returnItemSchema], default: [] },
    orderTotal: { type: Number, required: true, min: 0 },
    returnTotal: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    netTotal: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0 },
    paymentMethod: { type: String, default: "cash" },
    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "credit", "cancelled"],
      default: "paid"
    },
    saleType: { type: String, enum: ["walk-in", "credit"], default: "walk-in" },
    status: { type: String, enum: ["active", "cancelled"], default: "active" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sale", saleSchema);
