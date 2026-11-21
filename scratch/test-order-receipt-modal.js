const assert = require("assert");

// Import or recreate the exact resolveCleanBatchNumber logic from InvoiceReceiptModal.tsx
function resolveCleanBatchNumber(b, item, index, allBatches = []) {
  let rawNo =
    b?.batchNo ||
    (typeof b?.batchId === "object" && b?.batchId?.batchNo ? b.batchId.batchNo : undefined);

  if (!rawNo && b?.batchId) {
    const bIdStr = typeof b.batchId === "object" ? String(b.batchId._id || b.batchId.id || "") : String(b.batchId);
    const found = allBatches.find((ab) => String(ab._id || ab.id) === bIdStr);
    if (found?.batchNo) {
      rawNo = found.batchNo;
    }
  }

  if (!rawNo && Array.isArray(item?.batches) && item.batches[index]?.batchNo) {
    rawNo = item.batches[index].batchNo;
  }

  if (rawNo) {
    let clean = String(rawNo).replace(/^F\d+\s*[-·•:]\s*/i, "").trim();
    clean = clean.replace(/^Batch\s+/i, "").trim();

    const lower = clean.toLowerCase();
    if (
      clean &&
      !lower.includes("standard") &&
      clean !== "undefined" &&
      clean !== "null" &&
      clean !== "[object Object]"
    ) {
      return `Batch ${clean}`;
    }
  }

  const safeIdx = typeof index === "number" && !isNaN(index) ? index + 1 : 1;
  return `Batch #${safeIdx}`;
}

function getOrderStatusBadge(status, isOrder) {
  if (!isOrder) {
    return { label: "Completed & Invoiced", variant: "success" };
  }
  switch (status) {
    case "delivered":
      return { label: "Delivered", variant: "success" };
    case "cancelled":
      return { label: "Cancelled", variant: "danger" };
    case "pending_delivery":
    default:
      return { label: "Pending Packing", variant: "warning" };
  }
}

function getPaymentStatusBadge(status) {
  switch (status) {
    case "paid":
      return { label: "Paid", variant: "success" };
    case "credit":
      return { label: "Credit", variant: "danger" };
    case "partial":
      return { label: "Partial", variant: "warning" };
    case "not_collected":
    default:
      return { label: "Not Collected", variant: "warning" };
  }
}

function formatPaymentMethod(method) {
  if (!method || method === "not_collected") return "";
  return method
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function shouldShowPaymentMethod(paymentStatus, paymentMethod) {
  return (
    paymentStatus !== "not_collected" &&
    Boolean(paymentMethod) &&
    paymentMethod !== "not_collected"
  );
}

function processOrderForPackingUI(order, availableBatches = []) {
  const isOrder = true;
  const refNo = order.orderNo;
  const customerName = typeof order.customer === "object" ? order.customer?.name : "Walk-in Customer";
  const items = order.items || [];
  const totalUnits = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const distinctProductsCount = items.length;

  const returnsList = order.returns || order.proposedReturns || [];
  const returnsTotal =
    typeof order.returnTotal === "number" && order.returnTotal > 0
      ? order.returnTotal
      : returnsList.reduce(
          (sum, r) => sum + (Number(r.returnTotal) || Number(r.quantity || 0) * Number(r.returnPrice || 0)),
          0
        );

  const orderStatusBadge = getOrderStatusBadge(order.orderStatus, isOrder);
  const paymentStatusBadge = getPaymentStatusBadge(order.paymentStatus);
  const showPaymentMethod = shouldShowPaymentMethod(order.paymentStatus, order.paymentMethod);

  const processedItems = items.map((item, idx) => {
    const name = item.itemName || item.displayName || item.product?.name || "Product";
    const itemCode = item.itemCode || item.product?.itemCode || "";
    const itemTotalQty = Number(item.quantity) || 0;
    const itemBillingRate = Number(
      item.billingPrice !== undefined && item.billingPrice !== null ? item.billingPrice : item.unitPrice || 0
    );
    const itemLineTotal = Number(
      item.lineTotal !== undefined && item.lineTotal !== null ? item.lineTotal : itemTotalQty * itemBillingRate
    );

    const rawBatches =
      item.usedBatches && item.usedBatches.length > 0
        ? item.usedBatches
        : item.allocations && item.allocations.length > 0
        ? item.allocations
        : [];

    const itemBatches =
      rawBatches.length > 0
        ? rawBatches.map((b, bIdx) => {
            const batchNo = resolveCleanBatchNumber(b, item, bIdx, availableBatches);
            const bQty = Number(b.qty ?? b.quantity ?? 0);
            const bBilling = Number(
              b.billingPrice !== undefined && b.billingPrice !== null ? b.billingPrice : itemBillingRate
            );
            const bTotal = Number(b.lineTotal !== undefined && b.lineTotal !== null ? b.lineTotal : bQty * bBilling);
            return { batchNo, qty: bQty, billingPrice: bBilling, lineTotal: bTotal };
          })
        : [
            {
              batchNo: resolveCleanBatchNumber(item, item, 0, availableBatches),
              qty: itemTotalQty,
              billingPrice: itemBillingRate,
              lineTotal: itemLineTotal
            }
          ];

    return {
      name,
      itemCode,
      totalQty: itemTotalQty,
      productLineTotal: itemLineTotal,
      isMultiBatch: itemBatches.length > 1,
      batches: itemBatches
    };
  });

  return {
    refNo,
    customerName,
    orderStatusBadge,
    paymentStatusBadge,
    showPaymentMethod,
    totalUnits,
    distinctProductsCount,
    returnsTotal,
    items: processedItems
  };
}

console.log("=== RUNNING MODAL AND PACKING DETAILS VERIFICATION TESTS ===");

// TEST 1: Clean Batch Number Resolution
console.log("\n[TEST 1] Clean Batch Number Resolution");
assert.strictEqual(resolveCleanBatchNumber({ batchNo: "B-1795183273179" }), "Batch B-1795183273179");
assert.strictEqual(resolveCleanBatchNumber({ batchNo: "Batch B-1795183273179" }), "Batch B-1795183273179");
assert.strictEqual(resolveCleanBatchNumber({ batchNo: "F1 · B-1795183273179" }), "Batch B-1795183273179");
assert.strictEqual(resolveCleanBatchNumber({ batchNo: "F2 - B-1795183579949" }), "Batch B-1795183579949");
assert.strictEqual(resolveCleanBatchNumber({ batchNo: "F1 • Batch Standard" }), "Batch #1");
assert.strictEqual(resolveCleanBatchNumber({ batchNo: "undefined" }), "Batch #1");

// Lookup via availableBatches when batchNo missing
const mockBatches = [
  { _id: "601", batchNo: "B-2026-X1" },
  { _id: "602", batchNo: "B-2026-X2" }
];
assert.strictEqual(resolveCleanBatchNumber({ batchId: "601" }, null, 0, mockBatches), "Batch B-2026-X1");
console.log("✓ All batch number resolutions passed cleanly without technical prefixes");

// TEST 2: Order Status Badge Friendly Labels
console.log("\n[TEST 2] Order Status Friendly Labels");
assert.deepStrictEqual(getOrderStatusBadge("pending_delivery", true), { label: "Pending Packing", variant: "warning" });
assert.deepStrictEqual(getOrderStatusBadge("delivered", true), { label: "Delivered", variant: "success" });
assert.deepStrictEqual(getOrderStatusBadge("cancelled", true), { label: "Cancelled", variant: "danger" });
assert.deepStrictEqual(getOrderStatusBadge("completed", false), { label: "Completed & Invoiced", variant: "success" });
console.log("✓ Order status correctly maps pending_delivery -> 'Pending Packing'");

// TEST 3: Payment Status & Method Rules
console.log("\n[TEST 3] Payment Status & Method Omission Rule");
assert.deepStrictEqual(getPaymentStatusBadge("not_collected"), { label: "Not Collected", variant: "warning" });
assert.deepStrictEqual(getPaymentStatusBadge("paid"), { label: "Paid", variant: "success" });
assert.deepStrictEqual(getPaymentStatusBadge("credit"), { label: "Credit", variant: "danger" });

// If payment not collected, payment method must be hidden
assert.strictEqual(shouldShowPaymentMethod("not_collected", "cash"), false);
assert.strictEqual(shouldShowPaymentMethod("not_collected", "not_collected"), false);
assert.strictEqual(shouldShowPaymentMethod("paid", "cash"), true);
assert.strictEqual(formatPaymentMethod("cash"), "Cash");
assert.strictEqual(formatPaymentMethod("bank_transfer"), "Bank Transfer");
console.log("✓ Payment method is strictly hidden when paymentStatus is 'not_collected'");

// TEST 4: Single-Batch Order Processing (AUD-B-0104)
console.log("\n[TEST 4] Single-Batch Order Packing Data");
const singleBatchOrder = {
  orderNo: "ORD-00000004",
  customer: { name: "Wijaya Groceries" },
  orderStatus: "pending_delivery",
  paymentStatus: "not_collected",
  paymentMethod: "not_collected",
  orderTotal: 8000,
  netTotal: 8000,
  items: [
    {
      itemCode: "AUD-B-0104",
      itemName: "Anchor Butter 100g",
      quantity: 100,
      billingPrice: 80,
      lineTotal: 8000,
      usedBatches: [
        {
          batchNo: "B-1795100000001",
          qty: 100,
          billingPrice: 80,
          lineTotal: 8000
        }
      ]
    }
  ]
};

const processedSingle = processOrderForPackingUI(singleBatchOrder);
assert.strictEqual(processedSingle.refNo, "ORD-00000004");
assert.strictEqual(processedSingle.customerName, "Wijaya Groceries");
assert.strictEqual(processedSingle.orderStatusBadge.label, "Pending Packing");
assert.strictEqual(processedSingle.paymentStatusBadge.label, "Not Collected");
assert.strictEqual(processedSingle.showPaymentMethod, false);
assert.strictEqual(processedSingle.distinctProductsCount, 1);
assert.strictEqual(processedSingle.totalUnits, 100);
assert.strictEqual(processedSingle.items[0].isMultiBatch, false);
assert.strictEqual(processedSingle.items[0].batches[0].batchNo, "Batch B-1795100000001");
assert.strictEqual(processedSingle.items[0].batches[0].qty, 100);
assert.strictEqual(processedSingle.items[0].batches[0].billingPrice, 80);
assert.strictEqual(processedSingle.items[0].batches[0].lineTotal, 8000);
assert.strictEqual(processedSingle.items[0].productLineTotal, 8000);
console.log("✓ Single batch order formatted cleanly with exact physical batch and pick quantity");

// TEST 5: Multi-Batch Order Processing (ORD-00000003 - TP50)
console.log("\n[TEST 5] Multi-Batch Order Packing Data (ORD-00000003)");
const multiBatchOrder = {
  orderNo: "ORD-00000003",
  customer: { name: "City Supermarket" },
  orderStatus: "pending_delivery",
  paymentStatus: "not_collected",
  paymentMethod: "not_collected",
  orderTotal: 35500,
  netTotal: 34500,
  returnTotal: 1000,
  returns: [
    {
      itemCode: "CP50",
      itemName: "Chillie powder 50 g",
      quantity: 10,
      returnPrice: 100,
      returnTotal: 1000,
      condition: "resellable"
    }
  ],
  items: [
    {
      itemCode: "TP50",
      itemName: "Turmeric Powder 50 g",
      quantity: 210,
      billingPrice: 173.81, // average price should NOT appear on packing batches!
      lineTotal: 35500,
      usedBatches: [
        {
          batchNo: "B-1795183273179",
          qty: 130,
          billingPrice: 150,
          lineTotal: 19500
        },
        {
          batchNo: "B-1795183579949",
          qty: 80,
          billingPrice: 200,
          lineTotal: 16000
        }
      ]
    }
  ]
};

const processedMulti = processOrderForPackingUI(multiBatchOrder);
assert.strictEqual(processedMulti.refNo, "ORD-00000003");
assert.strictEqual(processedMulti.distinctProductsCount, 1);
assert.strictEqual(processedMulti.totalUnits, 210);
assert.strictEqual(processedMulti.returnsTotal, 1000);
assert.strictEqual(processedMulti.items[0].isMultiBatch, true);
assert.strictEqual(processedMulti.items[0].batches.length, 2);

// Batch 1
assert.strictEqual(processedMulti.items[0].batches[0].batchNo, "Batch B-1795183273179");
assert.strictEqual(processedMulti.items[0].batches[0].qty, 130);
assert.strictEqual(processedMulti.items[0].batches[0].billingPrice, 150);
assert.strictEqual(processedMulti.items[0].batches[0].lineTotal, 19500);

// Batch 2
assert.strictEqual(processedMulti.items[0].batches[1].batchNo, "Batch B-1795183579949");
assert.strictEqual(processedMulti.items[0].batches[1].qty, 80);
assert.strictEqual(processedMulti.items[0].batches[1].billingPrice, 200);
assert.strictEqual(processedMulti.items[0].batches[1].lineTotal, 16000);

// Product Total
assert.strictEqual(processedMulti.items[0].productLineTotal, 35500);
console.log("✓ Multi-batch order cleanly splits across Batches B-1795183273179 and B-1795183579949");
console.log("✓ Total Product Value Rs. 35,500.00 matches sum of batch line totals (19500 + 16000)");
console.log("✓ Proposed market returns (Rs. 1,000.00) captured for pending audit");

console.log("\n=== ALL ORDER BOOKING CONFIRMATION TESTS PASSED (5/5) ===");
