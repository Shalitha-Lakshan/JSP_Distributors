import { useEffect, useMemo, useState } from "react";
import api from "../api/client";

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;
const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-LK", { hour: "2-digit", minute: "2-digit" })
    : "-";

const PaymentsPage = () => {
  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [chequeStatus, setChequeStatus] = useState("pending");

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [customerRes, paymentRes] = await Promise.all([
        api.get("/api/customers", { headers: authHeader }),
        api.get("/api/payments", { headers: authHeader })
      ]);
      setCustomers(customerRes.data || []);
      setPayments(paymentRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load payment data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) {
      setCustomerSuggestions([]);
      return;
    }

    const matches = customers
      .filter((customer) => {
        const haystack = `${customer.name} ${customer.phone || ""}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 6);
    setCustomerSuggestions(matches);
  }, [customerSearch, customers]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer._id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  const todaySummary = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const todayPayments = payments.filter((payment) => {
      const createdAt = new Date(payment.createdAt);
      return createdAt >= start && createdAt <= end;
    });

    const cash = todayPayments
      .filter((payment) => payment.paymentMethod === "cash")
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const cheque = todayPayments
      .filter((payment) => payment.paymentMethod === "cheque")
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);

    return {
      total: cash + cheque,
      cash,
      cheque,
      count: todayPayments.length
    };
  }, [payments]);

  const handleSelectCustomer = (customer) => {
    setSelectedCustomerId(customer._id);
    setCustomerSearch(`${customer.name}${customer.phone ? ` - ${customer.phone}` : ""}`);
    setCustomerSuggestions([]);
  };

  const resetForm = () => {
    setSelectedCustomerId("");
    setCustomerSearch("");
    setPaymentMethod("cash");
    setAmount("");
    setNote("");
    setChequeNo("");
    setBankName("");
    setChequeDate("");
    setChequeStatus("pending");
  };

  const handleReceivePayment = async () => {
    setError("");
    setSuccess("");

    if (!selectedCustomerId) {
      setError("Select a customer to receive payment.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customer: selectedCustomerId,
        amount: Number(amount),
        paymentMethod,
        note: note || undefined,
        chequeNo: paymentMethod === "cheque" ? chequeNo : undefined,
        bankName: paymentMethod === "cheque" ? bankName : undefined,
        chequeDate: paymentMethod === "cheque" && chequeDate ? chequeDate : undefined,
        chequeStatus: paymentMethod === "cheque" ? chequeStatus : undefined
      };

      await api.post("/api/payments/receive", payload, { headers: authHeader });
      setSuccess("Payment recorded successfully.");
      resetForm();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to receive payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white/80 p-6 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Receive Payments</h1>
            <p className="text-ink/60">Record customer payments and reduce outstanding.</p>
          </div>
          <div className="rounded-2xl bg-slatewash/70 px-4 py-3 text-sm">
            <div className="text-xs text-ink/60">Today Collections</div>
            <div className="text-lg font-semibold">{formatCurrency(todaySummary.total)}</div>
            <div className="text-xs text-ink/60">
              Cash {formatCurrency(todaySummary.cash)} | Cheque {formatCurrency(todaySummary.cheque)}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-leaf/30 bg-leaf/10 px-4 py-3 text-sm text-leaf">
          {success}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl bg-white/80 p-6 text-sm text-ink/60 shadow">
          Loading payments...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl bg-white/80 p-6 shadow space-y-4">
            <div className="text-sm font-semibold text-ink/70">Payment Details</div>
            <div className="relative">
              <label className="text-xs text-ink/60">Customer</label>
              <input
                className="mt-1 w-full rounded-lg border border-slatewash px-3 py-3 text-base"
                placeholder="Search customer by name or phone"
                value={customerSearch}
                onChange={(event) => {
                  setCustomerSearch(event.target.value);
                  setSelectedCustomerId("");
                }}
              />
              {customerSearch && !selectedCustomerId && customerSuggestions.length > 0 && (
                <div className="absolute z-10 mt-2 w-full rounded-2xl border border-slatewash bg-white shadow">
                  {customerSuggestions.map((customer) => (
                    <button
                      key={customer._id}
                      type="button"
                      className="w-full px-4 py-3 text-left text-sm hover:bg-slatewash/60"
                      onClick={() => handleSelectCustomer(customer)}
                    >
                      <div className="font-semibold">{customer.name}</div>
                      <div className="text-xs text-ink/60">
                        {customer.phone || "No phone"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedCustomer && (
              <div className="rounded-xl bg-slatewash/70 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink/60">Selected</span>
                  <span className="font-semibold">{selectedCustomer.name}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-ink/60">
                  <span>Outstanding</span>
                  <span>{formatCurrency(selectedCustomer.outstandingBalance || 0)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-ink/60">
                  <span>Credit Limit</span>
                  <span>{formatCurrency(selectedCustomer.creditLimit || 0)}</span>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-ink/60">Payment Method</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slatewash px-3 py-3 text-base"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-ink/60">Amount</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slatewash px-3 py-3 text-base"
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            </div>

            {paymentMethod === "cheque" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-ink/60">Cheque No</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slatewash px-3 py-3 text-base"
                    value={chequeNo}
                    onChange={(event) => setChequeNo(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-ink/60">Bank Name</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slatewash px-3 py-3 text-base"
                    value={bankName}
                    onChange={(event) => setBankName(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-ink/60">Cheque Date</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slatewash px-3 py-3 text-base"
                    type="date"
                    value={chequeDate}
                    onChange={(event) => setChequeDate(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-ink/60">Cheque Status</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slatewash px-3 py-3 text-base"
                    value={chequeStatus}
                    onChange={(event) => setChequeStatus(event.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="cleared">Cleared</option>
                    <option value="returned">Returned</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-ink/60">Note</label>
              <textarea
                className="mt-1 w-full rounded-lg border border-slatewash px-3 py-3 text-base"
                rows="3"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional note"
              />
            </div>

            <button
              className="w-full rounded-lg bg-ink py-3 text-sm font-semibold text-sand disabled:opacity-60"
              type="button"
              onClick={handleReceivePayment}
              disabled={saving}
            >
              {saving ? "Saving..." : "Record Payment"}
            </button>
          </div>

          <div className="rounded-2xl bg-white/80 p-6 shadow space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-ink/70">Recent Payments</div>
              <span className="text-xs text-ink/60">{payments.length} records</span>
            </div>
            <div className="space-y-3">
              {payments.slice(0, 8).map((payment) => (
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
                      <div className="text-xs text-ink/60">{formatDateTime(payment.createdAt)}</div>
                    </div>
                  </div>
                  {payment.paymentMethod === "cheque" && (
                    <div className="mt-2 text-xs text-ink/60">
                      {payment.chequeNo ? `Cheque No: ${payment.chequeNo}` : "Cheque No: -"} | {payment.bankName ? `Bank: ${payment.bankName}` : "Bank: -"}
                    </div>
                  )}
                </div>
              ))}
              {payments.length === 0 && (
                <div className="text-sm text-ink/60">No payments recorded.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default PaymentsPage;
