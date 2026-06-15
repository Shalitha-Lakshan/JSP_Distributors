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
    supplierInvoiceNo: { type: String },
    dispatchedAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Return", returnSchema);
