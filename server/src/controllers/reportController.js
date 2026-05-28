const Sale = require("../models/Sale");

const getDailyClosing = async (req, res) => {
  const dateParam = req.query.date;
  const date = dateParam ? new Date(dateParam) : new Date();
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

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

const getMonthlySales = async (_req, res) => {
  return res.status(501).json({ message: "Monthly sales report not implemented" });
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

module.exports = {
  getDailyClosing,
  getMonthlySales,
  getItemWise,
  getCustomerWise,
  getCreditOutstanding,
  getPaymentCollections
};
