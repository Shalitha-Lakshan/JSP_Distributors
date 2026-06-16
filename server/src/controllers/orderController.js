const Order = require("../models/Order");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");
const Payment = require("../models/Payment");
const TripSession = require("../models/TripSession");
const { createSaleFromPayload } = require("../services/salesService");
const Counter = require("../models/Counter");

const reserveStockForItems = async (items) => {
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

    const batches = await StockBatch.find({
      productId: item.productId,
      remainingQty: { $gt: 0 }
    }).sort({ receivedDate: 1 });

    let remaining = quantity;
    let lineTotal = 0;
    const usedBatches = [];

    for (const batch of batches) {
      if (remaining <= 0) {
        break;
      }

      const takeQty = Math.min(batch.remainingQty, remaining);
      remaining -= takeQty;
      const batchTotal = takeQty * Number(batch.billingPrice || 0);
      lineTotal += batchTotal;

      usedBatches.push({
        batchId: batch._id,
        batchNo: batch.batchNo,
        qty: takeQty,
        billingPrice: Number(batch.billingPrice || 0),
        lineTotal: batchTotal
      });

      batchUpdates.push({
        updateOne: {
          filter: { _id: batch._id },
          update: { $inc: { remainingQty: -takeQty } }
        }
      });
    }

    if (remaining > 0) {
      throw new Error(
        `Insufficient stock for ${product.displayName}. Available: ${quantity - remaining}`
      );
    }

    orderItems.push({
      productId: product._id,
      itemCode: product.itemCode,
      itemName: product.displayName,
      quantity,
      unitPrice: quantity > 0 ? lineTotal / quantity : 0,
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
  const { customer, items = [] } = req.body;

  if (!items.length) {
    return res.status(400).json({ message: "No items provided" });
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

    if (batchUpdates.length > 0) {
      await StockBatch.bulkWrite(batchUpdates);
    }

    if (stockUpdates.size > 0) {
      await Product.bulkWrite(
        [...stockUpdates.entries()].map(([productId, qty]) => ({
          updateOne: {
            filter: { _id: productId },
            update: { $inc: { totalStock: -qty } }
          }
        }))
      );
    }

    const counter = await Counter.findOneAndUpdate(
      { id: "orderNo" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const orderSeq = String(counter.seq).padStart(8, "0");
    const orderNo = `ORD-${orderSeq}`;

    const order = await Order.create({
      orderNo,
      customer: customer || null,
      cashier: req.user?._id,
      items: orderItems,
      orderTotal,
      returnTotal: 0,
      discount: 0,
      netTotal: orderTotal,
      paidAmount: 0,
      dueAmount: orderTotal,
      orderStatus: "pending_delivery",
      paymentStatus: "not_collected",
      stockReserved: true
    });

    if (activeTrip) {
      order.tripId = activeTrip._id;
      await order.save();
      activeTrip.ordersBooked.push(order._id);
      await activeTrip.save();
    }

    return res.status(201).json(order);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Failed to create order" });
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
    .populate({ path: "items.productId", select: "supplier" })
    .populate("saleId", "paymentMethod")
    .sort({ createdAt: -1 });
  return res.json(orders);
};

const getOrder = async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("customer", "name phone address customerType")
    .populate("cashier", "name")
    .populate("tripId", "route")
    .populate({ path: "items.productId", select: "supplier" })
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
    try {
      if (order.stockReserved) {
        await restoreReservedStock(order.items);
      }

      const { orderItems, batchUpdates, stockUpdates } = await reserveStockForItems(items);

      if (batchUpdates.length > 0) {
        await StockBatch.bulkWrite(batchUpdates);
      }

      if (stockUpdates.size > 0) {
        await Product.bulkWrite(
          [...stockUpdates.entries()].map(([productId, qty]) => ({
            updateOne: {
              filter: { _id: productId },
              update: { $inc: { totalStock: -qty } }
            }
          }))
        );
      }

      order.items = orderItems;
      order.orderTotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
      order.stockReserved = true;
    } catch (err) {
      return res.status(400).json({ message: err.message || "Failed to update order" });
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
  const { items = [], returns = [], discount = 0, paidAmount = 0, paymentMethod } = req.body;
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

  const deliveredItems = order.stockReserved
    ? order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        itemCode: item.itemCode,
        itemName: item.itemName,
        usedBatches: item.usedBatches || []
      }))
    : items.length
      ? items
      : order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          itemCode: item.itemCode,
          itemName: item.itemName
        }));

  const orderItemMap = new Map(
    order.items.map((item) => [item.productId.toString(), item])
  );
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
  const returnTotal = returns.reduce(
    (sum, item) => sum + (item.returnTotal || item.quantity * item.returnPrice || 0),
    0
  );
  const netTotal = Math.max(orderTotal - returnTotal - Number(discount || 0), 0);
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
      returns,
      discount,
      paidAmount: numericPaid,
      paymentMethod: resolvedPaymentMethod,
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
    order.deliveryDate = new Date();
    order.saleId = sale._id;
    order.orderTotal = sale.orderTotal;
    order.returnTotal = sale.returnTotal;
    order.discount = sale.discount;
    order.netTotal = sale.netTotal;
    order.paidAmount = sale.paidAmount;
    order.dueAmount = sale.dueAmount;
    order.stockReserved = false;
    await order.save();

    return res.json({ order, sale });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Failed to deliver order" });
  }
};

module.exports = {
  createOrder,
  listOrders,
  getOrder,
  updateOrder,
  cancelOrder,
  deleteOrder,
  deliverOrder
};
