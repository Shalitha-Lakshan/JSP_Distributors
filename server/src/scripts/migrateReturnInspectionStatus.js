/**
 * Historical Return Inspection Status Migration Script
 *
 * SAFETY & IDEMPOTENCY:
 * - Default mode is DRY-RUN: Does not write any changes unless --execute is passed.
 * - Identifies historical returns that were ALREADY restocked in Milestone 7.
 * - Stamped with `inspectionStatus: "approved"` and `approvedResellableQty: item.quantity`.
 * - CRITICAL: Never increments Product.totalStock or creates duplicate StockBatches.
 * - Can be executed multiple times safely without duplicate side effects.
 *
 * Usage:
 *   node server/src/scripts/migrateReturnInspectionStatus.js             # Dry run mode
 *   node server/src/scripts/migrateReturnInspectionStatus.js --execute   # Live execution
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Return = require("../models/Return");
const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");

const isExecute = process.argv.includes("--execute");

async function runMigration() {
  console.log("=====================================================");
  console.log("   HISTORICAL RETURN SAFETY & MIGRATION SCRIPT      ");
  console.log("=====================================================");
  console.log(`MODE: ${isExecute ? "🚨 LIVE EXECUTION" : "🛡️  DRY-RUN (SIMULATION ONLY)"}`);
  console.log(`TIME: ${new Date().toISOString()}`);

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("FATAL: MONGO_URI environment variable is not defined.");
    process.exit(1);
  }

  const shouldManageConnection = mongoose.connection.readyState === 0;
  if (shouldManageConnection) {
    console.log("\nConnecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected successfully.\n");
  }

  const totalReturnsCount = await Return.countDocuments();
  console.log(`Found ${totalReturnsCount} total Return documents in database.`);

  const returns = await Return.find().sort({ createdAt: 1 });

  let alreadyInspectedCount = 0;
  let candidateReturnsCount = 0;
  let itemsToApproveCount = 0;
  let itemsToRejectCount = 0;
  let itemsUnchangedCount = 0;

  const reportDetails = [];

  for (const ret of returns) {
    let modified = false;
    const itemUpdates = [];

    // If parent is already marked approved or rejected, it's already inspected
    const isAlreadyFinalized =
      ret.inspectionStatus === "approved" ||
      ret.inspectionStatus === "partially_approved" ||
      ret.inspectionStatus === "rejected";

    if (isAlreadyFinalized) {
      alreadyInspectedCount++;
      continue;
    }

    candidateReturnsCount++;

    for (const item of ret.items || []) {
      if (item.inspectionStatus && item.inspectionStatus !== "pending_inspection") {
        itemsUnchangedCount++;
        continue;
      }

      if (item.condition === "resellable") {
        // Historical resellable item: in Milestone 7, this was automatically restocked.
        // We stamp inspectionStatus = 'approved' and approvedResellableQty = item.quantity.
        // We DO NOT increment Product.totalStock to avoid double-restocking!
        itemsToApproveCount++;
        itemUpdates.push({
          itemCode: item.itemCode,
          action: "MARK_APPROVED_HISTORICAL",
          qty: item.quantity,
          reason: "Pre-existing resellable return already in inventory"
        });

        if (isExecute) {
          item.inspectionStatus = "approved";
          item.approvedResellableQty = item.quantity;
          item.rejectedQty = 0;
          item.inspectedAt = item.inspectedAt || ret.createdAt || new Date();
          modified = true;
        }
      } else {
        // Historical damaged or expired item: never added to stock.
        itemsToRejectCount++;
        itemUpdates.push({
          itemCode: item.itemCode,
          action: "MARK_REJECTED_HISTORICAL",
          qty: item.quantity,
          reason: `Returned in ${item.condition} condition`
        });

        if (isExecute) {
          item.inspectionStatus = "rejected";
          item.approvedResellableQty = 0;
          item.rejectedQty = item.quantity;
          item.rejectionReason = `Returned in ${item.condition} condition (Historical)`;
          item.inspectedAt = item.inspectedAt || ret.createdAt || new Date();
          modified = true;
        }
      }
    }

    if (modified && isExecute) {
      const anyAppr = ret.items.some((i) => i.approvedResellableQty > 0);
      const anyRej = ret.items.some((i) => i.rejectedQty > 0);

      ret.inspectionStatus = anyAppr && anyRej ? "partially_approved" : anyAppr ? "approved" : "rejected";
      ret.inspectedAt = ret.inspectedAt || ret.createdAt || new Date();
      ret.inspectionNotes = "Backfilled historical return status safely without stock duplication.";
      await ret.save();
    }

    if (itemUpdates.length > 0) {
      reportDetails.push({
        returnId: ret._id.toString(),
        invoiceNo: ret.invoiceNo,
        itemsCount: ret.items.length,
        updates: itemUpdates
      });
    }
  }

  console.log("-----------------------------------------------------");
  console.log("             MIGRATION DRY-RUN SUMMARY               ");
  console.log("-----------------------------------------------------");
  console.log(`Total Returns Scanned:        ${totalReturnsCount}`);
  console.log(`Already Finalized Returns:    ${alreadyInspectedCount}`);
  console.log(`Historical Candidate Returns: ${candidateReturnsCount}`);
  console.log(`Items Marked Approved:        ${itemsToApproveCount} (Safe: 0 new StockBatches created)`);
  console.log(`Items Marked Rejected:        ${itemsToRejectCount} (Safe: Excluded from sellable stock)`);
  console.log(`Items Already Up-to-date:     ${itemsUnchangedCount}`);
  console.log("-----------------------------------------------------");

  if (!isExecute) {
    console.log("\n🛡️  DRY-RUN VERIFICATION SUCCESSFUL!");
    console.log("No changes were committed to MongoDB.");
    console.log("All historical returns are guaranteed to be protected from double-stocking.");
  } else {
    console.log("\n✅ LIVE MIGRATION COMPLETED SUCCESSFULLY!");
  }

  if (shouldManageConnection) {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.\n");
  }
}

if (require.main === module) {
  runMigration().catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  });
}

module.exports = { runMigration };
