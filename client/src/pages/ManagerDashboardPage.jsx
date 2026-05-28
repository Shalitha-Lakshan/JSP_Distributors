import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";
import api from "../api/client";

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;
const formatNumber = (value) => Number(value || 0).toLocaleString("en-LK");
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-LK") : "-";
const formatTime = (value) =>
  value ? new Date(value).toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" }) : "-";

const ManagerDashboardPage = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("token");
        const { data } = await api.get("/api/reports/manager-dashboard", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setDashboard(data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const summaryCards = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return [
      { label: "Gross Sales", value: formatCurrency(dashboard.grossSalesToday) },
      { label: "Returns", value: formatCurrency(dashboard.returnsAdjustedToday) },
      { label: "Net Sales", value: formatCurrency(dashboard.netSalesToday) },
      { label: "Total Collection", value: formatCurrency(dashboard.totalCollectionToday) },
      { label: "Credit Bills", value: formatCurrency(dashboard.creditBillsToday) },
      { label: "Outstanding Balance", value: formatCurrency(dashboard.totalOutstandingBalance) }
    ];
  }, [dashboard]);

  const inventorySignals = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return [
      {
        title: "Low Stock Items",
        value: formatNumber(dashboard.lowStockCount),
        link: "/products?filter=low-stock"
      },
      {
        title: "Near Expiry Batches",
        value: formatNumber(dashboard.nearExpiryCount),
        link: "/stock-batches?filter=near-expiry"
      },
      {
        title: "Stock Added Today",
        value: formatNumber(dashboard.stockAddedToday?.quantity),
        subtitle: `${formatNumber(dashboard.stockAddedToday?.batches)} batches`,
        link: "/stock/add"
      }
    ];
  }, [dashboard]);

  const salesVsCollectionData =
    dashboard?.salesVsCollectionData?.map((item) => ({
      name: item.name,
      value: Number(item.value || 0)
    })) || [];

  const paymentMixData = dashboard
    ? [
        { name: "Cash", value: dashboard.paymentMix?.cashCollection || 0 },
        { name: "Cheque", value: dashboard.paymentMix?.chequeCollection || 0 },
        { name: "Credit Bills", value: dashboard.paymentMix?.creditBills || 0 },
        { name: "Old Credit", value: dashboard.paymentMix?.oldCreditCollection || 0 }
      ]
    : [];

  const topSellingData =
    dashboard?.topSellingItems?.map((item) => ({
      name: item.itemName || item.itemCode,
      value: item.netQtySold || 0
    })) || [];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-white/80 p-6 shadow md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Manager Dashboard</h1>
          <p className="text-ink/60">
            Stock management, collections, credit bills, returns, and daily performance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-sand">
            Ruhunu Foods
          </span>
          <span className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold">
            {new Date().toLocaleDateString("en-LK")}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl bg-white/80 p-6 text-sm text-ink/60 shadow">
          Loading manager dashboard...
        </div>
      )}

      {!loading && dashboard && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-2xl bg-white/90 p-5 shadow">
                <div className="text-xs uppercase tracking-[0.2em] text-ink/50">{card.label}</div>
                <div className="mt-3 text-2xl font-semibold">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <div className="rounded-2xl bg-white/90 p-6 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-ink/70">Sales vs Collection</div>
                  <div className="text-xs text-ink/50">Gross, net, and collection</div>
                </div>
              </div>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesVsCollectionData} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="#f97316" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl bg-white/90 p-6 shadow">
              <div className="text-sm font-semibold text-ink/70">Payment Method Summary</div>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentMixData} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="#0f766e" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl bg-white/90 p-6 shadow">
              <div className="text-sm font-semibold text-ink/70">Top Selling Items</div>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topSellingData} barSize={30}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatNumber(value)} />
                    <Bar dataKey="value" fill="#0f172a" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl bg-white/90 p-6 shadow">
              <div className="text-sm font-semibold text-ink/70">Collection Split</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Today Bill Collection", value: dashboard.todayBillCollection },
                  { label: "Old Credit Collection", value: dashboard.oldCreditCollection }
                ].map((row) => (
                  <div key={row.label} className="rounded-2xl bg-slatewash/70 p-4">
                    <div className="text-xs text-ink/60">{row.label}</div>
                    <div className="mt-2 text-lg font-semibold">{formatCurrency(row.value)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { label: "Cash Collection", value: dashboard.paymentMix?.cashCollection },
                  { label: "Cheque Collection", value: dashboard.paymentMix?.chequeCollection },
                  { label: "Credit Bills", value: dashboard.paymentMix?.creditBills },
                  { label: "Old Credit Collection", value: dashboard.paymentMix?.oldCreditCollection }
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-2xl border border-slatewash p-4"
                  >
                    <span className="text-sm font-semibold">{row.label}</span>
                    <span className="text-sm text-ink/70">{formatCurrency(row.value)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-ink/50">
                Credit bills are shown separately from cash or cheque collections.
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/90 p-6 shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-ink/70">Inventory Signals</div>
                <div className="text-xs text-ink/50">Low stock, near expiry, and intake</div>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {inventorySignals.map((item) => (
                <Link
                  key={item.title}
                  to={item.link}
                  className="rounded-2xl bg-slatewash/70 p-4 transition hover:bg-slatewash"
                >
                  <div className="text-xs text-ink/60">{item.title}</div>
                  <div className="mt-2 text-lg font-semibold">{item.value}</div>
                  {item.subtitle && <div className="mt-1 text-xs text-ink/50">{item.subtitle}</div>}
                </Link>
              ))}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-slatewash bg-white/60 p-4">
                <div className="text-sm font-semibold text-ink/70">Top Low Stock Items</div>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase text-ink/50">
                      <tr>
                        <th className="py-2 pr-4">Item Code</th>
                        <th className="py-2 pr-4">Item Name</th>
                        <th className="py-2 pr-4">Current Stock</th>
                        <th className="py-2 pr-4">Reorder Level</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slatewash">
                      {dashboard.topLowStockItems?.map((row) => (
                        <tr key={`${row.itemCode}-${row.itemName}`}>
                          <td className="py-2 pr-4 font-semibold">{row.itemCode}</td>
                          <td className="py-2 pr-4">{row.itemName}</td>
                          <td className="py-2 pr-4">{row.currentStock}</td>
                          <td className="py-2 pr-4">{row.reorderLevel}</td>
                          <td className="py-2">
                            <span className="rounded-full bg-clay/10 px-2 py-1 text-xs font-semibold text-clay">
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {dashboard.topLowStockItems?.length === 0 && (
                        <tr>
                          <td className="py-3 text-ink/60" colSpan="5">
                            No low stock items today.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-slatewash bg-white/60 p-4">
                <div className="text-sm font-semibold text-ink/70">Near Expiry Batches</div>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase text-ink/50">
                      <tr>
                        <th className="py-2 pr-4">Batch No</th>
                        <th className="py-2 pr-4">Item Name</th>
                        <th className="py-2 pr-4">Remaining Qty</th>
                        <th className="py-2 pr-4">Expiry Date</th>
                        <th className="py-2">Days Left</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slatewash">
                      {dashboard.nearExpiryBatches?.map((row) => (
                        <tr key={row.batchNo}>
                          <td className="py-2 pr-4 font-semibold">{row.batchNo}</td>
                          <td className="py-2 pr-4">{row.itemName}</td>
                          <td className="py-2 pr-4">{row.remainingQty}</td>
                          <td className="py-2 pr-4">{formatDate(row.expiryDate)}</td>
                          <td className="py-2">{row.daysLeft ?? "-"}</td>
                        </tr>
                      ))}
                      {dashboard.nearExpiryBatches?.length === 0 && (
                        <tr>
                          <td className="py-3 text-ink/60" colSpan="5">
                            No near expiry batches.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl bg-white/90 p-6 shadow">
              <div className="text-sm font-semibold text-ink/70">Recent Payments</div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-ink/50">
                    <tr>
                      <th className="py-2 pr-4">Payment No</th>
                      <th className="py-2 pr-4">Customer</th>
                      <th className="py-2 pr-4">Amount</th>
                      <th className="py-2 pr-4">Method</th>
                      <th className="py-2 pr-4">Received By</th>
                      <th className="py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slatewash">
                    {dashboard.recentPayments?.map((row) => (
                      <tr key={row.paymentNo}>
                        <td className="py-2 pr-4 font-semibold">{row.paymentNo}</td>
                        <td className="py-2 pr-4">{row.customer}</td>
                        <td className="py-2 pr-4">{formatCurrency(row.amount)}</td>
                        <td className="py-2 pr-4">{row.method}</td>
                        <td className="py-2 pr-4">{row.receivedBy}</td>
                        <td className="py-2">{formatTime(row.createdAt)}</td>
                      </tr>
                    ))}
                    {dashboard.recentPayments?.length === 0 && (
                      <tr>
                        <td className="py-3 text-ink/60" colSpan="6">
                          No payments today.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl bg-white/90 p-6 shadow">
              <div className="text-sm font-semibold text-ink/70">Recent Credit Bills</div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-ink/50">
                    <tr>
                      <th className="py-2 pr-4">Invoice No</th>
                      <th className="py-2 pr-4">Customer</th>
                      <th className="py-2 pr-4">Net Total</th>
                      <th className="py-2 pr-4">Paid</th>
                      <th className="py-2 pr-4">Due</th>
                      <th className="py-2">Cashier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slatewash">
                    {dashboard.recentCreditBills?.map((row) => (
                      <tr key={row.invoiceNo}>
                        <td className="py-2 pr-4 font-semibold">{row.invoiceNo}</td>
                        <td className="py-2 pr-4">{row.customer}</td>
                        <td className="py-2 pr-4">{formatCurrency(row.netTotal)}</td>
                        <td className="py-2 pr-4">{formatCurrency(row.paidAmount)}</td>
                        <td className="py-2 pr-4">{formatCurrency(row.dueAmount)}</td>
                        <td className="py-2">{row.cashier}</td>
                      </tr>
                    ))}
                    {dashboard.recentCreditBills?.length === 0 && (
                      <tr>
                        <td className="py-3 text-ink/60" colSpan="6">
                          No credit bills right now.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/90 p-6 shadow">
            <div className="text-sm font-semibold text-ink/70">Recent Returns</div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-ink/50">
                  <tr>
                    <th className="py-2 pr-4">Return No</th>
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Item</th>
                    <th className="py-2 pr-4">Qty</th>
                    <th className="py-2 pr-4">Return Amount</th>
                    <th className="py-2">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slatewash">
                  {dashboard.recentReturns?.map((row) => (
                    <tr key={`${row.returnNo}-${row.item}`}>
                      <td className="py-2 pr-4 font-semibold">{row.returnNo}</td>
                      <td className="py-2 pr-4">{row.customer}</td>
                      <td className="py-2 pr-4">{row.item}</td>
                      <td className="py-2 pr-4">{row.qty}</td>
                      <td className="py-2 pr-4">{formatCurrency(row.returnAmount)}</td>
                      <td className="py-2">{row.condition}</td>
                    </tr>
                  ))}
                  {dashboard.recentReturns?.length === 0 && (
                    <tr>
                      <td className="py-3 text-ink/60" colSpan="6">
                        No returns recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-xs text-ink/50">
              Return adjustments are shown separately from sales totals.
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default ManagerDashboardPage;
