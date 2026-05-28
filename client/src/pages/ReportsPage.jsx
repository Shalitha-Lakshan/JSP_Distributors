import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString("en-LK") : "-";

const toDateInput = (value) => value.toISOString().slice(0, 10);

const startOfDay = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const endOfDay = (value) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate() + 1);

const ReportsPage = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState(toDateInput(new Date()));
  const [dateTo, setDateTo] = useState(toDateInput(new Date()));

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const role = useMemo(() => localStorage.getItem("role") || "cashier", []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [salesRes, ordersRes, paymentsRes] = await Promise.all([
          api.get("/api/sales", {
            headers: authHeader,
            params: role === "cashier" ? { mine: "true" } : undefined
          }),
          api.get("/api/orders", {
            headers: authHeader,
            params: role === "cashier" ? { mine: "true" } : undefined
          }),
          api.get("/api/payments", { headers: authHeader })
        ]);
        setSales(salesRes.data || []);
        setOrders(ordersRes.data || []);
        setPayments(paymentsRes.data || []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load report data");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [role]);

  const range = useMemo(() => {
    const from = startOfDay(new Date(dateFrom));
    const to = endOfDay(new Date(dateTo));
    return { from, to };
  }, [dateFrom, dateTo]);

  const inRange = (dateValue) => {
    if (!dateValue) {
      return false;
    }
    const date = new Date(dateValue);
    return date >= range.from && date < range.to;
  };

  const salesInRange = useMemo(
    () => sales.filter((sale) => inRange(sale.createdAt)),
    [sales, range]
  );

  const ordersInRange = useMemo(
    () => orders.filter((order) => inRange(order.createdAt)),
    [orders, range]
  );

  const paymentsInRange = useMemo(
    () => payments.filter((payment) => inRange(payment.createdAt)),
    [payments, range]
  );

  const activeSales = useMemo(
    () => salesInRange.filter((sale) => sale.status !== "cancelled"),
    [salesInRange]
  );

  const cancelledSales = useMemo(
    () => salesInRange.filter((sale) => sale.status === "cancelled"),
    [salesInRange]
  );

  const pendingOrders = useMemo(
    () => ordersInRange.filter((order) => order.orderStatus === "pending_delivery"),
    [ordersInRange]
  );

  const cancelledOrders = useMemo(
    () => ordersInRange.filter((order) => order.orderStatus === "cancelled"),
    [ordersInRange]
  );

  const returnsRows = useMemo(() => {
    const rows = [];
    activeSales.forEach((sale) => {
      (sale.returns || []).forEach((item) => {
        rows.push({
          saleId: sale._id,
          invoiceNo: sale.invoiceNo,
          customer: sale.customer?.name || "Walk-in",
          item: item.itemName,
          qty: item.quantity,
          returnAmount: item.returnTotal,
          condition: item.condition
        });
      });
    });
    return rows;
  }, [activeSales]);

  const creditBills = useMemo(
    () =>
      activeSales.filter(
        (sale) =>
          sale.dueAmount > 0 && ["credit", "partial"].includes(sale.paymentStatus)
      ),
    [activeSales]
  );

  const totals = useMemo(() => {
    const grossSales = activeSales.reduce((sum, sale) => sum + (sale.orderTotal || 0), 0);
    const returnsTotal = activeSales.reduce((sum, sale) => sum + (sale.returnTotal || 0), 0);
    const netSales = activeSales.reduce((sum, sale) => sum + (sale.netTotal || 0), 0);
    const collectionTotal = paymentsInRange.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0
    );
    const creditDue = creditBills.reduce((sum, sale) => sum + (sale.dueAmount || 0), 0);
    const pendingTotal = pendingOrders.reduce(
      (sum, order) => sum + (order.netTotal || order.orderTotal || 0),
      0
    );

    return {
      grossSales,
      returnsTotal,
      netSales,
      collectionTotal,
      creditDue,
      pendingTotal,
      salesCount: activeSales.length,
      returnCount: returnsRows.length,
      creditCount: creditBills.length,
      pendingCount: pendingOrders.length,
      cancelledCount: cancelledSales.length + cancelledOrders.length
    };
  }, [activeSales, paymentsInRange, creditBills, pendingOrders, returnsRows, cancelledSales, cancelledOrders]);

  const setQuickRange = (days) => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - days);
    setDateFrom(toDateInput(from));
    setDateTo(toDateInput(today));
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white/80 p-6 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Sales Report</h1>
            <p className="text-ink/60">
              Daily performance with sales, returns, collections, credit and delivery status.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="rounded-lg border border-slatewash px-3 py-2 text-sm"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
            <span className="text-sm text-ink/60">to</span>
            <input
              className="rounded-lg border border-slatewash px-3 py-2 text-sm"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold"
                type="button"
                onClick={() => setQuickRange(0)}
              >
                Today
              </button>
              <button
                className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold"
                type="button"
                onClick={() => setQuickRange(1)}
              >
                Last 2 days
              </button>
              <button
                className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold"
                type="button"
                onClick={() => setQuickRange(6)}
              >
                Last 7 days
              </button>
              <button
                className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold"
                type="button"
                onClick={() => setQuickRange(29)}
              >
                Last 30 days
              </button>
            </div>
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
          Loading report data...
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="text-xs uppercase text-ink/60">Gross Sales</div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.grossSales)}</div>
              <div className="mt-1 text-xs text-ink/60">{totals.salesCount} bills</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="text-xs uppercase text-ink/60">Returns</div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.returnsTotal)}</div>
              <div className="mt-1 text-xs text-ink/60">{totals.returnCount} items</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="text-xs uppercase text-ink/60">Net Sales</div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.netSales)}</div>
              <div className="mt-1 text-xs text-ink/60">After returns</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="text-xs uppercase text-ink/60">Collections</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatCurrency(totals.collectionTotal)}
              </div>
              <div className="mt-1 text-xs text-ink/60">Payments received</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="text-xs uppercase text-ink/60">Credit Bills</div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.creditDue)}</div>
              <div className="mt-1 text-xs text-ink/60">{totals.creditCount} invoices</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="text-xs uppercase text-ink/60">Pending Delivery</div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.pendingTotal)}</div>
              <div className="mt-1 text-xs text-ink/60">{totals.pendingCount} orders</div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Sales</div>
                <span className="text-xs text-ink/60">{activeSales.length} records</span>
              </div>
              <div className="mt-4 space-y-2">
                {activeSales.slice(0, 8).map((sale) => (
                  <div key={sale._id} className="rounded-xl bg-slatewash/60 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{sale.invoiceNo}</div>
                        <div className="text-xs text-ink/60">
                          {sale.customer?.name || "Walk-in"} - {formatDateTime(sale.createdAt)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(sale.netTotal)}</div>
                        <div className="text-xs text-ink/60">{sale.paymentStatus}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold"
                        type="button"
                        onClick={() => navigate(`/invoices/${sale.invoiceNo}`)}
                      >
                        View
                      </button>
                      <button
                        className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-sand"
                        type="button"
                        onClick={() => navigate(`/invoices/${sale.invoiceNo}`)}
                      >
                        Print
                      </button>
                    </div>
                  </div>
                ))}
                {activeSales.length === 0 && (
                  <div className="text-sm text-ink/60">No sales recorded.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Returns</div>
                <span className="text-xs text-ink/60">{returnsRows.length} items</span>
              </div>
              <div className="mt-4 space-y-2">
                {returnsRows.slice(0, 8).map((row, index) => (
                  <div key={`${row.invoiceNo}-${index}`} className="rounded-xl bg-slatewash/60 p-3 text-sm">
                    <div className="font-semibold">{row.item}</div>
                    <div className="mt-1 text-xs text-ink/60">
                      {row.customer} - {row.qty} units - {row.condition}
                    </div>
                    <div className="mt-2 text-sm font-semibold">
                      {formatCurrency(row.returnAmount)}
                    </div>
                  </div>
                ))}
                {returnsRows.length === 0 && (
                  <div className="text-sm text-ink/60">No returns recorded.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Collections</div>
                <span className="text-xs text-ink/60">{paymentsInRange.length} receipts</span>
              </div>
              <div className="mt-4 space-y-2">
                {paymentsInRange.slice(0, 8).map((payment) => (
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
                        <div className="text-xs text-ink/60">
                          {formatDateTime(payment.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-ink/60">
                      Received by: {payment.receivedBy?.name || "-"}
                    </div>
                  </div>
                ))}
                {paymentsInRange.length === 0 && (
                  <div className="text-sm text-ink/60">No collections recorded.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Credit Bills</div>
                <span className="text-xs text-ink/60">{creditBills.length} invoices</span>
              </div>
              <div className="mt-4 space-y-2">
                {creditBills.slice(0, 8).map((sale) => (
                  <div key={sale._id} className="rounded-xl bg-slatewash/60 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{sale.invoiceNo}</div>
                        <div className="text-xs text-ink/60">
                          {sale.customer?.name || "Walk-in"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(sale.dueAmount)}</div>
                        <div className="text-xs text-ink/60">{sale.paymentStatus}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-ink/60">
                      Net: {formatCurrency(sale.netTotal)} - Paid: {formatCurrency(sale.paidAmount)}
                    </div>
                  </div>
                ))}
                {creditBills.length === 0 && (
                  <div className="text-sm text-ink/60">No credit bills found.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Pending Delivery</div>
                <span className="text-xs text-ink/60">{pendingOrders.length} orders</span>
              </div>
              <div className="mt-4 space-y-2">
                {pendingOrders.slice(0, 8).map((order) => (
                  <div key={order._id} className="rounded-xl bg-slatewash/60 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{order.orderNo}</div>
                        <div className="text-xs text-ink/60">
                          {order.customer?.name || "Walk-in"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatCurrency(order.netTotal || order.orderTotal)}
                        </div>
                        <div className="text-xs text-ink/60">{formatDateTime(order.createdAt)}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {pendingOrders.length === 0 && (
                  <div className="text-sm text-ink/60">No pending deliveries.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Cancelled</div>
                <span className="text-xs text-ink/60">{totals.cancelledCount} records</span>
              </div>
              <div className="mt-4 space-y-2">
                {cancelledSales.slice(0, 4).map((sale) => (
                  <div key={sale._id} className="rounded-xl bg-slatewash/60 p-3 text-sm">
                    <div className="font-semibold">Sale - {sale.invoiceNo}</div>
                    <div className="text-xs text-ink/60">
                      {sale.customer?.name || "Walk-in"} - {formatDateTime(sale.createdAt)}
                    </div>
                  </div>
                ))}
                {cancelledOrders.slice(0, 4).map((order) => (
                  <div key={order._id} className="rounded-xl bg-slatewash/60 p-3 text-sm">
                    <div className="font-semibold">Order - {order.orderNo}</div>
                    <div className="text-xs text-ink/60">
                      {order.customer?.name || "Walk-in"} - {formatDateTime(order.createdAt)}
                    </div>
                  </div>
                ))}
                {cancelledSales.length === 0 && cancelledOrders.length === 0 && (
                  <div className="text-sm text-ink/60">No cancelled records.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default ReportsPage;
