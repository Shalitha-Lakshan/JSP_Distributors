import { getDatabase } from "../database";
import { CURRENT_SCHEMA_VERSION } from "../schema";

export interface SyncMetadataRow {
  entityKey: string;
  userId: string;
  lastSyncedAt: string;
  recordCount: number;
  schemaVersion: number;
}

export const syncMetadataRepository = {
  /**
   * Set or update last synchronization timestamp and record count for an entity.
   */
  async setLastSync(
    userId: string,
    entityKey: "products" | "categories" | "customers" | "sales",
    recordCount: number
  ): Promise<void> {
    const db = await getDatabase();
    if (!db || !userId) return;

    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT OR REPLACE INTO sync_metadata (
        entityKey, userId, lastSyncedAt, recordCount, schemaVersion
      ) VALUES (?, ?, ?, ?, ?)`,
      [entityKey, userId, now, recordCount, CURRENT_SCHEMA_VERSION]
    );
  },

  /**
   * Get the last sync info for a given entity and user.
   */
  async getLastSync(
    userId: string,
    entityKey: "products" | "categories" | "customers" | "sales"
  ): Promise<{ lastSyncedAt: string; recordCount: number } | null> {
    const db = await getDatabase();
    if (!db || !userId) return null;

    const row = await db.getFirstAsync<SyncMetadataRow>(
      `SELECT * FROM sync_metadata WHERE userId = ? AND entityKey = ? LIMIT 1`,
      [userId, entityKey]
    );

    if (!row) return null;

    return {
      lastSyncedAt: row.lastSyncedAt,
      recordCount: row.recordCount
    };
  },

  /**
   * Get all sync metadata for a user.
   */
  async getAllSyncMetadata(
    userId: string
  ): Promise<Record<string, { lastSyncedAt: string; recordCount: number }>> {
    const db = await getDatabase();
    if (!db || !userId) return {};

    const rows = await db.getAllAsync<SyncMetadataRow>(
      `SELECT * FROM sync_metadata WHERE userId = ?`,
      [userId]
    );

    const result: Record<string, { lastSyncedAt: string; recordCount: number }> = {};
    for (const r of rows) {
      result[r.entityKey] = {
        lastSyncedAt: r.lastSyncedAt,
        recordCount: r.recordCount
      };
    }
    return result;
  },

  /**
   * Delete sync metadata for a user.
   */
  async deleteUserSyncMetadata(userId: string): Promise<void> {
    const db = await getDatabase();
    if (!db || !userId) return;

    await db.runAsync(`DELETE FROM sync_metadata WHERE userId = ?`, [userId]);
  }
};

