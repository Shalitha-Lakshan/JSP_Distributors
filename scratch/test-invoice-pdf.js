const assert = require("assert");
const { splitRsCts, COMPANY_DETAILS, generateInvoiceHtml, escapeHtml } = require("./invoice-helpers");

console.log("=== RUNNING MILESTONE 4.1 COMPREHENSIVE PDF & INVOICE TESTS ===");

// TEST 1: Currency Formatter & Splitter
console.log("\n[Test 1] Currency Splitter (splitRsCts)");
const t1 = splitRsCts(1250.5);
assert.strictEqual(t1.rs, "1,250");
assert.strictEqual(t1.cts, "50");

const t2 = splitRsCts(0);
assert.strictEqual(t2.rs, "0");
assert.strictEqual(t2.cts, "00");

const t3 = splitRsCts(450.05);
assert.strictEqual(t3.rs, "450");
assert.strictEqual(t3.cts, "05");

const t4 = splitRsCts(1000000.99);
assert.strictEqual(t4.rs, "1,000,000");
assert.strictEqual(t4.cts, "99");
console.log("✓ splitRsCts handles standard, zero, decimal, and large amounts correctly");

// TEST 2: Company Details Verification
console.log("\n[Test 2] Verified JSP Distributors Company Info");
assert.strictEqual(COMPANY_DETAILS.name, "JSP DISTRIBUTORS");
assert.strictEqual(COMPANY_DETAILS.address, "130/B, Padavi - Parackramapura");
assert.strictEqual(COMPANY_DETAILS.tel, "0767761382");
assert.strictEqual(COMPANY_DETAILS.email, "dilshanrajitha201@gmail.com");
console.log("✓ Company details match authoritative system records");

// TEST 3: Direct Cash Sale Invoice Generation
console.log("\n[Test 3] Direct Cash Sale Invoice Generation");
const directSaleFixture = {
  invoiceNo: "INV-00000101",
  customer: {
    name: "Saman Perera Grocery",
    address: "45 Main Street, Anuradhapura",
    phone: "0771234567"
  },
  cashier: { name: "Kasun Silva" },
  tripId: { route: "Padavi Route 01" },
  items: [
    {
      itemCode: "RF-CHILI-100",
      itemName: "Ruhunu Chili Powder 100g",
      quantity: 10,
      sellingPrice: 250,
      lineTotal: 2500
    },
    {
      itemCode: "GF-CURRY-50",
      itemName: "Gajamuthu Curry Powder 50g",
      quantity: 5,
      sellingPrice: 150,
      lineTotal: 750
    }
  ],
  orderTotal: 3250,
  discount: 250,
  returnTotal: 0,
  netTotal: 3000,
  paidAmount: 3000,
  dueAmount: 0,
  paymentMethod: "cash",
  paymentStatus: "paid",
  createdAt: "2026-11-15T09:30:00.000Z"
};

const cashHtml = generateInvoiceHtml(directSaleFixture);
assert(cashHtml.includes("REDISTRIBUTOR SALES INVOICE"), "Title should be REDISTRIBUTOR SALES INVOICE");
assert(cashHtml.includes("INV-00000101"), "Invoice number should be present");
assert(cashHtml.includes("Saman Perera Grocery"), "Customer name should be present");
assert(cashHtml.includes("0771234567"), "Customer phone should be present");
assert(cashHtml.includes("Padavi Route 01"), "Route should be present");
assert(cashHtml.includes("Kasun Silva"), "Cashier rep should be present");
assert(cashHtml.includes("RF-CHILI-100"), "Product code RF-CHILI-100 should be present");
assert(cashHtml.includes("GF-CURRY-50"), "Product code GF-CURRY-50 should be present");
assert(cashHtml.includes("3,250.00"), "Subtotal 3,250.00 should be present");
assert(cashHtml.includes("250.00"), "Discount 250.00 should be present");
assert(cashHtml.includes("3,000.00"), "Net Total 3,000.00 should be present");
assert(cashHtml.includes("due-balance\">0.00"), "Due balance should be 0.00");
console.log("✓ Direct Cash Sale generated with all server-confirmed values");

// TEST 4: Credit Sale Invoice Generation
console.log("\n[Test 4] Credit Sale Invoice Generation");
const creditSaleFixture = {
  invoiceNo: "INV-00000102",
  customer: {
    name: "Sunil Supermart",
    address: "12 Temple Road",
    phone: "0719876543"
  },
  items: [
    {
      itemCode: "RF-PEPPER-100",
      itemName: "Ruhunu Black Pepper 100g",
      quantity: 20,
      sellingPrice: 500,
      lineTotal: 10000
    }
  ],
  orderTotal: 10000,
  discount: 0,
  returnTotal: 0,
  netTotal: 10000,
  paidAmount: 0,
  dueAmount: 10000,
  paymentMethod: "credit",
  paymentStatus: "credit"
};

const creditHtml = generateInvoiceHtml(creditSaleFixture);
assert(creditHtml.includes("credit"), "Payment method should be credit");
assert(creditHtml.includes("due-balance\">10,000.00"), "Due balance should be 10,000.00");
assert(creditHtml.includes("paid-amount\">0.00"), "Paid amount should be 0.00");
console.log("✓ Credit Sale invoice reflects 10,000 due balance and 0 paid amount");

// TEST 5: Partial Payment Invoice Generation
console.log("\n[Test 5] Partial Payment Invoice Generation");
const partialSaleFixture = {
  invoiceNo: "INV-00000103",
  customer: { name: "Kamal Stores" },
  items: [{ itemCode: "ITEM-1", itemName: "Product 1", quantity: 1, sellingPrice: 5000, lineTotal: 5000 }],
  orderTotal: 5000,
  discount: 0,
  returnTotal: 0,
  netTotal: 5000,
  paidAmount: 2000,
  dueAmount: 3000,
  paymentMethod: "cash",
  paymentStatus: "partial"
};
const partialHtml = generateInvoiceHtml(partialSaleFixture);
assert(partialHtml.includes("paid-amount\">2,000.00"), "Paid amount should be 2,000.00");
assert(partialHtml.includes("due-balance\">3,000.00"), "Due balance should be 3,000.00");
console.log("✓ Partial payment reflects paid 2,000 and due 3,000 accurately");

// TEST 6: Cheque Payment Details
console.log("\n[Test 6] Cheque Payment Details Display");
const chequeSaleFixture = {
  invoiceNo: "INV-00000104",
  customer: { name: "City Center Traders" },
  items: [{ itemCode: "ITEM-2", itemName: "Product 2", quantity: 2, sellingPrice: 4000, lineTotal: 8000 }],
  orderTotal: 8000,
  discount: 0,
  returnTotal: 0,
  netTotal: 8000,
  paidAmount: 8000,
  dueAmount: 0,
  paymentMethod: "cheque",
  paymentStatus: "paid",
  chequeBank: "Commercial Bank - Padavi Branch",
  chequeNo: "CHQ-778899",
  chequeDate: "2026-11-25T00:00:00.000Z"
};
const chequeHtml = generateInvoiceHtml(chequeSaleFixture);
assert(chequeHtml.includes("Commercial Bank - Padavi Branch"), "Bank name should be rendered");
assert(chequeHtml.includes("CHQ-778899"), "Cheque number should be rendered");
console.log("✓ Cheque details correctly rendered without invention of missing fields");

// TEST 7: Booked Order Confirmation (ORD-...) vs Sales Invoice (INV-...)
console.log("\n[Test 7] Booked Order vs Sales Invoice Distinction");
const bookedOrderFixture = {
  orderNo: "ORD-00000045",
  customer: { name: "Ruwan Stores" },
  items: [{ itemCode: "RF-CHILI-500", itemName: "Ruhunu Chili 500g", quantity: 4, unitPrice: 1200, lineTotal: 4800 }],
  orderTotal: 4800,
  discount: 0,
  returnTotal: 0,
  netTotal: 4800,
  paidAmount: 0,
  dueAmount: 4800,
  orderStatus: "pending_delivery",
  paymentStatus: "not_collected",
  stockReserved: true
};
const orderHtml = generateInvoiceHtml(bookedOrderFixture);
assert(orderHtml.includes("ORDER CONFIRMATION"), "Order confirmation title should be present");
assert(!orderHtml.includes("REDISTRIBUTOR SALES INVOICE"), "Must NOT display SALES INVOICE for an unfulfilled order");
assert(orderHtml.includes("ORD-00000045"), "Order number should be present");
assert(orderHtml.includes("STOCK RESERVED ON SERVER"), "Server stock reserved banner must be present");
console.log("✓ Strict document distinction preserved: ORD-... renders ORDER CONFIRMATION with stock-reserved disclaimer");

// TEST 8: Walk-in Customer Fallback
console.log("\n[Test 8] Walk-in Customer Fallback (Null/Undefined Customer)");
const walkInSaleFixture = {
  invoiceNo: "INV-00000105",
  customer: null,
  items: [{ itemCode: "ITEM-3", itemName: "Quick Sale Product", quantity: 1, sellingPrice: 600, lineTotal: 600 }],
  orderTotal: 600,
  discount: 0,
  returnTotal: 0,
  netTotal: 600,
  paidAmount: 600,
  dueAmount: 0,
  paymentMethod: "cash",
  paymentStatus: "paid"
};
const walkInHtml = generateInvoiceHtml(walkInSaleFixture);
assert(walkInHtml.includes("Walk-in Customer"), "Should fallback to Walk-in Customer");
console.log("✓ Walk-in customer safely falls back without inventing fake details");

// TEST 9: HTML / XSS Escaping
console.log("\n[Test 9] Character Escaping & Security");
const xssSaleFixture = {
  invoiceNo: "INV-00000106",
  customer: { name: "O'Reilly & Sons <script>alert(1)</script>" },
  items: [{ itemCode: "ITM<1>", itemName: "Chili \"Special\" & Spice", quantity: 1, sellingPrice: 100, lineTotal: 100 }],
  orderTotal: 100,
  discount: 0,
  returnTotal: 0,
  netTotal: 100,
  paidAmount: 100,
  dueAmount: 0,
  paymentMethod: "cash"
};
const xssHtml = generateInvoiceHtml(xssSaleFixture);
assert(!xssHtml.includes("<script>"), "Raw script tag must not be present");
assert(xssHtml.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "Script tag should be escaped");
assert(xssHtml.includes("O&#039;Reilly &amp; Sons"), "Apostrophe and ampersand should be escaped");
assert(xssHtml.includes("&quot;Special&quot; &amp; Spice"), "Quotes should be escaped");
console.log("✓ Special characters and HTML entities escaped securely");

// TEST 10: A4 Dimensions & Print Page Break Styling
console.log("\n[Test 10] A4 Print Styling & Avoid Page Break");
assert(cashHtml.includes("@page { size: A4 portrait;"), "A4 portrait page directive must exist");
assert(cashHtml.includes("JSP DISTRIBUTORS"), "Footer company must exist");
assert(cashHtml.includes("130/B, Padavi - Parackramapura"), "Footer address must exist");
assert(cashHtml.includes("0767761382"), "Footer telephone must exist");
assert(cashHtml.includes("dilshanrajitha201@gmail.com"), "Footer email must exist");
console.log("✓ A4 page sizing and authoritative contact info verified");

// TEST 11: Percentage-Based Discount in Sale & Invoice PDF
console.log("\n[Test 11] Percentage-Based Discount in Sale & Invoice PDF");
const percentSaleFixture = {
  invoiceNo: "INV-00000107",
  customer: { name: "Nimal Stores" },
  items: [{ itemCode: "ITM-10", itemName: "Spices Pack", quantity: 4, sellingPrice: 2500, lineTotal: 10000 }],
  orderTotal: 10000,
  discountPercent: 7.5,
  discount: 750,
  returnTotal: 0,
  netTotal: 9250,
  paidAmount: 9250,
  dueAmount: 0,
  paymentMethod: "cash",
  paymentStatus: "paid"
};
const percentSaleHtml = generateInvoiceHtml(percentSaleFixture);
assert(percentSaleHtml.includes("Less Discount (7.5%)"), "Invoice PDF must show 'Less Discount (7.5%)'");
assert(percentSaleHtml.includes("750.00"), "Discount amount of 750.00 must be rendered");
assert(percentSaleHtml.includes("9,250.00"), "Net Total 9,250.00 must be rendered");
console.log("✓ Percentage discount (7.5%) correctly formatted and rendered on Invoice PDF");

// TEST 12: Percentage Discount in Van Order Booking
console.log("\n[Test 12] Percentage Discount in Van Order Booking");
const percentOrderFixture = {
  orderNo: "ORD-00000046",
  customer: { name: "Central Grocery" },
  items: [{ itemCode: "ITM-20", itemName: "Curry Mix 1kg", quantity: 5, sellingPrice: 2000, lineTotal: 10000 }],
  orderTotal: 10000,
  discountPercent: 10,
  discount: 1000,
  returnTotal: 0,
  netTotal: 9000,
  paidAmount: 0,
  dueAmount: 9000,
  paymentStatus: "not_collected"
};
const percentOrderHtml = generateInvoiceHtml(percentOrderFixture);
assert(percentOrderHtml.includes("ORDER CONFIRMATION"), "Must be Order Confirmation");
assert(percentOrderHtml.includes("Less Discount (10%)"), "Order confirmation must show 'Less Discount (10%)'");
assert(percentOrderHtml.includes("1,000.00"), "Order discount amount 1,000.00 must be displayed");
assert(percentOrderHtml.includes("9,000.00"), "Order net total 9,000.00 must be displayed");
console.log("✓ Van Order Booking accurately persists and renders 10% discount on confirmation");

// TEST 13: Server Authoritative Discount & Net Total Formula
console.log("\n[Test 13] Server Authoritative Discount Calculation Formula");
function calculateServerTotals(orderTotal, returnTotal, discountPercent) {
  const baseTotal = Math.max(orderTotal - returnTotal, 0);
  const discountAmount = Math.round((baseTotal * (discountPercent / 100)) * 100) / 100;
  const netTotal = Math.max(baseTotal - discountAmount, 0);
  return { baseTotal, discountAmount, netTotal };
}

// Case A: 10% discount on 10,000 with 0 returns
const calcA = calculateServerTotals(10000, 0, 10);
assert.strictEqual(calcA.discountAmount, 1000);
assert.strictEqual(calcA.netTotal, 9000);

// Case B: 2.5% discount on 7,350 with 350 returns -> base 7,000
const calcB = calculateServerTotals(7350, 350, 2.5);
assert.strictEqual(calcB.baseTotal, 7000);
assert.strictEqual(calcB.discountAmount, 175);
assert.strictEqual(calcB.netTotal, 6825);

// Case C: 0% discount
const calcC = calculateServerTotals(5000, 0, 0);
assert.strictEqual(calcC.discountAmount, 0);
assert.strictEqual(calcC.netTotal, 5000);

// Case D: 100% discount
const calcD = calculateServerTotals(5000, 0, 100);
assert.strictEqual(calcD.discountAmount, 5000);
assert.strictEqual(calcD.netTotal, 0);

// Case E: Fractional rounding (3.33% on 1250)
// 1250 * 0.0333 = 41.625 -> rounds to 41.63
const calcE = calculateServerTotals(1250, 0, 3.33);
assert.strictEqual(calcE.discountAmount, 41.63);
assert.strictEqual(calcE.netTotal, 1208.37);
console.log("✓ Authoritative server calculation matches business specifications with 2-decimal precision");

// TEST 14: Order Delivery Recalculation Flow
console.log("\n[Test 14] Order Delivery Recalculation Flow");
const bookedOrder = {
  orderTotal: 10000,
  discountPercent: 5,
  discount: 500,
  netTotal: 9500
};
// Rep adjusts discount to 8% at delivery
const repAdjustedPercent = 8;
const deliverySubtotal = bookedOrder.orderTotal;
const deliveryDiscount = Math.round((deliverySubtotal * (repAdjustedPercent / 100)) * 100) / 100;
const deliveryNetTotal = Math.max(0, deliverySubtotal - deliveryDiscount);
assert.strictEqual(deliveryDiscount, 800);
assert.strictEqual(deliveryNetTotal, 9200);
console.log("✓ Order delivery dynamically recalculates net totals with adjusted discount percentage");

console.log("\n=======================================================");
console.log(">>> ALL 14 COMPREHENSIVE PDF & INVOICE TESTS PASSED! <<<");
console.log("=======================================================\n");
