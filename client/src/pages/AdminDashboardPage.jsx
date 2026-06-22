import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie
} from "recharts";
import api from "../api/client";

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;
const formatNumber = (value) => Number(value || 0).toLocaleString("en-LK");
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-LK") : "-";
const formatTime = (value) =>
  value ? new Date(value).toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" }) : "-";

/* ─── Premium Inline SVG Icons ────────────────────────────────────────── */
const Icons = {
  sales: (
    <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1" />
    </svg>
  ),
  cash: (
    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  pending: (
    <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  expenses: (
    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  netCash: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  globalDebt: (
    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5a2 2 0 10-2 2h2zm0 8h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  check: (
    <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  alert: (
    <svg className="w-5 h-5 text-clay" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
};

const AdminDashboardPage = () => {
  const [dashboard, setDashboard] = useState(null);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  // Period management states
  const [period, setPeriod] = useState("daily"); // daily, mtd, monthly
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Tabs states
  const [activeTab, setActiveTab] = useState("sales"); // sales, payments, returns
  const [activeChartTab, setActiveChartTab] = useState("revenue"); // revenue, payments, leaderboard

  // Roles overrides state for registration approvals
  const [selectedRoles, setSelectedRoles] = useState({});

  const loadDashboardData = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const params = { period };
      if (period === "daily") {
        params.date = selectedDate;
      } else if (period === "monthly") {
        params.month = selectedMonth;
      }

      const [dashRes, pendingUsersRes] = await Promise.all([
        api.get("/api/reports/manager-dashboard", {
          headers: { Authorization: `Bearer ${token}` },
          params
        }),
        api.get("/api/users/pending", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setDashboard(dashRes.data);
      setPendingUsers(pendingUsersRes.data || []);
      
      // Initialize roles draft map
      const initialRoles = {};
      (pendingUsersRes.data || []).forEach(u => {
        initialRoles[u._id] = u.role || "rep";
      });
      setSelectedRoles(initialRoles);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dashboard statistics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [period, selectedDate, selectedMonth]);

  // Handle access approvals directly on the dashboard
  const handleApproveUser = async (userId) => {
    setActionMessage("");
    try {
      const token = localStorage.getItem("token");
      const assignedRole = selectedRoles[userId] || "rep";
      await api.patch(
        `/api/users/${userId}/approve`,
        { role: assignedRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActionMessage("User access approved successfully.");
      await loadDashboardData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to approve user.");
    }
  };

  const handleRejectUser = async (userId) => {
    setActionMessage("");
    const reason = window.prompt("Enter rejection reason:", "");
    if (reason === null) return; // User cancelled prompt

    try {
      const token = localStorage.getItem("token");
      await api.patch(
        `/api/users/${userId}/reject`,
        { reason: reason || "Administrator rejected registration." },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActionMessage("User registration rejected.");
      await loadDashboardData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reject user.");
    }
  };

  // Derive metrics
  const tripMetrics = useMemo(() => {
    if (!dashboard) return { sales: 0, cash: 0, pending: 0, expenses: 0, netCash: 0 };
    return {
      sales: dashboard.totalSalesValue || 0,
      cash: dashboard.totalCashCollected || 0,
      pending: dashboard.totalPendingPayments || 0,
      expenses: dashboard.totalExpenses || 0,
      netCash: dashboard.netCashRemaining || 0
    };
  }, [dashboard]);

  const secondaryStats = useMemo(() => {
    if (!dashboard) return {};
    const totalSales = dashboard.totalSalesValue || 0;
    return {
      profit: totalSales * 0.18, // Fixed 18% standard company margin
      margin: 18,
      returns: dashboard.returnsAdjustedToday || 0,
      returnRatio: dashboard.returnSalesRatio || 0,
      lowStock: dashboard.lowStockCount || 0,
      nearExpiry: dashboard.nearExpiryCount || 0,
      outstanding: dashboard.totalOutstandingBalance || 0,
      stockBillingValue: dashboard.totalInventoryBillingValue || 0,
      stockSellingValue: dashboard.totalInventorySellingValue || 0,
      expiryRisk30: dashboard.expiryRiskExposure30 || 0,
      expiryRisk90: dashboard.expiryRiskExposure90 || 0
    };
  }, [dashboard]);

  // Graph formats
  const salesVsCollectionData = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.salesVsCollectionData || [];
  }, [dashboard]);

  const paymentMixPieData = useMemo(() => {
    if (!dashboard || !dashboard.paymentMix) return [];
    const mix = dashboard.paymentMix;
    return [
      { name: "Cash Collected", value: mix.cashCollection, color: "#0f766e" },
      { name: "Cheque Collected", value: mix.chequeCollection, color: "#6366f1" },
      { name: "Credit Invoices", value: mix.creditBills, color: "#f97316" },
      { name: "Old Credit Collected", value: mix.oldCreditCollection, color: "#a855f7" }
    ].filter(item => item.value > 0);
  }, [dashboard]);

  const topSellingData = useMemo(() => {
    if (!dashboard || !dashboard.topSellingItems) return [];
    return dashboard.topSellingItems.map(item => ({
      name: item.itemName || item.itemCode,
      revenue: item.netSalesAmount || 0,
      qty: item.netQtySold || 0
    }));
  }, [dashboard]);

  const leaderboardData = useMemo(() => {
    if (!dashboard || !dashboard.repLeaderboard) return [];
    return dashboard.repLeaderboard;
  }, [dashboard]);

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-ink border-t-transparent"></div>
          <p className="text-sm font-semibold text-ink/60">Assembling executive command console indicators...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6 pb-12">
      {/* ── HEADER PANEL & TIME WINDOW CONTROLLERS ──────────────────────────────── */}
      <div className="flex flex-col gap-6 rounded-3xl bg-white/90 p-6 shadow-sm border border-slatewash/40 md:flex-row md:items-center md:justify-between backdrop-blur-md">
        <div>
          <span className="rounded-full bg-amber-100 border border-amber-300 px-3 py-0.5 text-[10px] font-extrabold text-amber-800 tracking-wider inline-block">
            EXECUTIVE CONTROL UNIT
          </span>
          <h1 className="text-3xl font-extrabold text-ink tracking-tight mt-1.5">Hub Administration Center</h1>
          <p className="text-sm text-ink/60 mt-1">
            Core financial metrics, real-time route dispatches, stock expiration exposures, and pending authorizations.
          </p>
        </div>

        {/* Operational Timeframe Horizon Switchers */}
        <div className="flex flex-wrap items-center gap-3 bg-slatewash/20 p-2 rounded-2xl border border-slatewash/60">
          <div className="flex rounded-xl bg-slatewash/40 p-1">
            <button
              id="period-btn-daily"
              onClick={() => setPeriod("daily")}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                period === "daily" ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink"
              }`}
            >
              Daily (Live)
            </button>
            <button
              id="period-btn-mtd"
              onClick={() => setPeriod("mtd")}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                period === "mtd" ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink"
              }`}
            >
              MTD Progress
            </button>
            <button
              id="period-btn-monthly"
              onClick={() => setPeriod("monthly")}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                period === "monthly" ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink"
              }`}
            >
              Monthly Archival
            </button>
          </div>

          {/* Conditional Calendars */}
          {period === "daily" && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-ink/50 uppercase">Date:</span>
              <input
                id="date-picker-input"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-lg border border-slatewash/70 bg-white px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-ink"
              />
            </div>
          )}

          {period === "monthly" && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-ink/50 uppercase">Month:</span>
              <input
                id="month-picker-input"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-lg border border-slatewash/70 bg-white px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-ink"
              />
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-bold">Operational Error:</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {actionMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <p className="font-semibold">{actionMessage}</p>
        </div>
      )}

      {/* ── CORE FINANCIALS / EXECUTIVE METRIC INDICATORS ──────────────────────── */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
        
        {/* KPI 1: Net Sales */}
        <div className="group relative rounded-2xl bg-white p-5 shadow-sm border border-slatewash/50 transition duration-200 hover:shadow-md">
          <div className="absolute top-4 right-4 p-2 bg-indigo-50 rounded-xl text-indigo-600">
            {Icons.sales}
          </div>
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider block">Total Net Sales</span>
          <span className="text-lg font-black text-ink block mt-3 leading-none">
            {formatCurrency(tripMetrics.sales)}
          </span>
          <p className="text-[10px] text-ink/50 mt-3.5 leading-tight font-medium">
            Gross dispatches minus returned goods.
          </p>
        </div>

        {/* KPI 2: Collections */}
        <div className="group relative rounded-2xl bg-white p-5 shadow-sm border border-slatewash/50 transition duration-200 hover:shadow-md">
          <div className="absolute top-4 right-4 p-2 bg-emerald-50 rounded-xl text-emerald-600">
            {Icons.cash}
          </div>
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider block">Cash Collected</span>
          <span className="text-lg font-black text-emerald-800 block mt-3 leading-none">
            {formatCurrency(tripMetrics.cash)}
          </span>
          <p className="text-[10px] text-ink/50 mt-3.5 leading-tight font-medium">
            Cash + Cheque values in warehouse vault.
          </p>
        </div>

        {/* KPI 3: Current Debt Generated */}
        <div className="group relative rounded-2xl bg-white p-5 shadow-sm border border-slatewash/50 transition duration-200 hover:shadow-md">
          <div className="absolute top-4 right-4 p-2 bg-orange-50 rounded-xl text-orange-600">
            {Icons.pending}
          </div>
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider block">New Market Debt</span>
          <span className="text-lg font-black text-orange-700 block mt-3 leading-none">
            {formatCurrency(tripMetrics.pending)}
          </span>
          <p className="text-[10px] text-ink/50 mt-3.5 leading-tight font-medium">
            Unpaid invoices generated during window.
          </p>
        </div>

        {/* KPI 4: Disbursed Expenses */}
        <div className="group relative rounded-2xl bg-white p-5 shadow-sm border border-slatewash/50 transition duration-200 hover:shadow-md">
          <div className="absolute top-4 right-4 p-2 bg-red-50 rounded-xl text-red-600">
            {Icons.expenses}
          </div>
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider block">Trip Expenses</span>
          <span className="text-lg font-black text-red-600 block mt-3 leading-none">
            {formatCurrency(tripMetrics.expenses)}
          </span>
          <p className="text-[10px] text-ink/50 mt-3.5 leading-tight font-medium">
            Fuel, rep batta, and vehicle meal costs.
          </p>
        </div>

        {/* KPI 5: Net Cash Flow (SURPLUS / DEFICIT HERO CARD) */}
        <div
          className={`group relative rounded-2xl p-5 shadow-sm border transition duration-200 hover:shadow-md ${
            tripMetrics.netCash >= 0
              ? "bg-emerald-600 border-emerald-500 text-white shadow-emerald-50"
              : "bg-rose-600 border-rose-500 text-white shadow-rose-50 animate-pulse"
          }`}
        >
          <div className="absolute top-4 right-4 p-2 bg-white/20 rounded-xl text-white">
            {Icons.netCash}
          </div>
          <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wider block">Net Cash Flow</span>
          <span className="text-xl font-black block mt-3 leading-none tracking-tight">
            {formatCurrency(tripMetrics.netCash)}
          </span>
          <p className="text-[10px] text-white/70 mt-3.5 leading-tight font-medium">
            {tripMetrics.netCash >= 0 ? "Surplus operational cash" : "Deficit / negative cash warning"}
          </p>
        </div>

        {/* KPI 6: Global Outstanding Balance */}
        <div className="group relative rounded-2xl bg-white p-5 shadow-sm border border-slatewash/50 transition duration-200 hover:shadow-md">
          <div className="absolute top-4 right-4 p-2 bg-indigo-50 rounded-xl text-indigo-600">
            {Icons.globalDebt}
          </div>
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider block">Global Debt Risk</span>
          <span className="text-lg font-black text-indigo-900 block mt-3 leading-none">
            {formatCurrency(secondaryStats.outstanding)}
          </span>
          <p className="text-[10px] text-ink/50 mt-3.5 leading-tight font-medium">
            Total ledger outstanding in market.
          </p>
        </div>

      </div>

      {/* ── PENDING ACCESS APPROVALS QUEUE (ADMIN PRIVILEGE CONTROL) ─────────────── */}
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slatewash/50">
        <div className="flex items-center justify-between border-b border-slatewash pb-4">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-amber-50 rounded-xl text-amber-600">
              {Icons.users}
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink">Access Approvals Console</h2>
              <p className="text-xs text-ink/50 mt-0.5">Authorize registration applications and assign roles.</p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${
            pendingUsers.length > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
          }`}>
            {pendingUsers.length} Pending Actions
          </span>
        </div>

        <div className="mt-4">
          {pendingUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="text-[10px] uppercase text-ink/40 tracking-wider font-bold border-b border-slatewash">
                  <tr>
                    <th className="pb-3 pr-4">Applicant Name</th>
                    <th className="pb-3 pr-4">Email Address</th>
                    <th className="pb-3 pr-4">Requested Role</th>
                    <th className="pb-3 pr-4">Applied Date</th>
                    <th className="pb-3 pr-4">Assign Authorization Role</th>
                    <th className="pb-3 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slatewash">
                  {pendingUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-slatewash/10 transition-colors">
                      <td className="py-3.5 pr-4 font-bold text-ink">{user.name}</td>
                      <td className="py-3.5 pr-4 font-semibold text-ink/70">{user.email}</td>
                      <td className="py-3.5 pr-4">
                        <span className="rounded-full bg-slatewash px-2 py-0.5 font-bold uppercase text-[9px] text-ink/75">
                          Requested: {user.role}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 font-medium text-ink/60">{formatDate(user.createdAt)}</td>
                      <td className="py-3.5 pr-4">
                        <select
                          id={`role-select-${user._id}`}
                          className="rounded-lg border border-slatewash px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-ink"
                          value={selectedRoles[user._id] || "rep"}
                          onChange={(e) => setSelectedRoles({ ...selectedRoles, [user._id]: e.target.value })}
                        >
                          <option value="rep">Sales Representative</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                      <td className="py-3.5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            id={`btn-approve-${user._id}`}
                            onClick={() => handleApproveUser(user._id)}
                            className="rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-sand hover:bg-ink/80 transition shadow-sm"
                            type="button"
                          >
                            Approve
                          </button>
                          <button
                            id={`btn-reject-${user._id}`}
                            onClick={() => handleRejectUser(user._id)}
                            className="rounded-lg border border-ink/20 px-3 py-1.5 text-xs font-bold hover:bg-slatewash transition"
                            type="button"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-ink/50">
              <div className="p-3 bg-emerald-50 rounded-full mb-2">
                {Icons.check}
              </div>
              <p className="font-bold text-ink">All User Credentials Verified</p>
              <p className="text-[11px] text-ink/40 mt-0.5">No pending registration access applications awaiting audit.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── PRIMARY COLUMN GRID: VISUAL ANALYTICS & LIVE ROUTE MONITORING ────────── */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">

        {/* Left Card: Recharts Interactive Graphic Center */}
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slatewash/50 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slatewash pb-4">
            <div>
              <h2 className="text-lg font-bold text-ink">Analytical Command System</h2>
              <p className="text-xs text-ink/50 mt-0.5">Performance charts for collections, billing types, and sales reps.</p>
            </div>
            <div className="flex rounded-lg bg-slatewash/40 p-1">
              <button
                id="chart-tab-btn-revenue"
                onClick={() => setActiveChartTab("revenue")}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeChartTab === "revenue" ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink"
                }`}
              >
                Revenue Flow
              </button>
              <button
                id="chart-tab-btn-payments"
                onClick={() => setActiveChartTab("payments")}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeChartTab === "payments" ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink"
                }`}
              >
                Payment Mix
              </button>
              <button
                id="chart-tab-btn-leaderboard"
                onClick={() => setActiveChartTab("leaderboard")}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeChartTab === "leaderboard" ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink"
                }`}
              >
                Rep Leaderboard
              </button>
            </div>
          </div>

          <div className="h-72">
            {activeChartTab === "revenue" && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesVsCollectionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminColorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#0f172a" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#0f172a" }} />
                  <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }} />
                  <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2.5} fillOpacity={1} fill="url(#adminColorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {activeChartTab === "payments" && (
              <div className="grid h-full items-center gap-6 sm:grid-cols-2">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMixPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {paymentMixPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-ink/40 uppercase tracking-wider border-b border-slatewash pb-2">Collections Structure</h4>
                  {paymentMixPieData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                        <span className="font-semibold text-ink/80">{item.name}</span>
                      </div>
                      <span className="font-bold text-ink">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                  {paymentMixPieData.length === 0 && (
                    <p className="text-xs text-ink/50 italic py-4">No collections registered in current bounds.</p>
                  )}
                </div>
              </div>
            )}

            {activeChartTab === "leaderboard" && (
              <div className="h-full overflow-y-auto space-y-3 pr-2">
                <h4 className="text-xs font-bold text-ink/40 uppercase tracking-wider border-b border-slatewash pb-2">Top Performing Field Reps</h4>
                {leaderboardData.map((rep, idx) => (
                  <div key={rep.name} className="flex items-center justify-between rounded-xl border border-slatewash/50 p-3 bg-slatewash/10 hover:bg-slatewash/20 transition duration-150">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-bold text-sand shadow-sm">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-ink">{rep.name}</div>
                        <div className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Field Operations</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-ink"><span className="text-ink/50 text-[10px]">Net Sales:</span> {formatCurrency(rep.sales)}</div>
                      <div className="text-[11px] font-medium text-leaf"><span className="text-ink/40 text-[9px]">Collected:</span> {formatCurrency(rep.collections)}</div>
                    </div>
                  </div>
                ))}
                {leaderboardData.length === 0 && (
                  <div className="text-center py-12 text-xs text-ink/50 italic">
                    No active representatives registered sales in current bounds.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Card: Live Reps Route Tracking */}
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slatewash/50 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slatewash pb-4">
              <div>
                <h2 className="text-lg font-bold text-ink">Field Route Dispatches</h2>
                <p className="text-xs text-ink/50 mt-0.5">Currently active or pending audit reps on delivery routes.</p>
              </div>
              <span className="rounded-full bg-leaf/10 border border-leaf/30 px-2.5 py-0.5 text-[10px] font-bold text-leaf uppercase tracking-wider animate-pulse">
                {dashboard.activeTripsCount} In Field
              </span>
            </div>

            {/* Active dispatches list */}
            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              <h4 className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Active Representatives ({dashboard.activeTripsCount})</h4>
              
              {dashboard.activeTrips?.map((trip) => (
                <div key={trip.tripNo} className="rounded-xl border border-slatewash p-3.5 bg-slatewash/5 relative overflow-hidden">
                  <div className="absolute left-0 top-0 h-full w-1.5 bg-indigo-500"></div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-ink">{trip.tripNo}</span>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Active</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-ink/40 block text-[9px] uppercase tracking-wider">Route</span>
                      <span className="font-bold text-ink/80 truncate block">{trip.route}</span>
                    </div>
                    <div>
                      <span className="text-ink/40 block text-[9px] uppercase tracking-wider">Rep</span>
                      <span className="font-bold text-ink/80 truncate block">{trip.rep?.name}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slatewash/50 flex items-center justify-between text-xs">
                    <span className="text-ink/50">Expected collections:</span>
                    <span className="font-bold text-ink">{formatCurrency((trip.expectedCollections?.cash || 0) + (trip.expectedCollections?.cheque || 0))}</span>
                  </div>
                </div>
              ))}

              {dashboard.activeTrips?.length === 0 && (
                <div className="text-center py-6 text-xs text-ink/40 italic">
                  No representatives currently dispatched on field routes.
                </div>
              )}

              {/* Pending Audits */}
              {dashboard.pendingAuditsCount > 0 && (
                <>
                  <h4 className="text-[10px] font-bold text-clay uppercase tracking-wider mt-4">Awaiting Verification Audits ({dashboard.pendingAuditsCount})</h4>
                  {dashboard.pendingAudits?.map((trip) => {
                    const varianceTotal = (trip.varianceCollections?.cash || 0) + (trip.varianceCollections?.cheque || 0);
                    
                    return (
                      <Link to="/trips" key={trip.tripNo} className="block rounded-xl border border-clay/20 p-3.5 bg-clay/5 hover:bg-clay/10 transition relative">
                        <div className="absolute left-0 top-0 h-full w-1.5 bg-clay"></div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-ink">{trip.tripNo}</span>
                          <span className="text-[10px] font-bold text-clay bg-clay/15 px-2 py-0.5 rounded-full animate-pulse">Needs Audit</span>
                        </div>
                        <div className="mt-2 text-xs">
                          <div className="flex justify-between mt-1 text-ink/70">
                            <span>Rep: {trip.rep?.name}</span>
                            <span>Route: {trip.route}</span>
                          </div>
                          <div className="flex justify-between font-bold mt-2 pt-2 border-t border-slatewash/60">
                            <span className="text-ink/60">Audit Variance:</span>
                            <span className={varianceTotal < 0 ? "text-clay font-extrabold" : "text-leaf font-extrabold"}>
                              {formatCurrency(varianceTotal)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slatewash mt-4">
            <Link
              to="/trips"
              className="flex items-center justify-center rounded-xl bg-ink py-3 text-center text-xs font-bold text-sand hover:bg-ink/90 transition shadow-sm"
            >
              Manage Dispatch routes & Verify Audits
            </Link>
          </div>
        </div>

      </div>

      {/* ── ROW COLUMN: ASSET INVENTORY RISK AND TOP PRODUCTS ────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">

        {/* Left Side: Asset Inventory Risk Control Center */}
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slatewash/50 space-y-5">
          <div className="flex items-center justify-between border-b border-slatewash pb-4">
            <div>
              <h2 className="text-lg font-bold text-ink">Inventory & Asset Risk Control</h2>
              <p className="text-xs text-ink/50 mt-0.5">Physical asset valuations and expiration exposures.</p>
            </div>
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
              {secondaryStats.lowStock} Low Stock items
            </span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            
            {/* Capital Valuation Card */}
            <div className="rounded-2xl border border-slatewash/60 bg-slatewash/10 p-4 relative overflow-hidden">
              <span className="text-[9px] font-bold text-ink/40 uppercase tracking-widest block">Total Asset Valuation</span>
              <span className="text-2xl font-black text-ink mt-2 block leading-none">
                {formatCurrency(secondaryStats.stockBillingValue)}
              </span>
              <span className="text-xs text-ink/50 mt-2 block font-medium">
                Selling Valuation: {formatCurrency(secondaryStats.stockSellingValue)}
              </span>
              <div className="mt-4 pt-3.5 border-t border-slatewash/50 text-[11px] font-semibold text-leaf">
                Est. Unrealized Profit: {formatCurrency(secondaryStats.stockSellingValue - secondaryStats.stockBillingValue)}
              </div>
            </div>

            {/* Expiry Risk Exposure Timeline */}
            <div className="rounded-2xl border border-slatewash/60 bg-slatewash/10 p-4 space-y-3.5">
              <span className="text-[9px] font-bold text-ink/40 uppercase tracking-widest block">Expiration Exposure Timeline</span>
              
              <div className="space-y-2.5">
                <div>
                  <div className="flex justify-between text-xs font-bold text-ink/80">
                    <span>Critical (&lt; 30 Days)</span>
                    <span className="text-red-600">{formatCurrency(secondaryStats.expiryRisk30)}</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-slatewash">
                    <div
                      className="h-full rounded-full bg-red-500"
                      style={{
                        width: `${secondaryStats.stockBillingValue > 0 ? Math.min(100, (secondaryStats.expiryRisk30 / secondaryStats.stockBillingValue) * 100) : 0}%`
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-ink/80">
                    <span>Warning (31 - 90 Days)</span>
                    <span className="text-clay">{formatCurrency(secondaryStats.expiryRisk90)}</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-slatewash">
                    <div
                      className="h-full rounded-full bg-clay"
                      style={{
                        width: `${secondaryStats.stockBillingValue > 0 ? Math.min(100, (secondaryStats.expiryRisk90 / secondaryStats.stockBillingValue) * 100) : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Quick Warnings Tables */}
          <div className="grid gap-4 md:grid-cols-2 pt-2">
            
            {/* Low stock alerts */}
            <div className="rounded-2xl border border-slatewash/50 p-4 bg-white shadow-sm">
              <div className="flex justify-between items-center border-b border-slatewash/40 pb-2">
                <span className="text-xs font-bold text-ink/70 uppercase">Critical Low stock</span>
                <Link to="/products" className="text-[10px] text-clay font-bold hover:underline">Manage</Link>
              </div>
              <div className="mt-2.5 space-y-2 max-h-[150px] overflow-y-auto pr-1">
                {dashboard.topLowStockItems?.map((row) => (
                  <div key={row.itemCode} className="flex justify-between items-center text-xs">
                    <div className="truncate max-w-[150px]">
                      <span className="font-semibold block text-ink/80 truncate">{row.itemName}</span>
                      <span className="text-[9px] text-ink/40 font-mono block leading-none">{row.itemCode}</span>
                    </div>
                    <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full text-[10px]">
                      {row.currentStock} / {row.reorderLevel}
                    </span>
                  </div>
                ))}
                {dashboard.topLowStockItems?.length === 0 && (
                  <p className="text-xs text-ink/40 italic py-4 text-center">All products fully stocked.</p>
                )}
              </div>
            </div>

            {/* Near Expiry Batches */}
            <div className="rounded-2xl border border-slatewash/50 p-4 bg-white shadow-sm">
              <div className="flex justify-between items-center border-b border-slatewash/40 pb-2">
                <span className="text-xs font-bold text-ink/70 uppercase">Expiring Batches</span>
                <Link to="/stock/batches" className="text-[10px] text-indigo-500 font-bold hover:underline">Manage</Link>
              </div>
              <div className="mt-2.5 space-y-2 max-h-[150px] overflow-y-auto pr-1">
                {dashboard.nearExpiryBatches?.map((row) => (
                  <div key={row.batchNo} className="flex justify-between items-center text-xs">
                    <div>
                      <span className="font-semibold block text-ink/80 truncate max-w-[130px]">{row.itemName}</span>
                      <span className="text-[9px] text-ink/40 font-mono block leading-none">Batch: {row.batchNo}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-ink block">{row.remainingQty} units</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider block ${row.daysLeft <= 10 ? "text-red-500 animate-pulse" : "text-clay"}`}>
                        {row.daysLeft} days left
                      </span>
                    </div>
                  </div>
                ))}
                {dashboard.nearExpiryBatches?.length === 0 && (
                  <p className="text-xs text-ink/40 italic py-4 text-center">No batches near expiration.</p>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Right Side: Top Selling Products */}
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slatewash/50 space-y-4">
          <div className="flex items-center justify-between border-b border-slatewash pb-4">
            <div>
              <h2 className="text-lg font-bold text-ink">Volume Leaderboard</h2>
              <p className="text-xs text-ink/50 mt-0.5">Top-selling inventory items sold in period.</p>
            </div>
            <span className="p-1.5 bg-indigo-50 rounded-lg shrink-0 text-indigo-600">
              {Icons.sales}
            </span>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {topSellingData.map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between rounded-xl border border-slatewash/50 p-3 bg-slatewash/10 hover:bg-slatewash/20 transition duration-150">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-bold text-sand shadow-sm">
                    #{idx + 1}
                  </span>
                  <div className="max-w-[140px]">
                    <div className="text-xs font-bold text-ink truncate block">{item.name}</div>
                    <div className="text-[10px] text-ink/40 font-semibold">{item.qty} units sold</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-ink">{formatCurrency(item.revenue)}</div>
                  <div className="text-[9px] font-bold text-leaf uppercase tracking-wider mt-0.5">Gross Revenue</div>
                </div>
              </div>
            ))}
            {topSellingData.length === 0 && (
              <div className="text-center py-12 text-xs text-ink/50 italic">
                No inventory volumes recorded.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── SYSTEM SHORTCUTS / ADMINISTRATIVE QUICK ACTIONS ────────────────────── */}
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slatewash/50">
        <h2 className="text-sm font-bold text-ink/70 uppercase tracking-wider border-b border-slatewash pb-3">Administrative Action Shortcuts</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-5">
          <Link
            to="/stock/add"
            className="flex flex-col items-center justify-center rounded-2xl border border-slatewash p-4 text-center hover:bg-slatewash/10 hover:border-slatewash transition group"
          >
            <span className="text-xs font-bold text-ink group-hover:text-leaf transition">Receive Stock Batch</span>
            <span className="text-[10px] text-ink/50 mt-1">Record new intake batches</span>
          </Link>
          <Link
            to="/products"
            className="flex flex-col items-center justify-center rounded-2xl border border-slatewash p-4 text-center hover:bg-slatewash/10 hover:border-slatewash transition group"
          >
            <span className="text-xs font-bold text-ink group-hover:text-leaf transition">Manage Products</span>
            <span className="text-[10px] text-ink/50 mt-1">Configure pricing & SKUs</span>
          </Link>
          <Link
            to="/payments"
            className="flex flex-col items-center justify-center rounded-2xl border border-slatewash p-4 text-center hover:bg-slatewash/10 hover:border-slatewash transition group"
          >
            <span className="text-xs font-bold text-ink group-hover:text-leaf transition">Record Collections</span>
            <span className="text-[10px] text-ink/50 mt-1">Allocate field payments</span>
          </Link>
          <Link
            to="/users"
            className="flex flex-col items-center justify-center rounded-2xl border border-slatewash p-4 text-center hover:bg-slatewash/10 hover:border-slatewash transition group"
          >
            <span className="text-xs font-bold text-ink group-hover:text-leaf transition">User Administration</span>
            <span className="text-[10px] text-ink/50 mt-1">Approved users & roles</span>
          </Link>
          <Link
            to="/reports/daily-closing"
            className="flex flex-col items-center justify-center rounded-2xl border border-slatewash p-4 text-center hover:bg-slatewash/10 hover:border-slatewash transition group"
          >
            <span className="text-xs font-bold text-ink group-hover:text-leaf transition">Run Daily Closing</span>
            <span className="text-[10px] text-ink/50 mt-1">Verify daily operations</span>
          </Link>
        </div>
      </div>

      {/* ── TRANSACTION LEDGERS / DETAIL AUDIT TABS ────────────────────────────── */}
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slatewash/50 space-y-4">
        
        {/* Tab Headers */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slatewash pb-3">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "sales", label: "Credit Exposure Bills", count: dashboard.recentCreditBills?.length || 0 },
              { id: "payments", label: "Recent Collections", count: dashboard.recentPayments?.length || 0 },
              { id: "returns", label: "Returns Audits", count: dashboard.recentReturns?.length || 0 }
            ].map((tab) => (
              <button
                id={`ledger-tab-btn-${tab.id}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-4 py-2 text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "bg-ink text-sand shadow-sm"
                    : "bg-slatewash/30 text-ink/70 hover:bg-slatewash/60"
                }`}
                type="button"
              >
                <span>{tab.label}</span>
                <span className={`h-4.5 min-w-4.5 px-1.5 inline-flex items-center justify-center rounded-full text-[9px] font-extrabold uppercase ${
                  activeTab === tab.id ? "bg-clay text-sand" : "bg-slatewash text-ink/60"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          <span className="text-xs text-ink/40 font-semibold uppercase">Daily operations logs</span>
        </div>

        {/* Tab Content Tables */}
        <div className="overflow-x-auto">
          {activeTab === "sales" && (
            <table className="min-w-full text-left text-xs">
              <thead className="text-[10px] uppercase text-ink/40 tracking-wider font-bold border-b border-slatewash">
                <tr>
                  <th className="pb-3 pr-4">Invoice No</th>
                  <th className="pb-3 pr-4">Customer Name</th>
                  <th className="pb-3 pr-4">Net Total</th>
                  <th className="pb-3 pr-4">Paid Amount</th>
                  <th className="pb-3 pr-4">Outstanding Due</th>
                  <th className="pb-3">Responsible cashier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slatewash">
                {dashboard.recentCreditBills?.map((row) => (
                  <tr key={row.invoiceNo} className="hover:bg-slatewash/10 transition-colors">
                    <td className="py-3 pr-4 font-bold text-ink">
                      <Link to={`/invoices/${row.invoiceNo}`} className="hover:underline">{row.invoiceNo}</Link>
                    </td>
                    <td className="py-3 pr-4 font-semibold text-ink/80">{row.customer}</td>
                    <td className="py-3 pr-4 font-bold text-ink">{formatCurrency(row.netTotal)}</td>
                    <td className="py-3 pr-4 font-semibold text-leaf">{formatCurrency(row.paidAmount)}</td>
                    <td className="py-3 pr-4 font-black text-clay">{formatCurrency(row.dueAmount)}</td>
                    <td className="py-3 text-ink/60 font-medium">{row.cashier}</td>
                  </tr>
                ))}
                {dashboard.recentCreditBills?.length === 0 && (
                  <tr>
                    <td className="py-8 text-center text-ink/40 font-medium" colSpan="6">
                      No unpaid credit bills generated in matching period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === "payments" && (
            <table className="min-w-full text-left text-xs">
              <thead className="text-[10px] uppercase text-ink/40 tracking-wider font-bold border-b border-slatewash">
                <tr>
                  <th className="pb-3 pr-4">Receipt No</th>
                  <th className="pb-3 pr-4">Customer Name</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">Payment Method</th>
                  <th className="pb-3 pr-4">Received By</th>
                  <th className="pb-3">Collection Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slatewash">
                {dashboard.recentPayments?.map((row) => (
                  <tr key={row.paymentNo} className="hover:bg-slatewash/10 transition-colors">
                    <td className="py-3 pr-4 font-bold text-ink">{row.paymentNo}</td>
                    <td className="py-3 pr-4 font-semibold text-ink/80">{row.customer}</td>
                    <td className="py-3 pr-4 font-black text-leaf">{formatCurrency(row.amount)}</td>
                    <td className="py-3 pr-4 font-bold uppercase text-[10px] text-ink/50">{row.method}</td>
                    <td className="py-3 pr-4 font-medium text-ink/60">{row.receivedBy}</td>
                    <td className="py-3 text-ink/60 font-semibold">{formatTime(row.createdAt)}</td>
                  </tr>
                ))}
                {dashboard.recentPayments?.length === 0 && (
                  <tr>
                    <td className="py-8 text-center text-ink/40 font-medium" colSpan="6">
                      No collections recorded in matching period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === "returns" && (
            <table className="min-w-full text-left text-xs">
              <thead className="text-[10px] uppercase text-ink/40 tracking-wider font-bold border-b border-slatewash">
                <tr>
                  <th className="pb-3 pr-4">Return Receipt</th>
                  <th className="pb-3 pr-4">Customer Name</th>
                  <th className="pb-3 pr-4">Item details</th>
                  <th className="pb-3 pr-4">Quantity</th>
                  <th className="pb-3 pr-4">Returned Amount</th>
                  <th className="pb-3">Stock Condition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slatewash">
                {dashboard.recentReturns?.map((row) => (
                  <tr key={`${row.returnNo}-${row.item}`} className="hover:bg-slatewash/10 transition-colors">
                    <td className="py-3 pr-4 font-bold text-ink">{row.returnNo}</td>
                    <td className="py-3 pr-4 font-semibold text-ink/80">{row.customer}</td>
                    <td className="py-3 pr-4 font-semibold text-ink">{row.item}</td>
                    <td className="py-3 pr-4 font-bold text-ink">{row.qty}</td>
                    <td className="py-3 pr-4 font-black text-red-600">{formatCurrency(row.returnAmount)}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase
                        ${row.condition === "resellable" ? "bg-leaf/10 text-leaf" : "bg-clay/10 text-clay"}`}>
                        {row.condition}
                      </span>
                    </td>
                  </tr>
                ))}
                {dashboard.recentReturns?.length === 0 && (
                  <tr>
                    <td className="py-8 text-center text-ink/40 font-medium" colSpan="6">
                      No returned stock items logged in matching period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </section>
  );
};

export default AdminDashboardPage;
