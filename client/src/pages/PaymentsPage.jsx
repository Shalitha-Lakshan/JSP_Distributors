import { useEffect, useMemo, useState } from "react";
import api from "../api/client";

const formatCurrency = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-LK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const PaymentsPage = () => {
  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Rep View States
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
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [selectedInvoices, setSelectedInvoices] = useState({});
  const [sidebarSearch, setSidebarSearch] = useState("");

  // Manager View States
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [chequeStatusFilter, setChequeStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [inspectedPayment, setInspectedPayment] = useState(null);

  const role = useMemo(() => localStorage.getItem("role") || "rep", []);
  const isManager = role === "manager" || role === "admin";

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

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

  // Rep View collections summary
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

  // Manager View Live Filters
  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const query = search.trim().toLowerCase();
      const customerName = payment.customer?.name || "";
      const repName = payment.receivedBy?.name || "";
      const receiptNo = payment.paymentNo || "";
      const checkNo = payment.chequeNo || "";
      const bank = payment.bankName || "";

      const matchesSearch =
        !query ||
        `${customerName} ${repName} ${receiptNo} ${checkNo} ${bank}`.toLowerCase().includes(query);

      const matchesMethod =
        methodFilter === "all" ? true : payment.paymentMethod === methodFilter;

      const matchesChequeStatus =
        chequeStatusFilter === "all"
          ? true
          : payment.chequeStatus === chequeStatusFilter;

      let matchesDate = true;
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && new Date(payment.createdAt) >= start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && new Date(payment.createdAt) <= end;
      }

      return matchesSearch && matchesMethod && matchesChequeStatus && matchesDate;
    });
  }, [payments, search, methodFilter, chequeStatusFilter, startDate, endDate]);

  // Manager View Live Statistics
  const managerStats = useMemo(() => {
    let total = 0;
    let cash = 0;
    let cheque = 0;
    
    filteredPayments.forEach((p) => {
      total += p.amount || 0;
      if (p.paymentMethod === "cash") {
        cash += p.amount || 0;
      } else if (p.paymentMethod === "cheque") {
        cheque += p.amount || 0;
      }
    });

    return {
      total,
      cash,
      cheque,
      count: filteredPayments.length
    };
  }, [filteredPayments]);

  const handleSelectCustomer = async (customer) => {
    setSelectedCustomerId(customer._id);
    setCustomerSearch(`${customer.name}${customer.phone ? ` - ${customer.phone}` : ""}`);
    setCustomerSuggestions([]);
    
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

  // -------------------------------------------------------------
  // 1. MANAGER VIEW RENDER
  // -------------------------------------------------------------
  if (isManager) {
    return (
      <section className="space-y-6">
        {/* Header Banner */}
        <div className="rounded-2xl bg-white/80 p-6 shadow border-l-4 border-ink flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink font-display">Collections Audit Ledger</h1>
            <p className="text-sm text-ink/60 mt-0.5">
              Monitor route payments in real-time, inspect cheque clearance, and track sales receipts.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay font-medium">
            {error}
          </div>
        )}

        {/* Manager Summary KPI Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white/90 p-4 shadow border-b-4 border-leaf flex flex-col justify-between min-h-[90px]">
            <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Total Received</span>
            <span className="text-base sm:text-lg font-bold text-ink mt-2 truncate">
              {formatCurrency(managerStats.total)}
            </span>
            <span className="text-[10px] text-ink/50 mt-1">Sum of filtered collections</span>
          </div>

          <div className="rounded-2xl bg-white/90 p-4 shadow border-b-4 border-indigo-400 flex flex-col justify-between min-h-[90px]">
            <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Cash Receipts</span>
            <span className="text-base sm:text-lg font-bold text-indigo-700 mt-2 truncate">
              {formatCurrency(managerStats.cash)}
            </span>
            <span className="text-[10px] text-ink/50 mt-1">Liquid route collections</span>
          </div>

          <div className="rounded-2xl bg-white/90 p-4 shadow border-b-4 border-slatewash flex flex-col justify-between min-h-[90px]">
            <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Cheque Volume</span>
            <span className="text-base sm:text-lg font-bold text-ink mt-2 truncate">
              {formatCurrency(managerStats.cheque)}
            </span>
            <span className="text-[10px] text-ink/50 mt-1">Cheque drafts pending/cleared</span>
          </div>

          <div className="rounded-2xl bg-white/90 p-4 shadow border-b-4 border-clay flex flex-col justify-between min-h-[90px]">
            <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Receipts Count</span>
            <span className="text-lg sm:text-xl font-bold text-clay mt-2">
              {managerStats.count} <span className="text-xs font-normal text-ink/50">Payments</span>
            </span>
            <span className="text-[10px] text-ink/50 mt-1">Filtered database records</span>
          </div>
        </div>

        {/* Filter Registry Toolbar */}
        <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 space-y-4">
          <div className="text-xs font-bold text-ink/60 uppercase tracking-wider">Filter Transactions</div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-6 items-end">
            
            {/* Search Input */}
            <div className="md:col-span-2 relative">
              <label className="block text-[10px] font-bold text-ink/50 uppercase mb-1">Search Details</label>
              <span className="absolute inset-y-0 left-0 pl-3 pt-6 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                className="w-full rounded-xl border border-slatewash pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
                placeholder="Receipt, Customer, Representative..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Method Select */}
            <div>
              <label className="block text-[10px] font-bold text-ink/50 uppercase mb-1">Payment Method</label>
              <select
                className="w-full rounded-xl border border-slatewash px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/80"
                value={methodFilter}
                onChange={(e) => {
                  setMethodFilter(e.target.value);
                  setChequeStatusFilter("all");
                }}
              >
                <option value="all">All Methods</option>
                <option value="cash">Cash Only</option>
                <option value="cheque">Cheque Only</option>
              </select>
            </div>

            {/* Cheque Status (conditional) */}
            <div>
              <label className="block text-[10px] font-bold text-ink/50 uppercase mb-1">Cheque Status</label>
              <select
                className="w-full rounded-xl border border-slatewash px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/80 disabled:opacity-50"
                value={chequeStatusFilter}
                onChange={(e) => setChequeStatusFilter(e.target.value)}
                disabled={methodFilter === "cash"}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="cleared">Cleared</option>
                <option value="returned">Returned</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[10px] font-bold text-ink/50 uppercase mb-1">Start Date</label>
              <input
                className="w-full rounded-xl border border-slatewash px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/75"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[10px] font-bold text-ink/50 uppercase mb-1">End Date</label>
              <input
                className="w-full rounded-xl border border-slatewash px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/75"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Transactions Table Container */}
        <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40">
          <div className="flex items-center justify-between border-b border-slatewash pb-3">
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider">Collections History ({filteredPayments.length})</h2>
          </div>

          {loading ? (
            <div className="text-center py-12 text-xs text-ink/50 flex items-center justify-center gap-2">
              <div className="h-4 w-4 border-2 border-ink border-t-transparent rounded-full animate-spin"></div>
              Loading transaction journals...
            </div>
          ) : (
            <div className="overflow-x-auto mt-2">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-ink/40 border-b border-slatewash bg-slatewash/20">
                    <th className="px-4 py-3">Receipt Number</th>
                    <th className="px-4 py-3">Receipt Date</th>
                    <th className="px-4 py-3">Customer Accounts</th>
                    <th className="px-4 py-3">Representative</th>
                    <th className="px-4 py-3 text-center">Method</th>
                    <th className="px-4 py-3">Cheque Details</th>
                    <th className="px-4 py-3 text-right">Amount Paid</th>
                    <th className="px-4 py-3 text-center">Allocations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slatewash">
                  {filteredPayments.map((p) => (
                    <tr
                      key={p._id}
                      className="hover:bg-slatewash/10 transition-colors cursor-pointer"
                      onClick={() => setInspectedPayment(p)}
                      title="Click to view invoice allocations"
                    >
                      {/* Receipt No */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex rounded-lg bg-ink/5 border border-ink/10 px-2 py-1 font-bold text-ink">
                          {p.paymentNo}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 text-ink/70">
                        {formatDateTime(p.createdAt)}
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-ink leading-snug">{p.customer?.name || "-"}</div>
                      </td>

                      {/* Rep */}
                      <td className="px-4 py-3.5 text-ink/80">
                        {p.receivedBy?.name || "-"}
                      </td>

                      {/* Method Badge */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border
                          ${p.paymentMethod === "cash"
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                            : "bg-slatewash/70 border-slatewash text-ink/60"
                          }
                        `}>
                          {p.paymentMethod}
                        </span>
                      </td>

                      {/* Cheque specifications */}
                      <td className="px-4 py-3.5">
                        {p.paymentMethod === "cheque" ? (
                          <div className="space-y-0.5 leading-snug">
                            <div>
                              <span className="font-bold text-ink/70">{p.bankName || "Unknown Bank"}</span>
                              <span className="text-[10px] text-ink/40 ml-1.5 font-semibold">({p.chequeNo || "-"})</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] text-ink/45">Due: {p.chequeDate ? new Date(p.chequeDate).toLocaleDateString("en-LK") : "-"}</span>
                              <span className={`rounded-full px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider border leading-none
                                ${p.chequeStatus === "cleared" ? "bg-leaf/10 text-leaf border-leaf/20" : ""}
                                ${p.chequeStatus === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" : ""}
                                ${p.chequeStatus === "returned" ? "bg-clay/10 text-clay border-clay/20" : ""}
                              `}>
                                {p.chequeStatus || "pending"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-ink/30 italic">-</span>
                        )}
                      </td>

                      {/* Amount Paid */}
                      <td className="px-4 py-3.5 text-right font-bold text-ink text-sm">
                        {formatCurrency(p.amount)}
                      </td>

                      {/* Quick Inspect allocations */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectedPayment(p);
                          }}
                          className="rounded-lg border border-slatewash px-2.5 py-1 text-[10px] font-bold text-ink/50 hover:bg-slatewash hover:text-ink transition flex items-center gap-1 mx-auto"
                          type="button"
                        >
                          <svg className="w-3.5 h-3.5 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Inspect ({p.allocations?.length || 0})
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredPayments.length === 0 && (
                    <tr>
                      <td className="py-12 text-center text-ink/40 italic text-sm" colSpan="8">
                        No collection ledger logs match the active parameters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Allocations Inspector Popup Modal */}
        {inspectedPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slatewash space-y-4">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slatewash pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink uppercase tracking-wider">Receipt Allocations</h3>
                  <p className="text-xs text-ink/50 mt-0.5">Invoice allocation details for reference {inspectedPayment.paymentNo}.</p>
                </div>
                <button
                  onClick={() => setInspectedPayment(null)}
                  className="text-ink/40 hover:text-ink transition p-1"
                  type="button"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* General details stack */}
              <div className="rounded-xl bg-slatewash/30 p-3.5 border border-slatewash/60 text-xs grid grid-cols-2 gap-2 leading-relaxed">
                <div>
                  <span className="text-[10px] text-ink/40 uppercase font-semibold block">Customer Account</span>
                  <span className="font-bold text-ink">{inspectedPayment.customer?.name || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-ink/40 uppercase font-semibold block">Representative</span>
                  <span className="font-bold text-ink">{inspectedPayment.receivedBy?.name || "-"}</span>
                </div>
                <div className="mt-2">
                  <span className="text-[10px] text-ink/40 uppercase font-semibold block">Total Receipt Value</span>
                  <span className="font-bold text-ink text-sm">{formatCurrency(inspectedPayment.amount)}</span>
                </div>
                <div className="mt-2">
                  <span className="text-[10px] text-ink/40 uppercase font-semibold block">Payment Method</span>
                  <span className="font-bold text-indigo-700 capitalize">{inspectedPayment.paymentMethod}</span>
                </div>
              </div>

              {/* Note */}
              {inspectedPayment.note && (
                <div className="text-xs text-ink/65 italic bg-amber-50 p-2.5 rounded-lg border border-amber-200 leading-relaxed">
                  <span className="font-bold text-ink/80 block not-italic text-[10px] uppercase mb-0.5">Auditor/Rep Note:</span>
                  "{inspectedPayment.note}"
                </div>
              )}

              {/* Allocations Table */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-ink/50 uppercase tracking-wider">Cleared Credit Invoices</h4>
                {inspectedPayment.allocations && inspectedPayment.allocations.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-slatewash/60">
                    <table className="min-w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slatewash/30 font-bold uppercase text-[9px] text-ink/50 border-b border-slatewash/50">
                          <th className="px-4 py-2">Invoice Number</th>
                          <th className="px-4 py-2 text-right">Cleared Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slatewash/50 bg-white">
                        {inspectedPayment.allocations.map((alloc, idx) => (
                          <tr key={idx} className="hover:bg-slatewash/10">
                            <td className="px-4 py-2.5 font-semibold text-ink">{alloc.invoiceNo}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-leaf">{formatCurrency(alloc.allocatedAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs text-ink/40 py-4 text-center border border-dashed border-slatewash/60 rounded-xl bg-slatewash/10 italic">
                    This receipt has no manual invoice allocations (e.g. walk-in checkout).
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end pt-3 border-t border-slatewash/60">
                <button
                  onClick={() => setInspectedPayment(null)}
                  className="rounded-xl bg-ink px-6 py-2 text-xs font-semibold text-sand hover:bg-ink/90 transition shadow-sm"
                  type="button"
                >
                  Close Monitor
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  // -------------------------------------------------------------
  // 2. REPRESENTATIVE (REP) VIEW RENDER
  // -------------------------------------------------------------
  return (
    <section className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-white/80 p-6 shadow border-l-4 border-ink flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Receive Payments</h1>
          <p className="text-sm text-ink/60 mt-0.5">Record route collections and knock off customer ledger cards.</p>
        </div>
        <div className="rounded-xl bg-slatewash/60 px-4 py-3 text-xs border border-slatewash/70 flex gap-4 shrink-0">
          <div className="text-left">
            <div className="text-[10px] font-semibold text-ink/40 uppercase">Today Collections</div>
            <div className="text-sm font-bold text-ink">{formatCurrency(todaySummary.total)}</div>
          </div>
          <div className="border-l border-slatewash/90 pl-4 text-left">
            <div className="text-[10px] font-semibold text-ink/40 uppercase">Cash / Cheque</div>
            <div className="text-sm font-bold text-ink/75">
              {formatCurrency(todaySummary.cash)} / {formatCurrency(todaySummary.cheque)}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay font-medium transition duration-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-leaf/30 bg-leaf/5 px-4 py-3 text-sm text-leaf font-medium transition duration-200 flex items-center justify-between">
          <span>{success}</span>
          <button
            onClick={() => setSuccess("")}
            className="text-leaf hover:text-leaf/80 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-xs text-ink/50 flex items-center justify-center gap-2 bg-white/60 rounded-2xl shadow-sm border border-slatewash/40">
          <div className="h-5 w-5 border-2 border-ink border-t-transparent rounded-full animate-spin"></div>
          Loading registry ledgers...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-6 items-start">
          
          {/* Left Panel: Payment form details */}
          <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 space-y-5">
            <div className="text-xs font-bold text-ink/60 uppercase tracking-wider border-b border-slatewash pb-3">
              Route Collection Entry Form
            </div>
            
            {/* Customer Search suggestion bar */}
            <div className="relative">
              <label className="block text-xs font-bold text-ink/60 uppercase">Customer Account</label>
              <input
                className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
                placeholder="Search customer by name or phone..."
                value={customerSearch}
                onChange={(event) => {
                  setCustomerSearch(event.target.value);
                  setSelectedCustomerId("");
                  setUnpaidInvoices([]);
                  setSelectedInvoices({});
                }}
              />
              {customerSearch && !selectedCustomerId && customerSuggestions.length > 0 && (
                <div className="absolute z-10 mt-2 w-full rounded-2xl border border-slatewash bg-white shadow-xl max-h-60 overflow-y-auto">
                  {customerSuggestions.map((customer) => (
                    <button
                      key={customer._id}
                      type="button"
                      className="w-full px-4 py-3.5 text-left text-sm hover:bg-slatewash/60 border-b border-slatewash/40 last:border-b-0"
                      onClick={() => handleSelectCustomer(customer)}
                    >
                      <div className="font-semibold text-ink">{customer.name}</div>
                      <div className="text-xs text-ink/50 mt-0.5">
                        Phone: {customer.phone || "No phone registered"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Customer Card banner */}
            {selectedCustomer && (
              <div className="rounded-xl bg-slatewash/30 p-4 border border-slatewash/60 text-xs grid gap-3 sm:grid-cols-3">
                <div>
                  <span className="text-[10px] text-ink/40 uppercase font-semibold block">Customer Account</span>
                  <span className="font-bold text-ink text-sm">{selectedCustomer.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-ink/40 uppercase font-semibold block">Outstanding Debt</span>
                  <span className="font-bold text-clay text-sm">{formatCurrency(selectedCustomer.outstandingBalance || 0)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-ink/40 uppercase font-semibold block">Approved Credit Limit</span>
                  <span className="font-bold text-ink text-sm">{formatCurrency(selectedCustomer.creditLimit || 0)}</span>
                </div>
              </div>
            )}

            {/* Credit Invoices Sub-Table */}
            {selectedCustomerId && unpaidInvoices.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Unpaid Credit Invoices ({unpaidInvoices.length})</h3>
                <div className="overflow-hidden rounded-xl border border-slatewash shadow-inner">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slatewash/40 text-[10px] font-bold uppercase text-ink/50 border-b border-slatewash">
                          <th className="px-4 py-2.5 w-12 text-center">Select</th>
                          <th className="px-4 py-2.5">Invoice Date</th>
                          <th className="px-4 py-2.5">Invoice No</th>
                          <th className="px-4 py-2.5">Order No</th>
                          <th className="px-4 py-2.5">Total Value</th>
                          <th className="px-4 py-2.5 text-right">Amount Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slatewash bg-white">
                        {unpaidInvoices.map((inv) => (
                          <tr key={inv._id} className="hover:bg-slatewash/15 transition-colors">
                            <td className="px-4 py-2.5 text-center">
                              <input
                                type="checkbox"
                                className="rounded text-ink border-slatewash focus:ring-ink h-4 w-4 cursor-pointer"
                                checked={!!selectedInvoices[inv._id]}
                                onChange={() => handleToggleInvoice(inv)}
                              />
                            </td>
                            <td className="px-4 py-2.5 text-ink/70">
                              {new Date(inv.createdAt).toLocaleDateString("en-LK")}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-ink">{inv.invoiceNo}</td>
                            <td className="px-4 py-2.5 text-ink/60">{inv.orderId?.orderNo || "-"}</td>
                            <td className="px-4 py-2.5 font-medium">{formatCurrency(inv.netTotal)}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-clay">
                              {formatCurrency(inv.dueAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Input grid */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-ink/60 uppercase">Payment Method</label>
                <select
                  className="mt-1.5 w-full rounded-xl border border-slatewash px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/80"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink/60 uppercase">Amount Received</label>
                <div className="mt-1.5 relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-xs font-bold text-ink/40">Rs.</span>
                  </div>
                  <input
                    className="w-full rounded-xl border border-slatewash pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white font-semibold text-ink"
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Cheque detail box */}
            {paymentMethod === "cheque" && (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 border-t border-slatewash/50 pt-4">
                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Cheque Number</label>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
                    placeholder="e.g. 293848"
                    value={chequeNo}
                    onChange={(event) => setChequeNo(event.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Bank Name</label>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
                    placeholder="e.g. BOC, Sampath"
                    value={bankName}
                    onChange={(event) => setBankName(event.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Cheque Due Date</label>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/75"
                    type="date"
                    value={chequeDate}
                    onChange={(event) => setChequeDate(event.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Cheque Status</label>
                  <select
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/85"
                    value={chequeStatus}
                    onChange={(event) => setChequeStatus(event.target.value)}
                  >
                    <option value="pending">Pending Clearance</option>
                    <option value="cleared">Cleared / Realised</option>
                    <option value="returned">Returned / Bounced</option>
                  </select>
                </div>
              </div>
            )}

            {/* Note text field */}
            <div>
              <label className="block text-xs font-bold text-ink/60 uppercase">Audit Reference Notes</label>
              <textarea
                className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
                rows="3"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional cheque details, rep names, or references..."
              />
            </div>

            {/* Action */}
            <div className="pt-4 border-t border-slatewash mt-6 flex justify-end">
              <button
                className="rounded-xl bg-ink px-8 py-3 text-sm font-semibold text-sand disabled:opacity-60 hover:bg-ink/90 transition shadow flex items-center gap-2"
                type="button"
                onClick={handleReceivePayment}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 border-2 border-sand border-t-transparent rounded-full animate-spin"></div>
                    Recording collection...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Record Route Payment
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel: Credit Customers list sidebar */}
          <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 space-y-4 max-h-[600px] flex flex-col">
            <div>
              <h2 className="text-xs font-bold text-ink uppercase tracking-wider">Unpaid Debtor Accounts</h2>
              <p className="text-[10px] text-ink/50 mt-0.5">Click an account to register collections.</p>
            </div>
            
            <input
              className="w-full rounded-xl border border-slatewash px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
              placeholder="Search debtor name or phone..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
            />

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[420px]">
              {filteredCreditCustomers.length === 0 ? (
                <div className="text-xs text-ink/40 py-8 text-center italic">No pending debtor accounts found.</div>
              ) : (
                filteredCreditCustomers.map((c) => {
                  const isSelected = c._id === selectedCustomerId;
                  return (
                    <button
                      key={c._id}
                      type="button"
                      className={`w-full p-3 text-left rounded-xl border transition flex flex-col gap-1
                        ${isSelected
                          ? "bg-slatewash/60 border-ink shadow-sm"
                          : "bg-white/40 border-slatewash/60 hover:bg-slatewash/20 hover:border-slatewash"
                        }
                      `}
                      onClick={() => handleSelectCustomer(c)}
                    >
                      <div className="font-bold text-ink text-xs flex items-center justify-between">
                        <span className="truncate pr-2">{c.name}</span>
                        <span className="text-clay shrink-0">{formatCurrency(c.outstandingBalance)}</span>
                      </div>
                      <div className="text-[10px] text-ink/50 flex items-center justify-between">
                        <span>{c.phone || "No phone"}</span>
                        {isSelected && (
                          <span className="text-[8px] bg-ink text-sand px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            Selected
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
