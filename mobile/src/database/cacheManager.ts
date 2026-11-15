import { getDatabase } from "./database";
import { productsRepository } from "./repositories/productsRepository";
import { customersRepository } from "./repositories/customersRepository";
import { salesRepository } from "./repositories/salesRepository";
import { syncMetadataRepository } from "./repositories/syncMetadataRepository";
import { Category, Customer, Product, Sale } from "../types";

export interface CacheStatus {
  products: { lastSyncedAt: string | null; count: number };
  customers: { lastSyncedAt: string | null; count: number };
  sales: { lastSyncedAt: string | null; count: number };
}

export const cacheManager = {
  /**
   * Save fetched products and categories to SQLite cache and update metadata.
   */
  async cacheProducts(
    userId: string,
    products: Product[],
    categories?: Category[]
  ): Promise<void> {
    if (!userId) return;

    let categoryMap: Map<string, string> | undefined;
    if (categories && categories.length > 0) {
      await productsRepository.upsertCategories(userId, categories);
      await syncMetadataRepository.setLastSync(userId, "categories", categories.length);
      categoryMap = new Map(categories.map((c) => [c._id, c.name]));
    }

    if (products.length > 0) {
      await productsRepository.upsertProducts(userId, products, categoryMap);
      await syncMetadataRepository.setLastSync(userId, "products", products.length);
    }
  },

  /**
   * Save fetched customers to SQLite cache and update metadata.
   */
  async cacheCustomers(userId: string, customers: Customer[]): Promise<void> {
    if (!userId || !customers.length) return;

    await customersRepository.upsertCustomers(userId, customers);
    await syncMetadataRepository.setLastSync(userId, "customers", customers.length);
  },

  /**
   * Save fetched sales to SQLite cache and update metadata.
   */
  async cacheSales(userId: string, sales: Sale[]): Promise<void> {
    if (!userId || !sales.length) return;

    await salesRepository.upsertSales(userId, sales);
    await syncMetadataRepository.setLastSync(userId, "sales", sales.length);
  },

  /**
   * Purge all cached data belonging to a specific user.
   * Invoked on logout and account switching to enforce strict account isolation.
   */
  async clearUserCache(userId: string): Promise<void> {
    if (!userId) return;

    await Promise.all([
      productsRepository.deleteUserProducts(userId),
      customersRepository.deleteUserCustomers(userId),
      salesRepository.deleteUserSales(userId),
      syncMetadataRepository.deleteUserSyncMetadata(userId)
    ]);
  },

  /**
   * Purge all tables in SQLite database.
   */
  async clearAllCache(): Promise<void> {
    const db = await getDatabase();
    if (!db) return;

    await db.execAsync(`
      DELETE FROM cached_products;
      DELETE FROM cached_categories;
      DELETE FROM cached_customers;
      DELETE FROM cached_sales_summaries;
      DELETE FROM sync_metadata;
    `);
  },

  /**
   * Retrieve high-level status of the user's cached datasets.
   */
  async getCacheStatus(userId: string): Promise<CacheStatus> {
    if (!userId) {
      return {
        products: { lastSyncedAt: null, count: 0 },
        customers: { lastSyncedAt: null, count: 0 },
        sales: { lastSyncedAt: null, count: 0 }
      };
    }

    const metadata = await syncMetadataRepository.getAllSyncMetadata(userId);

    return {
      products: {
        lastSyncedAt: metadata.products?.lastSyncedAt || null,
        count: metadata.products?.recordCount || 0
      },
      customers: {
        lastSyncedAt: metadata.customers?.lastSyncedAt || null,
        count: metadata.customers?.recordCount || 0
      },
      sales: {
        lastSyncedAt: metadata.sales?.lastSyncedAt || null,
        count: metadata.sales?.recordCount || 0
      }
    };
  }
};

