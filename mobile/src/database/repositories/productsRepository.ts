import { getDatabase } from "../database";
import { Category, Product } from "../../types";

export interface CachedProductRow {
  id: string;
  userId: string;
  itemCode: string;
  productName: string;
  variant: string | null;
  displayName: string;
  category: string | null;
  categoryName: string | null;
  supplier: string;
  currentSellingPrice: number;
  totalStock: number;
  reorderLevel: number;
  isFastMoving: number;
  status: string;
  lastSyncedAt: string;
}

export const productsRepository = {
  /**
   * Upsert products for a specific authenticated sales rep into SQLite.
   * Parameterized to prevent SQL injection.
   * EXCLUDES supplier billing price and cost secrets.
   */
  async upsertProducts(
    userId: string,
    products: Product[],
    categoryMap?: Map<string, string>
  ): Promise<void> {
    const db = await getDatabase();
    if (!db || !userId || !products.length) return;

    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      for (const p of products) {
        const catName =
          p.category && categoryMap
            ? categoryMap.get(String(p.category)) || null
            : null;

        await db.runAsync(
          `INSERT OR REPLACE INTO cached_products (
            id, userId, itemCode, productName, variant, displayName,
            category, categoryName, supplier, currentSellingPrice,
            totalStock, reorderLevel, isFastMoving, status, lastSyncedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p._id,
            userId,
            p.itemCode,
            p.productName,
            p.variant || null,
            p.displayName || `${p.productName} ${p.variant || ""}`.trim(),
            p.category ? String(p.category) : null,
            catName,
            p.supplier || "Ruhunu Foods",
            p.currentSellingPrice,
            p.totalStock,
            p.reorderLevel || 0,
            p.isFastMoving ? 1 : 0,
            p.status || "active",
            now
          ]
        );
      }
    });
  },

  /**
   * Retrieve cached products with offline search and filtering capabilities.
   */
  async getProducts(
    userId: string,
    filters?: {
      search?: string;
      supplier?: string;
      categoryId?: string;
    }
  ): Promise<Product[]> {
    const db = await getDatabase();
    if (!db || !userId) return [];

    let sql = `SELECT * FROM cached_products WHERE userId = ? AND status = 'active'`;
    const params: (string | number)[] = [userId];

    if (filters?.supplier && filters.supplier !== "All") {
      sql += ` AND supplier = ?`;
      params.push(filters.supplier);
    }

    if (filters?.categoryId && filters.categoryId !== "all") {
      sql += ` AND category = ?`;
      params.push(filters.categoryId);
    }

    if (filters?.search && filters.search.trim()) {
      const searchPattern = `%${filters.search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(productName) LIKE ? OR LOWER(itemCode) LIKE ? OR LOWER(displayName) LIKE ?)`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ` ORDER BY productName ASC`;

    const rows = await db.getAllAsync<CachedProductRow>(sql, params);

    return rows.map((r) => ({
      _id: r.id,
      itemCode: r.itemCode,
      productName: r.productName,
      variant: r.variant || "",
      displayName: r.displayName,
      category: r.category || "",
      supplier: (r.supplier as any) || "Ruhunu Foods",
      currentSellingPrice: r.currentSellingPrice,
      currentBillingPrice: 0, // Protected: never exposed offline
      totalStock: r.totalStock,
      reorderLevel: r.reorderLevel,
      isFastMoving: Boolean(r.isFastMoving),
      status: r.status as any
    }));
  },

  /**
   * Upsert categories for offline category filtering.
   */
  async upsertCategories(userId: string, categories: Category[]): Promise<void> {
    const db = await getDatabase();
    if (!db || !userId || !categories.length) return;

    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      for (const cat of categories) {
        await db.runAsync(
          `INSERT OR REPLACE INTO cached_categories (id, userId, name, lastSyncedAt)
           VALUES (?, ?, ?, ?)`,
          [cat._id, userId, cat.name, now]
        );
      }
    });
  },

  /**
   * Retrieve cached categories.
   */
  async getCategories(userId: string): Promise<Category[]> {
    const db = await getDatabase();
    if (!db || !userId) return [];

    const rows = await db.getAllAsync<{ id: string; name: string }>(
      `SELECT id, name FROM cached_categories WHERE userId = ? ORDER BY name ASC`,
      [userId]
    );

    return rows.map((r) => ({
      _id: r.id,
      name: r.name,
      status: "active"
    }));
  },

  /**
   * Delete all cached products and categories for a user (on logout or account switch).
   */
  async deleteUserProducts(userId: string): Promise<void> {
    const db = await getDatabase();
    if (!db || !userId) return;

    await db.runAsync(`DELETE FROM cached_products WHERE userId = ?`, [userId]);
    await db.runAsync(`DELETE FROM cached_categories WHERE userId = ?`, [userId]);
  }
};

