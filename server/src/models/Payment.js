const mongoose = require("mongoose");

const allocationSchema = new mongoose.Schema(
  {
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
    invoiceNo: { type: String, required: true },
    allocatedAmount: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    paymentNo: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, default: "cash" },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    note: { type: String, trim: true },
    allocations: { type: [allocationSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
