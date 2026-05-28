import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;
const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-LK", { hour: "2-digit", minute: "2-digit" })
    : "-";

const InvoicePage = () => {
  const { invoiceNo } = useParams();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get(`/api/sales/invoice/${invoiceNo}`, { headers: authHeader });
        setSale(data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    };

    if (invoiceNo) {
      load();
    }
  }, [invoiceNo]);

  if (loading) {
    return (
      <section className="rounded-2xl bg-white/80 p-6 shadow text-sm text-ink/60">
        Loading invoice...
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-clay/30 bg-clay/10 p-6 text-sm text-clay">
        {error}
      </section>
    );
  }

  if (!sale) {
    return null;
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white/80 p-6 shadow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Invoice</h1>
            <p className="text-ink/60">{sale.invoiceNo}</p>
            <p className="text-xs text-ink/50">{formatDateTime(sale.createdAt)}</p>
          </div>
          <button
            className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-sand"
            type="button"
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl bg-white/80 p-6 shadow space-y-6">
          <div>
            <h2 className="text-lg font-semibold">New Order Items</h2>
            <div className="mt-3 space-y-3">
              {sale.items?.map((item) => (
                <div key={item.itemCode} className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{item.itemName}</div>
                    <div className="text-sm text-ink/60">
                      {item.quantity} x {formatCurrency(item.sellingPrice)}
                    </div>
                  </div>
                  <div className="font-semibold">{formatCurrency(item.lineTotal)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slatewash pt-4">
            <h2 className="text-lg font-semibold">Return Items</h2>
            {sale.returns?.length ? (
              <div className="mt-3 space-y-3">
                {sale.returns.map((item) => (
                  <div key={`${item.itemCode}-${item.returnTotal}`} className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{item.itemName}</div>
                      <div className="text-sm text-ink/60">
                        {item.quantity} x {formatCurrency(item.returnPrice)} ({item.condition})
                      </div>
                    </div>
                    <div className="font-semibold">- {formatCurrency(item.returnTotal)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm text-ink/60">No returns on this bill.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white/80 p-6 shadow space-y-3">
          <div className="flex justify-between text-sm">
            <span>Order Total</span>
            <span className="font-semibold">{formatCurrency(sale.orderTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Less Return Total</span>
            <span className="font-semibold">{formatCurrency(sale.returnTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Discount</span>
            <span className="font-semibold">{formatCurrency(sale.discount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Net Payable</span>
            <span className="font-semibold">{formatCurrency(sale.netTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Paid Amount</span>
            <span className="font-semibold">{formatCurrency(sale.paidAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Due Amount</span>
            <span className="font-semibold">{formatCurrency(sale.dueAmount)}</span>
          </div>
          <div className="mt-4 rounded-2xl bg-slatewash/70 p-4 text-xs text-ink/70">
            Payment Method: {sale.paymentMethod}
          </div>
        </div>
      </div>
    </section>
  );
};

export default InvoicePage;
