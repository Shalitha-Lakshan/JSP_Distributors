const Order = require("../models/Order");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");
const Payment = require("../models/Payment");
const TripSession = require("../models/TripSession");
const { createSaleFromPayload } = require("../services/salesService");
const Counter = require("../models/Counter");

const reserveStockForItems = async (items, preservedPricesMap = null) => {
  const orderItems = [];
  const batchUpdates = [];
  const stockUpdates = new Map();

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

    const quantity = Number(item.quantity);
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }

    let unitPrice;
    let sellingPrice;

    if (preservedPricesMap && preservedPricesMap.has(item.productId.toString())) {
      const preserved = preservedPricesMap.get(item.productId.toString());
      unitPrice = preserved.unitPrice;
      sellingPrice =
        preserved.sellingPrice !== undefined
          ? preserved.sellingPrice
          : Number(product.currentSellingPrice || 0);
    } else {
      const rawBillingPrice =
        product.currentBillingPrice !== undefined
          ? product.currentBillingPrice
          : product.customerBillingPrice;

      if (
        rawBillingPrice === undefined ||
        rawBillingPrice === null ||
        isNaN(Number(rawBillingPrice)) ||
        Number(rawBillingPrice) <= 0
      ) {
        const err = new Error(
          `Billing price unavailable or invalid for product ${product.itemCode} (${product.displayName}). Adding to bill is blocked.`
        );
        err.status = 400;
        err.statusCode = 400;
        throw err;
      }

      unitPrice = Number(rawBillingPrice);
      sellingPrice = Number(product.currentSellingPrice || 0);
    }

    const batches = await StockBatch.find({
      productId: item.productId,
      remainingQty: { $gt: 0 }
    }).sort({ receivedDate: 1, createdAt: 1, _id: 1 });

    const totalBatchAvailable = batches.reduce((sum, b) => sum + Number(b.remainingQty || 0), 0);
    if (totalBatchAvailable < quantity) {
      const err = new Error(
        `Insufficient stock for ${product.itemCode} (${product.displayName}). Available: ${totalBatchAvailable}, requested: ${quantity}`
      );
      err.status = 409;
      err.statusCode = 409;
      err.itemCode = product.itemCode;
      err.availableQuantity = totalBatchAvailable;
      err.requestedQuantity = quantity;
      throw err;
    }

    let remaining = quantity;
    const usedBatches = [];

    for (const batch of batches) {
      if (remaining <= 0) {
        break;
      }

      const takeQty = Math.min(batch.remainingQty, remaining);
      remaining -= takeQty;
      const batchCost = Number(batch.billingPrice || 0);
      const batchSelling = Number(batch.sellingPrice || 0);
      const batchTotal = takeQty * batchCost;

      usedBatches.push({
        batchId: batch._id,
        batchNo: batch.batchNo,
        qty: takeQty,
        billingPrice: batchCost,
        sellingPrice: batchSelling,
        lineTotal: batchTotal
      });

      batchUpdates.push({
        batchId: batch._id,
        takeQty
      });
    }

    if (remaining > 0) {
      const err = new Error(
        `Insufficient stock for ${product.itemCode} (${product.displayName}). Available: ${quantity - remaining}, requested: ${quantity}`
      );
      err.status = 409;
      err.statusCode = 409;
      err.itemCode = product.itemCode;
      err.availableQuantity = quantity - remaining;
      err.requestedQuantity = quantity;
      throw err;
    }

    const batchLineTotalSum = usedBatches.reduce((sum, b) => sum + Number(b.lineTotal || 0), 0);
    const lineTotal = usedBatches.length > 0 && batchLineTotalSum > 0
      ? Math.round(batchLineTotalSum * 100) / 100
      : Math.round(quantity * unitPrice * 100) / 100;

    const effectiveUnitPrice = Math.round((lineTotal / quantity) * 100) / 100;

    orderItems.push({
      productId: product._id,
      itemCode: product.itemCode,
      itemName: product.displayName,
      quantity,
      unitPrice: effectiveUnitPrice,
      billingPrice: effectiveUnitPrice,
      sellingPrice,
      lineTotal,
      usedBatches
    });

    stockUpdates.set(
      product._id.toString(),
      (stockUpdates.get(product._id.toString()) || 0) + quantity
    );
  }

  return { orderItems, batchUpdates, stockUpdates };
};

const restoreReservedStock = async (orderItems) => {
  const restoreBatches = [];
  const stockUpdates = new Map();

  orderItems.forEach((item) => {
    stockUpdates.set(
      item.productId.toString(),
      (stockUpdates.get(item.productId.toString()) || 0) + item.quantity
    );

    (item.usedBatches || []).forEach((batch) => {
      restoreBatches.push({
        updateOne: {
          filter: { _id: batch.batchId },
          update: { $inc: { remainingQty: batch.qty } }
        }
      });
    });
  });

  if (restoreBatches.length > 0) {
    await StockBatch.bulkWrite(restoreBatches);
  }

  if (stockUpdates.size > 0) {
    await Product.bulkWrite(
      [...stockUpdates.entries()].map(([productId, qty]) => ({
        updateOne: {
          filter: { _id: productId },
          update: { $inc: { totalStock: qty } }
        }
      }))
    );
  }
};

const createOrder = async (req, res) => {
  const {
    customer,
    items = [],
    returns = [],
    discountPercent = 0,
    discount,
    idempotencyKey
  } = req.body;

  if (!items.length) {
    return res.status(400).json({ message: "No items provided" });
  }

  // 1. Durable Idempotency Check: prevent duplicate order bookings and duplicate stock reservations
  if (idempotencyKey && typeof idempotencyKey === "string" && idempotencyKey.trim()) {
    const cleanKey = idempotencyKey.trim();
    const existingOrder = await Order.findOne({ idempotencyKey: cleanKey })
      .populate("customer", "name phone address customerType")
      .populate("cashier", "name");

    if (existingOrder) {
      // Validate that request matches the existing order to prevent key reuse collisions
      const existingCustId =
        existingOrder.customer?._id?.toString() || existingOrder.customer?.toString() || null;
      const reqCustId = customer ? customer.toString() : null;
      const customerMatches = existingCustId === reqCustId;

      const itemsMatch =
        Array.isArray(existingOrder.items) &&
        existingOrder.items.length === items.length &&
        items.every((it) => {
          const match = existingOrder.items.find(
            (ei) => ei.productId.toString() === it.productId.toString()
          );
          return match && match.quantity === Number(it.quantity);
        });

      const reqReturns = returns || [];
      const existingReturns = existingOrder.returns || [];
      const returnsMatch =
        existingReturns.length === reqReturns.length &&
        reqReturns.every((r) => {
          const match = existingReturns.find(
            (er) =>
              (er.productId?.toString() === r.productId?.toString() || er.itemCode === r.itemCode) &&
              (er.condition || "resellable") === (r.condition || "resellable")
          );
          return match && match.quantity === Number(r.quantity);
        });

      if (customerMatches && itemsMatch && returnsMatch) {
        // Safe idempotent replay: return the exact confirmed order without duplicate stock reservation
        return res.status(200).json(existingOrder);
      } else {
        return res.status(409).json({
          message:
            "Idempotency conflict: The provided idempotency key was already used for a different order payload."
        });
      }
    }
  }

  try {
    const activeTrip = await TripSession.findOne({
      rep: req.user?._id,
      status: "active"
    });

    if (req.user?.role === "rep" && !activeTrip) {
      return res.status(400).json({ message: "You must have an active trip session to book orders." });
    }

    if (customer) {
      const existingCustomer = await Customer.findById(customer);
      if (!existingCustomer) {
        return res.status(400).json({ message: "Customer not found" });
      }
    }

    const { orderItems, batchUpdates, stockUpdates } = await reserveStockForItems(items);
    const orderTotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);

    const appliedBatchDeductions = [];
    const appliedProductDeductions = [];

    try {
      if (batchUpdates.length > 0) {
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

      if (stockUpdates.size > 0) {
        for (const [productId, qty] of stockUpdates.entries()) {
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
      for (const ded of appliedBatchDeductions) {
        await StockBatch.findByIdAndUpdate(ded.batchId, { $inc: { remainingQty: ded.takeQty } });
      }
      for (const ded of appliedProductDeductions) {
        await Product.findByIdAndUpdate(ded.productId, { $inc: { totalStock: ded.qty } });
      }
      throw err;
    }

    const counter = await Counter.findOneAndUpdate(
      { id: "orderNo" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const orderSeq = String(counter.seq).padStart(8, "0");
    const orderNo = `ORD-${orderSeq}`;

    // Normalize and strictly validate proposed market returns
    const formattedReturns = [];
    for (const r of (returns || [])) {
      const qty = Number(r.quantity || 0);
      const price = Number(r.returnPrice || 0);

      if (qty <= 0 || isNaN(qty)) {
        return res.status(400).json({ message: `Invalid quantity for return item ${r.itemName || r.itemCode}.` });
      }

      if (price <= 0 || isNaN(price)) {
        return res.status(400).json({ message: `Return unit price for ${r.itemName || r.itemCode} must be greater than zero.` });
      }

      // Valuation Policy: return price must not exceed catalogue selling price
      if (r.productId || r.itemCode) {
        const prod = r.productId 
          ? await Product.findById(r.productId) 
          : await Product.findOne({ itemCode: r.itemCode });
        if (prod && typeof prod.currentSellingPrice === "number" && price > prod.currentSellingPrice) {
          return res.status(400).json({
            message: `Return unit price (Rs. ${price.toFixed(2)}) for "${prod.displayName || prod.productName}" cannot exceed catalogue selling price (Rs. ${prod.currentSellingPrice.toFixed(2)}).`
          });
        }
      }

      const itemReturnTotal = Math.round(qty * price * 100) / 100;

      formattedReturns.push({
        productId: r.productId,
        itemCode: r.itemCode,
        itemName: r.itemName,
        quantity: qty,
        returnPrice: price,
        returnTotal: itemReturnTotal,
        condition: r.condition || "resellable",
        reason: r.reason || "Proposed market return",
        originalInvoiceNo: r.originalInvoiceNo || ""
      });
    }

    const returnTotal = formattedReturns.reduce((sum, r) => sum + r.returnTotal, 0);
    const baseTotal = Math.max(0, orderTotal - returnTotal);

    let finalDiscount = 0;
    let finalDiscountPercent = 0;
    if (discountPercent !== undefined && discountPercent !== null && discountPercent !== "") {
      finalDiscountPercent = Math.min(100, Math.max(0, Number(discountPercent || 0)));
      finalDiscount = Math.round((baseTotal * (finalDiscountPercent / 100)) * 100) / 100;
    } else if (discount !== undefined && discount !== null) {
      finalDiscount = Math.min(baseTotal, Math.max(0, Number(discount || 0)));
      finalDiscountPercent = baseTotal > 0 ? Math.round((finalDiscount / baseTotal) * 10000) / 100 : 0;
    }

    const netTotal = Math.max(0, baseTotal - finalDiscount);

    const order = await Order.create({
      orderNo,
      customer: customer || null,
      cashier: req.user?._id,
      items: orderItems,
      returns: formattedReturns,
      orderTotal,
      returnTotal,
      discount: finalDiscount,
      discountPercent: finalDiscountPercent,
      netTotal,
      paidAmount: 0,
      dueAmount: netTotal,
      orderStatus: "pending_delivery",
      paymentStatus: "not_collected",
      stockReserved: true,
      idempotencyKey:
        idempotencyKey && typeof idempotencyKey === "string" ? idempotencyKey.trim() : undefined
    });

    if (activeTrip) {
      order.tripId = activeTrip._id;
      await order.save();
      activeTrip.ordersBooked.push(order._id);
      await activeTrip.save();
    }

    return res.status(201).json(order);
  } catch (err) {
    if (err.code === 11000 && idempotencyKey) {
      try {
        const cleanKey = idempotencyKey.trim();
        const existing = await Order.findOne({ idempotencyKey: cleanKey })
          .populate("customer", "name phone address customerType")
          .populate("cashier", "name");
        if (existing) {
          return res.status(200).json(existing);
        }
      } catch {
        // Fall through to default error response
      }
    }

    const status = err.status || err.statusCode || 400;
    return res.status(status).json({
      message: err.message || "Failed to create order",
      itemCode: err.itemCode,
      availableQuantity: err.availableQuantity,
      requestedQuantity: err.requestedQuantity
    });
  }
};

const listOrders = async (req, res) => {
  const filter = {};
  if (req.user?.role === "rep" || req.query.mine === "true") {
    filter.cashier = req.user?._id;

    // Scope strictly to active trip session for rep
    const activeTrip = await TripSession.findOne({
      rep: req.user?._id,
      status: "active"
    });
    if (activeTrip) {
      filter.tripId = activeTrip._id;
    } else if (req.user?.role === "rep") {
      filter.tripId = new (require("mongoose")).Types.ObjectId();
    }
  }

  const orders = await Order.find(filter)
    .populate("customer", "name phone address customerType")
    .populate("cashier", "name")
    .populate("tripId", "route")
    .populate({ path: "items.productId", select: "supplier currentSellingPrice currentBillingPrice displayName itemCode" })
    .populate({ path: "items.usedBatches.batchId", select: "sellingPrice billingPrice batchNo" })
    .populate("saleId", "paymentMethod")
    .sort({ createdAt: -1 });
  return res.json(orders);
};

const getOrder = async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("customer", "name phone address customerType")
    .populate("cashier", "name")
    .populate("tripId", "route")
    .populate({ path: "items.productId", select: "supplier currentSellingPrice currentBillingPrice displayName itemCode" })
    .populate({ path: "items.usedBatches.batchId", select: "sellingPrice billingPrice batchNo" })
    .populate("saleId", "paymentMethod");

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  return res.json(order);
};

const updateOrder = async (req, res) => {
  const { items = [], customer, discount, returns } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.orderStatus !== "pending_delivery") {
    return res.status(400).json({ message: "Only pending orders can be edited" });
  }

  if (customer) {
    order.customer = customer;
  }

  const discountVal = discount !== undefined ? Number(discount || 0) : order.discount || 0;
  
  let returnTotalVal = order.returnTotal || 0;
  if (returns !== undefined) {
    order.returns = returns;
    returnTotalVal = returns.reduce(
      (sum, item) => sum + (item.returnTotal || item.quantity * item.returnPrice || 0),
      0
    );
  }

  order.discount = discountVal;
  order.returnTotal = returnTotalVal;

  if (items.length > 0) {
    // 1. Build existing item map to preserve authorized historical prices
    const existingItemMap = new Map();
    order.items.forEach((it) => {
      existingItemMap.set(it.productId.toString(), it);
    });

    const preservedPricesMap = new Map();

    // 2. Validate all products, quantities, prices, and stock BEFORE database mutation
    for (const item of items) {
      if (!item.productId || !item.quantity) {
        return res.status(400).json({ message: "Product and quantity are required" });
      }

      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product ${item.productId} not found` });
      }

      if (product.status !== "active") {
        return res.status(400).json({ message: `Product ${product.itemCode} is inactive` });
      }

      const qty = Number(item.quantity);
      if (qty <= 0) {
        return res.status(400).json({ message: "Quantity must be greater than 0" });
      }

      if (existingItemMap.has(item.productId.toString())) {
        const existing = existingItemMap.get(item.productId.toString());
        const preservedUnitPrice =
          existing.billingPrice !== undefined && existing.billingPrice !== null
            ? Number(existing.billingPrice)
            : Number(existing.unitPrice);
        const preservedSellingPrice =
          existing.sellingPrice !== undefined && existing.sellingPrice !== null
            ? Number(existing.sellingPrice)
            : Number(product.currentSellingPrice || 0);

        preservedPricesMap.set(item.productId.toString(), {
          unitPrice: preservedUnitPrice,
          sellingPrice: preservedSellingPrice
        });
      } else {
        // New product added to order: validate authoritative Customer Billing Price
        const rawBillingPrice =
          product.currentBillingPrice !== undefined
            ? product.currentBillingPrice
            : product.customerBillingPrice;

        if (
          rawBillingPrice === undefined ||
          rawBillingPrice === null ||
          isNaN(Number(rawBillingPrice)) ||
          Number(rawBillingPrice) <= 0
        ) {
          return res.status(400).json({
            message: `Billing price unavailable or invalid for product ${product.itemCode} (${product.displayName}). Cannot add to order.`
          });
        }

        preservedPricesMap.set(item.productId.toString(), {
          unitPrice: Number(rawBillingPrice),
          sellingPrice: Number(product.currentSellingPrice || 0)
        });
      }

      // Check stock availability without mutating
      const currentlyReserved = existingItemMap.has(item.productId.toString())
        ? existingItemMap.get(item.productId.toString()).quantity
        : 0;
      const netAdditionalNeeded = qty - currentlyReserved;

      if (netAdditionalNeeded > 0) {
        const availableBatches = await StockBatch.find({
          productId: item.productId,
          remainingQty: { $gt: 0 }
        });
        const totalBatchAvailable = availableBatches.reduce(
          (sum, b) => sum + Number(b.remainingQty || 0),
          0
        );
        if (totalBatchAvailable < netAdditionalNeeded) {
          return res.status(409).json({
            message: `Insufficient stock for ${product.itemCode} (${product.displayName}). Available: ${totalBatchAvailable}, additional requested: ${netAdditionalNeeded}`,
            itemCode: product.itemCode,
            availableQuantity: totalBatchAvailable,
            requestedQuantity: netAdditionalNeeded
          });
        }
      }
    }

    // 3. Perform reservation transition safely:
    // If any error occurs during reserveStockForItems, restore original reserved stock so allocations are preserved
    const previousItems = order.items;
    try {
      if (order.stockReserved) {
        await restoreReservedStock(previousItems);
      }

      const { orderItems, batchUpdates, stockUpdates } = await reserveStockForItems(
        items,
        preservedPricesMap
      );

      if (batchUpdates.length > 0) {
        for (const update of batchUpdates) {
          await StockBatch.findByIdAndUpdate(update.batchId, {
            $inc: { remainingQty: -update.takeQty }
          });
        }
      }

      if (stockUpdates.size > 0) {
        for (const [productId, qty] of stockUpdates.entries()) {
          await Product.findByIdAndUpdate(productId, {
            $inc: { totalStock: -qty }
          });
        }
      }

      order.items = orderItems;
      order.orderTotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
      order.stockReserved = true;
    } catch (err) {
      if (order.stockReserved) {
        try {
          const { batchUpdates, stockUpdates } = await reserveStockForItems(previousItems, preservedPricesMap);
          for (const update of batchUpdates) {
            await StockBatch.findByIdAndUpdate(update.batchId, { $inc: { remainingQty: -update.takeQty } });
          }
          for (const [productId, qty] of stockUpdates.entries()) {
            await Product.findByIdAndUpdate(productId, { $inc: { totalStock: -qty } });
          }
        } catch {}
      }
      return res.status(err.status || err.statusCode || 400).json({
        message: err.message || "Failed to update order"
      });
    }
  }

  order.netTotal = Math.max(order.orderTotal - order.returnTotal - order.discount, 0);
  order.dueAmount = order.netTotal;

  await order.save();
  return res.json(order);
};

const cancelOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.orderStatus === "cancelled") {
    return res.json(order);
  }

  if (order.stockReserved) {
    await restoreReservedStock(order.items);
    order.stockReserved = false;
  }

  order.orderStatus = "cancelled";
  order.paymentStatus = "not_collected";
  await order.save();
  return res.json(order);
};

const deleteOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.orderStatus !== "cancelled") {
    return res.status(400).json({ message: "Only cancelled orders can be deleted" });
  }

  await Order.deleteOne({ _id: order._id });
  return res.json({ message: "Order deleted" });
};

const deliverOrder = async (req, res) => {
  const {
    items = [],
    returns = [],
    discount,
    discountPercent,
    paidAmount = 0,
    paymentMethod,
    chequeBank,
    chequeNo,
    chequeDate
  } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.orderStatus !== "pending_delivery") {
    return res.status(400).json({ message: "Order is not pending delivery" });
  }

  if (order.stockReserved && items.length > 0) {
    const mismatch = items.some((item) => {
      const reserved = order.items.find(
        (orderItem) => orderItem.productId.toString() === String(item.productId)
      );
      return !reserved || Number(item.quantity) !== Number(reserved.quantity);
    });
    if (mismatch) {
      return res
        .status(400)
        .json({ message: "Delivery quantities must match reserved stock" });
    }
  }

  const orderItemMap = new Map(
    order.items.map((item) => [item.productId.toString(), item])
  );

  const deliveredItems = order.stockReserved
    ? order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        itemCode: item.itemCode,
        itemName: item.itemName,
        billingPrice:
          item.billingPrice !== undefined && item.billingPrice !== null
            ? item.billingPrice
            : item.unitPrice,
        sellingPrice: item.sellingPrice,
        unitPrice: item.unitPrice,
        usedBatches: item.usedBatches || []
      }))
    : items.length
      ? items.map((item) => {
          const orderItem = orderItemMap.get(String(item.productId));
          return {
            productId: item.productId,
            quantity: item.quantity,
            itemCode: item.itemCode || orderItem?.itemCode,
            itemName: item.itemName || orderItem?.itemName,
            billingPrice: orderItem
              ? orderItem.billingPrice !== undefined && orderItem.billingPrice !== null
                ? orderItem.billingPrice
                : orderItem.unitPrice
              : undefined,
            sellingPrice: orderItem ? orderItem.sellingPrice : undefined,
            unitPrice: orderItem ? orderItem.unitPrice : undefined,
            usedBatches: orderItem?.usedBatches || []
          };
        })
      : order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          itemCode: item.itemCode,
          itemName: item.itemName,
          billingPrice:
            item.billingPrice !== undefined && item.billingPrice !== null
              ? item.billingPrice
              : item.unitPrice,
          sellingPrice: item.sellingPrice,
          unitPrice: item.unitPrice,
          usedBatches: item.usedBatches || []
        }));
  let missingItem = false;
  const orderTotal = deliveredItems.reduce((sum, item) => {
    const orderItem = orderItemMap.get(String(item.productId));
    if (!orderItem) {
      missingItem = true;
      return sum;
    }
    return sum + Number(item.quantity || 0) * Number(orderItem.unitPrice || 0);
  }, 0);
  if (missingItem) {
    return res.status(400).json({ message: "Delivered item does not exist in order" });
  }
  // Normalize and strictly validate confirmed market returns
  const validatedReturns = [];
  for (const r of (returns || [])) {
    const qty = Number(r.quantity || 0);
    const price = Number(r.returnPrice || 0);

    if (qty <= 0 || isNaN(qty)) {
      return res.status(400).json({ message: `Invalid quantity for return item ${r.itemName || r.itemCode}.` });
    }

    if (price <= 0 || isNaN(price)) {
      return res.status(400).json({ message: `Return unit price for ${r.itemName || r.itemCode} must be greater than zero.` });
    }

    // Valuation Policy: return price must not exceed catalogue selling price
    if (r.productId || r.itemCode) {
      const prod = r.productId 
        ? await Product.findById(r.productId) 
        : await Product.findOne({ itemCode: r.itemCode });
      if (prod && typeof prod.currentSellingPrice === "number" && price > prod.currentSellingPrice) {
        return res.status(400).json({
          message: `Return unit price (Rs. ${price.toFixed(2)}) for "${prod.displayName || prod.productName}" cannot exceed catalogue selling price (Rs. ${prod.currentSellingPrice.toFixed(2)}).`
        });
      }
    }

    const itemReturnTotal = Math.round(qty * price * 100) / 100;

    validatedReturns.push({
      productId: r.productId,
      itemCode: r.itemCode,
      itemName: r.itemName,
      quantity: qty,
      returnPrice: price,
      returnTotal: itemReturnTotal,
      condition: r.condition || "resellable",
      reason: r.reason || "Delivered market return",
      originalInvoiceNo: r.originalInvoiceNo || ""
    });
  }

  const returnTotal = validatedReturns.reduce((sum, item) => sum + item.returnTotal, 0);
  if (returnTotal > orderTotal) {
    return res.status(400).json({ message: "Return total cannot exceed order total" });
  }
  const baseTotal = Math.max(0, orderTotal - returnTotal);

  const effectiveDiscountPercent =
    discountPercent !== undefined && discountPercent !== null && discountPercent !== ""
      ? Number(discountPercent)
      : order.discountPercent !== undefined && order.discountPercent !== null
      ? order.discountPercent
      : order.orderTotal > 0 && order.discount
      ? (order.discount / order.orderTotal) * 100
      : 0;

  const calculatedDiscount = Math.round((baseTotal * (effectiveDiscountPercent / 100)) * 100) / 100;
  const netTotal = Math.max(0, baseTotal - calculatedDiscount);
  const numericPaid = Number(paidAmount || 0);
  const resolvedPaymentMethod = paymentMethod || "cash";

  if (!order.customer) {
    if (resolvedPaymentMethod === "credit") {
      return res
        .status(400)
        .json({ message: "Credit is only allowed for registered customers" });
    }
    if (numericPaid < netTotal) {
      return res
        .status(400)
        .json({ message: "Walk-in orders must be fully paid" });
    }
  }

  try {
    const activeTrip = await TripSession.findOne({
      rep: req.user?._id,
      status: "active"
    });

    const sale = await createSaleFromPayload({
      items: deliveredItems,
      returns: validatedReturns,
      discount,
      discountPercent: effectiveDiscountPercent,
      paidAmount: numericPaid,
      paymentMethod: resolvedPaymentMethod,
      chequeBank,
      chequeNo,
      chequeDate,
      customer: order.customer,
      saleType:
        order.customer && numericPaid > 0 && numericPaid < netTotal ? "credit" : "walk-in",
      cashierId: req.user?._id,
      orderId: order._id,
      skipProductStockUpdate: order.stockReserved,
      skipBatchUpdate: order.stockReserved,
      tripId: activeTrip ? activeTrip._id : undefined
    });

    if (activeTrip) {
      order.tripId = activeTrip._id;
      if (!activeTrip.ordersBooked.includes(order._id)) {
        activeTrip.ordersBooked.push(order._id);
        await activeTrip.save();
      }
    }

    const dueAmount = sale.dueAmount || 0;
    if (order.customer) {
      if (dueAmount > 0) {
        await Customer.findByIdAndUpdate(order.customer, {
          $inc: { outstandingBalance: dueAmount }
        });
      }
    }

    if (resolvedPaymentMethod === "cash" || resolvedPaymentMethod === "cheque") {
      const netCollected = sale.paidAmount - (sale.balance || 0);
      if (netCollected > 0) {
        if (order.customer) {
          const payment = await Payment.create({
            paymentNo: `PAY-${Date.now()}`,
            customer: order.customer,
            amount: netCollected,
            paymentMethod: resolvedPaymentMethod,
            receivedBy: req.user?._id,
            allocations: [
              {
                invoice: sale._id,
                invoiceNo: sale.invoiceNo,
                allocatedAmount: netCollected
              }
            ],
            tripId: activeTrip ? activeTrip._id : undefined
          });

          if (activeTrip) {
            activeTrip.paymentsCollected.push(payment._id);
            if (resolvedPaymentMethod === "cash") {
              activeTrip.expectedCollections.cash = (activeTrip.expectedCollections.cash || 0) + netCollected;
            } else if (resolvedPaymentMethod === "cheque") {
              activeTrip.expectedCollections.cheque = (activeTrip.expectedCollections.cheque || 0) + netCollected;
            }
            await activeTrip.save();
          }
        } else {
          // Walk-in order payment (no customer document), still collected during active trip
          if (activeTrip) {
            if (resolvedPaymentMethod === "cash") {
              activeTrip.expectedCollections.cash = (activeTrip.expectedCollections.cash || 0) + netCollected;
            } else if (resolvedPaymentMethod === "cheque") {
              activeTrip.expectedCollections.cheque = (activeTrip.expectedCollections.cheque || 0) + netCollected;
            }
            await activeTrip.save();
          }
        }
      }
    }

    order.orderStatus = "delivered";
    order.paymentStatus = sale.paymentStatus;
    order.paymentMethod = resolvedPaymentMethod;
    if (resolvedPaymentMethod === "cheque") {
      order.chequeBank = chequeBank;
      order.chequeNo = chequeNo;
      if (chequeDate) order.chequeDate = new Date(chequeDate);
    }
    order.deliveryDate = new Date();
    order.saleId = sale._id;
    order.returns = validatedReturns;
    order.orderTotal = sale.orderTotal;
    order.returnTotal = sale.returnTotal;
    order.discount = sale.discount;
    order.discountPercent = sale.discountPercent;
    order.netTotal = sale.netTotal;
    order.paidAmount = sale.paidAmount;
    order.dueAmount = sale.dueAmount;
    order.stockReserved = false;
    await order.save();

    return res.json({ order, sale });
  } catch (err) {
    const status = err.status || err.statusCode || 400;
    return res.status(status).json({
      message: err.message || "Failed to deliver order",
      itemCode: err.itemCode,
      availableQuantity: err.availableQuantity,
      requestedQuantity: err.requestedQuantity
    });
  }
};

const getOrderByIdempotencyKey = async (req, res) => {
  const { key } = req.params;
  if (!key || typeof key !== "string" || !key.trim()) {
    return res.status(400).json({ message: "Idempotency key is required" });
  }

  try {
    const order = await Order.findOne({ idempotencyKey: key.trim() })
      .populate("customer", "name phone address customerType")
      .populate("cashier", "name");

    if (!order) {
      return res.status(404).json({ message: "No order found for the provided idempotency key" });
    }

    if (req.user?.role === "rep" && order.cashier?._id?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ message: "Unauthorized access to order" });
    }

    return res.status(200).json(order);
  } catch (err) {
    return res
      .status(500)
      .json({ message: err.message || "Failed to query order by idempotency key" });
  }
};

module.exports = {
  createOrder,
  listOrders,
  getOrder,
  getOrderByIdempotencyKey,
  updateOrder,
  cancelOrder,
  deleteOrder,
  deliverOrder
};
