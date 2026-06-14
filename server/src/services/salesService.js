const Sale = require("../models/Sale");
const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");
const Return = require("../models/Return");

const createSaleFromPayload = async ({
  items = [],
  returns = [],
  discount = 0,
  paidAmount = 0,
  paymentMethod = "cash",
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
        updateOne: {
          filter: { _id: batch._id },
          update: { $inc: { remainingQty: -takeQty } }
        }
      });
    }

    if (remaining > 0) {
      throw new Error("Insufficient stock for item");
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

  if (batchUpdates.length > 0 && !skipBatchUpdate) {
    await StockBatch.bulkWrite(batchUpdates);
  }

  if (!skipProductStockUpdate) {
    for (const [productId, qty] of productStockUpdates.entries()) {
      await Product.findByIdAndUpdate(productId, { $inc: { totalStock: -qty } });
    }
  }

  const orderTotal = normalizedItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  const returnTotal = returns.reduce(
    (sum, item) => sum + (item.returnTotal || item.quantity * item.returnPrice || 0),
    0
  );

  if (returnTotal > orderTotal) {
    throw new Error("Return total cannot exceed order total");
  }

  const netTotal = Math.max(orderTotal - returnTotal - discount, 0);
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
    discount,
    netTotal,
    paidAmount,
    dueAmount,
    balance,
    paymentMethod,
    paymentStatus,
    saleType
  });

  if (returns.length > 0) {
    await Return.create({
      saleId: sale._id,
      invoiceNo: sale.invoiceNo,
      customer,
      cashier: cashierId,
      items: returns,
      returnTotal
    });

    const resellableReturns = returns.filter(
      (item) => item.condition === "resellable" && item.productId
    );

    await Promise.all(
      resellableReturns.map(async (item) => {
        const product = await Product.findById(item.productId);
        if (!product) {
          return;
        }

        product.totalStock += item.quantity;
        await product.save();

        await StockBatch.create({
          productId: product._id,
          batchNo: `R-${Date.now()}-${item.itemCode}`,
          billingPrice: item.returnPrice,
          sellingPrice: product.currentSellingPrice,
          quantity: item.quantity,
          remainingQty: item.quantity,
          receivedDate: new Date(),
          createdBy: cashierId
        });
      })
    );
  }

  return sale;
};

module.exports = { createSaleFromPayload };