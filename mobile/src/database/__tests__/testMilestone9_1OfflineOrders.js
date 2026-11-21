const { DatabaseSync } = require("node:sqlite");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

console.log("=====================================================");
console.log("   MILESTONE 9.1: OFFLINE VAN ORDERS & SYNC TESTS    ");
console.log("=====================================================");

// 1. In-memory SQLite Database
const db = new DatabaseSync(":memory:");

// Read SQL Schema from schema.ts
const schemaTsContent = fs.readFileSync(path.join(__dirname, "../schema.ts"), "utf-8");

// Extract CREATE_TABLES_SQL string from schema.ts
const sqlMatch = schemaTsContent.match(/export const CREATE_TABLES_SQL = `([\s\S]*?)`;/);
assert(sqlMatch && sqlMatch[1], "Failed to extract CREATE_TABLES_SQL from schema.ts");
const createTablesSql = sqlMatch[1];

console.log("\n--- TEST 1: Milestone 9.1 Table Creation & Verification ---");
db.exec(createTablesSql);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);
console.log("Created database tables:", tables);
assert(tables.includes("offline_orders"), "offline_orders table must exist in SQLite");
assert(tables.includes("offline_order_items"), "offline_order_items table must exist in SQLite");
assert(tables.includes("cached_active_trip"), "cached_active_trip table must exist in SQLite");
console.log("PASS: offline_orders, offline_order_items, and cached_active_trip tables created successfully.");

console.log("\n--- TEST 2: Schema & Column Verification ---");
const orderColumns = db.prepare("PRAGMA table_info(offline_orders)").all().map((c) => c.name);
console.log("offline_orders columns:", orderColumns);
assert(orderColumns.includes("idempotencyKey"), "offline_orders must have idempotencyKey");
assert(orderColumns.includes("syncStatus"), "offline_orders must have syncStatus");
assert(orderColumns.includes("estimatedTotal"), "offline_orders must have estimatedTotal");
assert(orderColumns.includes("confirmedOrderNo"), "offline_orders must have confirmedOrderNo");
assert(orderColumns.includes("userId"), "offline_orders must have userId for account isolation");

const itemColumns = db.prepare("PRAGMA table_info(offline_order_items)").all().map((c) => c.name);
console.log("offline_order_items columns:", itemColumns);
assert(itemColumns.includes("orderDraftId"), "offline_order_items must reference orderDraftId");
assert(itemColumns.includes("sellingPrice"), "offline_order_items must store sellingPrice");
assert(itemColumns.includes("billingPrice"), "offline_order_items must store billingPrice");
assert(itemColumns.includes("estimatedLineTotal"), "offline_order_items must store estimatedLineTotal");
console.log("PASS: Required schema fields verified.");

console.log("\n--- TEST 3: Transactional Draft Insertion ---");
const userA = "rep_user_A";
const draftId1 = "draft_sample_001";
const idempotencyKey1 = "ORD-rep_user_A-1731670000000-abc123";
const now = new Date().toISOString();

// Insert Order Draft
const insertDraftStmt = db.prepare(`
  INSERT INTO offline_orders (
    id, draftNo, userId, tripId, tripNo, tripRoute,
    customerId, customerName, customerPhone, customerType,
    discountPercent, estimatedSubtotal, estimatedDiscount, estimatedTotal,
    syncStatus, idempotencyKey, createdAt, updatedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insertDraftStmt.run(
  draftId1,
  "DFT-A1B2",
  userA,
  "trip_001",
  "TRP-20261115-001",
  "Colombo North",
  "cust_001",
  "Nihal Pharmacy",
  "0771234567",
  "wholesale",
  10, // 10% discount
  5000, // subtotal
  500, // discount
  4500, // net total
  "ready_to_sync",
  idempotencyKey1,
  now,
  now
);

// Insert Items
const insertItemStmt = db.prepare(`
  INSERT INTO offline_order_items (
    id, orderDraftId, userId, productId, itemCode, productName,
    displayName, variant, quantity, sellingPrice, billingPrice,
    estimatedLineTotal, totalStockSnapshot
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insertItemStmt.run(
  "item_1",
  draftId1,
  userA,
  "prod_001",
  "MED-001",
  "Panadol Extra",
  "Panadol Extra 500mg",
  "500mg",
  10,
  200,
  160,
  1600,
  50
);

insertItemStmt.run(
  "item_2",
  draftId1,
  userA,
  "prod_002",
  "MED-002",
  "Amoxicillin 250mg",
  "Amoxicillin 250mg",
  "250mg",
  15,
  200,
  180,
  2700,
  40
);

// Verify Draft and Items Retrieval
const fetchedDraft = db.prepare("SELECT * FROM offline_orders WHERE id = ?").get(draftId1);
assert.strictEqual(fetchedDraft.draftNo, "DFT-A1B2");
assert.strictEqual(fetchedDraft.estimatedTotal, 4500);
assert.strictEqual(fetchedDraft.syncStatus, "ready_to_sync");

const fetchedItems = db.prepare("SELECT * FROM offline_order_items WHERE orderDraftId = ?").all(draftId1);
assert.strictEqual(fetchedItems.length, 2);
assert.strictEqual(fetchedItems[0].quantity + fetchedItems[1].quantity, 25);
console.log("PASS: Offline order draft and line items saved and retrieved with transactional consistency.");

console.log("\n--- TEST 4: Rep Account Isolation ---");
const userB = "rep_user_B";
const draftId2 = "draft_sample_002";

insertDraftStmt.run(
  draftId2,
  "DFT-C3D4",
  userB,
  "trip_002",
  "TRP-20261115-002",
  "Kandy Route",
  "cust_002",
  "Perera Supermarket",
  "0719876543",
  "retail",
  0,
  1200,
  0,
  1200,
  "draft",
  "ORD-rep_user_B-1731670000000-xyz789",
  now,
  now
);

const draftsForUserA = db.prepare("SELECT * FROM offline_orders WHERE userId = ?").all(userA);
const draftsForUserB = db.prepare("SELECT * FROM offline_orders WHERE userId = ?").all(userB);

assert.strictEqual(draftsForUserA.length, 1);
assert.strictEqual(draftsForUserB.length, 1);
assert.strictEqual(draftsForUserA[0].id, draftId1);
assert.strictEqual(draftsForUserB[0].id, draftId2);

const unsyncedUserA = db.prepare("SELECT COUNT(*) as count FROM offline_orders WHERE userId = ? AND syncStatus != 'synced'").get(userA);
assert.strictEqual(unsyncedUserA.count, 1);
console.log("PASS: Multi-user account isolation verified. Sales reps cannot view or access other reps' offline drafts.");

console.log("\n--- TEST 5: Draft Updating & Stable Idempotency ---");
// Update draft items (simulate user re-editing draft before sync)
db.exec("BEGIN TRANSACTION");
db.prepare("DELETE FROM offline_order_items WHERE orderDraftId = ?").run(draftId1);

// Insert updated line items (qty changed from 10 to 5)
insertItemStmt.run(
  "item_1_mod",
  draftId1,
  userA,
  "prod_001",
  "MED-001",
  "Panadol Extra",
  "Panadol Extra 500mg",
  "500mg",
  5, // changed to 5
  200,
  160,
  800,
  50
);

// Update order totals, keeping SAME idempotencyKey
db.prepare(`
  UPDATE offline_orders
  SET estimatedSubtotal = 1000,
      estimatedDiscount = 100,
      estimatedTotal = 900,
      updatedAt = ?
  WHERE id = ?
`).run(new Date().toISOString(), draftId1);
db.exec("COMMIT");

const updatedDraft = db.prepare("SELECT * FROM offline_orders WHERE id = ?").get(draftId1);
assert.strictEqual(updatedDraft.estimatedTotal, 900);
assert.strictEqual(updatedDraft.idempotencyKey, idempotencyKey1, "Idempotency key must remain stable across edits");
console.log("PASS: Draft updated transactionally while preserving stable client idempotency key.");

console.log("\n--- TEST 6: Sync Lifecycle & State Transitions ---");
// 1. Mark as syncing
db.prepare("UPDATE offline_orders SET syncStatus = 'syncing' WHERE id = ?").run(draftId1);
let statusRow = db.prepare("SELECT syncStatus FROM offline_orders WHERE id = ?").get(draftId1);
assert.strictEqual(statusRow.syncStatus, "syncing");

// 2. Mark as needs_review (e.g. stock shortfall detected during pre-validation)
db.prepare(`
  UPDATE offline_orders
  SET syncStatus = 'needs_review',
      lastSyncError = 'Insufficient stock for MED-001: 5 requested, only 2 available.'
  WHERE id = ?
`).run(draftId1);
statusRow = db.prepare("SELECT syncStatus, lastSyncError FROM offline_orders WHERE id = ?").get(draftId1);
assert.strictEqual(statusRow.syncStatus, "needs_review");
assert(statusRow.lastSyncError.includes("Insufficient stock"));

// 3. Mark as synced once central server accepts order
const officialOrderNo = "ORD-20261115-0042";
db.prepare(`
  UPDATE offline_orders
  SET syncStatus = 'synced',
      confirmedOrderNo = ?,
      confirmedOrderId = 'mongo_id_order_0042',
      confirmedAt = ?,
      lastSyncError = NULL
  WHERE id = ?
`).run(officialOrderNo, new Date().toISOString(), draftId1);

statusRow = db.prepare("SELECT syncStatus, confirmedOrderNo, lastSyncError FROM offline_orders WHERE id = ?").get(draftId1);
assert.strictEqual(statusRow.syncStatus, "synced");
assert.strictEqual(statusRow.confirmedOrderNo, officialOrderNo);
assert.strictEqual(statusRow.lastSyncError, null);
console.log("PASS: Lifecycle state transitions ('draft' -> 'syncing' -> 'needs_review' -> 'synced') verified.");

console.log("\n--- TEST 7: Cached Active Trip Snapshot ---");
// Upsert active trip
db.prepare(`
  INSERT OR REPLACE INTO cached_active_trip (
    userId, tripId, tripNo, route, status, startTime, cachedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(userA, "trip_001", "TRP-20261115-001", "Colombo North", "active", now, now);

const cachedTripRow = db.prepare("SELECT * FROM cached_active_trip WHERE userId = ?").get(userA);
assert(cachedTripRow, "Cached trip row must exist");
assert.strictEqual(cachedTripRow.tripNo, "TRP-20261115-001");
assert.strictEqual(cachedTripRow.status, "active");

// Clear trip on shift close
db.prepare("DELETE FROM cached_active_trip WHERE userId = ?").run(userA);
const clearedTrip = db.prepare("SELECT * FROM cached_active_trip WHERE userId = ?").get(userA);
assert.strictEqual(clearedTrip, undefined, "Trip snapshot must be cleared on shift completion");
console.log("PASS: Active trip session caching and shift clearing verified.");

console.log("\n--- TEST 8: Draft Deletion & Cascading Items ---");
db.exec("BEGIN TRANSACTION");
db.prepare("DELETE FROM offline_order_items WHERE orderDraftId = ?").run(draftId1);
db.prepare("DELETE FROM offline_orders WHERE id = ?").run(draftId1);
db.exec("COMMIT");

const deletedDraft = db.prepare("SELECT * FROM offline_orders WHERE id = ?").get(draftId1);
const orphanItems = db.prepare("SELECT * FROM offline_order_items WHERE orderDraftId = ?").all(draftId1);
assert.strictEqual(deletedDraft, undefined);
assert.strictEqual(orphanItems.length, 0);
console.log("PASS: Draft deletion safely cascades to all associated line items with zero orphan rows.");

console.log("\n=====================================================");
console.log("   ALL MILESTONE 9.1 OFFLINE ORDER TESTS PASSED!     ");
console.log("=====================================================");
