import { getDatabase } from "../database";
import { Customer, CustomerType } from "../../types";

export interface CachedCustomerRow {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  address: string | null;
  customerType: string;
  creditLimit: number;
  creditDays: number;
  outstandingBalance: number;
  status: string;
  lastSyncedAt: string;
}

export const customersRepository = {
  /**
   * Upsert customers for the authenticated sales rep into SQLite.
   * Parameterized queries prevent SQL injection.
   * Isolates records by userId.
   */
  async upsertCustomers(userId: string, customers: Customer[]): Promise<void> {
    const db = await getDatabase();
    if (!db || !userId || !customers.length) return;

    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      for (const c of customers) {
        await db.runAsync(
          `INSERT OR REPLACE INTO cached_customers (
            id, userId, name, phone, address, customerType,
            creditLimit, creditDays, outstandingBalance, status, lastSyncedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            c._id,
            userId,
            c.name,
            c.phone || null,
            c.address || null,
            c.customerType || "retail",
            c.creditLimit || 0,
            30,
            c.outstandingBalance || 0,
            c.status || "active",
            now
          ]
        );
      }
    });
  },

  /**
   * Query cached customers for a specific user with optional search and type filtering.
   */
  async getCustomers(
    userId: string,
    filters?: {
      search?: string;
      customerType?: string;
    }
  ): Promise<Customer[]> {
    const db = await getDatabase();
    if (!db || !userId) return [];

    let sql = `SELECT * FROM cached_customers WHERE userId = ? AND status = 'active'`;
    const params: (string | number)[] = [userId];

    if (filters?.customerType && filters.customerType !== "all") {
      sql += ` AND customerType = ?`;
      params.push(filters.customerType);
    }

    if (filters?.search && filters.search.trim()) {
      const searchPattern = `%${filters.search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(name) LIKE ? OR LOWER(phone) LIKE ?)`;
      params.push(searchPattern, searchPattern);
    }

    sql += ` ORDER BY name ASC`;

    const rows = await db.getAllAsync<CachedCustomerRow>(sql, params);

    return rows.map((r) => ({
      _id: r.id,
      name: r.name,
      phone: r.phone || undefined,
      address: r.address || undefined,
      customerType: r.customerType as CustomerType,
      creditLimit: r.creditLimit,
      outstandingBalance: r.outstandingBalance,
      status: r.status as "active" | "inactive"
    }));
  },

  /**
   * Retrieve a single customer from SQLite cache by ID.
   */
  async getCustomerById(userId: string, customerId: string): Promise<Customer | null> {
    const db = await getDatabase();
    if (!db || !userId || !customerId) return null;

    const row = await db.getFirstAsync<CachedCustomerRow>(
      `SELECT * FROM cached_customers WHERE userId = ? AND id = ? LIMIT 1`,
      [userId, customerId]
    );

    if (!row) return null;

    return {
      _id: row.id,
      name: row.name,
      phone: row.phone || undefined,
      address: row.address || undefined,
      customerType: row.customerType as CustomerType,
      creditLimit: row.creditLimit,
      outstandingBalance: row.outstandingBalance,
      status: row.status as "active" | "inactive"
    };
  },

  /**
   * Delete cached customers for a user (on logout or account switch).
   */
  async deleteUserCustomers(userId: string): Promise<void> {
    const db = await getDatabase();
    if (!db || !userId) return;

    await db.runAsync(`DELETE FROM cached_customers WHERE userId = ?`, [userId]);
  }
};

