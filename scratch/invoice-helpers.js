const fs = require("fs");
const path = require("path");

const logoPath = path.resolve(__dirname, "../mobile/assets/logo.png");
const JSP_LOGO_BASE64 = fs.existsSync(logoPath)
  ? "data:image/png;base64," + fs.readFileSync(logoPath, "base64")
  : "";

const COMPANY_DETAILS = {
  name: "JSP DISTRIBUTORS",
  subTitle: "REDISTRIBUTOR SALES INVOICE",
  address: "130/B, Padavi - Parackramapura",
  tel: "0767761382",
  email: "dilshanrajitha201@gmail.com"
};

const escapeHtml = (unsafe) => {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const splitRsCts = (val) => {
  const num = Number(val || 0);
  const rounded = Math.round(num * 100) / 100;
  const rs = Math.floor(rounded);
  const cts = Math.round((rounded - rs) * 100);
  return {
    rs: rs.toLocaleString("en-LK"),
    cts: cts.toString().padStart(2, "0")
  };
};

const formatDate = (iso) => {
  if (!iso) {
    const now = new Date();
    return now.toLocaleDateString("en-GB") + " " + now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB") + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const generateInvoiceHtml = (doc, options) => {
  const isOrder = options?.isOrder ?? (!("invoiceNo" in doc) && "orderNo" in doc);
  const docNo = "invoiceNo" in doc ? doc.invoiceNo : doc.orderNo || "";
  const documentTitle = isOrder ? "ORDER CONFIRMATION" : "REDISTRIBUTOR SALES INVOICE";

  // Customer information
  const customerObj = typeof doc.customer === "object" && doc.customer !== null ? doc.customer : null;
  const customerName = customerObj?.name ? escapeHtml(customerObj.name) : "Walk-in Customer";
  const customerAddress = customerObj?.address ? escapeHtml(customerObj.address) : "-";
  const customerPhone = customerObj?.phone ? escapeHtml(customerObj.phone) : "-";

  // Route / Area
  const tripRoute =
    typeof doc.tripId === "object" && doc.tripId?.route
      ? doc.tripId.route
      : options?.routeName || "-";

  // Cashier / Rep
  const cashierObj = typeof doc.cashier === "object" && doc.cashier !== null ? doc.cashier : null;
  const repName = cashierObj?.name ? escapeHtml(cashierObj.name) : options?.repName || "Field Sales Rep";

  // Items
  const items = doc.items || [];
  const itemsRowsHtml = items
    .map((item) => {
      const itemCode = escapeHtml(item.itemCode || "-");
      const name = escapeHtml(item.itemName || item.product?.name || "Product");
      const qty = Number(item.quantity || 0);
      const unitPrice = Number(item.sellingPrice || item.unitPrice || 0);
      const lineTotal = Number(item.lineTotal || qty * unitPrice);

      const rateFormatted = splitRsCts(unitPrice);
      const lineFormatted = splitRsCts(lineTotal);

      return `
        <tr>
          <td style="font-family: monospace; font-weight: bold; width: 14%;">${itemCode}</td>
          <td style="font-weight: 600; text-align: left; width: 38%;">${name}</td>
          <td style="text-align: right; font-family: monospace; width: 11%;">${rateFormatted.rs}</td>
          <td style="text-align: center; font-family: monospace; width: 6%;">${rateFormatted.cts}</td>
          <td style="text-align: center; font-weight: bold; font-family: monospace; width: 9%;">${qty}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold; width: 15%;">${lineFormatted.rs}</td>
          <td style="text-align: center; font-family: monospace; font-weight: bold; width: 7%;">${lineFormatted.cts}</td>
        </tr>
      `;
    })
    .join("");

  // Payment Method
  const paymentMethod = (doc.paymentMethod || "cash").toLowerCase();
  const chequeBank = escapeHtml(doc.chequeBank || "-");
  const chequeNo = escapeHtml(doc.chequeNo || "-");
  const chequeDate = doc.chequeDate ? formatDate(doc.chequeDate) : "-";

  // Financial summary
  const orderTotal = Number(doc.orderTotal || doc.subtotal || 0);
  const discountVal = Number(doc.discount || 0);
  const discountPercentVal =
    typeof doc.discountPercent === "number"
      ? doc.discountPercent
      : orderTotal > 0 && discountVal > 0
      ? Math.round((discountVal / orderTotal) * 100 * 10) / 10
      : 0;
  const grossAfterDiscount = Math.max(0, orderTotal - discountVal);
  const returnTotalVal = Number(doc.returnTotal || 0);
  const netTotalVal = Number(doc.netTotal || 0);
  const paidAmountVal = Number(doc.paidAmount || 0);
  const dueAmountVal = Number(doc.dueAmount || 0);

  const orderTotalRsCts = splitRsCts(orderTotal);
  const discountRsCts = splitRsCts(discountVal);
  const grossAfterDiscountRsCts = splitRsCts(grossAfterDiscount);
  const returnTotalRsCts = splitRsCts(returnTotalVal);
  const netTotalRsCts = splitRsCts(netTotalVal);
  const paidAmountRsCts = splitRsCts(paidAmountVal);
  const dueAmountRsCts = splitRsCts(dueAmountVal);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(documentTitle)} - ${escapeHtml(docNo)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 10mm 12mm 10mm; }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header-sec">
      <div class="brand-title">${escapeHtml(documentTitle)}</div>
      <div class="brand-company">${escapeHtml(COMPANY_DETAILS.name)}</div>
      ${isOrder ? `<div class="order-badge">STOCK RESERVED ON SERVER • PENDING FIELD DELIVERY</div>` : ""}
      <div class="doc-no">${escapeHtml(docNo)}</div>
      <div class="area">${escapeHtml(tripRoute)}</div>
    </div>
    <div class="customer-name">${customerName}</div>
    <div class="customer-address">${customerAddress}</div>
    <div class="customer-phone">${customerPhone}</div>
    <table class="items-table">
      ${itemsRowsHtml}
    </table>
    <div class="payment-method">${paymentMethod}</div>
    ${paymentMethod === "cheque" ? `<div class="cheque-bank">${chequeBank}</div><div class="cheque-no">${chequeNo}</div>` : ""}
    <div class="order-total">${orderTotalRsCts.rs}.${orderTotalRsCts.cts}</div>
    <div class="discount-label">Less Discount${discountPercentVal > 0 ? ` (${discountPercentVal}%)` : ""}</div>
    <div class="discount">${discountRsCts.rs}.${discountRsCts.cts}</div>
    <div class="returns">${returnTotalRsCts.rs}.${returnTotalRsCts.cts}</div>
    <div class="net-total">${netTotalRsCts.rs}.${netTotalRsCts.cts}</div>
    <div class="paid-amount">${paidAmountRsCts.rs}.${paidAmountRsCts.cts}</div>
    <div class="due-balance">${dueAmountRsCts.rs}.${dueAmountRsCts.cts}</div>
    <div class="rep-name">${repName}</div>
    <div class="footer-company">${escapeHtml(COMPANY_DETAILS.name)}</div>
    <div class="footer-address">${escapeHtml(COMPANY_DETAILS.address)}</div>
    <div class="footer-tel">${escapeHtml(COMPANY_DETAILS.tel)}</div>
    <div class="footer-email">${escapeHtml(COMPANY_DETAILS.email)}</div>
  </div>
</body>
</html>`;
};

module.exports = {
  COMPANY_DETAILS,
  splitRsCts,
  escapeHtml,
  generateInvoiceHtml
};
