import { useEffect, useMemo, useState, useRef } from "react";
import api from "../api/client";

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

const DailyClosingPage = () => {
  const [period, setPeriod] = useState("daily"); // "daily" | "monthly"
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [selectedMonth, setSelectedMonth] = useState(() =>
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );
  
  const [summary, setSummary] = useState(null);
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isRep = useMemo(() => localStorage.getItem("role") === "rep", []);

  const [activeTrip, setActiveTrip] = useState(null);
  const [expenseReason, setExpenseReason] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseSaving, setExpenseSaving] = useState(false);

  const reasonInputRef = useRef(null);
  const amountInputRef = useRef(null);

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadData = async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
    }
    setError("");
    try {
      const params = isRep
        ? {} // Rep is locked to active trip session metrics
        : period === "monthly"
        ? { period: "monthly", month: selectedMonth }
        : { period: "daily", date: selectedDate };

      const promises = [
        api.get("/api/reports/daily-closing", {
          headers: authHeader,
          params
        }),
        api.get("/api/sales", { headers: authHeader }),
        api.get("/api/payments", { headers: authHeader }),
        api.get("/api/orders", { headers: authHeader })
      ];

      if (isRep) {
        promises.push(api.get("/api/trips/active", { headers: authHeader }));
      }

      const results = await Promise.all(promises);

      setSummary(results[0].data || null);
      setSales(results[1].data || []);
      setPayments(results[2].data || []);
      setOrders(results[3].data || []);

      if (isRep) {
        setActiveTrip(results[4]?.data || null);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load periodical closing data");
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseReason.trim() || !expenseAmount || Number(expenseAmount) <= 0) {
      setError("Please enter a valid reason and amount.");
      return;
    }

    setExpenseSaving(true);
    setError("");
    try {
      const res = await api.post(
        "/api/trips/active/expenses",
        { reason: expenseReason, amount: Number(expenseAmount) },
        { headers: authHeader }
      );
      setActiveTrip(res.data || null);
      setExpenseReason("");
      setExpenseAmount("");
      reasonInputRef.current?.focus();
      // Auto-update dashboard metrics in background
      await loadData(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add expense");
    } finally {
      setExpenseSaving(false);
    }
  };

  const handleDeleteExpense = async (index) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) {
      return;
    }

    try {
      const res = await api.delete(`/api/trips/active/expenses/${index}`, { headers: authHeader });
      setActiveTrip(res.data || null);
      // Auto-update dashboard metrics in background
      await loadData(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete expense");
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedMonth, period]);

  const dateRange = useMemo(() => {
    if (period === "monthly" && !isRep) {
      const [year, monthVal] = selectedMonth.split("-").map(Number);
      const start = new Date(year, monthVal - 1, 1);
      const end = new Date(year, monthVal, 0, 23, 59, 59, 999);
      return { start, end };
    }
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [selectedDate, selectedMonth, period, isRep]);

  const salesFiltered = useMemo(
    () => {
      if (isRep) return sales;
      return sales.filter((sale) => {
        const created = new Date(sale.createdAt);
        return created >= dateRange.start && created <= dateRange.end;
      });
    },
    [sales, dateRange, isRep]
  );

  const activeSalesFiltered = useMemo(
    () => salesFiltered.filter((sale) => sale.status !== "cancelled"),
    [salesFiltered]
  );

  const cancelledSalesFiltered = useMemo(
    () => salesFiltered.filter((sale) => sale.status === "cancelled"),
    [salesFiltered]
  );

  const paymentsFiltered = useMemo(
    () => {
      if (isRep) return payments;
      return payments.filter((payment) => {
        const created = new Date(payment.createdAt);
        return created >= dateRange.start && created <= dateRange.end;
      });
    },
    [payments, dateRange, isRep]
  );

  const pendingOrdersFiltered = useMemo(
    () => {
      if (isRep) {
        return orders.filter((order) => order.orderStatus === "pending_delivery");
      }
      return orders.filter((order) => {
        const created = new Date(order.createdAt);
        return (
          created >= dateRange.start &&
          created <= dateRange.end &&
          order.orderStatus === "pending_delivery"
        );
      });
    },
    [orders, dateRange, isRep]
  );

  // Grouped payments for dashboard sub-aggregates
  const cashCollection = useMemo(
    () =>
      paymentsFiltered
        .filter((payment) => payment.paymentMethod === "cash")
        .reduce((sum, payment) => sum + (payment.amount || 0), 0),
    [paymentsFiltered]
  );

  const chequeCollection = useMemo(
    () =>
      paymentsFiltered
        .filter((payment) => payment.paymentMethod === "cheque")
        .reduce((sum, payment) => sum + (payment.amount || 0), 0),
    [paymentsFiltered]
  );

  const topSales = useMemo(() => activeSalesFiltered.slice(0, 10), [activeSalesFiltered]);
  const topPayments = useMemo(() => paymentsFiltered.slice(0, 10), [paymentsFiltered]);

  return (
    <section className="space-y-6">
      {/* Page Header and Audit Swapper */}
      <div className="rounded-2xl bg-white/80 p-6 shadow">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Periodical Closing Dashboard</h1>
            <p className="text-ink/60">
              {isRep
                ? "Active trip session sales, collections, and expenses."
                : `Audit financial logs for the selected ${period === "daily" ? "day" : "month"}.`}
            </p>
          </div>

          {isRep ? (
            <div className="rounded-full bg-leaf/10 border border-leaf/30 px-4 py-2 text-xs font-semibold text-leaf animate-pulse">
              Active Trip Session Metrics
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {/* Tab Selector */}
              <div className="flex rounded-xl bg-slatewash/40 p-1">
                <button
                  type="button"
                  onClick={() => setPeriod("daily")}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                    period === "daily" ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink"
                  }`}
                >
                  Daily Audit
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod("monthly")}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                    period === "monthly" ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink"
                  }`}
                >
                  Monthly Audit
                </button>
              </div>

              {/* Date/Month Input */}
              {period === "daily" ? (
                <input
                  className="rounded-lg border border-slatewash px-3 py-1.5 text-sm bg-white font-medium text-ink focus:outline-none"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              ) : (
                <input
                  className="rounded-lg border border-slatewash px-3 py-1.5 text-sm bg-white font-medium text-ink focus:outline-none"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl bg-white/80 p-8 text-center text-sm text-ink/60 shadow">
          Loading closing details...
        </div>
      ) : (
        <>
          {/* KPI Dashboard Cards Grid */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 transition hover:shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink/50">
                {period === "daily" ? "Gross Sales" : "Monthly Gross"}
              </div>
              <div className="mt-2 text-2xl font-bold text-ink">
                {formatCurrency(summary?.grossSales || 0)}
              </div>
              <div className="mt-1 text-xs text-ink/60">
                {summary?.archivedRevenue > 0 ? "Includes archives" : `${activeSalesFiltered.length} bills`}
              </div>
            </div>

            <div className="rounded-2xl bg-white/90 p-5 shadow border border-clay/10 transition hover:shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-clay/70">Returns</div>
              <div className="mt-2 text-2xl font-bold text-clay">
                {formatCurrency(summary?.returns || 0)}
              </div>
              <div className="mt-1 text-xs text-ink/60">Deducted total</div>
            </div>

            <div className="rounded-2xl bg-white/90 p-5 shadow border border-amber-500/10 transition hover:shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600/80">Discounts</div>
              <div className="mt-2 text-2xl font-bold text-amber-600">
                {formatCurrency(summary?.discounts || 0)}
              </div>
              <div className="mt-1 text-xs text-ink/60">Granted</div>
            </div>

            <div className="rounded-2xl bg-white/90 p-5 shadow border border-clay/15 transition hover:shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-clay/80">Expenses</div>
              <div className="mt-2 text-2xl font-bold text-clay">
                {formatCurrency(summary?.expenses || 0)}
              </div>
              <div className="mt-1 text-xs text-ink/60">Trip disbursements</div>
            </div>

            <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 transition hover:shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink/50">Net Sales</div>
              <div className="mt-2 text-2xl font-bold text-ink">
                {formatCurrency(summary?.netSales || 0)}
              </div>
              <div className="mt-1 text-xs text-ink/60">Gross - Ret - Disc</div>
            </div>

            <div className="rounded-2xl bg-leaf/10 p-5 shadow border border-leaf/20 transition hover:shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-leaf/80">Net Cash Collection</div>
              <div className="mt-2 text-2xl font-extrabold text-leaf">
                {formatCurrency(summary?.netCashCollection || 0)}
              </div>
              <div className="mt-1 text-xs text-leaf/60 font-medium">Cash - Expenses</div>
            </div>
          </div>

          {/* Archived Notification Banner */}
          {!isRep && period === "monthly" && summary?.archivedRevenue > 0 && (
            <div className="rounded-2xl border border-leaf/30 bg-leaf/5 px-4 py-3 text-xs text-leaf font-medium">
              💡 This audit includes <strong>{formatCurrency(summary.archivedRevenue)}</strong> in archived revenue
              from the End-of-Month Cleanup of paid invoices for <strong>{selectedMonth}</strong>, keeping your monthly records consistent.
            </div>
          )}

          {/* Tab Specific Content views */}
          {period === "daily" || isRep ? (
            /* DAILY LOG VIEW DETAILS */
            <>
              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40">
                  <div className="flex items-center justify-between border-b border-slatewash pb-3">
                    <div className="text-sm font-bold text-ink uppercase tracking-wider">Sales Invoices</div>
                    <span className="text-xs text-ink/60">{activeSalesFiltered.length} records</span>
                  </div>
                  <div className="mt-4 space-y-2 max-h-[26rem] overflow-y-auto pr-1">
                    {topSales.map((sale) => (
                      <div key={sale._id} className="rounded-xl bg-slatewash/60 p-3 text-sm transition hover:bg-slatewash/80">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-ink">{sale.invoiceNo}</div>
                            <div className="text-xs text-ink/50">
                              {sale.customer?.name || "Walk-in"} • {new Date(sale.createdAt).toLocaleTimeString("en-LK", { hour: "numeric", minute: "2-digit" })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-ink">{formatCurrency(sale.netTotal)}</div>
                            <span className={`inline-block mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                              sale.paymentStatus === "paid" ? "bg-leaf/10 text-leaf" : "bg-amber-100 text-amber-800"
                            }`}>
                              {sale.paymentStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {topSales.length === 0 && (
                      <div className="text-sm text-ink/65 py-4 text-center">No sales recorded.</div>
                    )}
                  </div>
                  {cancelledSalesFiltered.length > 0 && (
                    <div className="mt-4 rounded-xl border border-clay/30 bg-clay/10 px-3 py-2 text-xs text-clay">
                      ⚠️ {cancelledSalesFiltered.length} cancelled invoice(s) recorded in this period.
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40">
                  <div className="flex items-center justify-between border-b border-slatewash pb-3">
                    <div className="text-sm font-bold text-ink uppercase tracking-wider">Collections Received</div>
                    <span className="text-xs font-bold text-leaf">
                      Cash: {formatCurrency(cashCollection)} • Cheque: {formatCurrency(chequeCollection)}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 max-h-[26rem] overflow-y-auto pr-1">
                    {topPayments.map((payment) => (
                      <div key={payment._id} className="rounded-xl bg-slatewash/60 p-3 text-sm transition hover:bg-slatewash/80">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-ink">{payment.paymentNo}</div>
                            <div className="text-xs text-ink/50">
                              {payment.customer?.name || "Walk-in"} • {payment.paymentMethod.toUpperCase()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-ink">{formatCurrency(payment.amount)}</div>
                            <div className="text-xs text-ink/50">
                              {new Date(payment.createdAt).toLocaleTimeString("en-LK", { hour: "numeric", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {topPayments.length === 0 && (
                      <div className="text-sm text-ink/65 py-4 text-center">No collections recorded.</div>
                    )}
                  </div>
                </div>
              </div>

              {isRep && activeTrip && (
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="md:col-span-2 rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 space-y-4">
                    <div className="flex items-center justify-between border-b border-slatewash pb-3">
                      <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Trip Expenses</h3>
                      <span className="text-xs font-bold text-clay">
                        Total: {formatCurrency((activeTrip.expenses || []).reduce((sum, exp) => sum + exp.amount, 0))}
                      </span>
                    </div>
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {(activeTrip.expenses || []).map((exp, index) => (
                        <div key={index} className="flex items-center justify-between rounded-xl bg-slatewash/60 p-3 text-sm">
                          <div className="font-semibold text-ink">{exp.reason}</div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-clay">{formatCurrency(exp.amount)}</span>
                            <button
                              type="button"
                              className="text-clay/60 hover:text-clay text-xs font-semibold"
                              onClick={() => handleDeleteExpense(index)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                      {(activeTrip.expenses || []).length === 0 && (
                        <div className="text-sm text-ink/60 py-2">No expenses added to this trip session.</div>
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleAddExpense} className="md:col-span-1 rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 space-y-4">
                    <div className="border-b border-slatewash pb-3">
                      <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Add Expense</h3>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] text-ink/50 uppercase font-bold tracking-wider">Reason</label>
                        <input
                          ref={reasonInputRef}
                          className="mt-1 w-full rounded-lg border border-slatewash px-3 py-2 text-sm focus:ring-1 focus:ring-ink focus:outline-none"
                          placeholder="e.g. Fuel, Tea, Parking"
                          value={expenseReason}
                          onChange={(e) => setExpenseReason(e.target.value)}
                          required
                        />
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {["Fuel", "Food/Tea", "Parking", "Toll", "Misc"].map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                setExpenseReason(tag);
                                amountInputRef.current?.focus();
                              }}
                              className="rounded-full bg-slatewash/80 px-2 py-0.5 text-[9px] text-ink/70 hover:bg-slatewash hover:text-ink transition border border-slatewash/50 font-semibold"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-ink/50 uppercase font-bold tracking-wider">Amount (Rs.)</label>
                        <input
                          ref={amountInputRef}
                          className="mt-1 w-full rounded-lg border border-slatewash px-3 py-2 text-sm focus:ring-1 focus:ring-ink focus:outline-none"
                          type="number"
                          min="0.01"
                          step="any"
                          placeholder="e.g. 1500"
                          value={expenseAmount}
                          onChange={(e) => setExpenseAmount(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={expenseSaving}
                      className="w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-sand hover:bg-ink/90 transition disabled:opacity-60 shadow-sm"
                    >
                      {expenseSaving ? "Adding..." : "Add Expense"}
                    </button>
                  </form>
                </div>
              )}
            </>
          ) : (
            /* MONTHLY BUSINESS AUDIT VIEW DETAILS */
            <div className="space-y-6">
              {/* Payment Methods and Scope Metadata Card */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 space-y-4">
                  <h3 className="text-sm font-bold text-ink uppercase tracking-wider border-b border-slatewash pb-2">
                    Monthly Collections Split
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slatewash/50 p-4 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-ink/40 tracking-wider">Cash Collected</span>
                      <div className="text-xl font-bold text-ink mt-1">
                        {formatCurrency(summary?.cashCollected || 0)}
                      </div>
                    </div>
                    <div className="bg-slatewash/50 p-4 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-ink/40 tracking-wider">Cheque Collected</span>
                      <div className="text-xl font-bold text-ink mt-1">
                        {formatCurrency(summary?.chequeCollected || 0)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-ink/50 leading-relaxed pt-1">
                    Sum total collections from cash payments and route cheque collections. Triangulate these against variance checks in trip sessions.
                  </div>
                </div>

                <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 space-y-4">
                  <h3 className="text-sm font-bold text-ink uppercase tracking-wider border-b border-slatewash pb-2">
                    Monthly Trip Audits
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slatewash/50 p-4 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-ink/40 tracking-wider">Total Trips Run</span>
                      <div className="text-xl font-bold text-ink mt-1">
                        {summary?.tripsCount || 0} Trips
                      </div>
                    </div>
                    <div className="bg-slatewash/50 p-4 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-ink/40 tracking-wider">Archive Month</span>
                      <div className="text-xl font-bold text-ink mt-1">
                        {selectedMonth}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-ink/50 leading-relaxed pt-1">
                    Rep trip sessions submitted, variance reconciled, and finalized during this month. Check individual trip logs in Trip Sessions tab if details required.
                  </div>
                </div>
              </div>

              {/* DAILY FINANCIAL LOG BREAKDOWN TABLE */}
              <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 space-y-4">
                <h3 className="text-sm font-bold text-ink uppercase tracking-wider border-b border-slatewash pb-2">
                  Daily Financial breakdown log
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b-2 border-slatewash bg-slatewash/30 text-ink/60 font-bold">
                        <th className="p-3">Date</th>
                        <th className="p-3 text-right">Gross Sales</th>
                        <th className="p-3 text-right">Returns</th>
                        <th className="p-3 text-right">Discounts</th>
                        <th className="p-3 text-right">Net Sales</th>
                        <th className="p-3 text-right">Cash Collected</th>
                        <th className="p-3 text-right">Cheque Collected</th>
                        <th className="p-3 text-right">Expenses</th>
                        <th className="p-3 text-right">Net Cash Flow</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slatewash">
                      {(summary?.dailyBreakdown || []).map((row) => {
                        const hasActivity =
                          row.grossSales > 0 ||
                          row.returns > 0 ||
                          row.cashCollected > 0 ||
                          row.expenses > 0;

                        return (
                          <tr
                            key={row.date}
                            className={`hover:bg-slatewash/20 transition ${
                              !hasActivity ? "text-ink/30 opacity-70 bg-slatewash/5" : "text-ink/85 font-medium"
                            }`}
                          >
                            <td className="p-3 font-semibold font-mono">{row.date}</td>
                            <td className="p-3 text-right">{formatCurrency(row.grossSales)}</td>
                            <td className="p-3 text-right text-clay font-medium">{formatCurrency(row.returns)}</td>
                            <td className="p-3 text-right text-amber-600">{formatCurrency(row.discounts)}</td>
                            <td className="p-3 text-right font-bold">{formatCurrency(row.netSales)}</td>
                            <td className="p-3 text-right text-leaf font-medium">{formatCurrency(row.cashCollected)}</td>
                            <td className="p-3 text-right text-indigo-700">{formatCurrency(row.chequeCollected)}</td>
                            <td className="p-3 text-right text-clay">{formatCurrency(row.expenses)}</td>
                            <td className={`p-3 text-right font-bold ${row.netCashCollection >= 0 ? "text-leaf" : "text-clay"}`}>
                              {formatCurrency(row.netCashCollection)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slatewash bg-slatewash/40 font-bold text-ink text-right">
                        <td className="p-3 text-left">Monthly Sum:</td>
                        <td className="p-3">{formatCurrency(summary?.grossSales || 0)}</td>
                        <td className="p-3 text-clay">{formatCurrency(summary?.returns || 0)}</td>
                        <td className="p-3 text-amber-600">{formatCurrency(summary?.discounts || 0)}</td>
                        <td className="p-3 font-extrabold">{formatCurrency(summary?.netSales || 0)}</td>
                        <td className="p-3 text-leaf">{formatCurrency(summary?.cashCollected || 0)}</td>
                        <td className="p-3 text-indigo-700">{formatCurrency(summary?.chequeCollected || 0)}</td>
                        <td className="p-3 text-clay">{formatCurrency(summary?.expenses || 0)}</td>
                        <td className={`p-3 font-extrabold ${summary?.netCashCollection >= 0 ? "text-leaf" : "text-clay"}`}>
                          {formatCurrency(summary?.netCashCollection || 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default DailyClosingPage;
