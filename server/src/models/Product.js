const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    barcode: { type: String, trim: true, unique: true, sparse: true },
    itemCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    productName: { type: String, required: true, trim: true },
    variant: { type: String, required: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    searchKeywords: { type: [String], default: [] },
    currentSellingPrice: { type: Number, required: true, min: 0 },
    currentBillingPrice: { type: Number, required: true, min: 0 },
    totalStock: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 0, min: 0 },
    isFastMoving: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    supplier: {
      type: String,
      enum: ["Ruhunu Foods", "Gajamuthu Foods"],
      default: "Ruhunu Foods"
    }
  },
  { timestamps: true }
);

productSchema.pre("save", function (next) {
  if (this.productName && this.variant) {
    this.displayName = `${this.productName} ${this.variant}`.trim();
  }

  if (this.searchKeywords && this.searchKeywords.length > 0) {
    this.searchKeywords = this.searchKeywords.map((keyword) =>
      String(keyword).trim().toLowerCase()
    );
  }

  next();
});

productSchema.index({ itemCode: 1 });
productSchema.index({ barcode: 1 });
productSchema.index({ productName: "text", displayName: "text" });
productSchema.index({ searchKeywords: 1 });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });

module.exports = mongoose.model("Product", productSchema);
