const Sale = require("../models/Sale");
const MonthlySalesSnapshot = require("../models/MonthlySalesSnapshot");
const { createSaleFromPayload } = require("../services/salesService");
const TripSession = require("../models/TripSession");
const Customer = require("../models/Customer");
const Payment = require("../models/Payment");

const createSale = async (req, res) => {
  const {
    items = [],
    returns = [],
    discount = 0,
    paidAmount = 0,
    paymentMethod = "cash",
    customer,
    saleType = "walk-in"
  } = req.body;

  try {
    // 1. Check if the current user has an active trip session
    const activeTrip = await TripSession.findOne({
      rep: req.user?._id,
      status: "active"
    });

    // 2. Create the sale with the active trip ID associated
    const sale = await createSaleFromPayload({
      items,
      returns,
      discount,
      paidAmount,
      paymentMethod,
      customer,
      saleType,
      cashierId: req.user?._id,
      tripId: activeTrip ? activeTrip._id : undefined
    });

    const netCollected = sale.paidAmount - (sale.balance || 0);

    // 3. Update customer outstanding balance if a customer is selected
    if (customer) {
      // If it has due amount, increase outstanding balance
      if (sale.dueAmount > 0) {
        await Customer.findByIdAndUpdate(customer, {
          $inc: { outstandingBalance: sale.dueAmount }
        });
      }

      // If a payment is collected at POS, record it as a Payment transaction
      if (netCollected > 0) {
        const payment = await Payment.create({
          paymentNo: `PAY-${Date.now()}`,
          customer,
          amount: netCollected,
          paymentMethod,
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
        }
      }
    }

    // 4. Update expected collections on the active trip
    if (activeTrip && netCollected > 0) {
      if (paymentMethod === "cash") {
        activeTrip.expectedCollections.cash = (activeTrip.expectedCollections.cash || 0) + netCollected;
      } else if (paymentMethod === "cheque") {
        activeTrip.expectedCollections.cheque = (activeTrip.expectedCollections.cheque || 0) + netCollected;
      }
      await activeTrip.save();
    }

    return res.status(201).json(sale);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Failed to complete sale" });
  }
};

const listSales = async (req, res) => {
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

  const sales = await Sale.find(filter)
    .populate("customer", "name")
    .populate("cashier", "name")
    .sort({ createdAt: -1 });
  return res.json(sales);
};

const getSale = async (req, res) => {
  const sale = await Sale.findById(req.params.id);
  if (!sale) {
    return res.status(404).json({ message: "Sale not found" });
  }
  return res.json(sale);
};

const getSaleByInvoice = async (req, res) => {
  const sale = await Sale.findOne({ invoiceNo: req.params.invoiceNo });
  if (!sale) {
    return res.status(404).json({ message: "Sale not found" });
  }
  return res.json(sale);
};

const cancelSale = async (req, res) => {
  const sale = await Sale.findByIdAndUpdate(
    req.params.id,
    { status: "cancelled", paymentStatus: "cancelled" },
    { new: true }
  );
  if (!sale) {
    return res.status(404).json({ message: "Sale not found" });
  }
  return res.json(sale);
};

const getSalePdf = async (_req, res) => {
  return res.status(501).json({ message: "PDF generation not implemented" });
};

/**
 * DELETE /api/sales/tablet-cleanup
 *
 * End-of-Month Cleanup – 3 sequential steps:
 *
 * Step A  Aggregate revenue + profit from paid invoices older than 30 days,
 *         grouped by calendar month.
 *
 * Step B  Upsert those totals into MonthlySalesSnapshot (addToSet so repeated
 *         cleanups in the same month safely accumulate, not overwrite).
 *
 * Step C  Delete those exact invoices from the Sale collection.
 *         Credit / partial / cancelled invoices are NEVER touched.
 */
const tabletCleanup = async (req, res) => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);  // older than 30 days

    // ── Step A: Aggregate ─────────────────────────────────────────────────
    // Group paid sales by YYYY-MM and sum revenue + profit.
    // Profit = sum of (sellingLineTotal - lineTotal) across all batch records.
    const monthlyAgg = await Sale.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          status: { $ne: "cancelled" },
          createdAt: { $lt: cutoff }
        }
      },
      {
        $project: {
          month: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          netTotal: 1,
          // profit per sale = sum(sellingLineTotal) – sum(lineTotal) across items
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
          totalRevenue: { $sum: "$netTotal" },
          totalProfit: { $sum: "$saleProfit" },
          invoiceCount: { $sum: 1 }
        }
      }
    ]);

    if (monthlyAgg.length === 0) {
      return res.json({
        message: "No paid invoices older than 30 days found. Nothing to clean up.",
        deletedCount: 0
      });
    }

    // ── Step B: Upsert into MonthlySalesSnapshot ──────────────────────────
    // Use $inc so multiple cleanups in the same month safely accumulate.
    const upsertOps = monthlyAgg.map((row) => ({
      updateOne: {
        filter: { month: row._id },
        update: {
          $inc: {
            totalRevenue: row.totalRevenue,
            totalProfit: row.totalProfit,
            invoiceCount: row.invoiceCount
          }
        },
        upsert: true
      }
    }));

    await MonthlySalesSnapshot.bulkWrite(upsertOps);

    // ── Step C: Delete only those exact paid invoices ─────────────────────
    const { deletedCount } = await Sale.deleteMany({
      paymentStatus: "paid",
      status: { $ne: "cancelled" },
      createdAt: { $lt: cutoff }
    });

    return res.json({
      message: `Cleanup complete. ${deletedCount} paid invoice(s) archived and removed.`,
      deletedCount,
      monthsArchived: monthlyAgg.map((r) => r._id)
    });
  } catch (err) {
    console.error("tabletCleanup error:", err);
    return res.status(500).json({ message: err.message || "Cleanup failed" });
  }
};

module.exports = {
  createSale,
  listSales,
  getSale,
  getSaleByInvoice,
  cancelSale,
  getSalePdf,
  tabletCleanup
};
