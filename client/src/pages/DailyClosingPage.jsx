import { useEffect, useMemo, useState } from "react";
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

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, salesRes, paymentsRes, ordersRes] = await Promise.all([
        api.get("/api/reports/daily-closing", {
          headers: authHeader,
          params: { date: selectedDate }
        }),
        api.get("/api/sales", { headers: authHeader }),
        api.get("/api/payments", { headers: authHeader }),
        api.get("/api/orders", { headers: authHeader })
      ]);

      setSummary(summaryRes.data || null);
      setSales(salesRes.data || []);
      setPayments(paymentsRes.data || []);
      setOrders(ordersRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load daily closing data");
    } finally {
      setLoading(false);
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
    () =>
      sales.filter((sale) => {
        const created = new Date(sale.createdAt);
        return created >= dateRange.start && created <= dateRange.end;
      }),
    [sales, dateRange]
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
    () =>
      payments.filter((payment) => {
        const created = new Date(payment.createdAt);
        return created >= dateRange.start && created <= dateRange.end;
      }),
    [payments, dateRange]
  );

  const pendingOrdersToday = useMemo(
    () =>
      orders.filter((order) => {
        const created = new Date(order.createdAt);
        return (
          created >= dateRange.start &&
          created <= dateRange.end &&
          order.orderStatus === "pending_delivery"
        );
      }),
    [orders, dateRange]
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
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink/60">Date</label>
            <input
              className="rounded-lg border border-slatewash px-3 py-2 text-sm"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </div>
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="text-xs uppercase text-ink/60">Gross Sales</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatCurrency(summary?.grossSales || 0)}
              </div>
              <div className="mt-1 text-xs text-ink/60">{activeSalesToday.length} bills</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="text-xs uppercase text-ink/60">Returns</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatCurrency(summary?.returnsAdjusted || 0)}
              </div>
              <div className="mt-1 text-xs text-ink/60">Adjusted</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="text-xs uppercase text-ink/60">Net Sales</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatCurrency(summary?.netSales || 0)}
              </div>
              <div className="mt-1 text-xs text-ink/60">After returns</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="text-xs uppercase text-ink/60">Total Collection</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatCurrency(cashCollection + chequeCollection)}
              </div>
              <div className="mt-1 text-xs text-ink/60">Cash + Cheque</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="text-xs uppercase text-ink/60">Cash Collection</div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(cashCollection)}</div>
              <div className="mt-1 text-xs text-ink/60">Cash receipts</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="text-xs uppercase text-ink/60">Cheque Collection</div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(chequeCollection)}</div>
              <div className="mt-1 text-xs text-ink/60">Cheque receipts</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="text-xs uppercase text-ink/60">Credit Due</div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(creditDueToday)}</div>
              <div className="mt-1 text-xs text-ink/60">Unpaid bills</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="text-xs uppercase text-ink/60">Pending Delivery</div>
              <div className="mt-2 text-2xl font-semibold">{pendingOrdersToday.length}</div>
              <div className="mt-1 text-xs text-ink/60">Orders not delivered</div>
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
                <span className="text-xs text-ink/60">{paymentsToday.length} receipts</span>
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
        </>
      )}
    </section>
  );
};

export default DailyClosingPage;
