import { useEffect, useMemo, useState, useRef } from "react";
import api from "../api/client";

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-LK") : "-");

const DailyClosingPage = () => {
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
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
      const promises = [
        api.get("/api/reports/daily-closing", {
          headers: authHeader,
          params: { date: selectedDate }
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
      setError(err.response?.data?.message || "Failed to load daily closing data");
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
  }, [selectedDate]);

  const dateRange = useMemo(() => {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [selectedDate]);

  const salesToday = useMemo(
    () => {
      if (isRep) return sales;
      return sales.filter((sale) => {
        const created = new Date(sale.createdAt);
        return created >= dateRange.start && created <= dateRange.end;
      });
    },
    [sales, dateRange, isRep]
  );

  const activeSalesToday = useMemo(
    () => salesToday.filter((sale) => sale.status !== "cancelled"),
    [salesToday]
  );

  const cancelledSalesToday = useMemo(
    () => salesToday.filter((sale) => sale.status === "cancelled"),
    [salesToday]
  );

  const paymentsToday = useMemo(
    () => {
      if (isRep) return payments;
      return payments.filter((payment) => {
        const created = new Date(payment.createdAt);
        return created >= dateRange.start && created <= dateRange.end;
      });
    },
    [payments, dateRange, isRep]
  );

  const pendingOrdersToday = useMemo(
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

  const cashCollection = useMemo(
    () =>
      paymentsToday
        .filter((payment) => payment.paymentMethod === "cash")
        .reduce((sum, payment) => sum + (payment.amount || 0), 0),
    [paymentsToday]
  );

  const chequeCollection = useMemo(
    () =>
      paymentsToday
        .filter((payment) => payment.paymentMethod === "cheque")
        .reduce((sum, payment) => sum + (payment.amount || 0), 0),
    [paymentsToday]
  );

  const creditDueToday = useMemo(
    () =>
      activeSalesToday
        .filter((sale) => sale.dueAmount > 0)
        .reduce((sum, sale) => sum + (sale.dueAmount || 0), 0),
    [activeSalesToday]
  );

  const topSales = useMemo(() => activeSalesToday.slice(0, 6), [activeSalesToday]);
  const topPayments = useMemo(() => paymentsToday.slice(0, 6), [paymentsToday]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white/80 p-6 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Daily Closing</h1>
            <p className="text-ink/60">Daily sales, returns, collections, and pending deliveries.</p>
          </div>
          {isRep ? (
            <div className="rounded-full bg-leaf/10 border border-leaf/30 px-4 py-2 text-xs font-semibold text-leaf animate-pulse">
              Active Trip Session Metrics
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <label className="text-xs text-ink/60">Date</label>
              <input
                className="rounded-lg border border-slatewash px-3 py-2 text-sm"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
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
        <div className="rounded-2xl bg-white/80 p-6 text-sm text-ink/60 shadow">
          Loading daily closing...
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {/* Gross Sales Card */}
            <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 transition hover:shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink/50">Gross Sales</div>
              <div className="mt-2 text-2xl font-bold text-ink">
                {formatCurrency(summary?.grossSales || 0)}
              </div>
              <div className="mt-1 text-xs text-ink/60">{activeSalesToday.length} bills</div>
            </div>

            {/* Returns Card */}
            <div className="rounded-2xl bg-white/90 p-5 shadow border border-clay/10 transition hover:shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-clay/70">Returns</div>
              <div className="mt-2 text-2xl font-bold text-clay">
                {formatCurrency(summary?.returns || 0)}
              </div>
              <div className="mt-1 text-xs text-ink/60">Adjusted</div>
            </div>

            {/* Discounts Card */}
            <div className="rounded-2xl bg-white/90 p-5 shadow border border-amber-500/10 transition hover:shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600/80">Discounts</div>
              <div className="mt-2 text-2xl font-bold text-amber-600">
                {formatCurrency(summary?.discounts || 0)}
              </div>
              <div className="mt-1 text-xs text-ink/60">Granted</div>
            </div>

            {/* Expenses Card */}
            <div className="rounded-2xl bg-white/90 p-5 shadow border border-clay/15 transition hover:shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-clay/80">Expenses</div>
              <div className="mt-2 text-2xl font-bold text-clay">
                {formatCurrency(summary?.expenses || 0)}
              </div>
              <div className="mt-1 text-xs text-ink/60">Trip Expenses</div>
            </div>

            {/* Net Sales Card */}
            <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 transition hover:shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink/50">Net Sales</div>
              <div className="mt-2 text-2xl font-bold text-ink">
                {formatCurrency(summary?.netSales || 0)}
              </div>
              <div className="mt-1 text-xs text-ink/60">Gross - Ret - Disc</div>
            </div>

            {/* Net Cash Collection Card */}
            <div className="rounded-2xl bg-leaf/10 p-5 shadow border border-leaf/20 transition hover:shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-leaf/80">Net Cash Collection</div>
              <div className="mt-2 text-2xl font-extrabold text-leaf">
                {formatCurrency(summary?.netCashCollection || 0)}
              </div>
              <div className="mt-1 text-xs text-leaf/60 font-medium">Cash - Expenses</div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Sales Summary</div>
                <span className="text-xs text-ink/60">{activeSalesToday.length} sales</span>
              </div>
              <div className="mt-4 space-y-2">
                {topSales.map((sale) => (
                  <div key={sale._id} className="rounded-xl bg-slatewash/60 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{sale.invoiceNo}</div>
                        <div className="text-xs text-ink/60">
                          {sale.customer?.name || "Walk-in"} - {formatDate(sale.createdAt)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(sale.netTotal)}</div>
                        <div className="text-xs text-ink/60">{sale.paymentStatus}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {topSales.length === 0 && (
                  <div className="text-sm text-ink/60">No sales recorded.</div>
                )}
              </div>
              {cancelledSalesToday.length > 0 && (
                <div className="mt-4 rounded-xl border border-clay/30 bg-clay/10 px-3 py-2 text-xs text-clay">
                  {cancelledSalesToday.length} cancelled sales recorded today.
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Collections Summary</div>
                <span className="text-xs font-semibold text-leaf">
                  Total: {formatCurrency(cashCollection + chequeCollection)}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {topPayments.map((payment) => (
                  <div key={payment._id} className="rounded-xl bg-slatewash/60 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{payment.paymentNo}</div>
                        <div className="text-xs text-ink/60">
                          {payment.customer?.name || "Walk-in"} - {payment.paymentMethod}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(payment.amount)}</div>
                        <div className="text-xs text-ink/60">{formatDate(payment.createdAt)}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {topPayments.length === 0 && (
                  <div className="text-sm text-ink/60">No collections recorded.</div>
                )}
              </div>
            </div>
          </div>

          {isRep && activeTrip && (
            <div className="grid gap-6 md:grid-cols-3">
              {/* Left/Middle: Expenses List (Takes 2 cols) */}
              <div className="md:col-span-2 rounded-2xl bg-white/90 p-5 shadow space-y-4">
                <div className="flex items-center justify-between border-b border-slatewash pb-3">
                  <h3 className="text-sm font-semibold text-ink uppercase tracking-wider">Trip Expenses</h3>
                  <span className="text-xs text-ink/60">
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

              {/* Right Sidebar: Add Expense Form (Takes 1 col) */}
              <form onSubmit={handleAddExpense} className="md:col-span-1 rounded-2xl bg-white/90 p-5 shadow space-y-4">
                <div className="border-b border-slatewash pb-3">
                  <h3 className="text-sm font-semibold text-ink uppercase tracking-wider">Add Expense</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-ink/60 uppercase font-semibold">Reason</label>
                    <input
                      ref={reasonInputRef}
                      className="mt-1 w-full rounded-lg border border-slatewash px-3 py-2 text-sm focus:ring-1 focus:ring-ink focus:outline-none"
                      placeholder="e.g. Fuel, Tea, Parking"
                      value={expenseReason}
                      onChange={(e) => setExpenseReason(e.target.value)}
                      required
                    />
                    {/* Quick Tags for fast input */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {["Fuel", "Food/Tea", "Parking", "Toll", "Misc"].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setExpenseReason(tag);
                            amountInputRef.current?.focus();
                          }}
                          className="rounded-full bg-slatewash/80 px-2 py-0.5 text-[10px] text-ink/70 hover:bg-slatewash hover:text-ink transition border border-slatewash/50 font-medium"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-ink/60 uppercase font-semibold">Price / Amount (Rs.)</label>
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
      )}
    </section>
  );
};

export default DailyClosingPage;
