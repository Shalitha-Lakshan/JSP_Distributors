const mongoose = require("mongoose");

const supplierReturnItemSchema = new mongoose.Schema(
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

const supplierReturnSchema = new mongoose.Schema(
  {
    supplierInvoiceNo: { type: String, required: true, unique: true },
    supplierName: { type: String, default: "Ruhunu Foods" },
    reportingMonth: { type: String }, // e.g. "2026-11"
    status: {
      type: String,
      enum: ["draft", "ready_for_dispatch", "dispatched", "partially_acknowledged", "acknowledged", "settled"],
      default: "dispatched"
    },
    dispatchedAt: { type: Date, default: Date.now },
    dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    transportRef: { type: String, trim: true },
    acknowledgedAt: { type: Date },
    creditNoteRef: { type: String, trim: true },
    settlementNotes: { type: String, trim: true },
    items: { type: [supplierReturnItemSchema], default: [] },
    totalAmount: { type: Number, required: true, min: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupplierReturn", supplierReturnSchema);
