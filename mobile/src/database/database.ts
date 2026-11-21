import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";
import { CREATE_TABLES_SQL, CURRENT_SCHEMA_VERSION } from "./schema";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase | null> | null = null;

/**
 * Initializes and returns the local SQLite database.
 * Executes migrations and schema creation once on application startup.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase | null> {
  if (Platform.OS === "web") {
    // SQLite native database is not supported on standard web runs; fallback safely
    return null;
  }

  if (dbInstance) {
    return dbInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync("jsp_distributors.db");

      // Execute schema creation & PRAGMA configuration
      await db.execAsync(CREATE_TABLES_SQL);

      // Safe migration for proposedReturns column if upgrading from v2
      try {
        await db.execAsync("ALTER TABLE offline_orders ADD COLUMN proposedReturns TEXT;");
      } catch {
        // Column already exists or table was just created with proposedReturns
      }

      // Safe migrations for Customer Billing Price and FIFO Batches
      try {
        await db.execAsync("ALTER TABLE cached_products ADD COLUMN currentBillingPrice REAL DEFAULT 0;");
      } catch {
        // Column already exists
      }
      try {
        await db.execAsync("ALTER TABLE cached_products ADD COLUMN batches TEXT;");
      } catch {
        // Column already exists
      }
      try {
        await db.execAsync("ALTER TABLE offline_order_items ADD COLUMN billingPrice REAL DEFAULT 0;");
      } catch {
        // Column already exists
      }

      // Safe cache cleanup: purge stale cached product rows that had 0 or null billing price
      // This forces a clean refresh from the server while preserving all offline orders and drafts.
      try {
        await db.execAsync(
          "DELETE FROM cached_products WHERE currentBillingPrice <= 0 OR currentBillingPrice IS NULL;"
        );
      } catch {
        // Ignored
      }

      dbInstance = db;
      return db;
    } catch (err) {
      console.error("Failed to initialize SQLite offline database:", err);
      initPromise = null;
      return null;
    }
  })();

  return initPromise;
}

/**
 * Helper to close or reset connection (e.g. for testing)
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    try {
      await dbInstance.closeAsync();
    } catch {
      // Ignored
    }
    dbInstance = null;
    initPromise = null;
  }
}

