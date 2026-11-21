/**
 * Offline Van Order Draft Types & Interfaces
 *
 * SAFETY & POLICY:
 * - Offline drafts are NEVER confirmed orders.
 * - Confirmed order numbers (ORD-...) are generated strictly by the central server.
 * - Idempotency key is stable and unique per draft to guarantee zero duplicate bookings.
 */

import { ReturnItem } from "./index";

export type OfflineOrderSyncStatus =
  | "draft"
  | "ready_to_sync"
  | "syncing"
  | "needs_review"
  | "synced"
  | "failed";

export interface OfflineOrderItem {
  id: string; // Unique item ID (UUID)
  orderDraftId: string;
  productId: string;
  itemCode: string;
  productName: string;
  displayName: string;
  variant?: string;
  quantity: number;
  billingPrice: number; // Customer Billing Price
  sellingPrice: number; // Last known reference selling price
  estimatedLineTotal: number;
  totalStockSnapshot?: number; // Last known stock at time of drafting
}

export interface ConflictDetail {
  type:
    | "out_of_stock"
    | "insufficient_quantity"
    | "price_changed"
    | "customer_inactive"
    | "customer_not_found"
    | "trip_inactive"
    | "general";
  itemCode?: string;
  itemName?: string;
  message: string;
  availableQuantity?: number;
  requestedQuantity?: number;
  oldPrice?: number;
  newPrice?: number;
}

export interface OfflineOrderDraft {
  id: string; // Local Draft ID (UUID)
  draftNo: string; // Friendly display reference, e.g. "DFT-ABCD12"
  userId: string; // Sales Rep ID for account isolation
  tripId: string; // Original active trip session ID
  tripNo: string; // Original trip reference (e.g. "TRP-20261115-001")
  tripRoute: string; // Original trip route name
  customerId: string;
  customerName: string; // Snapshot for offline display
  customerPhone?: string;
  customerType?: string;
  items: OfflineOrderItem[];
  proposedReturns?: ReturnItem[];
  discountPercent: number;
  estimatedSubtotal: number;
  estimatedDiscount: number;
  estimatedTotal: number;
  syncStatus: OfflineOrderSyncStatus;
  idempotencyKey: string; // Stable idempotency key
  lastSyncAttemptAt?: string;
  lastSyncError?: string;
  conflictDetails?: ConflictDetail[];
  confirmedOrderId?: string; // MongoDB _id once synced
  confirmedOrderNo?: string; // Official server order number (e.g. "ORD-00000123")
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewValidationResult {
  valid: boolean;
  canSync: boolean;
  conflicts: ConflictDetail[];
  recalculatedSubtotal: number;
  recalculatedDiscount: number;
  recalculatedTotal: number;
  currentTrip?: {
    id: string;
    tripNo: string;
    route: string;
    status: string;
  };
  currentCustomer?: {
    id: string;
    name: string;
    status: string;
    customerType: string;
  };
}

