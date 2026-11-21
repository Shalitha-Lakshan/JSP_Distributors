import { apiClient } from "../api/client";
import { fetchProducts } from "../api/products";
import { fetchCustomerById } from "../api/customers";
import { createOrder, fetchOrderByIdempotencyKey } from "../api/orders";
import { offlineOrdersRepository } from "../database/repositories/offlineOrdersRepository";
import {
  ConflictDetail,
  OfflineOrderDraft,
  ReviewValidationResult
} from "../types/offlineOrder";
import { CreateOrderPayload, Order, Product, TripSession } from "../types";
import { networkService } from "./networkService";

export const offlineOrderSyncService = {
  /**
   * Performs an authoritative server pre-validation of an offline draft before sync.
   * Compares cached estimates against real-time backend prices, stock availability,
   * active trip ownership, and customer status.
   */
  async reviewDraftBeforeSync(
    userId: string,
    draftId: string
  ): Promise<ReviewValidationResult> {
    const draft = await offlineOrdersRepository.getDraftById(userId, draftId);
    if (!draft) {
      throw new Error("Draft order not found.");
    }

    if (!networkService.getStatus().isOnline) {
      throw new Error(
        "A live network connection is required to review order drafts against current server data."
      );
    }

    const conflicts: ConflictDetail[] = [];

    // 1. Validate Active Trip Session
    let currentTrip: TripSession | null = null;
    try {
      const tripRes = await apiClient.get<TripSession | null>("/api/trips/active");
      currentTrip = tripRes.data || null;
    } catch {
      currentTrip = null;
    }

    if (!currentTrip || currentTrip._id !== draft.tripId) {
      conflicts.push({
        type: "trip_inactive",
        message: `Original trip "${draft.tripNo}" is no longer active. Orders cannot be booked without an active trip session.`
      });
    }

    // 2. Validate Customer Status
    let customerDoc: any = null;
    try {
      customerDoc = await fetchCustomerById(draft.customerId);
      if (customerDoc.status === "inactive") {
        conflicts.push({
          type: "customer_inactive",
          message: `Customer "${draft.customerName}" is marked inactive.`
        });
      }
    } catch {
      conflicts.push({
        type: "customer_not_found",
        message: `Customer "${draft.customerName}" could not be verified on the server.`
      });
    }

    // 3. Fetch latest live products and verify stock and prices
    const latestProducts: Product[] = await fetchProducts();
    const productMap = new Map<string, Product>(
      latestProducts.map((p) => [p._id, p])
    );

    let authoritativeSubtotal = 0;

    for (const item of draft.items) {
      const liveProduct = productMap.get(item.productId);

      if (!liveProduct || liveProduct.status !== "active") {
        conflicts.push({
          type: "out_of_stock",
          itemCode: item.itemCode,
          itemName: item.displayName,
          message: `Item ${item.itemCode} is discontinued or inactive on the server.`
        });
        continue;
      }

      // Check Stock
      if (liveProduct.totalStock < item.quantity) {
        conflicts.push({
          type: "insufficient_quantity",
          itemCode: item.itemCode,
          itemName: item.displayName,
          availableQuantity: liveProduct.totalStock,
          requestedQuantity: item.quantity,
          message: `${item.itemCode}: Insufficient stock (Available: ${liveProduct.totalStock}, Requested: ${item.quantity}).`
        });
      }

      // Check Billing Price differences (Customer Billing Price is the calculation base)
      const liveBillingPrice =
        liveProduct.currentBillingPrice !== undefined
          ? liveProduct.currentBillingPrice
          : (liveProduct as any).customerBillingPrice;

      const itemBillingPrice =
        item.billingPrice !== undefined && item.billingPrice !== null && Number(item.billingPrice) > 0
          ? Number(item.billingPrice)
          : 0;

      if (liveBillingPrice !== undefined && liveBillingPrice !== itemBillingPrice) {
        conflicts.push({
          type: "price_changed",
          itemCode: item.itemCode,
          itemName: item.displayName,
          oldPrice: itemBillingPrice,
          newPrice: liveBillingPrice,
          message: `${item.itemCode}: Customer Billing price updated from Rs. ${itemBillingPrice} to Rs. ${liveBillingPrice}.`
        });
      }

      const effectiveBillingPrice = liveBillingPrice !== undefined ? liveBillingPrice : itemBillingPrice;
      authoritativeSubtotal += item.quantity * effectiveBillingPrice;
    }

    // 4. Recalculate authoritative discount and net total (deducting proposed returns)
    const proposedReturnsTotal = (draft.proposedReturns || []).reduce(
      (sum, r) => sum + (r.returnTotal || r.quantity * r.returnPrice),
      0
    );
    const authoritativeBase = Math.max(0, authoritativeSubtotal - proposedReturnsTotal);
    const discountPct = draft.discountPercent || 0;
    const authoritativeDiscount =
      Math.round(authoritativeBase * (discountPct / 100) * 100) / 100;
    const authoritativeTotal = Math.max(
      0,
      authoritativeBase - authoritativeDiscount
    );

    const hasBlockingConflict = conflicts.some(
      (c) =>
        c.type === "trip_inactive" ||
        c.type === "customer_inactive" ||
        c.type === "customer_not_found" ||
        c.type === "out_of_stock" ||
        c.type === "insufficient_quantity"
    );

    // If conflicts exist, update status to needs_review in SQLite
    if (conflicts.length > 0) {
      await offlineOrdersRepository.updateDraftStatus(userId, draftId, "needs_review", {
        conflictDetails: conflicts
      });
    }

    return {
      valid: conflicts.length === 0,
      canSync: !hasBlockingConflict,
      conflicts,
      recalculatedSubtotal: authoritativeSubtotal,
      recalculatedDiscount: authoritativeDiscount,
      recalculatedTotal: authoritativeTotal,
      currentTrip: currentTrip
        ? {
            id: currentTrip._id,
            tripNo: currentTrip.tripNo,
            route: currentTrip.route,
            status: currentTrip.status
          }
        : undefined,
      currentCustomer: customerDoc
        ? {
            id: customerDoc._id,
            name: customerDoc.name,
            status: customerDoc.status,
            customerType: customerDoc.customerType
          }
        : undefined
    };
  },

  /**
   * Safely synchronizes an offline draft order with the central backend using durable idempotency.
   */
  async syncDraft(
    userId: string,
    draftId: string
  ): Promise<{ success: boolean; order?: Order; error?: string }> {
    const draft = await offlineOrdersRepository.getDraftById(userId, draftId);
    if (!draft) {
      return { success: false, error: "Draft not found." };
    }

    if (!networkService.getStatus().isOnline) {
      return {
        success: false,
        error: "Cannot synchronize while offline. Please connect to internet."
      };
    }

    const now = new Date().toISOString();

    // Mark as syncing in SQLite
    await offlineOrdersRepository.updateDraftStatus(userId, draftId, "syncing", {
      lastSyncAttemptAt: now
    });

    const payload: CreateOrderPayload = {
      customer: draft.customerId,
      items: draft.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity
      })),
      returns: draft.proposedReturns || [],
      discountPercent: draft.discountPercent,
      idempotencyKey: draft.idempotencyKey
    };

    try {
      const order = await createOrder(payload);

      // Successfully confirmed by server!
      await offlineOrdersRepository.updateDraftStatus(userId, draftId, "synced", {
        confirmedOrderId: order._id,
        confirmedOrderNo: order.orderNo,
        confirmedAt: new Date().toISOString(),
        lastSyncError: null,
        conflictDetails: null
      });

      return { success: true, order };
    } catch (err: any) {
      // Check for ambiguous timeout: Query backend by stable idempotency key to resolve
      if (!err.status || err.message?.includes("timeout") || err.code === "ECONNABORTED") {
        try {
          const verifiedOrder = await fetchOrderByIdempotencyKey(draft.idempotencyKey);
          if (verifiedOrder) {
            // Server actually committed the order before the connection dropped!
            await offlineOrdersRepository.updateDraftStatus(
              userId,
              draftId,
              "synced",
              {
                confirmedOrderId: verifiedOrder._id,
                confirmedOrderNo: verifiedOrder.orderNo,
                confirmedAt: new Date().toISOString(),
                lastSyncError: null,
                conflictDetails: null
              }
            );
            return { success: true, order: verifiedOrder };
          }
        } catch {
          // Fall through
        }

        // Still unreachable or not committed: preserve draft and mark failed for safe retry
        await offlineOrdersRepository.updateDraftStatus(userId, draftId, "failed", {
          lastSyncError:
            "Connection timed out. Idempotency key preserved. Please retry once signal is stable."
        });

        return {
          success: false,
          error:
            "Connection timed out. The draft has been preserved. Please retry once signal is stable."
        };
      }

      // Rejection or Conflict from backend (HTTP 400, 409, etc.)
      const errorMsg =
        err.response?.data?.message || err.message || "Failed to synchronize order.";

      await offlineOrdersRepository.updateDraftStatus(
        userId,
        draftId,
        "needs_review",
        {
          lastSyncError: errorMsg,
          conflictDetails: [
            {
              type: "general",
              message: errorMsg
            }
          ]
        }
      );

      return { success: false, error: errorMsg };
    }
  }
};

