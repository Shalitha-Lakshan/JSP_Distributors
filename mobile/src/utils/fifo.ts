import { FifoAllocation, StockBatch } from "../types";

/**
 * Sorts batches deterministically in true FIFO order:
 * 1. Oldest receivedDate first
 * 2. Oldest createdAt first (tie-breaker)
 * 3. Batch number / ID ascending (tie-breaker)
 *
 * Filters out batches with 0 or negative remainingQty.
 */
export const sortBatchesFifo = (batches?: StockBatch[]): StockBatch[] => {
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

      return String(a.batchNo || a._id || "").localeCompare(
        String(b.batchNo || b._id || "")
      );
    });
};

export interface FifoComputationResult {
  allocations: FifoAllocation[];
  allocatedQty: number;
  lineTotal: number;
  effectiveUnitPrice: number;
  hasMultipleBatches: boolean;
  isFullyAllocated: boolean;
  isPricingUnavailable?: boolean;
  errorMessage?: string;
}

/**
 * Calculates FIFO batch allocation for a product given a requested quantity.
 * Follows the established Web POS algorithm with deterministic FIFO ordering.
 *
 * POLICY:
 * - Real warehouse stock batches are required for batch billing.
 * - Never create synthetic "Batch Standard" or "Unassigned" fallback lines.
 * - If no active batches exist, returns isPricingUnavailable: true with empty allocations.
 * - If requested quantity exceeds batch stock, isFullyAllocated is false.
 */
export const calculateFifoAllocation = (
  batches: StockBatch[] | undefined,
  requestedQty: number,
  fallbackBilling: number,
  fallbackSelling: number = 0
): FifoComputationResult => {
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
  const allocations: FifoAllocation[] = [];

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
};

