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
    dispatchedAt: { type: Date, default: Date.now },
    dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    items: { type: [supplierReturnItemSchema], default: [] },
    totalAmount: { type: Number, required: true, min: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupplierReturn", supplierReturnSchema);
