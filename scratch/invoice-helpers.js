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

  // Batch price lookup map from options (if provided)
  const batchLookup = new Map();
  if (options?.batchMap) {
    if (options.batchMap instanceof Map) {
      options.batchMap.forEach((v, k) => batchLookup.set(k, { sellingPrice: v }));
    } else {
      Object.entries(options.batchMap).forEach(([k, v]) => batchLookup.set(k, { sellingPrice: Number(v) }));
    }
  }
  if (Array.isArray(options?.batches)) {
    options.batches.forEach((b) => {
      const sp = b.sellingPrice !== undefined && Number(b.sellingPrice) > 0 ? Number(b.sellingPrice) : undefined;
      const bp = b.billingPrice !== undefined && Number(b.billingPrice) > 0 ? Number(b.billingPrice) : undefined;
      if (b._id) batchLookup.set(String(b._id), { sellingPrice: sp, billingPrice: bp });
      if (b.batchId) batchLookup.set(String(b.batchId), { sellingPrice: sp, billingPrice: bp });
      if (b.batchNo) batchLookup.set(String(b.batchNo), { sellingPrice: sp, billingPrice: bp });
    });
  }

  // Items
  const items = doc.items || [];
  const itemsRowsHtml = items
    .map((item) => {
      const itemCode = escapeHtml(item.itemCode || "-");
      const name = escapeHtml(item.itemName || item.product?.displayName || item.product?.name || "Product");
      const qty = Number(item.quantity || 0);

      // Customer Billing Unit Price (Authoritative calculation base)
      const billingPrice =
        item.billingPrice !== undefined && item.billingPrice !== null
          ? Number(item.billingPrice)
          : item.unitPrice !== undefined && item.unitPrice !== null
          ? Number(item.unitPrice)
          : 0;

      // Line Total calculated strictly from Billing Price
      const lineTotal = Number(
        item.lineTotal !== undefined && item.lineTotal !== null
          ? item.lineTotal
          : qty * billingPrice
      );

      const usedBatches = Array.isArray(item.usedBatches)
        ? item.usedBatches
        : Array.isArray(item.allocations)
        ? item.allocations
        : [];

      // Parent item-level selling price snapshot
      const rawItemSelling =
        item.sellingPrice !== undefined &&
        item.sellingPrice !== null &&
        !isNaN(Number(item.sellingPrice)) &&
        Number(item.sellingPrice) > 0
          ? Number(item.sellingPrice)
          : typeof item.product === "object" && item.product !== null && Number(item.product.currentSellingPrice) > 0
          ? Number(item.product.currentSellingPrice)
          : null;

      // Normalize each allocated FIFO stock batch
      const processedBatches = usedBatches.map((b, bIdx) => {
        const rawBatchQty =
          b.quantity !== undefined && b.quantity !== null
            ? b.quantity
            : b.qty !== undefined && b.qty !== null
            ? b.qty
            : 0;
        const bQty = Number(rawBatchQty);
        const validBQty = !isNaN(bQty) && bQty > 0 ? bQty : 0;

        const bBilling = Number(
          b.billingPrice !== undefined && b.billingPrice !== null ? b.billingPrice : billingPrice
        );
        const bLineTotal = Number(
          b.lineTotal !== undefined && b.lineTotal !== null ? b.lineTotal : validBQty * bBilling
        );

        // Resolve display-only reference selling price for this specific batch
        let bSelling = null;
        if (
          b.sellingPrice !== undefined &&
          b.sellingPrice !== null &&
          !isNaN(Number(b.sellingPrice)) &&
          Number(b.sellingPrice) > 0
        ) {
          bSelling = Number(b.sellingPrice);
        } else if (typeof b.batchId === "object" && b.batchId !== null && Number(b.batchId.sellingPrice) > 0) {
          bSelling = Number(b.batchId.sellingPrice);
        } else if (b.batchId && batchLookup.has(String(b.batchId)) && batchLookup.get(String(b.batchId))?.sellingPrice) {
          bSelling = batchLookup.get(String(b.batchId)).sellingPrice;
        } else if (b.batchNo && batchLookup.has(String(b.batchNo)) && batchLookup.get(String(b.batchNo))?.sellingPrice) {
          bSelling = batchLookup.get(String(b.batchNo)).sellingPrice;
        } else if (Array.isArray(item.batches)) {
          const matched = item.batches.find(
            (ib) =>
              (b.batchId && String(ib._id || ib.batchId) === String(b.batchId)) ||
              (b.batchNo && ib.batchNo === b.batchNo)
          );
          if (matched && Number(matched.sellingPrice) > 0) {
            bSelling = Number(matched.sellingPrice);
          }
        }

        // If batch selling price still missing, fallback to item-level selling price snapshot
        if (bSelling === null && rawItemSelling !== null) {
          bSelling = rawItemSelling;
        }

        return {
          batchId: b.batchId,
          batchNo: b.batchNo || "-",
          label: b.label || `F${bIdx + 1}`,
          qty: validBQty,
          billingPrice: bBilling,
          sellingPrice: bSelling,
          lineTotal: bLineTotal
        };
      });

      // MULTI-BATCH PRESENTATION:
      if (processedBatches.length > 1) {
        const lineFormatted = splitRsCts(lineTotal);

        const subRowsHtml = processedBatches
          .map((b) => {
            const bSellingFormatted = b.sellingPrice !== null ? splitRsCts(b.sellingPrice) : null;
            const bBillingFormatted = splitRsCts(b.billingPrice);
            const bLineFormatted = splitRsCts(b.lineTotal);
            const bLabel = escapeHtml(b.label);
            const bNo = escapeHtml(b.batchNo);

            return `
              <tr style="background-color: #f8fafc; font-size: 9.5px; color: #334155;">
                <td style="font-family: monospace; font-weight: 700; text-align: center; color: #0f766e; width: 14%;">
                  ↳ ${itemCode} (${bLabel})
                </td>
                <td style="text-align: left; padding-left: 14px; font-family: monospace; color: #475569; width: 32%;">
                  Batch ${bNo}
                </td>
                <td style="text-align: center; font-weight: 700; font-family: monospace; color: #0f172a; width: 8%;">
                  ${b.qty}
                </td>
                ${
                  bSellingFormatted
                    ? `<td style="text-align: right; font-family: monospace; color: #64748b; width: 10%;">${bSellingFormatted.rs}</td>
                       <td style="text-align: center; font-family: monospace; color: #64748b; width: 5%;">${bSellingFormatted.cts}</td>`
                    : `<td colspan="2" style="text-align: center; font-family: monospace; color: #94a3b8; width: 15%;">N/A</td>`
                }
                <td style="text-align: right; font-family: monospace; font-weight: 700; width: 10%;">${bBillingFormatted.rs}</td>
                <td style="text-align: center; font-family: monospace; font-weight: 700; width: 5%;">${bBillingFormatted.cts}</td>
                <td style="text-align: right; font-family: monospace; font-weight: 700; width: 11%;">${bLineFormatted.rs}</td>
                <td style="text-align: center; font-family: monospace; font-weight: 700; width: 5%;">${bLineFormatted.cts}</td>
              </tr>
            `;
          })
          .join("");

        return `
          <tr style="font-weight: 600;">
            <td style="font-family: monospace; font-weight: bold; width: 14%; text-align: center;">${itemCode}</td>
            <td style="font-weight: 700; text-align: left; width: 32%;">${name}</td>
            <td style="text-align: center; font-weight: bold; font-family: monospace; width: 8%;">${qty}</td>
            <td colspan="2" style="text-align: center; font-family: monospace; color: #94a3b8; width: 15%; font-size: 8.5px;">-</td>
            <td colspan="2" style="text-align: center; font-family: monospace; color: #94a3b8; width: 15%; font-size: 8.5px;">-</td>
            <td style="text-align: right; font-family: monospace; font-weight: bold; width: 11%;">${lineFormatted.rs}</td>
            <td style="text-align: center; font-family: monospace; font-weight: bold; width: 5%;">${lineFormatted.cts}</td>
          </tr>
          ${subRowsHtml}
        `;
      }

      // SINGLE-BATCH OR LEGACY ROW:
      const singleBatch = processedBatches.length === 1 ? processedBatches[0] : null;
      const effectiveBilling = singleBatch ? singleBatch.billingPrice : billingPrice;
      const effectiveSelling = singleBatch?.sellingPrice ?? rawItemSelling;
      const billingFormatted = splitRsCts(effectiveBilling);
      const sellingFormatted = effectiveSelling !== null ? splitRsCts(effectiveSelling) : null;
      const lineFormatted = splitRsCts(lineTotal);

      return `
        <tr>
          <td style="font-family: monospace; font-weight: bold; width: 14%; text-align: center;">${itemCode}</td>
          <td style="font-weight: 600; text-align: left; width: 32%;">${name}</td>
          <td style="text-align: center; font-weight: bold; font-family: monospace; width: 8%;">${qty}</td>
          ${
            sellingFormatted
              ? `<td style="text-align: right; font-family: monospace; color: #475569; width: 10%;">${sellingFormatted.rs}</td>
                 <td style="text-align: center; font-family: monospace; color: #475569; width: 5%;">${sellingFormatted.cts}</td>`
              : `<td colspan="2" style="text-align: center; font-family: monospace; color: #94a3b8; width: 15%;">N/A</td>`
          }
          <td style="text-align: right; font-family: monospace; font-weight: bold; width: 10%;">${billingFormatted.rs}</td>
          <td style="text-align: center; font-family: monospace; font-weight: bold; width: 5%;">${billingFormatted.cts}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold; width: 11%;">${lineFormatted.rs}</td>
          <td style="text-align: center; font-family: monospace; font-weight: bold; width: 5%;">${lineFormatted.cts}</td>
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
      <thead>
        <tr>
          <th rowspan="2" style="width: 14%;">Item Code</th>
          <th rowspan="2" style="width: 32%; text-align: left;">Product Description</th>
          <th rowspan="2" style="width: 8%;">Qty.</th>
          <th colspan="2" style="width: 15%;">Selling Price<br><span style="font-size: 8px; font-weight: normal; text-transform: none;">(Ref. Only)</span></th>
          <th colspan="2" style="width: 15%;">Billing Price</th>
          <th colspan="2" style="width: 16%;">Amount</th>
        </tr>
        <tr>
          <th style="border-top: 1px solid #000; width: 10%;">Rs.</th>
          <th style="border-top: 1px solid #000; border-left: 1px solid #000; width: 5%;">Cts.</th>
          <th style="border-top: 1px solid #000; border-left: 1px solid #000; width: 10%;">Rs.</th>
          <th style="border-top: 1px solid #000; border-left: 1px solid #000; width: 5%;">Cts.</th>
          <th style="border-top: 1px solid #000; border-left: 1px solid #000; width: 11%;">Rs.</th>
          <th style="border-top: 1px solid #000; border-left: 1px solid #000; width: 5%;">Cts.</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml}
      </tbody>
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
