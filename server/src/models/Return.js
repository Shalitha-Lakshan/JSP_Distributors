const mongoose = require("mongoose");

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
    reason: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "dispatched"],
      default: "pending"
    },
    inspectionStatus: {
      type: String,
      enum: ["pending_inspection", "approved", "rejected"],
      default: "pending_inspection"
    },
    approvedResellableQty: { type: Number, default: 0, min: 0 },
    rejectedQty: { type: Number, default: 0, min: 0 },
    rejectionReason: { type: String, trim: true },
    inspectedAt: { type: Date },
    inspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    stockBatchId: { type: mongoose.Schema.Types.ObjectId, ref: "StockBatch" },
    supplierInvoiceNo: { type: String },
    dispatchedAt: { type: Date }
  },
  { _id: false }
);

const returnSchema = new mongoose.Schema(
  {
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
    invoiceNo: { type: String, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    items: { type: [returnItemSchema], default: [] },
    returnTotal: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "dispatched"],
      default: "pending"
    },
    inspectionStatus: {
      type: String,
      enum: ["pending_inspection", "partially_approved", "approved", "rejected"],
      default: "pending_inspection"
    },
    inspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    inspectedAt: { type: Date },
    inspectionNotes: { type: String, trim: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "TripSession" },
    supplierInvoiceNo: { type: String },
    dispatchedAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Return", returnSchema);
