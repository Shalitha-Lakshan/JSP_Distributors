const Sale = require("../models/Sale");
const Payment = require("../models/Payment");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");
const Return = require("../models/Return");
const MonthlySalesSnapshot = require("../models/MonthlySalesSnapshot");

const getDailyClosing = async (req, res) => {
  const dateParam = req.query.date;
  const date = dateParam ? new Date(dateParam) : new Date();
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  const match = {
    createdAt: { $gte: start, $lt: end },
    status: { $ne: "cancelled" }
  };

  if (req.user?.role === "rep") {
    match.cashier = req.user._id;
    const TripSession = require("../models/TripSession");
    const activeTrip = await TripSession.findOne({
      rep: req.user._id,
      status: "active"
    });
    if (activeTrip) {
      match.tripId = activeTrip._id;
    } else {
      match.tripId = new (require("mongoose")).Types.ObjectId();
    }
  }

  const [summary] = await Sale.aggregate([
    {
      $match: match
    },
    {
      $group: {
        _id: null,
        grossSales: { $sum: "$orderTotal" },
        returnsAdjusted: { $sum: "$returnTotal" },
        netSales: { $sum: "$netTotal" }
      }
    }
  ]);

  return res.json({
    date: start,
    grossSales: summary?.grossSales || 0,
    returnsAdjusted: summary?.returnsAdjusted || 0,
    netSales: summary?.netSales || 0
  });
};

/**
 * GET /api/reports/monthly-sales
 *
 * Returns a chart-ready array of monthly revenue + profit.
 * Merges two data sources:
 *   1. Live Sale documents (aggregated on the fly)
 *   2. Archived MonthlySalesSnapshot documents (from past cleanups)
 *
 * Response shape:
 *   [ { month: "2026-05", revenue: 0, profit: 0, invoiceCount: 0 }, ... ]
 *
 * Query params:
 *   months  (optional, default 12) – how many months back to include
 */
const getMonthlySales = async (req, res) => {
  try {
    const monthsBack = Math.max(1, Math.min(Number(req.query.months || 12), 36));

    // Build a date range: first day of (now - monthsBack) months through now
    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);

    // ── 1. Aggregate from live Sale collection ───────────────────────────
    const liveSalesAgg = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: rangeStart },
          status: { $ne: "cancelled" }
        }
      },
      {
        $project: {
          month: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          netTotal: 1,
          saleProfit: {
            $subtract: [
              {
                $sum: {
                  $map: {
                    input: "$items",
                    as: "item",
                    in: {
                      $sum: {
                        $map: {
                          input: "$$item.usedBatches",
                          as: "b",
                          in: "$$b.sellingLineTotal"
                        }
                      }
                    }
                  }
                }
              },
              {
                $sum: {
                  $map: {
                    input: "$items",
                    as: "item",
                    in: "$$item.lineTotal"
                  }
                }
              }
            ]
          }
        }
      },
      {
        $group: {
          _id: "$month",
          revenue: { $sum: "$netTotal" },
          profit: { $sum: "$saleProfit" },
          invoiceCount: { $sum: 1 }
        }
      }
    ]);

    // ── 2. Fetch archived snapshot records ──────────────────────────────
    const rangeStartMonthStr = rangeStart.toISOString().slice(0, 7); // "YYYY-MM"
    const snapshots = await MonthlySalesSnapshot.find({
      month: { $gte: rangeStartMonthStr }
    });

    // ── 3. Merge into a single Map keyed by "YYYY-MM" ──────────────────────
    const merged = new Map();

    // Seed all months in range with zeros so the chart has a continuous x-axis
    for (let i = 0; i < monthsBack; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1 - i), 1);
      const key = d.toISOString().slice(0, 7);
      merged.set(key, { month: key, revenue: 0, profit: 0, invoiceCount: 0 });
    }

    // Add archived snapshot totals
    snapshots.forEach((snap) => {
      const row = merged.get(snap.month) || { month: snap.month, revenue: 0, profit: 0, invoiceCount: 0 };
      row.revenue      += snap.totalRevenue  || 0;
      row.profit       += snap.totalProfit   || 0;
      row.invoiceCount += snap.invoiceCount  || 0;
      merged.set(snap.month, row);
    });

    // Add live sale aggregation totals (may overlap with snapshot months if
    // a cleanup was run mid-month – live data is additive on top of snapshot)
    liveSalesAgg.forEach((row) => {
      const existing = merged.get(row._id) || { month: row._id, revenue: 0, profit: 0, invoiceCount: 0 };
      existing.revenue      += row.revenue      || 0;
      existing.profit       += row.profit       || 0;
      existing.invoiceCount += row.invoiceCount || 0;
      merged.set(row._id, existing);
    });

    // Sort chronologically
    const chart = [...merged.values()].sort((a, b) => (a.month < b.month ? -1 : 1));

    return res.json(chart);
  } catch (err) {
    console.error("getMonthlySales error:", err);
    return res.status(500).json({ message: err.message || "Failed to generate monthly sales report" });
  }
};

const getItemWise = async (_req, res) => {
  return res.status(501).json({ message: "Item wise report not implemented" });
};

const getCustomerWise = async (_req, res) => {
  return res.status(501).json({ message: "Customer wise report not implemented" });
};

const getCreditOutstanding = async (_req, res) => {
  return res.status(501).json({ message: "Credit outstanding report not implemented" });
};

const getPaymentCollections = async (_req, res) => {
  return res.status(501).json({ message: "Payment collections report not implemented" });
};

const getManagerDashboard = async (_req, res) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const nearExpiryEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);

  const salesToday = await Sale.find({
    createdAt: { $gte: start, $lt: end },
    status: { $ne: "cancelled" }
  })
    .select(
      "orderTotal returnTotal netTotal dueAmount paymentStatus items returns invoiceNo customer cashier createdAt"
    )
    .populate("customer", "name")
    .populate("cashier", "name");

  let grossSalesToday = 0;
  let returnsAdjustedToday = 0;
  let creditBillsToday = 0;

  salesToday.forEach((sale) => {
    grossSalesToday += sale.orderTotal || 0;
    returnsAdjustedToday += sale.returnTotal || 0;
    if (sale.dueAmount > 0 && ["credit", "partial"].includes(sale.paymentStatus)) {
      creditBillsToday += sale.dueAmount;
    }
  });

  const netSalesToday = grossSalesToday - returnsAdjustedToday;

  const [outstanding] = await Customer.aggregate([
    { $group: { _id: null, total: { $sum: "$outstandingBalance" } } }
  ]);

  const totalOutstandingBalance = outstanding?.total || 0;

  const lowStockQuery = { $expr: { $lte: ["$totalStock", "$reorderLevel"] } };
  const lowStockCount = await Product.countDocuments(lowStockQuery);
  const topLowStockItems = await Product.find(lowStockQuery)
    .sort({ totalStock: 1 })
    .limit(10)
    .select("itemCode displayName totalStock reorderLevel");

  const nearExpiryQuery = {
    expiryDate: { $gte: start, $lte: nearExpiryEnd },
    remainingQty: { $gt: 0 }
  };
  const nearExpiryCount = await StockBatch.countDocuments(nearExpiryQuery);
  const nearExpiryBatches = await StockBatch.find(nearExpiryQuery)
    .sort({ expiryDate: 1 })
    .limit(10)
    .populate("productId", "displayName productName")
    .select("batchNo remainingQty expiryDate productId");

  const [stockAdded] = await StockBatch.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    { $group: { _id: null, totalQty: { $sum: "$quantity" }, batchCount: { $sum: 1 } } }
  ]);

  const stockAddedTodayQty = stockAdded?.totalQty || 0;
  const stockAddedTodayBatches = stockAdded?.batchCount || 0;

  const paymentsToday = await Payment.find({ createdAt: { $gte: start, $lt: end } })
    .sort({ createdAt: -1 })
    .populate("customer", "name")
    .populate("receivedBy", "name");

  let cashCollection = 0;
  let chequeCollection = 0;

  paymentsToday.forEach((payment) => {
    const method = (payment.paymentMethod || "").toLowerCase();
    if (method === "cash") {
      cashCollection += payment.amount || 0;
    } else if (method === "cheque") {
      chequeCollection += payment.amount || 0;
    }
  });

  const totalCollectionToday = cashCollection + chequeCollection;

  const allocationIds = new Set();
  paymentsToday.forEach((payment) => {
    (payment.allocations || []).forEach((allocation) => {
      if (allocation.invoice) {
        allocationIds.add(allocation.invoice.toString());
      }
    });
  });

  const allocatedSales = await Sale.find({ _id: { $in: [...allocationIds] } }).select(
    "createdAt"
  );
  const saleDateMap = new Map(
    allocatedSales.map((sale) => [sale._id.toString(), sale.createdAt])
  );

  let todayBillCollection = 0;
  let oldCreditCollection = 0;

  paymentsToday.forEach((payment) => {
    (payment.allocations || []).forEach((allocation) => {
      const invoiceId = allocation.invoice?.toString();
      const saleDate = invoiceId ? saleDateMap.get(invoiceId) : null;
      if (!saleDate) {
        return;
      }

      if (saleDate >= start && saleDate < end) {
        todayBillCollection += allocation.allocatedAmount || 0;
      } else {
        oldCreditCollection += allocation.allocatedAmount || 0;
      }
    });
  });

  const recentPayments = paymentsToday.slice(0, 5).map((payment) => ({
    paymentNo: payment.paymentNo,
    customer: payment.customer?.name || "Walk-in",
    amount: payment.amount,
    method: payment.paymentMethod,
    receivedBy: payment.receivedBy?.name || "-",
    createdAt: payment.createdAt
  }));

  const recentCreditBillsDocs = await Sale.find({
    dueAmount: { $gt: 0 },
    status: { $ne: "cancelled" }
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("customer", "name")
    .populate("cashier", "name");

  const recentCreditBills = recentCreditBillsDocs.map((sale) => ({
    invoiceNo: sale.invoiceNo,
    customer: sale.customer?.name || "Walk-in",
    netTotal: sale.netTotal,
    paidAmount: sale.paidAmount,
    dueAmount: sale.dueAmount,
    cashier: sale.cashier?.name || "-"
  }));

  const recentReturnDocs = await Return.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("customer", "name");

  const recentReturns = [];
  for (const ret of recentReturnDocs) {
    for (const item of ret.items || []) {
      recentReturns.push({
        returnNo: `RET-${ret._id.toString().slice(-6)}`,
        customer: ret.customer?.name || "Walk-in",
        item: item.itemName,
        qty: item.quantity,
        returnAmount: item.returnTotal,
        condition: item.condition
      });
      if (recentReturns.length >= 5) {
        break;
      }
    }
    if (recentReturns.length >= 5) {
      break;
    }
  }

  const itemMap = new Map();

  salesToday.forEach((sale) => {
    (sale.items || []).forEach((item) => {
      const key = item.itemCode || item.itemName;
      const existing = itemMap.get(key) || {
        itemCode: item.itemCode,
        itemName: item.itemName,
        soldQty: 0,
        returnQty: 0,
        netQtySold: 0,
        grossSalesAmount: 0,
        returnAmount: 0,
        netSalesAmount: 0
      };

      existing.soldQty += item.quantity || 0;
      existing.grossSalesAmount += item.lineTotal || 0;
      itemMap.set(key, existing);
    });

    (sale.returns || []).forEach((item) => {
      const key = item.itemCode || item.itemName;
      const existing = itemMap.get(key) || {
        itemCode: item.itemCode,
        itemName: item.itemName,
        soldQty: 0,
        returnQty: 0,
        netQtySold: 0,
        grossSalesAmount: 0,
        returnAmount: 0,
        netSalesAmount: 0
      };

      existing.returnQty += item.quantity || 0;
      existing.returnAmount += item.returnTotal || 0;
      itemMap.set(key, existing);
    });
  });

  const topSellingItems = [...itemMap.values()]
    .map((item) => ({
      ...item,
      netQtySold: (item.soldQty || 0) - (item.returnQty || 0),
      netSalesAmount: (item.grossSalesAmount || 0) - (item.returnAmount || 0)
    }))
    .sort((a, b) => {
      if (b.netQtySold !== a.netQtySold) {
        return b.netQtySold - a.netQtySold;
      }
      return b.netSalesAmount - a.netSalesAmount;
    })
    .slice(0, 5);

  const salesVsCollectionData = [
    { name: "Gross Sales", value: grossSalesToday },
    { name: "Net Sales", value: netSalesToday },
    { name: "Total Collection", value: totalCollectionToday }
  ];

  const paymentMix = {
    cashCollection,
    chequeCollection,
    creditBills: creditBillsToday,
    oldCreditCollection
  };

  const nearExpiryRows = nearExpiryBatches.map((batch) => {
    const daysLeft = batch.expiryDate
      ? Math.ceil((batch.expiryDate - now) / (1000 * 60 * 60 * 24))
      : null;
    return {
      batchNo: batch.batchNo,
      itemName: batch.productId?.displayName || batch.productId?.productName || "-",
      remainingQty: batch.remainingQty,
      expiryDate: batch.expiryDate,
      daysLeft
    };
  });

  const topLowStockRows = topLowStockItems.map((item) => ({
    itemCode: item.itemCode,
    itemName: item.displayName,
    currentStock: item.totalStock,
    reorderLevel: item.reorderLevel,
    status: item.totalStock <= item.reorderLevel ? "Reorder" : "Ok"
  }));

  return res.json({
    grossSalesToday,
    returnsAdjustedToday,
    netSalesToday,
    totalCollectionToday,
    todayBillCollection,
    oldCreditCollection,
    creditBillsToday,
    totalOutstandingBalance,
    lowStockCount,
    nearExpiryCount,
    stockAddedToday: {
      quantity: stockAddedTodayQty,
      batches: stockAddedTodayBatches
    },
    topLowStockItems: topLowStockRows,
    nearExpiryBatches: nearExpiryRows,
    paymentMix,
    recentPayments,
    recentCreditBills,
    recentReturns,
    topSellingItems,
    salesVsCollectionData
  });
};

module.exports = {
  getDailyClosing,
  getMonthlySales,
  getItemWise,
  getCustomerWise,
  getCreditOutstanding,
  getPaymentCollections,
  getManagerDashboard
};
