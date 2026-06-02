const Order = require("../models/Order");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const Payment = require("../models/Payment");
const { createSaleFromPayload } = require("../services/salesService");

const buildOrderItems = async (items, reservedQtyByProduct = new Map()) => {
  const result = [];
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

    const reservedQty = reservedQtyByProduct.get(product._id.toString()) || 0;
    const availableQty = Number(product.totalStock || 0) + Number(reservedQty || 0);

    if (quantity > availableQty) {
      throw new Error(
        `Insufficient stock for ${product.displayName}. Available: ${availableQty}`
      );
    }
    const unitPrice = Number(product.currentSellingPrice || 0);
    result.push({
      productId: product._id,
      itemCode: product.itemCode,
      itemName: product.displayName,
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice
    });
  }

  return result;
};

const createOrder = async (req, res) => {
  const { customer, items = [] } = req.body;

  if (!items.length) {
    return res.status(400).json({ message: "No items provided" });
  }

  try {
    if (customer) {
      const existingCustomer = await Customer.findById(customer);
      if (!existingCustomer) {
        return res.status(400).json({ message: "Customer not found" });
      }
    }

    const orderItems = await buildOrderItems(items);
    const orderTotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const stockUpdates = orderItems.reduce((map, item) => {
      const key = item.productId.toString();
      map.set(key, (map.get(key) || 0) + item.quantity);
      return map;
    }, new Map());

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

    const order = await Order.create({
      orderNo: `ORD-${Date.now()}`,
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

    return res.status(201).json(order);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Failed to create order" });
  }
};

const listOrders = async (req, res) => {
  const filter = {};
  if (req.user?.role === "cashier" || req.query.mine === "true") {
    filter.cashier = req.user?._id;
  }

  const orders = await Order.find(filter)
    .populate("customer", "name")
    .populate("cashier", "name")
    .sort({ createdAt: -1 });
  return res.json(orders);
};

const getOrder = async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("customer", "name")
    .populate("cashier", "name");

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  return res.json(order);
};

const updateOrder = async (req, res) => {
  const { items = [], customer } = req.body;
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

  if (items.length > 0) {
    try {
      const reservedQtyByProduct = new Map(
        order.items.map((item) => [item.productId.toString(), item.quantity])
      );
      const orderItems = await buildOrderItems(items, reservedQtyByProduct);

      if (order.stockReserved) {
        const newQtyByProduct = new Map(
          orderItems.map((item) => [item.productId.toString(), item.quantity])
        );
        const deltaUpdates = new Map();

        reservedQtyByProduct.forEach((qty, productId) => {
          const nextQty = newQtyByProduct.get(productId) || 0;
          const delta = nextQty - qty;
          if (delta !== 0) {
            deltaUpdates.set(productId, delta);
          }
        });

        newQtyByProduct.forEach((qty, productId) => {
          if (!reservedQtyByProduct.has(productId)) {
            deltaUpdates.set(productId, qty);
          }
        });

        if (deltaUpdates.size > 0) {
          await Product.bulkWrite(
            [...deltaUpdates.entries()].map(([productId, delta]) => ({
              updateOne: {
                filter: { _id: productId },
                update: { $inc: { totalStock: -delta } }
              }
            }))
          );
        }
      }

      order.items = orderItems;
      order.orderTotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
      order.netTotal = order.orderTotal;
      order.dueAmount = order.orderTotal;
    } catch (err) {
      return res.status(400).json({ message: err.message || "Failed to update order" });
    }
  }

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
    const restoreUpdates = order.items.map((item) => ({
      updateOne: {
        filter: { _id: item.productId },
        update: { $inc: { totalStock: item.quantity } }
      }
    }));
    if (restoreUpdates.length > 0) {
      await Product.bulkWrite(restoreUpdates);
    }
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

  const deliveredItems = items.length
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
      skipProductStockUpdate: order.stockReserved
    });

    const dueAmount = sale.dueAmount || 0;
    if (order.customer) {
      if (dueAmount > 0) {
        await Customer.findByIdAndUpdate(order.customer, {
          $inc: { outstandingBalance: dueAmount }
        });
      }
    }

    if (resolvedPaymentMethod === "cash" || resolvedPaymentMethod === "cheque") {
      if (numericPaid > 0 && order.customer) {
        await Payment.create({
          paymentNo: `PAY-${Date.now()}`,
          customer: order.customer,
          amount: numericPaid,
          paymentMethod: resolvedPaymentMethod,
          receivedBy: req.user?._id,
          allocations: [
            {
              invoice: sale._id,
              invoiceNo: sale.invoiceNo,
              allocatedAmount: numericPaid
            }
          ]
        });
      }
    }

    order.orderStatus = "delivered";
    order.paymentStatus = sale.paymentStatus;
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
  deliverOrder,
  deleteOrder
};
