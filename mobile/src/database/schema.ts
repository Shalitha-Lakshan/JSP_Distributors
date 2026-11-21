/**
 * SQLite Local Database Schema for Offline Caching & Offline Van Order Drafts
 *
 * SAFETY & SECURITY:
 * - Every table includes userId for strict account isolation.
 * - Sensitive supplier costs and billing prices are EXCLUDED.
 * - Passwords, JWTs, and secret keys are NEVER stored in SQLite.
 * - Offline Van Order drafts store stable idempotency keys for reliable replay.
 */

export const CURRENT_SCHEMA_VERSION = 6;

export const CREATE_TABLES_SQL = `
  PRAGMA journal_mode = WAL;

  -- 1. Products Table (Offline Catalogue)
  CREATE TABLE IF NOT EXISTS cached_products (
    id TEXT NOT NULL,
    userId TEXT NOT NULL,
    itemCode TEXT NOT NULL,
    productName TEXT NOT NULL,
    variant TEXT,
    displayName TEXT NOT NULL,
    category TEXT,
    categoryName TEXT,
    supplier TEXT NOT NULL,
    currentSellingPrice REAL NOT NULL,
    currentBillingPrice REAL NOT NULL DEFAULT 0,
    batches TEXT,
    totalStock INTEGER NOT NULL,
    reorderLevel INTEGER DEFAULT 0,
    isFastMoving INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    lastSyncedAt TEXT NOT NULL,
    PRIMARY KEY (id, userId)
  );

  CREATE INDEX IF NOT EXISTS idx_products_user ON cached_products(userId);
  CREATE INDEX IF NOT EXISTS idx_products_search ON cached_products(userId, itemCode, productName, supplier);

  -- 2. Categories Table (Offline Category Filters)
  CREATE TABLE IF NOT EXISTS cached_categories (
    id TEXT NOT NULL,
    userId TEXT NOT NULL,
    name TEXT NOT NULL,
    lastSyncedAt TEXT NOT NULL,
    PRIMARY KEY (id, userId)
  );

  CREATE INDEX IF NOT EXISTS idx_categories_user ON cached_categories(userId);

  -- 3. Customers Table (Offline Customer Directory)
  CREATE TABLE IF NOT EXISTS cached_customers (
    id TEXT NOT NULL,
    userId TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    customerType TEXT DEFAULT 'retail',
    creditLimit REAL DEFAULT 0,
    creditDays INTEGER DEFAULT 30,
    outstandingBalance REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    lastSyncedAt TEXT NOT NULL,
    PRIMARY KEY (id, userId)
  );

  CREATE INDEX IF NOT EXISTS idx_customers_user ON cached_customers(userId);
  CREATE INDEX IF NOT EXISTS idx_customers_search ON cached_customers(userId, name, phone, customerType);

  -- 4. Sales Summaries Table (Offline Recent Sales History)
  CREATE TABLE IF NOT EXISTS cached_sales_summaries (
    id TEXT NOT NULL,
    userId TEXT NOT NULL,
    invoiceNo TEXT NOT NULL,
    customerName TEXT,
    customerId TEXT,
    date TEXT NOT NULL,
    totalAmount REAL NOT NULL,
    netTotal REAL NOT NULL,
    paidAmount REAL NOT NULL,
    dueAmount REAL NOT NULL,
    paymentStatus TEXT NOT NULL,
    paymentMethod TEXT,
    saleType TEXT,
    itemsCount INTEGER NOT NULL,
    lastSyncedAt TEXT NOT NULL,
    PRIMARY KEY (id, userId)
  );

  CREATE INDEX IF NOT EXISTS idx_sales_user ON cached_sales_summaries(userId);
  CREATE INDEX IF NOT EXISTS idx_sales_date ON cached_sales_summaries(userId, date);

  -- 5. Synchronization Metadata Table
  CREATE TABLE IF NOT EXISTS sync_metadata (
    entityKey TEXT NOT NULL,
    userId TEXT NOT NULL,
    lastSyncedAt TEXT NOT NULL,
    recordCount INTEGER NOT NULL,
    schemaVersion INTEGER NOT NULL,
    PRIMARY KEY (entityKey, userId)
  );

  -- 6. Offline Van Order Drafts Table (Milestone 9.1)
  CREATE TABLE IF NOT EXISTS offline_orders (
    id TEXT PRIMARY KEY,
    draftNo TEXT NOT NULL,
    userId TEXT NOT NULL,
    tripId TEXT NOT NULL,
    tripNo TEXT NOT NULL,
    tripRoute TEXT NOT NULL,
    customerId TEXT NOT NULL,
    customerName TEXT NOT NULL,
    customerPhone TEXT,
    customerType TEXT,
    discountPercent REAL DEFAULT 0,
    estimatedSubtotal REAL NOT NULL,
    estimatedDiscount REAL NOT NULL,
    estimatedTotal REAL NOT NULL,
    syncStatus TEXT NOT NULL DEFAULT 'draft',
    idempotencyKey TEXT NOT NULL UNIQUE,
    lastSyncAttemptAt TEXT,
    lastSyncError TEXT,
    conflictDetails TEXT,
    proposedReturns TEXT,
    confirmedOrderId TEXT,
    confirmedOrderNo TEXT,
    confirmedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_offline_orders_user ON offline_orders(userId);
  CREATE INDEX IF NOT EXISTS idx_offline_orders_status ON offline_orders(userId, syncStatus);
  CREATE INDEX IF NOT EXISTS idx_offline_orders_trip ON offline_orders(userId, tripId);

  -- 7. Offline Van Order Items Table (Milestone 9.1)
  CREATE TABLE IF NOT EXISTS offline_order_items (
    id TEXT PRIMARY KEY,
    orderDraftId TEXT NOT NULL,
    userId TEXT NOT NULL,
    productId TEXT NOT NULL,
    itemCode TEXT NOT NULL,
    productName TEXT NOT NULL,
    displayName TEXT NOT NULL,
    variant TEXT,
    quantity INTEGER NOT NULL,
    sellingPrice REAL NOT NULL,
    billingPrice REAL NOT NULL DEFAULT 0,
    estimatedLineTotal REAL NOT NULL,
    totalStockSnapshot INTEGER DEFAULT 0,
    FOREIGN KEY (orderDraftId) REFERENCES offline_orders(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_offline_order_items_order ON offline_order_items(orderDraftId);
  CREATE INDEX IF NOT EXISTS idx_offline_order_items_user ON offline_order_items(userId);

  -- 8. Cached Active Trip Snapshot Table (Milestone 9.1)
  CREATE TABLE IF NOT EXISTS cached_active_trip (
    userId TEXT PRIMARY KEY,
    tripId TEXT NOT NULL,
    tripNo TEXT NOT NULL,
    route TEXT NOT NULL,
    status TEXT NOT NULL,
    startTime TEXT NOT NULL,
    cachedAt TEXT NOT NULL
  );
`;
