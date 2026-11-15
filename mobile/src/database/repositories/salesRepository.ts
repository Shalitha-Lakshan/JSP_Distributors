import { getDatabase } from "../database";
import { Customer, PaymentMethod, PaymentStatus, Sale, SaleType } from "../../types";

export interface CachedSaleRow {
  id: string;
  userId: string;
  invoiceNo: string;
  customerName: string | null;
  customerId: string | null;
  date: string;
  totalAmount: number;
  netTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: string;
  paymentMethod: string | null;
  saleType: string | null;
  itemsCount: number;
  lastSyncedAt: string;
}

export const salesRepository = {
  /**
   * Upsert recent sales summaries for the authenticated sales rep into SQLite.
   * Parameterized queries ensure safe execution.
   */
  async upsertSales(userId: string, sales: Sale[]): Promise<void> {
    const db = await getDatabase();
    if (!db || !userId || !sales.length) return;

    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      for (const s of sales) {
        let custName: string | null = null;
        let custId: string | null = null;

        if (s.customer && typeof s.customer === "object") {
          custName = (s.customer as Customer).name || null;
          custId = (s.customer as Customer)._id || null;
        } else if (typeof s.customer === "string") {
          custId = s.customer;
        }

        const itemsCount = Array.isArray(s.items) ? s.items.length : 0;

        await db.runAsync(
          `INSERT OR REPLACE INTO cached_sales_summaries (
            id, userId, invoiceNo, customerName, customerId, date,
            totalAmount, netTotal, paidAmount, dueAmount, paymentStatus,
            paymentMethod, saleType, itemsCount, lastSyncedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s._id,
            userId,
            s.invoiceNo,
            custName,
            custId,
            s.createdAt || now,
            s.orderTotal || s.subtotal || 0,
            s.netTotal || 0,
            s.paidAmount || 0,
            s.dueAmount || 0,
            s.paymentStatus || "paid",
            s.paymentMethod || "cash",
            s.saleType || "walk-in",
            itemsCount,
            now
          ]
        );
      }
    });
  },

  /**
   * Retrieve cached recent sales summaries for a user with search capability.
   */
  async getSales(userId: string, search?: string): Promise<Sale[]> {
    const db = await getDatabase();
    if (!db || !userId) return [];

    let sql = `SELECT * FROM cached_sales_summaries WHERE userId = ?`;
    const params: (string | number)[] = [userId];

    if (search && search.trim()) {
      const searchPattern = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(invoiceNo) LIKE ? OR LOWER(customerName) LIKE ?)`;
      params.push(searchPattern, searchPattern);
    }

    sql += ` ORDER BY date DESC LIMIT 100`;

    const rows = await db.getAllAsync<CachedSaleRow>(sql, params);

    return rows.map((r) => ({
      _id: r.id,
      invoiceNo: r.invoiceNo,
      customer: r.customerId
        ? {
            _id: r.customerId,
            name: r.customerName || "Customer",
            customerType: "retail" as const,
            creditLimit: 0,
            outstandingBalance: 0,
            status: "active" as const
          }
        : null,
      cashier: userId,
      items: [],
      returns: [],
      orderTotal: r.totalAmount,
      returnTotal: 0,
      subtotal: r.totalAmount,
      discount: 0,
      netTotal: r.netTotal,
      paidAmount: r.paidAmount,
      dueAmount: r.dueAmount,
      balance: 0,
      paymentMethod: (r.paymentMethod as PaymentMethod) || "cash",
      paymentStatus: (r.paymentStatus as PaymentStatus) || "paid",
      saleType: (r.saleType as SaleType) || "walk-in",
      status: "active",
      createdAt: r.date,
      updatedAt: r.date
    }));
  },

  /**
   * Delete cached sales for a user (on logout or account switch).
   */
  async deleteUserSales(userId: string): Promise<void> {
    const db = await getDatabase();
    if (!db || !userId) return;

    await db.runAsync(`DELETE FROM cached_sales_summaries WHERE userId = ?`, [userId]);
  }
};

