const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    barcode: { type: String, trim: true },
    itemCode: { type: String, required: true, unique: true, trim: true },
    productName: { type: String, required: true, trim: true },
    variant: { type: String, trim: true },
    displayName: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    searchKeywords: { type: [String], default: [] },
    currentSellingPrice: { type: Number, required: true, min: 0 },
    currentBillingPrice: { type: Number, required: true, min: 0 },
    totalStock: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 0, min: 0 },
    isFastMoving: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "inactive"], default: "active" }
  },
  { timestamps: true }
);

productSchema.index({ itemCode: 1 });
productSchema.index({ barcode: 1 });
productSchema.index({ searchKeywords: 1 });

module.exports = mongoose.model("Product", productSchema);
