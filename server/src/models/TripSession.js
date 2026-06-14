const mongoose = require("mongoose");

const tripSessionSchema = new mongoose.Schema(
  {
    tripNo: { type: String, required: true, unique: true },
    rep: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    route: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["active", "pending_audit", "approved"],
      default: "active"
    },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    expectedCollections: {
      cash: { type: Number, default: 0 },
      cheque: { type: Number, default: 0 }
    },
    actualCollections: {
      cash: { type: Number, default: 0 },
      cheque: { type: Number, default: 0 }
    },
    varianceCollections: {
      cash: { type: Number, default: 0 },
      cheque: { type: Number, default: 0 }
    },
    ordersBooked: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
    paymentsCollected: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }],
    expenses: [
      {
        reason: { type: String, required: true },
        amount: { type: Number, required: true, min: 0 }
      }
    ],
    auditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    auditedAt: { type: Date },
    auditNotes: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("TripSession", tripSessionSchema);
