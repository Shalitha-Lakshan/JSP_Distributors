const Sale = require("../models/Sale");
const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");
const Return = require("../models/Return");

const createSaleFromPayload = async ({
  items = [],
  returns = [],
  discount = 0,
  discountPercent,
  paidAmount = 0,
  paymentMethod = "cash",
  chequeBank,
  chequeNo,
  chequeDate,
  customer,
  saleType = "walk-in",
  cashierId,
  orderId,
  skipProductStockUpdate = false,
  skipBatchUpdate = false,
  tripId
}) => {
  if (!items.length) {
    throw new Error("No items provided");
  }

  const normalizedItems = [];
  const batchUpdates = [];
  const productStockUpdates = new Map();

  for (const item of items) {
    if (!item.productId || !item.quantity) {
      throw new Error("Product and quantity are required");
    }

    const product = await Product.findById(item.productId);
    if (!product) {
      throw new Error("Product not found");
    }

    if (product.status !== "active") {
      throw new Error("Product is inactive");
    }

    const qtyNeeded = Number(item.quantity);
    if (qtyNeeded <= 0) {
      throw new Error("Quantity must be greater than 0");
    }

    const providedBatches = Array.isArray(item.usedBatches) && item.usedBatches.length > 0;

    if (providedBatches) {
      const usedBatches = item.usedBatches.map((batch) => ({
        batchId: batch.batchId,
        batchNo: batch.batchNo,
        qty: Number(batch.qty || 0),
        billingPrice: Number(batch.billingPrice || 0),
        sellingPrice: Number(batch.sellingPrice || batch.billingPrice || 0),
        lineTotal: Number(batch.lineTotal || 0),
        sellingLineTotal: Number(batch.sellingLineTotal || batch.lineTotal || 0)
      }));

      const allocatedQty = usedBatches.reduce((sum, batch) => sum + batch.qty, 0);
      if (allocatedQty < qtyNeeded) {
        throw new Error("Reserved stock does not cover requested quantity");
      }

      const billingTotal = usedBatches.reduce((sum, batch) => sum + batch.qty * batch.billingPrice, 0);

      normalizedItems.push({
        product: product._id,
        itemCode: item.itemCode || product.itemCode,
        itemName: item.itemName || product.displayName,
        quantity: qtyNeeded,
        sellingPrice: billingTotal / qtyNeeded,
        billingPrice: billingTotal / qtyNeeded,
        lineTotal: billingTotal,
        usedBatches
      });
      continue;
    }

    const batches = await StockBatch.find({
      productId: item.productId,
      remainingQty: { $gt: 0 }
    }).sort({ receivedDate: 1 });

    const totalBatchAvailable = batches.reduce((sum, b) => sum + Number(b.remainingQty || 0), 0);
    if (totalBatchAvailable < qtyNeeded) {
      const err = new Error(
        `Insufficient stock for ${product.itemCode} (${product.displayName || product.productName}). Available: ${totalBatchAvailable}, requested: ${qtyNeeded}`
      );
      err.status = 409;
      err.statusCode = 409;
      err.itemCode = product.itemCode;
      err.availableQuantity = totalBatchAvailable;
      err.requestedQuantity = qtyNeeded;
      throw err;
    }

    let remaining = qtyNeeded;
    const usedBatches = [];
    let billingTotal = 0;

    for (const batch of batches) {
      if (remaining <= 0) {
        break;
      }

      const takeQty = Math.min(batch.remainingQty, remaining);
      remaining -= takeQty;
      const batchBilling = Number(batch.billingPrice || 0);
      const batchSelling = Number(batch.sellingPrice || product.currentSellingPrice || 0);

      billingTotal += takeQty * batchBilling;

      usedBatches.push({
        batchId: batch._id,
        batchNo: batch.batchNo,
        qty: takeQty,
        billingPrice: batchBilling,
        sellingPrice: batchSelling,
        lineTotal: takeQty * batchBilling,
        sellingLineTotal: takeQty * batchSelling
      });

      batchUpdates.push({
        batchId: batch._id,
        takeQty
      });
    }

    if (remaining > 0) {
      const err = new Error(
        `Insufficient stock for ${product.itemCode} (${product.displayName || product.productName}). Available: ${qtyNeeded - remaining}, requested: ${qtyNeeded}`
      );
      err.status = 409;
      err.statusCode = 409;
      err.itemCode = product.itemCode;
      err.availableQuantity = qtyNeeded - remaining;
      err.requestedQuantity = qtyNeeded;
      throw err;
    }

    normalizedItems.push({
      product: product._id,
      itemCode: item.itemCode || product.itemCode,
      itemName: item.itemName || product.displayName,
      quantity: qtyNeeded,
      sellingPrice: billingTotal / qtyNeeded,
      billingPrice: billingTotal / qtyNeeded,
      lineTotal: billingTotal,
      usedBatches
    });

    productStockUpdates.set(
      product._id.toString(),
      (productStockUpdates.get(product._id.toString()) || 0) + qtyNeeded
    );
  }

  // Atomic conditional stock deductions with rollback protection against race conditions
  const appliedBatchDeductions = [];
  const appliedProductDeductions = [];

  try {
    if (batchUpdates.length > 0 && !skipBatchUpdate) {
      for (const update of batchUpdates) {
        const updatedBatch = await StockBatch.findOneAndUpdate(
          { _id: update.batchId, remainingQty: { $gte: update.takeQty } },
          { $inc: { remainingQty: -update.takeQty } },
          { new: true }
        );

        if (!updatedBatch) {
          const err = new Error(
            "Stock conflict: Available units were claimed by another transaction during processing. Please refresh and retry."
          );
          err.status = 409;
          err.statusCode = 409;
          throw err;
        }

        appliedBatchDeductions.push(update);
      }
    }

    if (!skipProductStockUpdate) {
      for (const [productId, qty] of productStockUpdates.entries()) {
        const updatedProd = await Product.findOneAndUpdate(
          { _id: productId, totalStock: { $gte: qty } },
          { $inc: { totalStock: -qty } },
          { new: true }
        );

        if (!updatedProd) {
          const err = new Error(
            "Product stock conflict: Insufficient total stock remaining. Please refresh catalogue."
          );
          err.status = 409;
          err.statusCode = 409;
          throw err;
        }

        appliedProductDeductions.push({ productId, qty });
      }
    }
  } catch (err) {
    // Rollback any batches successfully deducted before collision
    for (const ded of appliedBatchDeductions) {
      await StockBatch.findByIdAndUpdate(ded.batchId, { $inc: { remainingQty: ded.takeQty } });
    }
    for (const ded of appliedProductDeductions) {
      await Product.findByIdAndUpdate(ded.productId, { $inc: { totalStock: ded.qty } });
    }
    throw err;
  }

  const orderTotal = normalizedItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  const returnTotal = returns.reduce(
    (sum, item) => sum + (item.returnTotal || item.quantity * item.returnPrice || 0),
    0
  );

  if (returnTotal > orderTotal) {
    throw new Error("Return total cannot exceed order total");
  }

  const baseTotal = Math.max(orderTotal - returnTotal, 0);

  // Authoritative percentage and monetary discount calculation
  let finalDiscount = 0;
  let finalDiscountPercent = 0;

  if (discountPercent !== undefined && discountPercent !== null && discountPercent !== "") {
    finalDiscountPercent = Math.min(100, Math.max(0, Number(discountPercent || 0)));
    finalDiscount = Math.round((baseTotal * (finalDiscountPercent / 100)) * 100) / 100;
  } else if (discount !== undefined && discount !== null) {
    finalDiscount = Math.min(baseTotal, Math.max(0, Number(discount || 0)));
    finalDiscountPercent = baseTotal > 0 ? Math.round((finalDiscount / baseTotal) * 10000) / 100 : 0;
  }

  const netTotal = Math.max(baseTotal - finalDiscount, 0);
  const dueAmount = Math.max(netTotal - paidAmount, 0);
  const balance = Math.max(paidAmount - netTotal, 0);

  let paymentStatus = "paid";
  if (dueAmount > 0) {
    paymentStatus = paidAmount > 0 ? "partial" : "credit";
  }

  const sale = await Sale.create({
    invoiceNo: `INV-${Date.now()}`,
    orderId,
    customer,
    cashier: cashierId,
    tripId,
    items: normalizedItems,
    returns,
    orderTotal,
    returnTotal,
    subtotal: orderTotal,
    discount: finalDiscount,
    discountPercent: finalDiscountPercent,
    netTotal,
    paidAmount,
    dueAmount,
    balance,
    paymentMethod,
    chequeBank: paymentMethod === "cheque" ? chequeBank : undefined,
    chequeNo: paymentMethod === "cheque" ? chequeNo : undefined,
    chequeDate: paymentMethod === "cheque" && chequeDate ? new Date(chequeDate) : undefined,
    paymentStatus,
    saleType
  });

  if (returns.length > 0) {
    const returnItems = returns.map((item) => ({
      productId: item.productId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      quantity: item.quantity,
      returnPrice: item.returnPrice,
      returnTotal: item.returnTotal || (item.quantity * item.returnPrice),
      condition: item.condition || "resellable",
      reason: item.reason || "POS return",
      originalInvoiceNo: item.originalInvoiceNo || sale.invoiceNo,
      status: "pending",
      inspectionStatus: "pending_inspection",
      approvedResellableQty: 0,
      rejectedQty: 0
    }));

    await Return.create({
      saleId: sale._id,
      invoiceNo: sale.invoiceNo,
      customer,
      cashier: cashierId,
      tripId: sale.tripId,
      items: returnItems,
      returnTotal,
      status: "pending",
      inspectionStatus: "pending_inspection"
    });
  }

  await sale.populate([
    { path: "customer", select: "name phone address customerType" },
    { path: "cashier", select: "name" },
    { path: "tripId", select: "route" }
  ]);

  return sale;
};

module.exports = { createSaleFromPayload };