import { getDatabase } from "../database";
import {
  ConflictDetail,
  OfflineOrderDraft,
  OfflineOrderItem,
  OfflineOrderSyncStatus
} from "../../types/offlineOrder";
import { TripSession } from "../../types";

export interface OfflineOrderRow {
  id: string;
  draftNo: string;
  userId: string;
  tripId: string;
  tripNo: string;
  tripRoute: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  customerType: string | null;
  discountPercent: number;
  estimatedSubtotal: number;
  estimatedDiscount: number;
  estimatedTotal: number;
  syncStatus: string;
  idempotencyKey: string;
  lastSyncAttemptAt: string | null;
  lastSyncError: string | null;
  conflictDetails: string | null;
  proposedReturns: string | null;
  confirmedOrderId: string | null;
  confirmedOrderNo: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineOrderItemRow {
  id: string;
  orderDraftId: string;
  userId: string;
  productId: string;
  itemCode: string;
  productName: string;
  displayName: string;
  variant: string | null;
  quantity: number;
  sellingPrice: number;
  estimatedLineTotal: number;
  totalStockSnapshot: number;
}

export const offlineOrdersRepository = {
  /**
   * Save a new offline Van Order draft with all items in a single atomic transaction.
   * Parameterized to prevent SQL injection.
   */
  async saveDraft(draft: OfflineOrderDraft): Promise<void> {
    const db = await getDatabase();
    if (!db || !draft.userId) return;

    await db.withTransactionAsync(async () => {
      // 1. Insert Order Header
      await db.runAsync(
        `INSERT OR REPLACE INTO offline_orders (
          id, draftNo, userId, tripId, tripNo, tripRoute,
          customerId, customerName, customerPhone, customerType,
          discountPercent, estimatedSubtotal, estimatedDiscount, estimatedTotal,
          syncStatus, idempotencyKey, lastSyncAttemptAt, lastSyncError,
          conflictDetails, proposedReturns, confirmedOrderId, confirmedOrderNo, confirmedAt,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          draft.id,
          draft.draftNo,
          draft.userId,
          draft.tripId,
          draft.tripNo,
          draft.tripRoute,
          draft.customerId,
          draft.customerName,
          draft.customerPhone || null,
          draft.customerType || null,
          draft.discountPercent || 0,
          draft.estimatedSubtotal,
          draft.estimatedDiscount,
          draft.estimatedTotal,
          draft.syncStatus || "draft",
          draft.idempotencyKey,
          draft.lastSyncAttemptAt || null,
          draft.lastSyncError || null,
          draft.conflictDetails ? JSON.stringify(draft.conflictDetails) : null,
          draft.proposedReturns ? JSON.stringify(draft.proposedReturns) : null,
          draft.confirmedOrderId || null,
          draft.confirmedOrderNo || null,
          draft.confirmedAt || null,
          draft.createdAt,
          draft.updatedAt
        ]
      );

      // 2. Clear any old items if updating
      await db.runAsync(
        `DELETE FROM offline_order_items WHERE orderDraftId = ? AND userId = ?`,
        [draft.id, draft.userId]
      );

      // 3. Insert Items
      for (const item of draft.items) {
        await db.runAsync(
          `INSERT INTO offline_order_items (
            id, orderDraftId, userId, productId, itemCode,
            productName, displayName, variant, quantity,
            sellingPrice, estimatedLineTotal, totalStockSnapshot
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            draft.id,
            draft.userId,
            item.productId,
            item.itemCode,
            item.productName,
            item.displayName,
            item.variant || null,
            item.quantity,
            item.sellingPrice,
            item.estimatedLineTotal,
            item.totalStockSnapshot || 0
          ]
        );
      }
    });
  },

  /**
   * Retrieve all offline order drafts for a specific user, optionally filtered by status.
   */
  async getDrafts(
    userId: string,
    filterStatus?: OfflineOrderSyncStatus
  ): Promise<OfflineOrderDraft[]> {
    const db = await getDatabase();
    if (!db || !userId) return [];

    let sql = `SELECT * FROM offline_orders WHERE userId = ?`;
    const params: string[] = [userId];

    if (filterStatus) {
      sql += ` AND syncStatus = ?`;
      params.push(filterStatus);
    }

    sql += ` ORDER BY createdAt DESC`;

    const orderRows = await db.getAllAsync<OfflineOrderRow>(sql, params);
    if (!orderRows.length) return [];

    // Fetch all items for these drafts
    const orderIds = orderRows.map((o) => o.id);
    const placeholders = orderIds.map(() => "?").join(",");
    const itemRows = await db.getAllAsync<OfflineOrderItemRow>(
      `SELECT * FROM offline_order_items WHERE userId = ? AND orderDraftId IN (${placeholders})`,
      [userId, ...orderIds]
    );

    const itemsByDraftId = new Map<string, OfflineOrderItem[]>();
    for (const item of itemRows) {
      const list = itemsByDraftId.get(item.orderDraftId) || [];
      list.push({
        id: item.id,
        orderDraftId: item.orderDraftId,
        productId: item.productId,
        itemCode: item.itemCode,
        productName: item.productName,
        displayName: item.displayName,
        variant: item.variant || undefined,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        estimatedLineTotal: item.estimatedLineTotal,
        totalStockSnapshot: item.totalStockSnapshot
      });
      itemsByDraftId.set(item.orderDraftId, list);
    }

    return orderRows.map((row) => ({
      id: row.id,
      draftNo: row.draftNo,
      userId: row.userId,
      tripId: row.tripId,
      tripNo: row.tripNo,
      tripRoute: row.tripRoute,
      customerId: row.customerId,
      customerName: row.customerName,
      customerPhone: row.customerPhone || undefined,
      customerType: row.customerType || undefined,
      items: itemsByDraftId.get(row.id) || [],
      proposedReturns: row.proposedReturns ? JSON.parse(row.proposedReturns) : undefined,
      discountPercent: row.discountPercent,
      estimatedSubtotal: row.estimatedSubtotal,
      estimatedDiscount: row.estimatedDiscount,
      estimatedTotal: row.estimatedTotal,
      syncStatus: row.syncStatus as OfflineOrderSyncStatus,
      idempotencyKey: row.idempotencyKey,
      lastSyncAttemptAt: row.lastSyncAttemptAt || undefined,
      lastSyncError: row.lastSyncError || undefined,
      conflictDetails: row.conflictDetails ? JSON.parse(row.conflictDetails) : undefined,
      confirmedOrderId: row.confirmedOrderId || undefined,
      confirmedOrderNo: row.confirmedOrderNo || undefined,
      confirmedAt: row.confirmedAt || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
  },

  /**
   * Retrieve a single offline order draft by ID for a user.
   */
  async getDraftById(
    userId: string,
    draftId: string
  ): Promise<OfflineOrderDraft | null> {
    const db = await getDatabase();
    if (!db || !userId || !draftId) return null;

    const row = await db.getFirstAsync<OfflineOrderRow>(
      `SELECT * FROM offline_orders WHERE userId = ? AND id = ? LIMIT 1`,
      [userId, draftId]
    );

    if (!row) return null;

    const itemRows = await db.getAllAsync<OfflineOrderItemRow>(
      `SELECT * FROM offline_order_items WHERE userId = ? AND orderDraftId = ?`,
      [userId, draftId]
    );

    const items: OfflineOrderItem[] = itemRows.map((item) => ({
      id: item.id,
      orderDraftId: item.orderDraftId,
      productId: item.productId,
      itemCode: item.itemCode,
      productName: item.productName,
      displayName: item.displayName,
      variant: item.variant || undefined,
      quantity: item.quantity,
      sellingPrice: item.sellingPrice,
      estimatedLineTotal: item.estimatedLineTotal,
      totalStockSnapshot: item.totalStockSnapshot
    }));

    return {
      id: row.id,
      draftNo: row.draftNo,
      userId: row.userId,
      tripId: row.tripId,
      tripNo: row.tripNo,
      tripRoute: row.tripRoute,
      customerId: row.customerId,
      customerName: row.customerName,
      customerPhone: row.customerPhone || undefined,
      customerType: row.customerType || undefined,
      items,
      proposedReturns: row.proposedReturns ? JSON.parse(row.proposedReturns) : undefined,
      discountPercent: row.discountPercent,
      estimatedSubtotal: row.estimatedSubtotal,
      estimatedDiscount: row.estimatedDiscount,
      estimatedTotal: row.estimatedTotal,
      syncStatus: row.syncStatus as OfflineOrderSyncStatus,
      idempotencyKey: row.idempotencyKey,
      lastSyncAttemptAt: row.lastSyncAttemptAt || undefined,
      lastSyncError: row.lastSyncError || undefined,
      conflictDetails: row.conflictDetails ? JSON.parse(row.conflictDetails) : undefined,
      confirmedOrderId: row.confirmedOrderId || undefined,
      confirmedOrderNo: row.confirmedOrderNo || undefined,
      confirmedAt: row.confirmedAt || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  },

  /**
   * Update synchronization status and metadata for a draft.
   */
  async updateDraftStatus(
    userId: string,
    draftId: string,
    status: OfflineOrderSyncStatus,
    meta?: {
      lastSyncAttemptAt?: string;
      lastSyncError?: string | null;
      conflictDetails?: ConflictDetail[] | null;
      confirmedOrderId?: string;
      confirmedOrderNo?: string;
      confirmedAt?: string;
    }
  ): Promise<void> {
    const db = await getDatabase();
    if (!db || !userId || !draftId) return;

    const now = new Date().toISOString();

    let sql = `UPDATE offline_orders SET syncStatus = ?, updatedAt = ?`;
    const params: (string | null)[] = [status, now];

    if (meta?.lastSyncAttemptAt !== undefined) {
      sql += `, lastSyncAttemptAt = ?`;
      params.push(meta.lastSyncAttemptAt);
    }
    if (meta?.lastSyncError !== undefined) {
      sql += `, lastSyncError = ?`;
      params.push(meta.lastSyncError);
    }
    if (meta?.conflictDetails !== undefined) {
      sql += `, conflictDetails = ?`;
      params.push(meta.conflictDetails ? JSON.stringify(meta.conflictDetails) : null);
    }
    if (meta?.confirmedOrderId !== undefined) {
      sql += `, confirmedOrderId = ?`;
      params.push(meta.confirmedOrderId);
    }
    if (meta?.confirmedOrderNo !== undefined) {
      sql += `, confirmedOrderNo = ?`;
      params.push(meta.confirmedOrderNo);
    }
    if (meta?.confirmedAt !== undefined) {
      sql += `, confirmedAt = ?`;
      params.push(meta.confirmedAt);
    }

    sql += ` WHERE userId = ? AND id = ?`;
    params.push(userId, draftId);

    await db.runAsync(sql, params);
  },

  /**
   * Delete an offline order draft and its items.
   */
  async deleteDraft(userId: string, draftId: string): Promise<void> {
    const db = await getDatabase();
    if (!db || !userId || !draftId) return;

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `DELETE FROM offline_order_items WHERE userId = ? AND orderDraftId = ?`,
        [userId, draftId]
      );
      await db.runAsync(
        `DELETE FROM offline_orders WHERE userId = ? AND id = ?`,
        [userId, draftId]
      );
    });
  },

  /**
   * Get count of unsynchronized drafts (everything except 'synced').
   */
  async getUnsyncedCount(userId: string): Promise<number> {
    const db = await getDatabase();
    if (!db || !userId) return 0;

    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM offline_orders WHERE userId = ? AND syncStatus != 'synced'`,
      [userId]
    );

    return row?.count || 0;
  },

  /**
   * Purge all drafts for a user (only on explicit user confirmation).
   */
  async purgeUserDrafts(userId: string): Promise<void> {
    const db = await getDatabase();
    if (!db || !userId) return;

    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM offline_order_items WHERE userId = ?`, [userId]);
      await db.runAsync(`DELETE FROM offline_orders WHERE userId = ?`, [userId]);
    });
  },

  // -------------------------------------------------------------
  // Cached Active Trip Snapshot Repository Methods
  // -------------------------------------------------------------

  /**
   * Cache verified active trip snapshot for a user.
   */
  async saveCachedActiveTrip(userId: string, trip: TripSession): Promise<void> {
    const db = await getDatabase();
    if (!db || !userId || !trip) return;

    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT OR REPLACE INTO cached_active_trip (
        userId, tripId, tripNo, route, status, startTime, cachedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, trip._id, trip.tripNo, trip.route, trip.status, trip.startTime, now]
    );
  },

  /**
   * Retrieve cached active trip snapshot for a user.
   */
  async getCachedActiveTrip(userId: string): Promise<TripSession | null> {
    const db = await getDatabase();
    if (!db || !userId) return null;

    const row = await db.getFirstAsync<{
      userId: string;
      tripId: string;
      tripNo: string;
      route: string;
      status: string;
      startTime: string;
      cachedAt: string;
    }>(`SELECT * FROM cached_active_trip WHERE userId = ? LIMIT 1`, [userId]);

    if (!row) return null;

    return {
      _id: row.tripId,
      tripNo: row.tripNo,
      route: row.route,
      status: row.status as any,
      startTime: row.startTime,
      rep: userId,
      expectedCollections: { cash: 0, cheque: 0 },
      ordersBooked: [],
      paymentsCollected: [],
      expenses: [],
      createdAt: row.startTime,
      updatedAt: row.cachedAt
    };
  },

  /**
   * Clear cached active trip snapshot (when trip is submitted, approved, or closed).
   */
  async clearCachedActiveTrip(userId: string): Promise<void> {
    const db = await getDatabase();
    if (!db || !userId) return;

    await db.runAsync(`DELETE FROM cached_active_trip WHERE userId = ?`, [userId]);
  }
};

