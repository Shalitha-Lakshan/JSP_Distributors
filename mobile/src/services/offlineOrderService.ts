import { offlineOrdersRepository } from "../database/repositories/offlineOrdersRepository";
import {
  OfflineOrderDraft,
  OfflineOrderItem,
  OfflineOrderSyncStatus
} from "../types/offlineOrder";
import { CartItem, Customer, ReturnItem, TripSession, User } from "../types";
import { generateIdempotencyKey } from "../utils/idempotency";

export interface CreateDraftInput {
  items: CartItem[];
  returns?: ReturnItem[];
  customer: Customer;
  activeTrip: TripSession;
  discountPercent?: number;
  user: User;
  existingDraftId?: string; // If editing an existing draft
  existingIdempotencyKey?: string; // Preserve stable key unless items changed
}

function generateLocalDraftId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `draft_${ts}_${rand}`;
}

function generateDraftDisplayNo(): string {
  const randPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `DFT-${randPart}`;
}

export const offlineOrderService = {
  /**
   * Creates or updates a local offline Van Order draft from current cart state.
   */
  async saveDraftFromCart(input: CreateDraftInput): Promise<OfflineOrderDraft> {
    const { items, returns = [], customer, activeTrip, discountPercent = 0, user } = input;

    if (!items.length) {
      throw new Error("Cannot save an empty draft. Please add at least one item.");
    }

    if (!customer) {
      throw new Error("A customer must be selected to save a Van Order draft.");
    }

    if (!activeTrip) {
      throw new Error("An active route trip session is required to save an order draft.");
    }

    const now = new Date().toISOString();
    const draftId = input.existingDraftId || generateLocalDraftId();
    const draftNo = generateDraftDisplayNo();

    // Preserve stable idempotency key across draft updates/retries, or generate one if new
    const idempotencyKey =
      input.existingIdempotencyKey || generateIdempotencyKey("ORD");

    // Calculate estimated totals including proposed market returns
    const estimatedSubtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const estimatedReturnTotal = (returns || []).reduce(
      (sum, item) => sum + (item.returnTotal || item.quantity * item.returnPrice),
      0
    );
    const baseTotal = Math.max(0, estimatedSubtotal - estimatedReturnTotal);
    const clampedDiscountPct = Math.min(100, Math.max(0, Number(discountPercent || 0)));
    const estimatedDiscount =
      Math.round(baseTotal * (clampedDiscountPct / 100) * 100) / 100;
    const estimatedTotal = Math.max(0, baseTotal - estimatedDiscount);

    // Map cart items to offline order items
    const offlineItems: OfflineOrderItem[] = items.map((item, idx) => ({
      id: `${draftId}_item_${idx}_${Date.now()}`,
      orderDraftId: draftId,
      productId: item.productId,
      itemCode: item.itemCode,
      productName: item.productName,
      displayName: item.displayName || item.productName,
      variant: item.variant || undefined,
      quantity: item.quantity,
      billingPrice: item.billingPrice,
      sellingPrice: item.sellingPrice,
      estimatedLineTotal: item.lineTotal,
      totalStockSnapshot: item.totalStock
    }));

    const draft: OfflineOrderDraft = {
      id: draftId,
      draftNo,
      userId: user.id,
      tripId: activeTrip._id,
      tripNo: activeTrip.tripNo,
      tripRoute: activeTrip.route,
      customerId: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerType: customer.customerType,
      items: offlineItems,
      proposedReturns: returns || [],
      discountPercent: clampedDiscountPct,
      estimatedSubtotal,
      estimatedDiscount,
      estimatedTotal,
      syncStatus: "ready_to_sync",
      idempotencyKey,
      createdAt: now,
      updatedAt: now
    };

    await offlineOrdersRepository.saveDraft(draft);
    return draft;
  },

  /**
   * Retrieve all drafts for a user.
   */
  async getDrafts(
    userId: string,
    filterStatus?: OfflineOrderSyncStatus
  ): Promise<OfflineOrderDraft[]> {
    return await offlineOrdersRepository.getDrafts(userId, filterStatus);
  },

  /**
   * Retrieve single draft by ID.
   */
  async getDraftById(
    userId: string,
    draftId: string
  ): Promise<OfflineOrderDraft | null> {
    return await offlineOrdersRepository.getDraftById(userId, draftId);
  },

  /**
   * Delete draft.
   */
  async deleteDraft(userId: string, draftId: string): Promise<void> {
    await offlineOrdersRepository.deleteDraft(userId, draftId);
  },

  /**
   * Get count of pending drafts waiting to sync.
   */
  async getPendingDraftsCount(userId: string): Promise<number> {
    return await offlineOrdersRepository.getUnsyncedCount(userId);
  }
};

