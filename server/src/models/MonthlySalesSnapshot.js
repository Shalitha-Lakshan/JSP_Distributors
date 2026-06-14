const mongoose = require("mongoose");

/**
 * MonthlySalesSnapshot
 * ---------------------
 * One document per calendar month (e.g. "2026-06").
 * Accumulates revenue and profit totals from paid invoices
 * that were deleted during the End-of-Month Cleanup.
 *
 * Revenue = sum of netTotal (what the customer paid / owed)
 * Profit  = sum of (sellingLineTotal – lineTotal) across all items
 *           i.e. selling price revenue minus billing (cost) price
 */
const monthlySalesSnapshotSchema = new mongoose.Schema(
  {
    month: {
      type: String,          // "YYYY-MM"  e.g.  "2026-06"
      required: true,
      unique: true,
      match: /^\d{4}-\d{2}$/
    },
    totalRevenue: { type: Number, default: 0, min: 0 },
    totalProfit:  { type: Number, default: 0 },
    invoiceCount: { type: Number, default: 0, min: 0 }   // how many invoices were archived
  },
  { timestamps: true }
);

module.exports = mongoose.model("MonthlySalesSnapshot", monthlySalesSnapshotSchema);
