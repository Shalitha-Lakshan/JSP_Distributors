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

  // Credit invoices lookup & checkboxes
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [selectedInvoices, setSelectedInvoices] = useState({});
  const [sidebarSearch, setSidebarSearch] = useState("");

  const creditCustomers = useMemo(() => {
    return customers
      .filter((customer) => (customer.outstandingBalance || 0) > 0)
      .sort((a, b) => (b.outstandingBalance || 0) - (a.outstandingBalance || 0));
  }, [customers]);

  const filteredCreditCustomers = useMemo(() => {
    const query = sidebarSearch.trim().toLowerCase();
    if (!query) return creditCustomers;
    return creditCustomers.filter((customer) => {
      const haystack = `${customer.name} ${customer.phone || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [creditCustomers, sidebarSearch]);

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

  const handleSelectCustomer = async (customer) => {
    setSelectedCustomerId(customer._id);
    setCustomerSearch(`${customer.name}${customer.phone ? ` - ${customer.phone}` : ""}`);
    setCustomerSuggestions([]);
    
    // Fetch unpaid invoices
    try {
      const res = await api.get(`/api/customers/${customer._id}/unpaid-invoices`, { headers: authHeader });
      setUnpaidInvoices(res.data || []);
      setSelectedInvoices({});
      setAmount("");
    } catch (err) {
      setError("Failed to fetch customer unpaid invoices.");
    }
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
    setUnpaidInvoices([]);
    setSelectedInvoices({});
    setSidebarSearch("");
  };

  const handleToggleInvoice = (invoice) => {
    setSelectedInvoices((prev) => {
      const next = { ...prev, [invoice._id]: !prev[invoice._id] };
      let totalSum = 0;
      unpaidInvoices.forEach((inv) => {
        if (next[inv._id]) {
          totalSum += inv.dueAmount || 0;
        }
      });
      setAmount(totalSum > 0 ? String(totalSum) : "");
      return next;
    });
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
      const allocations = [];
      unpaidInvoices.forEach((inv) => {
        if (selectedInvoices[inv._id]) {
          allocations.push({
            invoice: inv._id,
            invoiceNo: inv.invoiceNo,
            allocatedAmount: inv.dueAmount
          });
        }
      });

      const payload = {
        customer: selectedCustomerId,
        amount: Number(amount),
        paymentMethod,
        note: note || undefined,
        chequeNo: paymentMethod === "cheque" ? chequeNo : undefined,
        bankName: paymentMethod === "cheque" ? bankName : undefined,
        chequeDate: paymentMethod === "cheque" && chequeDate ? chequeDate : undefined,
        chequeStatus: paymentMethod === "cheque" ? chequeStatus : undefined,
        allocations
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Payment Form Container (Takes 2/3 width) */}
          <div className="lg:col-span-2 rounded-2xl bg-white/80 p-6 shadow space-y-6">
            <div className="text-sm font-semibold text-ink/70 border-b border-slatewash pb-3">Payment Details</div>
            
            <div className="relative">
              <label className="text-xs text-ink/60 uppercase font-semibold">Customer</label>
              <input
                className="mt-1.5 w-full rounded-lg border border-slatewash px-3 py-3 text-base focus:ring-1 focus:ring-ink focus:outline-none"
                placeholder="Search customer by name or phone"
                value={customerSearch}
                onChange={(event) => {
                  setCustomerSearch(event.target.value);
                  setSelectedCustomerId("");
                  setUnpaidInvoices([]);
                  setSelectedInvoices({});
                }}
              />
              {customerSearch && !selectedCustomerId && customerSuggestions.length > 0 && (
                <div className="absolute z-10 mt-2 w-full rounded-2xl border border-slatewash bg-white shadow-lg max-h-60 overflow-y-auto">
                  {customerSuggestions.map((customer) => (
                    <button
                      key={customer._id}
                      type="button"
                      className="w-full px-4 py-3 text-left text-sm hover:bg-slatewash/60 border-b border-slatewash/40 last:border-b-0"
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
              <div className="rounded-xl bg-slatewash/70 px-4 py-3 text-sm grid gap-2 sm:grid-cols-3">
                <div>
                  <span className="text-xs text-ink/50 uppercase block">Selected Customer</span>
                  <span className="font-semibold text-ink text-base">{selectedCustomer.name}</span>
                </div>
                <div>
                  <span className="text-xs text-ink/50 uppercase block">Outstanding Balance</span>
                  <span className="font-semibold text-clay text-base">{formatCurrency(selectedCustomer.outstandingBalance || 0)}</span>
                </div>
                <div>
                  <span className="text-xs text-ink/50 uppercase block">Credit Limit</span>
                  <span className="font-semibold text-ink text-base">{formatCurrency(selectedCustomer.creditLimit || 0)}</span>
                </div>
              </div>
            )}

            {/* Credit Invoices Sub-Table */}
            {selectedCustomerId && unpaidInvoices.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-ink uppercase tracking-wider">Outstanding Credit Invoices ({unpaidInvoices.length})</h3>
                <div className="overflow-x-auto rounded-xl border border-slatewash shadow-inner">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-slatewash/50 text-xs font-semibold uppercase text-ink/60">
                        <th className="px-4 py-3 w-12 text-center">Pay</th>
                        <th className="px-4 py-3">Invoice Date</th>
                        <th className="px-4 py-3">Invoice No</th>
                        <th className="px-4 py-3">Order No</th>
                        <th className="px-4 py-3">Total Value</th>
                        <th className="px-4 py-3 text-right">Amount Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slatewash bg-white">
                      {unpaidInvoices.map((inv) => (
                        <tr key={inv._id} className="hover:bg-slatewash/20 transition">
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              className="rounded text-ink border-slatewash focus:ring-ink h-4 w-4"
                              checked={!!selectedInvoices[inv._id]}
                              onChange={() => handleToggleInvoice(inv)}
                            />
                          </td>
                          <td className="px-4 py-3 text-ink/80">
                            {new Date(inv.createdAt).toLocaleDateString("en-LK")}
                          </td>
                          <td className="px-4 py-3 font-semibold text-ink">{inv.invoiceNo}</td>
                          <td className="px-4 py-3 text-ink/70">{inv.orderId?.orderNo || "-"}</td>
                          <td className="px-4 py-3 font-medium">{formatCurrency(inv.netTotal)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-clay">
                            {formatCurrency(inv.dueAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-ink/60 uppercase font-semibold">Payment Method</label>
                <select
                  className="mt-1.5 w-full rounded-lg border border-slatewash px-3 py-3 text-base focus:ring-1 focus:ring-ink focus:outline-none"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-ink/60 uppercase font-semibold">Amount (Rs.)</label>
                <input
                  className="mt-1.5 w-full rounded-lg border border-slatewash px-3 py-3 text-base focus:ring-1 focus:ring-ink focus:outline-none font-semibold text-ink"
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            </div>

            {paymentMethod === "cheque" && (
              <div className="grid gap-4 sm:grid-cols-2 border-t border-slatewash/50 pt-4">
                <div>
                  <label className="text-xs text-ink/60 uppercase font-semibold">Cheque No</label>
                  <input
                    className="mt-1.5 w-full rounded-lg border border-slatewash px-3 py-3 text-base focus:ring-1 focus:ring-ink focus:outline-none"
                    value={chequeNo}
                    onChange={(event) => setChequeNo(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-ink/60 uppercase font-semibold">Bank Name</label>
                  <input
                    className="mt-1.5 w-full rounded-lg border border-slatewash px-3 py-3 text-base focus:ring-1 focus:ring-ink focus:outline-none"
                    value={bankName}
                    onChange={(event) => setBankName(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-ink/60 uppercase font-semibold">Cheque Date</label>
                  <input
                    className="mt-1.5 w-full rounded-lg border border-slatewash px-3 py-3 text-base focus:ring-1 focus:ring-ink focus:outline-none"
                    type="date"
                    value={chequeDate}
                    onChange={(event) => setChequeDate(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-ink/60 uppercase font-semibold">Cheque Status</label>
                  <select
                    className="mt-1.5 w-full rounded-lg border border-slatewash px-3 py-3 text-base focus:ring-1 focus:ring-ink focus:outline-none"
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
              <label className="text-xs text-ink/60 uppercase font-semibold">Note</label>
              <textarea
                className="mt-1.5 w-full rounded-lg border border-slatewash px-3 py-3 text-base focus:ring-1 focus:ring-ink focus:outline-none"
                rows="3"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional notes or references"
              />
            </div>

            <button
              className="w-full rounded-lg bg-ink py-3.5 text-base font-semibold text-sand hover:bg-ink/90 transition disabled:opacity-60 shadow-md"
              type="button"
              onClick={handleReceivePayment}
              disabled={saving}
            >
              {saving ? "Saving Payment..." : "Record Payment"}
            </button>
          </div>

          {/* Credit Customers Sidebar (Takes 1/3 width) */}
          <div className="lg:col-span-1 rounded-2xl bg-white/80 p-6 shadow flex flex-col max-h-[650px] space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-ink uppercase tracking-wider">Credit Customers</h3>
              <p className="text-xs text-ink/60">Click on a customer to load their credit invoices.</p>
            </div>
            
            <input
              className="w-full rounded-lg border border-slatewash px-3 py-2.5 text-sm focus:ring-1 focus:ring-ink focus:outline-none bg-white"
              placeholder="Filter by name or phone..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
            />

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[480px]">
              {filteredCreditCustomers.length === 0 ? (
                <div className="text-sm text-ink/40 py-4 text-center">No credit customers found.</div>
              ) : (
                filteredCreditCustomers.map((c) => {
                  const isSelected = c._id === selectedCustomerId;
                  return (
                    <button
                      key={c._id}
                      type="button"
                      className={`w-full p-3 text-left rounded-xl border transition-all text-sm flex flex-col gap-1 ${
                        isSelected
                          ? "bg-slatewash border-ink shadow-sm"
                          : "bg-white/40 border-slatewash/60 hover:bg-slatewash/40 hover:border-slatewash"
                      }`}
                      onClick={() => handleSelectCustomer(c)}
                    >
                      <div className="font-semibold text-ink flex items-center justify-between">
                        <span>{c.name}</span>
                        <span className="text-sm font-bold text-clay">
                          {formatCurrency(c.outstandingBalance)}
                        </span>
                      </div>
                      <div className="text-xs text-ink/60 flex items-center justify-between">
                        <span>{c.phone || "No phone"}</span>
                        {isSelected && (
                          <span className="text-[10px] bg-ink text-sand px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                            Active
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default PaymentsPage;
