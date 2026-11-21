const path = require("path");

function sortBatchesFifo(batches) {
  if (!batches || !Array.isArray(batches)) return [];
  return [...batches]
    .filter((b) => Number(b.remainingQty || 0) > 0)
    .sort((a, b) => {
      const da = new Date(a.receivedDate || a.createdAt || 0).getTime();
      const db = new Date(b.receivedDate || b.createdAt || 0).getTime();
      if (da !== db) return da - db;
      const ca = new Date(a.createdAt || 0).getTime();
      const cb = new Date(b.createdAt || 0).getTime();
      if (ca !== cb) return ca - cb;
      return String(a.batchNo || a._id || "").localeCompare(String(b.batchNo || b._id || ""));
    });
}

function calculateFifoAllocation(batches, requestedQty, fallbackBilling, fallbackSelling = 0) {
  const safeQty = Math.max(0, Math.floor(requestedQty));
  const safeFallbackBilling = Number(fallbackBilling || 0);

  if (safeQty === 0) {
    return {
      allocations: [],
      allocatedQty: 0,
      lineTotal: 0,
      effectiveUnitPrice: safeFallbackBilling,
      hasMultipleBatches: false,
      isFullyAllocated: true
    };
  }

  const sorted = sortBatchesFifo(batches);

  // If no active stock batches exist, do NOT generate fake "Batch Standard"
  if (sorted.length === 0) {
    return {
      allocations: [],
      allocatedQty: 0,
      lineTotal: 0,
      effectiveUnitPrice: 0,
      hasMultipleBatches: false,
      isFullyAllocated: false,
      isPricingUnavailable: true,
      errorMessage: "FIFO pricing unavailable: No active warehouse stock batches found."
    };
  }

  let remaining = safeQty;
  let totalCost = 0;
  const allocations = [];

  for (const batch of sorted) {
    if (remaining <= 0) break;
    const available = Number(batch.remainingQty || 0);
    if (available <= 0) continue;

    const take = Math.min(remaining, available);
    const batchBilling =
      batch.billingPrice !== undefined && Number(batch.billingPrice) > 0
        ? Number(batch.billingPrice)
        : safeFallbackBilling;
    const batchSelling =
      batch.sellingPrice !== undefined
        ? Number(batch.sellingPrice)
        : fallbackSelling;

    const lineCost = Math.round(take * batchBilling * 100) / 100;

    allocations.push({
      batchId: String(batch._id || batch.batchNo),
      batchNo: batch.batchNo || "Unknown",
      label: `F${allocations.length + 1}`,
      quantity: take,
      billingPrice: batchBilling,
      sellingPrice: batchSelling,
      lineTotal: lineCost
    });

    totalCost += lineCost;
    remaining -= take;
  }

  // If requested quantity exceeds available batch stock, do NOT create fake "Unassigned" allocations
  if (remaining > 0) {
    const allocatedQty = safeQty - remaining;
    const roundedTotal = Math.round(totalCost * 100) / 100;
    const effectiveUnitPrice =
      allocatedQty > 0 ? Math.round((roundedTotal / allocatedQty) * 100) / 100 : 0;

    return {
      allocations,
      allocatedQty,
      lineTotal: roundedTotal,
      effectiveUnitPrice,
      hasMultipleBatches: allocations.length > 1,
      isFullyAllocated: false,
      isPricingUnavailable: false,
      errorMessage: `Requested quantity (${safeQty}) exceeds available warehouse batch stock (${allocatedQty}).`
    };
  }

  const roundedTotal = Math.round(totalCost * 100) / 100;
  const effectiveUnitPrice =
    safeQty > 0 ? Math.round((roundedTotal / safeQty) * 100) / 100 : safeFallbackBilling;

  return {
    allocations,
    allocatedQty: safeQty,
    lineTotal: roundedTotal,
    effectiveUnitPrice,
    hasMultipleBatches: allocations.length > 1,
    isFullyAllocated: true
  };
}

// Sample batches matching Manager Web Database TP50
const tp50Batches = [
  {
    _id: "6b0052a9e014fe87de83c79a",
    batchNo: "B-1795183273179",
    billingPrice: 150,
    sellingPrice: 200,
    quantity: 250,
    remainingQty: 130,
    receivedDate: "2026-11-20T00:00:00.000Z",
    createdAt: "2026-11-20T14:01:13.180Z"
  },
  {
    _id: "6b0053dbe014fe87de83c83e",
    batchNo: "B-1795183579949",
    billingPrice: 200,
    sellingPrice: 250,
    quantity: 100,
    remainingQty: 100,
    receivedDate: "2026-11-20T00:00:00.000Z",
    createdAt: "2026-11-20T14:06:19.949Z"
  }
];

// Sample batches matching CP50
const cp50Batches = [
  {
    _id: "cp01",
    batchNo: "B-1795183392766",
    billingPrice: 100,
    sellingPrice: 120,
    quantity: 100,
    remainingQty: 100,
    receivedDate: "2026-11-20T00:00:00.000Z",
    createdAt: "2026-11-20T14:03:00.000Z"
  },
  {
    _id: "cp02",
    batchNo: "B-1795183431857",
    billingPrice: 100,
    sellingPrice: 130,
    quantity: 100,
    remainingQty: 100,
    receivedDate: "2026-11-20T00:00:00.000Z",
    createdAt: "2026-11-20T14:04:00.000Z"
  }
];

console.log("=== RUNNING ENHANCED FIFO BILLING PARITY VERIFICATION ===");

// Test 1: TP50 Qty 130 (Fills Batch 1 exactly)
const res130 = calculateFifoAllocation(tp50Batches, 130, 200, 250);
console.log("\n[Test 1] TP50 Qty 130:");
console.log(`  Line Total: Rs. ${res130.lineTotal} (Expected: Rs. 19500)`);
console.log(`  Allocations: ${JSON.stringify(res130.allocations.map(a => `${a.label} (${a.batchNo}): ${a.quantity} @ ${a.billingPrice} = ${a.lineTotal}`))}`);
if (res130.lineTotal !== 19500 || res130.allocations.length !== 1 || res130.allocations[0].batchNo !== "B-1795183273179") {
  console.error("FAIL Test 1");
  process.exit(1);
}

// Test 2: TP50 Qty 200 (130 @ 150 + 70 @ 200 = 19500 + 14000 = 33500)
const res200 = calculateFifoAllocation(tp50Batches, 200, 200, 250);
console.log("\n[Test 2] TP50 Qty 200:");
console.log(`  Line Total: Rs. ${res200.lineTotal} (Expected: Rs. 33500)`);
console.log(`  Effective Unit Price: Rs. ${res200.effectiveUnitPrice}`);
console.log(`  Allocations: ${JSON.stringify(res200.allocations.map(a => `${a.label} (${a.batchNo}): ${a.quantity} @ ${a.billingPrice} = ${a.lineTotal}`))}`);
if (res200.lineTotal !== 33500 || res200.allocations.length !== 2) {
  console.error("FAIL Test 2");
  process.exit(1);
}

// Test 3: TP50 Qty 230 (130 @ 150 + 100 @ 200 = 19500 + 20000 = 39500)
const res230 = calculateFifoAllocation(tp50Batches, 230, 200, 250);
console.log("\n[Test 3] TP50 Qty 230 (User Reported Problem Case):");
console.log(`  Line Total: Rs. ${res230.lineTotal} (Expected: Rs. 39500, NOT Rs. 46000)`);
console.log(`  Effective Unit Price: Rs. ${res230.effectiveUnitPrice}`);
console.log(`  Allocations: ${JSON.stringify(res230.allocations.map(a => `${a.label} (${a.batchNo}): ${a.quantity} @ ${a.billingPrice} = ${a.lineTotal}`))}`);
if (res230.lineTotal !== 39500 || res230.allocations.length !== 2) {
  console.error("FAIL Test 3: Line total must be 39500!");
  process.exit(1);
}
if (res230.allocations[0].batchNo !== "B-1795183273179" || res230.allocations[1].batchNo !== "B-1795183579949") {
  console.error("FAIL Test 3: Batch sequence incorrect!");
  process.exit(1);
}

// Test 4: TP50 Qty 250 (Exceeds stock of 230)
const res250 = calculateFifoAllocation(tp50Batches, 250, 200, 250);
console.log("\n[Test 4] TP50 Qty 250 (Exceeds stock):");
console.log(`  Is Fully Allocated: ${res250.isFullyAllocated} (Expected: false)`);
console.log(`  Error Message: ${res250.errorMessage}`);
console.log(`  No "Unassigned" fake allocation generated: ${!res250.allocations.some(a => a.batchNo === "Unassigned")}`);
if (res250.isFullyAllocated !== false || res250.allocations.some(a => a.batchNo === "Unassigned")) {
  console.error("FAIL Test 4");
  process.exit(1);
}

// Test 5: Empty batches check (NO "Batch Standard" allowed)
const resEmpty = calculateFifoAllocation([], 50, 200, 250);
console.log("\n[Test 5] Empty Batches (Missing real batch data):");
console.log(`  Allocations count: ${resEmpty.allocations.length} (Expected: 0)`);
console.log(`  Is Pricing Unavailable: ${resEmpty.isPricingUnavailable} (Expected: true)`);
console.log(`  No "Batch Standard" fake line: ${!resEmpty.allocations.some(a => a.batchNo === "Standard")}`);
if (resEmpty.allocations.length !== 0 || resEmpty.isPricingUnavailable !== true || resEmpty.allocations.some(a => a.batchNo === "Standard")) {
  console.error("FAIL Test 5: Synthetic Batch Standard was created!");
  process.exit(1);
}

// Test 6: CP50 Qty 200 (100 @ 100 + 100 @ 100 = 20,000)
const resCp = calculateFifoAllocation(cp50Batches, 200, 100, 125);
console.log("\n[Test 6] CP50 Qty 200 across two batches:");
console.log(`  Line Total: Rs. ${resCp.lineTotal} (Expected: Rs. 20000)`);
console.log(`  Allocations: ${JSON.stringify(resCp.allocations.map(a => `${a.label} (${a.batchNo}): ${a.quantity} @ ${a.billingPrice} = ${a.lineTotal}`))}`);
if (resCp.lineTotal !== 20000 || resCp.allocations.length !== 2) {
  console.error("FAIL Test 6");
  process.exit(1);
}

console.log("\n=== ALL 6 ENHANCED FIFO PARITY CHECKS PASSED SUCCESSFULLY ===");

module.exports = { calculateFifoAllocation, sortBatchesFifo };
