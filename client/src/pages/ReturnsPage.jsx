import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import "./ReturnsPage.css";
const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" }) : "-";

const supplierAddresses = {
  "Ruhunu Foods": {
    companyName: "Ruhunu Foods (Pvt) Ltd.",
    streetAddress: "No: 235, Digana Road",
    cityPostal: "Kundasale 20168",
    country: "Sri Lanka"
  },
  "Gajamuthu Foods": {
    companyName: "Gajamuthu Food Products Pvt Ltd",
    streetAddress: "No 34, Jayathilakawatta Estate",
    cityPostal: "Horana, Western Province",
    country: "Sri Lanka"
  }
};

const ReturnsPage = () => {
  const [pendingReturns, setPendingReturns] = useState([]);
  const [dispatchHistory, setDispatchHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("Ruhunu Foods"); // "Ruhunu Foods" | "Gajamuthu Foods"
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "history"

  // Checkbox selections for pending return items (stores unique key: returnId-itemCode-condition)
  const [selectedItemKeys, setSelectedItemKeys] = useState([]);

  // Modal / Print states
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [supplierName, setSupplierName] = useState("Ruhunu Foods");
  const [dispatching, setDispatching] = useState(false);

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [pendingRes, historyRes] = await Promise.all([
        api.get("/api/returns/pending", { headers: authHeader }),
        api.get("/api/returns/dispatched", { headers: authHeader })
      ]);
      setPendingReturns(pendingRes.data || []);
      setDispatchHistory(historyRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load returns data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered returns based on search, condition, and supplier
  const filteredPending = useMemo(() => {
    return pendingReturns.filter((item) => {
      // Search matches customer name, slip invoice no, product code, or item name
      const matchesSearch =
        item.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
        (item.customer?.name || "Walk-in").toLowerCase().includes(search.toLowerCase()) ||
        item.itemName.toLowerCase().includes(search.toLowerCase()) ||
        item.itemCode.toLowerCase().includes(search.toLowerCase());

      const matchesCondition =
        conditionFilter === "all" || item.condition === conditionFilter;

      const matchesSupplier =
        supplierFilter === "all" || item.supplier === supplierFilter;

      return matchesSearch && matchesCondition && matchesSupplier;
    });
  }, [pendingReturns, search, conditionFilter, supplierFilter]);

  // KPI calculations (scoped to selected supplier)
  const stats = useMemo(() => {
    let totalValue = 0;
    let totalItemsCount = 0;
    let damagedCount = 0;
    let expiredCount = 0;
    let resellableCount = 0;
    let oldestDate = null;

    // Filter items by supplier to calculate specific statistics
    const supplierItems = pendingReturns.filter(
      (item) => supplierFilter === "all" || item.supplier === supplierFilter
    );

    supplierItems.forEach((item) => {
      totalValue += item.returnTotal || 0;
      if (!oldestDate || new Date(item.createdAt) < new Date(oldestDate)) {
        oldestDate = item.createdAt;
      }

      totalItemsCount += item.quantity;
      if (item.condition === "damaged") damagedCount += item.quantity;
      else if (item.condition === "expired") expiredCount += item.quantity;
      else resellableCount += item.quantity;
    });

    const oldestAgeDays = oldestDate
      ? Math.floor((new Date() - new Date(oldestDate)) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      totalValue,
      totalItemsCount,
      oldestAgeDays,
      damagedCount,
      expiredCount,
      resellableCount
    };
  }, [pendingReturns, supplierFilter]);

  // Handle individual selection toggles
  const handleSelectToggle = (key) => {
    setSelectedItemKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  // Handle selecting / deselecting all visible pending items
  const handleSelectAllToggle = () => {
    const visibleKeys = filteredPending.map((r) => r.key);
    const allVisibleSelected = visibleKeys.every((key) => selectedItemKeys.includes(key));

    if (allVisibleSelected) {
      setSelectedItemKeys((prev) => prev.filter((key) => !visibleKeys.includes(key)));
    } else {
      setSelectedItemKeys((prev) => {
        const newSelection = [...prev];
        visibleKeys.forEach((key) => {
          if (!newSelection.includes(key)) newSelection.push(key);
        });
        return newSelection;
      });
    }
  };

  // Dispatch selected returns to supplier
  const handleConfirmDispatch = async () => {
    if (selectedItemKeys.length === 0) return;

    // Compile backend request payload
    const dispatchItems = pendingReturns
      .filter((item) => selectedItemKeys.includes(item.key))
      .map((item) => ({
        returnId: item.returnId,
        itemCode: item.itemCode,
        condition: item.condition
      }));

    setDispatching(true);
    setError("");
    try {
      const res = await api.post(
        "/api/returns/dispatch",
        {
          supplierName: supplierName.trim(),
          dispatchItems
        },
        { headers: authHeader }
      );
      
      // Load updated data
      await loadData();
      
      // Clear checkbox selections
      setSelectedItemKeys([]);
      setShowConfirmModal(false);

      // Display generated Supplier Return Invoice
      setActiveInvoice(res.data);
      setShowInvoiceModal(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to dispatch returns to supplier");
    } finally {
      setDispatching(false);
    }
  };

  const handleViewInvoice = (invoice) => {
    setActiveInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <section className="space-y-6">
      {/* Page Header */}
      <div className="rounded-2xl bg-white/80 p-6 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Warehouse Returns Dispatch</h1>
            <p className="text-ink/60">
              Manage accumulated customer returns and dispatch them back to parent manufacturing company.
            </p>
          </div>
          {activeTab === "pending" && selectedItemKeys.length > 0 && (
            <button
              onClick={() => {
                setSupplierName(supplierFilter);
                setShowConfirmModal(true);
              }}
              disabled={dispatching}
              className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-sand shadow transition hover:bg-ink/90 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
              Dispatch {selectedItemKeys.length} Selected to {supplierFilter}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
          {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white/90 p-5 shadow">
          <div className="text-xs uppercase tracking-wider text-ink/60">{supplierFilter} Pending Value</div>
          <div className="mt-2 text-2xl font-bold text-ink">{formatCurrency(stats.totalValue)}</div>
          <div className="mt-1 text-xs text-ink/50">Accumulated in warehouse</div>
        </div>

        <div className="rounded-2xl bg-white/90 p-5 shadow">
          <div className="text-xs uppercase tracking-wider text-ink/60">Total Units Pending</div>
          <div className="mt-2 text-2xl font-bold text-ink">{stats.totalItemsCount} units</div>
          <div className="mt-1 text-xs text-ink/50">Awaiting supplier dispatch</div>
        </div>

        <div className="rounded-2xl bg-white/90 p-5 shadow">
          <div className="text-xs uppercase tracking-wider text-ink/60">Oldest Return Age</div>
          <div className="mt-2 text-2xl font-bold text-ink">{stats.oldestAgeDays} Days</div>
          <div className="mt-1 text-xs text-ink/50">
            {stats.oldestAgeDays > 60 ? (
              <span className="font-semibold text-clay">Action Required: &gt; 2 Months</span>
            ) : (
              "Within 1-3 months cycle"
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white/90 p-5 shadow">
          <div className="text-xs uppercase tracking-wider text-ink/60">Condition Breakdown</div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-clay font-medium">Damaged:</span>
              <span className="font-semibold">{stats.damagedCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-600 font-medium">Expired:</span>
              <span className="font-semibold">{stats.expiredCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-600 font-medium">Resellable:</span>
              <span className="font-semibold">{stats.resellableCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="border-b border-slatewash flex gap-4">
        <button
          onClick={() => setActiveTab("pending")}
          className={`pb-3 text-sm font-semibold relative transition ${
            activeTab === "pending" ? "text-ink border-b-2 border-ink" : "text-ink/50 hover:text-ink"
          }`}
        >
          Pending Customer Returns ({pendingReturns.length} Items Pool)
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 text-sm font-semibold relative transition ${
            activeTab === "history" ? "text-ink border-b-2 border-ink" : "text-ink/50 hover:text-ink"
          }`}
        >
          Supplier Dispatch History ({dispatchHistory.length})
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-white/80 p-8 text-center text-sm text-ink/60 shadow">
          Loading returns information...
        </div>
      ) : activeTab === "pending" ? (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/80 p-4 shadow">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              {/* Supplier Filter */}
              <select
                value={supplierFilter}
                onChange={(e) => {
                  setSupplierFilter(e.target.value);
                  setSupplierName(e.target.value);
                  setSelectedItemKeys([]); // Clear selections when switching supplier profiles
                }}
                className="rounded-xl border border-slatewash px-3 py-2 text-sm focus:outline-none bg-white font-semibold text-ink"
              >
                <option value="Ruhunu Foods">Supplier: Ruhunu Foods</option>
                <option value="Gajamuthu Foods">Supplier: Gajamuthu Foods</option>
              </select>

              {/* Search */}
              <input
                type="text"
                placeholder="Search Invoice, Customer, Item..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-xs rounded-xl border border-slatewash px-3 py-2 text-sm focus:outline-none focus:border-ink/50 bg-white"
              />

              {/* Condition Filter */}
              <select
                value={conditionFilter}
                onChange={(e) => setConditionFilter(e.target.value)}
                className="rounded-xl border border-slatewash px-3 py-2 text-sm focus:outline-none bg-white"
              >
                <option value="all">All Conditions</option>
                <option value="resellable">Resellable</option>
                <option value="damaged">Damaged</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div className="text-xs text-ink/50">
              Showing {filteredPending.length} pending items
            </div>
          </div>

          {/* Pending Returns List */}
          <div className="overflow-x-auto rounded-2xl bg-white shadow">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slatewash bg-slatewash/30 text-ink/60 font-bold">
                  <th className="p-4 w-12">
                    <input
                      type="checkbox"
                      checked={
                        filteredPending.length > 0 &&
                        filteredPending.every((r) => selectedItemKeys.includes(r.key))
                      }
                      onChange={handleSelectAllToggle}
                      className="rounded border-slatewash text-ink focus:ring-ink"
                    />
                  </th>
                  <th className="p-4 font-semibold">Date / Age</th>
                  <th className="p-4 font-semibold">Return Slip No</th>
                  <th className="p-4 font-semibold">Customer</th>
                  <th className="p-4 font-semibold">Product Details</th>
                  <th className="p-4 font-semibold">Condition</th>
                  <th className="p-4 font-semibold text-right">Return Price</th>
                  <th className="p-4 font-semibold text-center">Qty</th>
                  <th className="p-4 font-semibold text-right">Return Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slatewash">
                {filteredPending.map((item) => {
                  const isSelected = selectedItemKeys.includes(item.key);
                  const returnDate = new Date(item.createdAt);
                  const ageDays = Math.floor((new Date() - returnDate) / (1000 * 60 * 60 * 24));

                  return (
                    <tr
                      key={item.key}
                      className={`transition hover:bg-slatewash/20 ${isSelected ? "bg-slatewash/40" : ""}`}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectToggle(item.key)}
                          className="rounded border-slatewash text-ink focus:ring-ink"
                        />
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-ink">{formatDate(item.createdAt)}</div>
                        <div className="text-xs text-ink/50">{ageDays} days in warehouse</div>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-xs font-semibold bg-slatewash/60 px-2.5 py-1 rounded-full text-ink">
                          {item.invoiceNo}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-ink">{item.customer?.name || "Walk-in"}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-ink">{item.itemName}</div>
                        <div className="text-xs font-mono text-ink/50">{item.itemCode}</div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            item.condition === "damaged"
                              ? "bg-clay/10 text-clay"
                              : item.condition === "expired"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {item.condition.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono">{formatCurrency(item.returnPrice)}</td>
                      <td className="p-4 text-center font-bold text-ink">{item.quantity}</td>
                      <td className="p-4 text-right font-bold text-ink font-mono">
                        {formatCurrency(item.returnTotal)}
                      </td>
                    </tr>
                  );
                })}

                {filteredPending.length === 0 && (
                  <tr>
                    <td colSpan="9" className="p-8 text-center text-ink/50">
                      No pending return items found for {supplierFilter}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Dispatch History Log */
        <div className="overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slatewash bg-slatewash/30 text-ink/60">
                <th className="p-4 font-semibold">Dispatch Date</th>
                <th className="p-4 font-semibold">Supplier Invoice No</th>
                <th className="p-4 font-semibold">Supplier Company</th>
                <th className="p-4 font-semibold">Dispatched By</th>
                <th className="p-4 font-semibold">Unique Items</th>
                <th className="p-4 font-semibold text-right">Total Invoice Value</th>
                <th className="p-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slatewash">
              {dispatchHistory.map((disp) => {
                const totalUnits = disp.items?.reduce((sum, i) => sum + i.quantity, 0) || 0;
                return (
                  <tr key={disp._id} className="transition hover:bg-slatewash/10">
                    <td className="p-4">
                      <div className="font-semibold">{formatDate(disp.dispatchedAt)}</div>
                      <div className="text-xs text-ink/50">
                        {new Date(disp.dispatchedAt).toLocaleTimeString("en-LK", { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-xs font-semibold bg-slatewash/60 px-2.5 py-1 rounded-full text-ink">
                        {disp.supplierInvoiceNo}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-ink">
                      {disp.supplierName || "Ruhunu Foods"}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold">{disp.dispatchedBy?.name || "System"}</div>
                    </td>
                    <td className="p-4">
                      <div>{disp.items?.length || 0} Products</div>
                      <div className="text-xs text-ink/50">{totalUnits} units total</div>
                    </td>
                    <td className="p-4 text-right font-bold text-ink">
                      {formatCurrency(disp.totalAmount)}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleViewInvoice(disp)}
                        className="rounded-lg border border-ink/20 px-3 py-1.5 text-xs font-semibold hover:bg-slatewash/30 transition"
                      >
                        View & Print
                      </button>
                    </td>
                  </tr>
                );
              })}

              {dispatchHistory.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-ink/50">
                    No supplier dispatches recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUPPLIER RETURN INVOICE MODAL / PRINT VIEW */}
      {showInvoiceModal && activeInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm print:absolute print:inset-0 print:bg-white print:p-0 print:backdrop-blur-none overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl print:shadow-none print:max-w-none print:rounded-none printable-invoice">
            {/* Modal Actions Header (Hidden on Print) */}
            <div className="mb-4 flex items-center justify-between border-b border-slatewash pb-3 print:hidden">
              <h3 className="text-lg font-bold text-ink">Supplier Return Invoice</h3>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-sand hover:bg-ink/90 transition"
                >
                  Print Invoice
                </button>
                <button
                  onClick={() => {
                    setShowInvoiceModal(false);
                    setActiveInvoice(null);
                  }}
                  className="rounded-xl border border-slatewash px-4 py-2 text-xs font-semibold text-ink hover:bg-slatewash/30 transition"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Invoice Container */}
            <div className="p-4 print:p-0">
              {/* Invoice Brand Header */}
              <div className="flex justify-between items-start border-b-2 border-ink pb-6">
                <div className="flex items-center gap-4">
                  <img src="/logo.png" alt="JSP logo" className="h-16 w-16 object-contain" />
                  <div>
                    <h1 className="text-3xl font-black tracking-tight text-ink">JSP DISTRIBUTORS</h1>
                    <p className="text-xs text-ink/60 mt-0.5">Daily Operations & Warehouse Management</p>
                    <p className="text-xs text-ink/60">Phone: 0767761382 | Email: dilshanrajitha201@gmail.com</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block bg-ink text-sand font-mono text-xs px-3 py-1.5 rounded-md font-bold mb-2">
                    SUPPLIER RETURN
                  </div>
                  <div className="text-xs font-semibold text-ink/50">Invoice Number</div>
                  <div className="font-mono text-sm font-bold text-ink">{activeInvoice.supplierInvoiceNo}</div>
                  <div className="text-xs font-semibold text-ink/50 mt-2">Dispatch Date</div>
                  <div className="text-sm font-bold text-ink">{formatDate(activeInvoice.dispatchedAt)}</div>
                </div>
              </div>

              {/* Invoice Addresses */}
              <div className="grid grid-cols-2 gap-8 my-6 text-sm">
                <div>
                  <div className="font-bold text-ink/50 uppercase tracking-wide text-xs">Dispatched To:</div>
                  <div className="font-bold text-ink mt-1.5 text-base">
                    {supplierAddresses[activeInvoice.supplierName]?.companyName || activeInvoice.supplierName || "Ruhunu Foods"}
                  </div>
                  <div className="text-ink/70 mt-1">
                    {supplierAddresses[activeInvoice.supplierName]?.streetAddress || "Main Factory & Returns Warehouse"}
                  </div>
                  <div className="text-ink/70">
                    {supplierAddresses[activeInvoice.supplierName]?.cityPostal || "Industrial Zone, Colombo"}
                  </div>
                  <div className="text-ink/70">
                    {supplierAddresses[activeInvoice.supplierName]?.country || "Sri Lanka"}
                  </div>
                </div>
                <div>
                  <div className="font-bold text-ink/50 uppercase tracking-wide text-xs">Origin Warehouse:</div>
                  <div className="font-bold text-ink mt-1.5 text-base">JSP Central Warehouse</div>
                  <div className="text-ink/70 mt-1">Returns Processing Section</div>
                  <div className="text-ink/70">Authorized by: {activeInvoice.dispatchedBy?.name || "Warehouse Manager"}</div>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full border-collapse text-left text-xs my-6">
                <thead>
                  <tr className="border-b-2 border-ink bg-slatewash/40 font-bold text-ink">
                    <th className="p-2 w-12 text-center">#</th>
                    <th className="p-2">Item Code</th>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-center">Condition</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Return Price</th>
                    <th className="p-2 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slatewash">
                  {(activeInvoice.items || []).map((item, index) => (
                    <tr key={index} className="text-ink/90">
                      <td className="p-2 text-center font-mono">{index + 1}</td>
                      <td className="p-2 font-mono text-[11px]">{item.itemCode}</td>
                      <td className="p-2">
                        <div className="font-bold">{item.itemName}</div>
                        {item.originalInvoiceNo && (
                          <div className="text-[10px] text-ink/40">Ref invoice: {item.originalInvoiceNo}</div>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <span className="font-semibold uppercase tracking-wider text-[9px] bg-slatewash px-2 py-0.5 rounded border border-slatewash">
                          {item.condition}
                        </span>
                      </td>
                      <td className="p-2 text-center font-bold">{item.quantity}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(item.returnPrice)}</td>
                      <td className="p-2 text-right font-bold font-mono">{formatCurrency(item.returnTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Summary */}
              <div className="flex justify-between items-start border-t border-slatewash pt-4">
                <div className="max-w-xs text-[11px] text-ink/50 italic leading-relaxed">
                  Note: These products have been verified by the warehouse manager and are returned due to defect, expiry, or standard return lifecycle policies. Please credit our distribution account accordingly.
                </div>
                <div className="w-64">
                  <div className="flex justify-between text-xs py-1">
                    <span className="text-ink/60">Total Items:</span>
                    <span className="font-semibold text-ink">{(activeInvoice.items || []).length}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1">
                    <span className="text-ink/60">Total Quantity:</span>
                    <span className="font-semibold text-ink">
                      {activeInvoice.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} units
                    </span>
                  </div>
                  <div className="flex justify-between border-t-2 border-ink pt-2 text-sm font-bold text-ink">
                    <span>Grand Total:</span>
                    <span className="font-mono text-base">{formatCurrency(activeInvoice.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Signature Blocks */}
              <div className="grid grid-cols-2 gap-12 mt-16 text-xs text-center">
                <div className="border-t border-ink/40 pt-4">
                  <div className="font-bold text-ink">Warehouse Dispatcher Signature</div>
                  <div className="text-ink/40 mt-1">JSP Distributors representative</div>
                </div>
                <div className="border-t border-ink/40 pt-4">
                  <div className="font-bold text-ink">Supplier Acknowledgement</div>
                  <div className="text-ink/40 mt-1">Parent Manufacturing representative</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIER DISPATCH CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-ink mb-2">Confirm Supplier Dispatch</h3>
            <p className="text-sm text-ink/60 mb-4">
              You are dispatching <span className="font-semibold text-ink">{selectedItemKeys.length}</span> return item(s) back to the manufacturing supplier.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink/60 mb-1.5">
                Supplier Name
              </label>
              <input
                list="suppliers"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full rounded-xl border border-slatewash px-3 py-2 text-sm focus:outline-none focus:border-ink/50 bg-white"
                placeholder="Select or type supplier name..."
              />
              <datalist id="suppliers">
                <option value="Ruhunu Foods" />
                <option value="Gajamuthu Foods" />
              </datalist>
              <p className="text-[11px] text-ink/40 mt-1">
                Choose a structured option or type a custom name if a new supplier arises.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slatewash pt-4 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                }}
                className="rounded-xl border border-slatewash px-4 py-2 text-xs font-semibold text-ink hover:bg-slatewash/30 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDispatch}
                disabled={dispatching || !supplierName.trim()}
                className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-sand hover:bg-ink/90 transition disabled:opacity-50"
              >
                {dispatching ? "Processing..." : "Confirm Dispatch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ReturnsPage;
