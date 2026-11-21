import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Paths } from "expo-file-system";
import { Order, Sale } from "../types";
import { JSP_LOGO_BASE64 } from "../assets/logoBase64";

export interface InvoicePdfOptions {
  isOrder?: boolean;
  routeName?: string;
  repName?: string;
  batches?: any[];
  batchMap?: Map<string, number> | Record<string, number>;
}

export const COMPANY_DETAILS = {
  name: "JSP DISTRIBUTORS",
  subTitle: "REDISTRIBUTOR SALES INVOICE",
  address: "130/B, Padavi - Parackramapura",
  tel: "0767761382",
  email: "dilshanrajitha201@gmail.com"
};

const escapeHtml = (unsafe?: string): string => {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export const splitRsCts = (val?: number) => {
  const num = Number(val || 0);
  const rounded = Math.round(num * 100) / 100;
  const rs = Math.floor(rounded);
  const cts = Math.round((rounded - rs) * 100);
  return {
    rs: rs.toLocaleString("en-LK"),
    cts: cts.toString().padStart(2, "0")
  };
};

const formatDate = (iso?: string) => {
  if (!iso) {
    const now = new Date();
    return now.toLocaleDateString("en-GB") + " " + now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB") + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/**
 * Generates print-ready A4 HTML for a confirmed Sale invoice or Booked Order confirmation.
 */
export const generateInvoiceHtml = (
  doc: Sale | Order,
  options?: InvoicePdfOptions
): string => {
  const isOrder = options?.isOrder ?? (!("invoiceNo" in doc) && "orderNo" in doc);
  const docNo = "invoiceNo" in doc ? doc.invoiceNo : (doc as Order).orderNo || "";
  const documentTitle = isOrder ? "ORDER CONFIRMATION" : "REDISTRIBUTOR SALES INVOICE";

  // Customer information
  const customerObj = typeof doc.customer === "object" && doc.customer !== null ? doc.customer : null;
  const customerName = customerObj?.name ? escapeHtml(customerObj.name) : "Walk-in Customer";
  const customerAddress = customerObj?.address ? escapeHtml(customerObj.address) : "-";
  const customerPhone = customerObj?.phone ? escapeHtml(customerObj.phone) : "-";

  // Route / Area
  const tripRoute =
    typeof (doc as any).tripId === "object" && (doc as any).tripId?.route
      ? (doc as any).tripId.route
      : options?.routeName || "-";

  // Cashier / Rep
  const cashierObj = typeof doc.cashier === "object" && doc.cashier !== null ? doc.cashier : null;
  const repName = cashierObj?.name ? escapeHtml(cashierObj.name) : options?.repName || "Field Sales Rep";

  // Batch price lookup map from options (if provided)
  const batchLookup = new Map<string, { sellingPrice?: number; billingPrice?: number }>();
  if (options?.batchMap) {
    if (options.batchMap instanceof Map) {
      options.batchMap.forEach((v, k) => batchLookup.set(k, { sellingPrice: v }));
    } else {
      Object.entries(options.batchMap).forEach(([k, v]) => batchLookup.set(k, { sellingPrice: Number(v) }));
    }
  }
  if (Array.isArray(options?.batches)) {
    options.batches.forEach((b: any) => {
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
    .map((item: any) => {
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
      const processedBatches = usedBatches.map((b: any, bIdx: number) => {
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
        let bSelling: number | null = null;
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
          bSelling = batchLookup.get(String(b.batchId))!.sellingPrice!;
        } else if (b.batchNo && batchLookup.has(String(b.batchNo)) && batchLookup.get(String(b.batchNo))?.sellingPrice) {
          bSelling = batchLookup.get(String(b.batchNo))!.sellingPrice!;
        } else if (Array.isArray(item.batches)) {
          const matched = item.batches.find(
            (ib: any) =>
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
      // When multiple FIFO batches exist, render:
      // 1. Master product row showing total quantity & aggregate line total,
      //    with Unit Prices marked '-' to prevent misleading average unit rates.
      // 2. Clear, itemized sub-rows per FIFO allocation with exact batch numbers,
      //    positive allocated quantities, batch selling price reference, batch billing price, and batch amount.
      if (processedBatches.length > 1) {
        const lineFormatted = splitRsCts(lineTotal);

        const subRowsHtml = processedBatches
          .map((b: any) => {
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

  // Financial summary (Authoritative backend values)
  const orderTotal = Number(doc.orderTotal || (doc as any).subtotal || 0);
  const discountVal = Number(doc.discount || 0);
  const grossAfterDiscount = Math.max(0, orderTotal - discountVal);
  const returnTotalVal = Number(doc.returnTotal || 0);
  const baseForDiscount = Math.max(0, orderTotal - returnTotalVal);
  const discountPercentVal =
    typeof (doc as any).discountPercent === "number" && (doc as any).discountPercent > 0
      ? (doc as any).discountPercent
      : baseForDiscount > 0 && discountVal > 0
      ? Math.round((discountVal / baseForDiscount) * 100 * 10) / 10
      : 0;
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
    @page {
      size: A4 portrait;
      margin: 10mm 10mm 12mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background-color: #ffffff;
      font-size: 11px;
      line-height: 1.35;
    }
    .invoice-card {
      width: 100%;
      border: 1.5px solid #000;
      padding: 10px;
      background-color: #ffffff;
    }
    .header-sec {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
      border-bottom: 1.5px solid #000;
      padding-bottom: 8px;
    }
    .brand-block {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-logo {
      height: 48px;
      max-width: 120px;
      object-fit: contain;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 900;
      color: #0f766e;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .brand-company {
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.3px;
    }
    .order-badge {
      display: inline-block;
      margin-top: 3px;
      background-color: #fef3c7;
      color: #92400e;
      border: 1px solid #d97706;
      font-size: 9px;
      font-weight: 800;
      padding: 1px 6px;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .meta-box {
      border: 1.5px solid #000;
      width: 260px;
      font-size: 11px;
    }
    .meta-header {
      border-bottom: 1.5px solid #000;
      padding: 4px 6px;
      font-weight: 800;
      font-size: 11px;
      background-color: #f1f5f9;
      display: flex;
      justify-content: space-between;
    }
    .meta-row {
      display: flex;
      border-bottom: 1px solid #000;
    }
    .meta-row:last-child {
      border-bottom: none;
    }
    .meta-label {
      width: 38%;
      padding: 3px 6px;
      font-weight: 700;
      border-right: 1px solid #000;
      background-color: #f8fafc;
      color: #475569;
    }
    .meta-value {
      width: 62%;
      padding: 3px 6px;
      font-weight: 700;
    }
    .customer-box {
      border: 1.5px solid #000;
      padding: 6px 8px;
      margin-bottom: 10px;
      font-size: 11px;
    }
    .customer-title {
      font-weight: 800;
      text-transform: uppercase;
      color: #0f766e;
      margin-bottom: 4px;
      font-size: 10px;
      letter-spacing: 0.3px;
    }
    .customer-line {
      display: flex;
      margin-bottom: 2px;
      font-weight: 600;
    }
    .customer-label {
      width: 70px;
      color: #475569;
      font-weight: 700;
    }
    .customer-val {
      color: #0f172a;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
      margin-bottom: 0;
    }
    table.items-table th, table.items-table td {
      border: 1px solid #000;
      padding: 4px 6px;
      font-size: 10.5px;
      vertical-align: middle;
    }
    table.items-table th {
      background-color: #f1f5f9;
      font-weight: 800;
      text-transform: uppercase;
      text-align: center;
      color: #0f172a;
    }
    tr {
      page-break-inside: avoid;
    }
    .bottom-section {
      display: flex;
      border: 1.5px solid #000;
      border-top: none;
      width: 100%;
      font-size: 10.5px;
      page-break-inside: avoid;
    }
    .payment-side {
      width: 50%;
      border-right: 1.5px solid #000;
      padding: 8px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .section-title {
      font-weight: 800;
      text-transform: uppercase;
      color: #0f766e;
      margin-bottom: 6px;
      border-bottom: 1px solid #000;
      padding-bottom: 2px;
      font-size: 10.5px;
    }
    .mode-row {
      display: flex;
      gap: 16px;
      margin-bottom: 10px;
      font-weight: 700;
    }
    .mode-item {
      display: flex;
      align-items: center;
    }
    .chk {
      border: 1px solid #000;
      display: inline-block;
      width: 13px;
      height: 13px;
      line-height: 11px;
      text-align: center;
      font-size: 9px;
      margin-right: 5px;
      font-family: monospace;
      font-weight: 900;
    }
    .cheque-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .cheque-row {
      display: flex;
      align-items: center;
    }
    .cheque-label {
      width: 75px;
      font-weight: 700;
      color: #475569;
    }
    .cheque-line {
      border-bottom: 1px dotted #000;
      flex-grow: 1;
      padding-bottom: 1px;
      font-weight: 700;
    }
    .totals-side {
      width: 50%;
    }
    table.totals-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    table.totals-table td {
      border-bottom: 1px solid #000;
      padding: 4px 6px;
    }
    .total-title-col {
      width: 56%;
      font-weight: 700;
      color: #475569;
      border-right: 1px solid #000;
      background-color: #f8fafc;
    }
    .total-rs-col {
      width: 30%;
      text-align: right;
      font-family: monospace;
      font-weight: 700;
      border-right: 1px solid #000;
    }
    .total-cts-col {
      width: 14%;
      text-align: center;
      font-family: monospace;
      font-weight: 700;
    }
    .grand-total-row {
      background-color: #f1f5f9;
    }
    .grand-total-row td {
      font-weight: 900 !important;
      color: #0f766e !important;
      font-size: 11.5px !important;
    }
    .due-balance-row {
      background-color: #fef2f2;
    }
    .due-balance-row td {
      font-weight: 900 !important;
      color: #b91c1c !important;
      font-size: 11px !important;
    }
    .signatures-sec {
      display: flex;
      justify-content: space-between;
      margin-top: 45px;
      padding: 0 15px;
      font-size: 10.5px;
      page-break-inside: avoid;
    }
    .sign-col {
      text-align: center;
      width: 220px;
    }
    .sign-line {
      border-top: 1px dotted #000;
      margin-bottom: 4px;
    }
    .sign-label {
      font-weight: 700;
      color: #0f172a;
    }
    .footer-sec {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #000;
      font-size: 9px;
      color: #475569;
      line-height: 1.4;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <!-- Header Section -->
    <div class="header-sec">
      <div class="brand-block">
        <img src="${JSP_LOGO_BASE64}" alt="JSP Logo" class="brand-logo" />
        <div>
          <div class="brand-title">${escapeHtml(documentTitle)}</div>
          <div class="brand-company">${escapeHtml(COMPANY_DETAILS.name)}</div>
          ${
            isOrder
              ? `<div class="order-badge">STOCK RESERVED ON SERVER • PENDING FIELD DELIVERY</div>`
              : ""
          }
        </div>
      </div>

      <!-- Meta Box -->
      <div class="meta-box">
        <div class="meta-header">
          <span>${isOrder ? "Order No :-" : "Invoice No :-"}</span>
          <span style="font-family: monospace; color: #b91c1c;">${escapeHtml(docNo)}</span>
        </div>
        <div class="meta-row">
          <div class="meta-label">Date</div>
          <div class="meta-value">${formatDate(doc.createdAt)}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">Area</div>
          <div class="meta-value">${escapeHtml(tripRoute)}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">Distributor</div>
          <div class="meta-value">${escapeHtml(COMPANY_DETAILS.name)}</div>
        </div>
      </div>
    </div>

    <!-- Customer Information Box -->
    <div class="customer-box">
      <div class="customer-title">Name & Address of the Customer :-</div>
      <div class="customer-line">
        <span class="customer-label">Name:</span>
        <span class="customer-val">${customerName}</span>
      </div>
      <div class="customer-line">
        <span class="customer-label">Address:</span>
        <span class="customer-val">${customerAddress}</span>
      </div>
      <div class="customer-line">
        <span class="customer-label">Phone:</span>
        <span class="customer-val">${customerPhone}</span>
      </div>
    </div>

    <!-- Items Table -->
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
        ${
          itemsRowsHtml ||
          `<tr>
            <td colspan="9" style="text-align: center; color: #475569; padding: 12px;">No items fulfilled</td>
          </tr>`
        }
      </tbody>
    </table>

    <!-- Bottom Section: Mode of Payment (Left) & Totals (Right) -->
    <div class="bottom-section">
      <!-- Mode of Payment -->
      <div class="payment-side">
        <div>
          <div class="section-title">Mode of Payment</div>
          <div class="mode-row">
            <div class="mode-item">
              <span class="chk">${paymentMethod === "cash" ? "✓" : "&nbsp;"}</span>
              Cash
            </div>
            <div class="mode-item">
              <span class="chk">${paymentMethod === "credit" ? "✓" : "&nbsp;"}</span>
              Credit
            </div>
            <div class="mode-item">
              <span class="chk">${paymentMethod === "cheque" ? "✓" : "&nbsp;"}</span>
              Cheque
            </div>
          </div>

          <div class="cheque-details">
            <div class="cheque-row">
              <span class="cheque-label">Bank:</span>
              <span class="cheque-line">${paymentMethod === "cheque" ? chequeBank : ""}</span>
            </div>
            <div class="cheque-row">
              <span class="cheque-label">Cheque No:</span>
              <span class="cheque-line" style="font-family: monospace;">${paymentMethod === "cheque" ? chequeNo : ""}</span>
            </div>
            <div class="cheque-row">
              <span class="cheque-label">Date:</span>
              <span class="cheque-line">${paymentMethod === "cheque" ? chequeDate : ""}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Totals Table -->
      <div class="totals-side">
        <table class="totals-table">
          <tbody>
            <tr>
              <td class="total-title-col">Total</td>
              <td class="total-rs-col">${orderTotalRsCts.rs}</td>
              <td class="total-cts-col">${orderTotalRsCts.cts}</td>
            </tr>
            <tr>
              <td class="total-title-col">Less Discount${discountPercentVal > 0 ? ` (${discountPercentVal}%)` : ""}</td>
              <td class="total-rs-col" style="color: #b91c1c;">${discountRsCts.rs}</td>
              <td class="total-cts-col" style="color: #b91c1c;">${discountRsCts.cts}</td>
            </tr>
            <tr>
              <td class="total-title-col">Gross Total</td>
              <td class="total-rs-col">${grossAfterDiscountRsCts.rs}</td>
              <td class="total-cts-col">${grossAfterDiscountRsCts.cts}</td>
            </tr>
            <tr>
              <td class="total-title-col">Market Returns</td>
              <td class="total-rs-col" style="color: #b91c1c;">${returnTotalRsCts.rs}</td>
              <td class="total-cts-col" style="color: #b91c1c;">${returnTotalRsCts.cts}</td>
            </tr>
            <tr class="grand-total-row">
              <td class="total-title-col" style="text-transform: uppercase;">Grand Total</td>
              <td class="total-rs-col">${netTotalRsCts.rs}</td>
              <td class="total-cts-col">${netTotalRsCts.cts}</td>
            </tr>
            <tr>
              <td class="total-title-col">Paid Amount</td>
              <td class="total-rs-col" style="color: #059669;">${paidAmountRsCts.rs}</td>
              <td class="total-cts-col" style="color: #059669;">${paidAmountRsCts.cts}</td>
            </tr>
            <tr class="due-balance-row">
              <td class="total-title-col" style="text-transform: uppercase;">Due Balance</td>
              <td class="total-rs-col">${dueAmountRsCts.rs}</td>
              <td class="total-cts-col">${dueAmountRsCts.cts}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Signatures -->
    <div class="signatures-sec">
      <div class="sign-col">
        <div class="sign-line"></div>
        <div class="sign-label">Name & Signature of Customer</div>
      </div>
      <div class="sign-col">
        <div class="sign-line"></div>
        <div class="sign-label">Name & Signature of Rep (${repName})</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer-sec">
      <strong style="color: #0f172a; text-transform: uppercase;">${escapeHtml(COMPANY_DETAILS.name)}</strong><br />
      ${escapeHtml(COMPANY_DETAILS.address)}<br />
      Tel: ${escapeHtml(COMPANY_DETAILS.tel)} | Email: ${escapeHtml(COMPANY_DETAILS.email)}
    </div>
  </div>
</body>
</html>`;
};

/**
 * Generate a PDF file on disk and return its URI.
 */
const resolveSafeDirectory = (): string | null => {
  try {
    if (FileSystem.documentDirectory) return FileSystem.documentDirectory;
    if (FileSystem.cacheDirectory) return FileSystem.cacheDirectory;
    if (Paths?.document?.uri) return Paths.document.uri;
    if (Paths?.cache?.uri) return Paths.cache.uri;
  } catch (err) {
    console.warn("[Safe Directory Resolution Warning]", err);
  }
  return null;
};

/**
 * Generate a local PDF file from the invoice/order document using expo-print.
 * Explicitly requests base64 and writes to the application's document/cache directory
 * to guarantee native Android FileProvider permissions for expo-sharing.
 */
export const generateInvoicePdf = async (
  doc: Sale | Order,
  options?: InvoicePdfOptions
): Promise<{ uri: string; numberOfPages: number }> => {
  const html = generateInvoiceHtml(doc, options);
  const result = await Print.printToFileAsync({
    html,
    width: 595,
    height: 842,
    base64: true
  });

  const isOrder = options?.isOrder ?? (!("invoiceNo" in doc) && "orderNo" in doc);
  const docNo = "invoiceNo" in doc ? doc.invoiceNo : (doc as Order).orderNo || "Document";
  const cleanDocNo = docNo.replace(/[^a-zA-Z0-9_-]/g, "_");
  const brandedFilename = `JSP_${isOrder ? "Order" : "Invoice"}_${cleanDocNo}.pdf`;
  let finalUri = result.uri;

  const safeDir = resolveSafeDirectory();
  if (safeDir && result.base64) {
    const targetUri = `${safeDir.replace(/\/*$/, "")}/${brandedFilename}`;
    try {
      // Remove any previously generated file with this exact filename for a clean write
      try {
        const info = await FileSystem.getInfoAsync(targetUri);
        if (info.exists) {
          await FileSystem.deleteAsync(targetUri, { idempotent: true });
        }
      } catch {
        // Non-fatal if pre-deletion fails
      }

      await FileSystem.writeAsStringAsync(targetUri, result.base64, {
        encoding: FileSystem.EncodingType.Base64
      });
      finalUri = targetUri;
    } catch (writeErr) {
      console.warn("Failed writing base64 PDF to safe local directory, falling back:", writeErr);
      try {
        await FileSystem.copyAsync({
          from: result.uri,
          to: targetUri
        });
        finalUri = targetUri;
      } catch (copyErr) {
        console.warn("Could not copy PDF to safe local directory:", copyErr);
      }
    }
  }

  // Verify file existence and positive byte size
  try {
    const fileInfo = await FileSystem.getInfoAsync(finalUri);
    if (!fileInfo.exists) {
      throw new Error(`Generated PDF file does not exist at local path: ${finalUri}`);
    }
    if (fileInfo.size === 0) {
      throw new Error(`Generated PDF file at ${finalUri} is empty (0 bytes).`);
    }
  } catch (verifyErr: any) {
    console.error("[PDF Local File Verification Error]", verifyErr);
    throw verifyErr;
  }

  return {
    uri: finalUri,
    numberOfPages: result.numberOfPages || 1
  };
};

/**
 * Open the native platform printing dialog using expo-print.
 */
export const printInvoice = async (
  doc: Sale | Order,
  options?: InvoicePdfOptions
): Promise<void> => {
  const html = generateInvoiceHtml(doc, options);
  await Print.printAsync({
    html,
    width: 595,
    height: 842
  });
};

/**
 * Open native share sheet for the generated invoice PDF using expo-sharing.
 */
export const shareInvoicePdf = async (
  doc: Sale | Order,
  options?: InvoicePdfOptions
): Promise<void> => {
  let isAvailable = false;
  try {
    isAvailable = await Sharing.isAvailableAsync();
  } catch (checkErr) {
    console.warn("Sharing.isAvailableAsync check warning:", checkErr);
    isAvailable = true;
  }

  if (!isAvailable) {
    throw new Error(
      "Sharing is not available on this device. You can preview the invoice or use Print to save as PDF."
    );
  }

  const { uri } = await generateInvoicePdf(doc, options);
  const isOrder = options?.isOrder ?? (!("invoiceNo" in doc) && "orderNo" in doc);
  const docNo = "invoiceNo" in doc ? doc.invoiceNo : (doc as Order).orderNo || "Invoice";
  const shareableUri = uri.startsWith("file://") ? uri : `file://${uri}`;

  try {
    await Sharing.shareAsync(shareableUri, {
      mimeType: "application/pdf",
      dialogTitle: `Share JSP Distributors ${isOrder ? "Order" : "Invoice"} - ${docNo}`,
      UTI: "com.adobe.pdf"
    });
  } catch (shareErr: any) {
    const errMsg = String(shareErr?.message || "").toLowerCase();
    if (
      errMsg.includes("canceled") ||
      errMsg.includes("cancelled") ||
      errMsg.includes("dismissed") ||
      errMsg.includes("user did not share") ||
      errMsg.includes("abort")
    ) {
      // User cancelled/dismissed share sheet; non-error state
      return;
    }
    console.error("[Native PDF Share Failure]", shareErr);
    throw shareErr;
  }
};

