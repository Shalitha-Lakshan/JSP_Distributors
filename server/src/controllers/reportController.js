const Sale = require("../models/Sale");
const Payment = require("../models/Payment");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");
const Return = require("../models/Return");
const MonthlySalesSnapshot = require("../models/MonthlySalesSnapshot");
const TripSession = require("../models/TripSession");
const User = require("../models/User");

const getDailyClosing = async (req, res) => {
  try {
    const tripIdParam = req.query.tripId;
    let activeTrip = null;

    if (tripIdParam) {
      activeTrip = await TripSession.findById(tripIdParam);
    } else if (req.user?.role === "rep") {
      activeTrip = await TripSession.findOne({
        rep: req.user._id,
        status: "active"
      });
    }

    // A. Active Trip Session Scoped
    if (activeTrip || (req.user?.role === "rep" && !activeTrip)) {
      if (!activeTrip) {
        return res.json({
          date: new Date(),
          grossSales: 0,
          returns: 0,
          expenses: 0,
          netSales: 0,
          discounts: 0,
          netCashCollection: 0,
          tripNo: "-",
          route: "-"
        });
      }

      const [summary] = await Sale.aggregate([
        {
          $match: {
            tripId: activeTrip._id,
            status: { $ne: "cancelled" }
          }
        },
        {
          $group: {
            _id: null,
            grossSales: { $sum: "$orderTotal" },
            returns: { $sum: "$returnTotal" },
            discounts: { $sum: "$discount" },
            netSales: { $sum: "$netTotal" }
          }
        }
      ]);

      const expenses = (activeTrip.expenses || []).reduce((sum, e) => sum + e.amount, 0);
      const netCashCollection = (activeTrip.expectedCollections?.cash || 0) - expenses;

      return res.json({
        date: activeTrip.createdAt,
        grossSales: summary?.grossSales || 0,
        returns: summary?.returns || 0,
        expenses,
        netSales: summary?.netSales || 0,
        discounts: summary?.discounts || 0,
        netCashCollection,
        tripNo: activeTrip.tripNo,
        route: activeTrip.route
      });
    }

    // B. Date-Based or Month-Based Global Summary for Manager/Admin
    const period = req.query.period || "daily";
    let start, end;
    let monthStr = "";

    if (period === "monthly") {
      monthStr = req.query.month || new Date().toISOString().slice(0, 7);
      const [year, monthVal] = monthStr.split("-").map(Number);
      start = new Date(year, monthVal - 1, 1);
      end = new Date(year, monthVal, 1);
    } else {
      const dateParam = req.query.date;
      const date = dateParam ? new Date(dateParam) : new Date();
      start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    }

    const [summary] = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lt: end },
          status: { $ne: "cancelled" }
        }
      },
      {
        $group: {
          _id: null,
          grossSales: { $sum: "$orderTotal" },
          returns: { $sum: "$returnTotal" },
          discounts: { $sum: "$discount" },
          netSales: { $sum: "$netTotal" }
        }
      }
    ]);

    // Integrate MonthlySalesSnapshot archived values if monthly period is active
    let archivedRevenue = 0;
    let archivedProfit = 0;
    if (period === "monthly") {
      const snapshot = await MonthlySalesSnapshot.findOne({ month: monthStr });
      if (snapshot) {
        archivedRevenue = snapshot.totalRevenue || 0;
        archivedProfit = snapshot.totalProfit || 0;
      }
    }

    const grossSalesVal = (summary?.grossSales || 0) + archivedRevenue;
    const netSalesVal = (summary?.netSales || 0) + archivedRevenue;
    const returnsVal = summary?.returns || 0;
    const discountsVal = summary?.discounts || 0;

    // Sum expenses from all trips active/started in this range
    const trips = await TripSession.find({
      startTime: { $gte: start, $lt: end }
    });
    const totalExpenses = trips.reduce((sum, t) => {
      return sum + (t.expenses || []).reduce((s, e) => s + e.amount, 0);
    }, 0);

    // Sum cash and cheque collections from Payments
    const collectionsAgg = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lt: end }
        }
      },
      {
        $group: {
          _id: "$paymentMethod",
          total: { $sum: "$amount" }
        }
      }
    ]);

    let totalCashCollected = 0;
    let totalChequeCollected = 0;
    collectionsAgg.forEach((p) => {
      if (p._id === "cash") totalCashCollected = p.total;
      if (p._id === "cheque") totalChequeCollected = p.total;
    });

    const netCashCollection = totalCashCollected - totalExpenses;

    if (period === "monthly") {
      // Calculate daily breakdown for the monthly audit
      const salesByDay = await Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lt: end },
            status: { $ne: "cancelled" }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:30" } },
            grossSales: { $sum: "$orderTotal" },
            returns: { $sum: "$returnTotal" },
            discounts: { $sum: "$discount" },
            netSales: { $sum: "$netTotal" }
          }
        }
      ]);

      const paymentsByDay = await Payment.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lt: end }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:30" } },
              method: "$paymentMethod"
            },
            total: { $sum: "$amount" }
          }
        }
      ]);

      // Group expenses by date using trip startTime
      const expensesMap = {};
      trips.forEach((t) => {
        const tripDate = new Date(t.startTime || t.createdAt);
        // Use +05:30 timezone offset or local Sri Lanka date string
        const localDateStr = new Date(tripDate.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().slice(0, 10);
        (t.expenses || []).forEach((e) => {
          expensesMap[localDateStr] = (expensesMap[localDateStr] || 0) + e.amount;
        });
      });

      const dailyBreakdown = [];
      const [year, monthVal] = monthStr.split("-").map(Number);
      const daysInMonth = new Date(year, monthVal, 0).getDate();

      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${monthStr}-${String(d).padStart(2, "0")}`;
        const daySales = salesByDay.find((s) => s._id === dayStr) || {};
        const dayCash = paymentsByDay.find((p) => p._id.date === dayStr && p._id.method === "cash")?.total || 0;
        const dayCheque = paymentsByDay.find((p) => p._id.date === dayStr && p._id.method === "cheque")?.total || 0;
        const dayExpenses = expensesMap[dayStr] || 0;

        dailyBreakdown.push({
          date: dayStr,
          grossSales: daySales.grossSales || 0,
          returns: daySales.returns || 0,
          discounts: daySales.discounts || 0,
          netSales: daySales.netSales || 0,
          cashCollected: dayCash,
          chequeCollected: dayCheque,
          expenses: dayExpenses,
          netCashCollection: dayCash - dayExpenses
        });
      }

      return res.json({
        period: "monthly",
        month: monthStr,
        grossSales: grossSalesVal,
        returns: returnsVal,
        expenses: totalExpenses,
        netSales: netSalesVal,
        discounts: discountsVal,
        cashCollected: totalCashCollected,
        chequeCollected: totalChequeCollected,
        netCashCollection,
        tripsCount: trips.length,
        archivedRevenue,
        archivedProfit,
        dailyBreakdown
      });
    }

    // Default Daily Response
    return res.json({
      period: "daily",
      date: start,
      grossSales: grossSalesVal,
      returns: returnsVal,
      expenses: totalExpenses,
      netSales: netSalesVal,
      discounts: discountsVal,
      cashCollected: totalCashCollected,
      chequeCollected: totalChequeCollected,
      netCashCollection,
      tripNo: "-",
      route: "-"
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to calculate daily closing report" });
  }
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

const getManagerDashboard = async (req, res) => {
  try {
    const now = new Date();
    
    // A. Parse Timeframe Period
    const period = req.query.period || "daily";
    let start, end;

    if (period === "monthly") {
      const monthStr = req.query.month || now.toISOString().slice(0, 7); // "YYYY-MM"
      const [year, monthVal] = monthStr.split("-").map(Number);
      start = new Date(year, monthVal - 1, 1);
      end = new Date(year, monthVal, 1);
    } else if (period === "mtd") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else {
      // Default to daily
      const dateParam = req.query.date;
      const date = dateParam ? new Date(dateParam) : now;
      start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    }

    const nearExpiryEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);

    // B. Query TripSession Documents Matching Timeframe
    const trips = await TripSession.find({
      startTime: { $gte: start, $lt: end }
    }).populate("rep", "name");

    const tripIds = trips.map((t) => t._id);

    // C. Drive transactions metrics strictly through the matching TripSessions
    const sales = tripIds.length > 0
      ? await Sale.find({
          tripId: { $in: tripIds },
          status: { $ne: "cancelled" }
        })
          .select("orderTotal returnTotal netTotal dueAmount paymentStatus items returns invoiceNo customer cashier createdAt")
          .populate("customer", "name")
          .populate("cashier", "name")
      : [];

    const payments = tripIds.length > 0
      ? await Payment.find({
          tripId: { $in: tripIds }
        })
          .sort({ createdAt: -1 })
          .populate("customer", "name")
          .populate("receivedBy", "name")
      : [];

    let grossSalesToday = 0;
    let returnsAdjustedToday = 0;
    let creditBillsToday = 0;

    sales.forEach((sale) => {
      grossSalesToday += sale.orderTotal || 0;
      returnsAdjustedToday += sale.returnTotal || 0;
      if (sale.dueAmount > 0 && ["credit", "partial"].includes(sale.paymentStatus)) {
        creditBillsToday += sale.dueAmount;
      }
    });

    const netSalesToday = grossSalesToday - returnsAdjustedToday;

    // Calculations for the 5 definitive trip-linked indicators
    // 1. Total Sales Value
    const totalSalesValue = netSalesToday;

    // 2. Total Cash Collected (cash + cheque from payments linked to matched trips)
    let cashCollection = 0;
    let chequeCollection = 0;
    payments.forEach((payment) => {
      const method = (payment.paymentMethod || "").toLowerCase();
      if (method === "cash") {
        cashCollection += payment.amount || 0;
      } else if (method === "cheque") {
        chequeCollection += payment.amount || 0;
      }
    });
    const totalCashCollected = cashCollection + chequeCollection;

    // 3. Total Pending Payments (market debt created during filtered trips that remains unpaid)
    const totalPendingPayments = creditBillsToday;

    // 4. Total Expenses (cumulative sum of expenses logged inside matching trip profiles)
    let totalExpenses = 0;
    trips.forEach((trip) => {
      (trip.expenses || []).forEach((e) => {
        totalExpenses += e.amount || 0;
      });
    });

    // 5. Net Cash Remaining (Total Cash Collected - Total Expenses)
    const netCashRemaining = totalCashCollected - totalExpenses;

    // Global dashboard indicators (non-trip scoped for customer risk & stock counts)
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

    // Bill collections split
    const allocationIds = new Set();
    payments.forEach((payment) => {
      (payment.allocations || []).forEach((allocation) => {
        if (allocation.invoice) {
          allocationIds.add(allocation.invoice.toString());
        }
      });
    });

    const allocatedSales = allocationIds.size > 0
      ? await Sale.find({ _id: { $in: [...allocationIds] } }).select("createdAt")
      : [];
    const saleDateMap = new Map(
      allocatedSales.map((sale) => [sale._id.toString(), sale.createdAt])
    );

    let todayBillCollection = 0;
    let oldCreditCollection = 0;
    let oldCreditCollectionMix = 0; // to keep old credit logic if needed

    payments.forEach((payment) => {
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
      // Mix paymentMix details
      const method = (payment.paymentMethod || "").toLowerCase();
      // If we calculate old credit collections inside payment mix, we check allocations too
      (payment.allocations || []).forEach((allocation) => {
        const invoiceId = allocation.invoice?.toString();
        const saleDate = invoiceId ? saleDateMap.get(invoiceId) : null;
        if (saleDate && (saleDate < start || saleDate >= end)) {
          oldCreditCollectionMix += allocation.allocatedAmount || 0;
        }
      });
    });

    const recentPayments = payments.slice(0, 5).map((payment) => ({
      paymentNo: payment.paymentNo,
      customer: payment.customer?.name || "Walk-in",
      amount: payment.amount,
      method: payment.paymentMethod,
      receivedBy: payment.receivedBy?.name || "-",
      createdAt: payment.createdAt
    }));

    const recentCreditBillsDocs = tripIds.length > 0
      ? await Sale.find({
          tripId: { $in: tripIds },
          dueAmount: { $gt: 0 },
          status: { $ne: "cancelled" }
        })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate("customer", "name")
          .populate("cashier", "name")
      : [];

    const recentCreditBills = recentCreditBillsDocs.map((sale) => ({
      invoiceNo: sale.invoiceNo,
      customer: sale.customer?.name || "Walk-in",
      netTotal: sale.netTotal,
      paidAmount: sale.paidAmount,
      dueAmount: sale.dueAmount,
      cashier: sale.cashier?.name || "-"
    }));

    // Returns mapping
    const saleIds = sales.map((s) => s._id);
    const recentReturnDocs = saleIds.length > 0
      ? await Return.find({ saleId: { $in: saleIds } })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate("customer", "name")
      : [];

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

    // Top selling items aggregation
    const itemMap = new Map();
    sales.forEach((sale) => {
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
      .sort((a, b) => b.netQtySold - a.netQtySold || b.netSalesAmount - a.netSalesAmount)
      .slice(0, 5);

    const salesVsCollectionData = [
      { name: "Gross Sales", value: grossSalesToday },
      { name: "Net Sales", value: netSalesToday },
      { name: "Total Collection", value: totalCashCollected }
    ];

    const paymentMix = {
      cashCollection,
      chequeCollection,
      creditBills: creditBillsToday,
      oldCreditCollection: oldCreditCollectionMix
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

    // Profitability metrics
    let profitToday = 0;
    sales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        (item.usedBatches || []).forEach((b) => {
          profitToday += (b.sellingLineTotal || 0) - (b.lineTotal || 0);
        });
      });
    });
    const profitMarginToday = grossSalesToday > 0 ? (profitToday / grossSalesToday) * 100 : 0;
    const creditExposureRatio = netSalesToday > 0 ? (creditBillsToday / netSalesToday) * 100 : 0;
    const returnSalesRatio = grossSalesToday > 0 ? (returnsAdjustedToday / grossSalesToday) * 100 : 0;

    // Real-time active trips & pending audits (always return current live status)
    const activeTrips = await TripSession.find({ status: "active" })
      .populate("rep", "name")
      .select("tripNo route expectedCollections startTime createdAt");

    const pendingAudits = await TripSession.find({ status: "pending_audit" })
      .populate("rep", "name")
      .select("tripNo route expectedCollections actualCollections varianceCollections startTime createdAt");

    // Stock valuations
    const stockValueData = await StockBatch.aggregate([
      { $match: { remainingQty: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalBillingValue: { $sum: { $multiply: ["$remainingQty", "$billingPrice"] } },
          totalSellingValue: { $sum: { $multiply: ["$remainingQty", "$sellingPrice"] } }
        }
      }
    ]);
    const totalInventoryBillingValue = stockValueData[0]?.totalBillingValue || 0;
    const totalInventorySellingValue = stockValueData[0]?.totalSellingValue || 0;

    // Expiry risk valuation
    const ninetyDaysEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 90);
    const expiryRiskData = await StockBatch.aggregate([
      { $match: { expiryDate: { $gte: start, $lte: ninetyDaysEnd }, remainingQty: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          valueExpiring30: {
            $sum: {
              $cond: [
                { $lte: ["$expiryDate", nearExpiryEnd] },
                { $multiply: ["$remainingQty", "$billingPrice"] },
                0
              ]
            }
          },
          valueExpiring90: {
            $sum: {
              $cond: [
                { $gt: ["$expiryDate", nearExpiryEnd] },
                { $multiply: ["$remainingQty", "$billingPrice"] },
                0
              ]
            }
          }
        }
      }
    ]);
    const expiryRiskExposure30 = expiryRiskData[0]?.valueExpiring30 || 0;
    const expiryRiskExposure90 = expiryRiskData[0]?.valueExpiring90 || 0;

    // Rep leaderboard for filtered trips
    const salesByRepAgg = tripIds.length > 0 ? await Sale.aggregate([
      { $match: { tripId: { $in: tripIds }, status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: "$cashier",
          netSales: { $sum: "$netTotal" }
        }
      }
    ]) : [];

    const paymentsByRepAgg = tripIds.length > 0 ? await Payment.aggregate([
      { $match: { tripId: { $in: tripIds } } },
      {
        $group: {
          _id: "$receivedBy",
          totalCollection: { $sum: "$amount" }
        }
      }
    ]) : [];

    const repStatsMap = new Map();

    salesByRepAgg.forEach((item) => {
      if (item._id) {
        const key = item._id.toString();
        repStatsMap.set(key, { repId: item._id, sales: item.netSales, collections: 0 });
      }
    });

    paymentsByRepAgg.forEach((item) => {
      if (item._id) {
        const key = item._id.toString();
        const existing = repStatsMap.get(key);
        if (existing) {
          existing.collections = item.totalCollection;
        } else {
          repStatsMap.set(key, { repId: item._id, sales: 0, collections: item.totalCollection });
        }
      }
    });

    const repIds = [...repStatsMap.keys()];
    const reps = await User.find({ _id: { $in: repIds } }).select("name");
    const repNameMap = new Map(reps.map((r) => [r._id.toString(), r.name]));

    const repLeaderboard = [...repStatsMap.values()]
      .map((stat) => ({
        name: repNameMap.get(stat.repId.toString()) || "Unknown",
        sales: stat.sales,
        collections: stat.collections
      }))
      .sort((a, b) => b.sales - a.sales || b.collections - a.collections);

    return res.json({
      grossSalesToday,
      returnsAdjustedToday,
      netSalesToday,
      totalCollectionToday: totalCashCollected,
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
      salesVsCollectionData,
      profitToday,
      profitMarginToday,
      creditExposureRatio,
      returnSalesRatio,
      activeTripsCount: activeTrips.length,
      activeTrips,
      pendingAuditsCount: pendingAudits.length,
      pendingAudits,
      totalInventoryBillingValue,
      totalInventorySellingValue,
      expiryRiskExposure30,
      expiryRiskExposure90,
      repLeaderboard,
      
      // New definitive trip-linked metric indicators
      totalSalesValue,
      totalCashCollected,
      totalPendingPayments,
      totalExpenses,
      netCashRemaining
    });
  } catch (err) {
    console.error("getManagerDashboard error:", err);
    return res.status(500).json({ message: err.message || "Failed to load dashboard metrics" });
  }
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
