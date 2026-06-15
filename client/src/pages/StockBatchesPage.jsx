import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../api/client";

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-LK") : "-";

const formatCurrency = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const StockBatchesPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [remainingOnly, setRemainingOnly] = useState(true);
  const [nearExpiryDays, setNearExpiryDays] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadBatches = async (params = {}) => {
    setLoading(true);
    setError("");
    try {
      const [categoryRes, batchRes] = await Promise.all([
        api.get("/api/categories", { headers: authHeader, params: { status: "active" } }),
        api.get("/api/stock/batches", { headers: authHeader, params })
      ]);
      setCategories(categoryRes.data || []);
      setBatches(batchRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load batches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const filter = searchParams.get("filter");
    if (filter === "near-expiry") {
      setNearExpiryDays("30");
    }
    loadBatches({
      remainingOnly: "true",
      nearExpiryDays: filter === "near-expiry" ? "30" : undefined
    });
  }, [searchParams]);

  useEffect(() => {
    const params = {
      remainingOnly: remainingOnly ? "true" : "false"
    };
    if (nearExpiryDays) {
      params.nearExpiryDays = nearExpiryDays;
    }
    loadBatches(params);
  }, [remainingOnly, nearExpiryDays]);

  const filteredBatches = useMemo(() => {
    const text = search.trim().toLowerCase();
    return batches.filter((batch) => {
      const name = batch.productId?.displayName || "";
      const code = batch.productId?.itemCode || "";
      const matchesSearch = !text
        ? true
        : `${code} ${name} ${batch.batchNo}`.toLowerCase().includes(text);
      const matchesCategory = categoryFilter
        ? batch.productId?.category === categoryFilter
        : true;
      return matchesSearch && matchesCategory;
    });
  }, [batches, search, categoryFilter]);

  // Compute expiry state health and color classes
  const getExpiryHealth = (expiryDate) => {
    if (!expiryDate) {
      return {
        label: "No Expiry Limit",
        colorClass: "text-ink/40 bg-slatewash/40",
        status: "none"
      };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return {
        label: `Expired ${Math.abs(diffDays)}d ago`,
        colorClass: "text-clay bg-clay/10 border border-clay/20 font-bold",
        status: "expired"
      };
    } else if (diffDays <= 30) {
      return {
        label: `Expires in ${diffDays}d`,
        colorClass: "text-amber-700 bg-amber-50 border border-amber-200 font-bold animate-pulse",
        status: "near-expiry"
      };
    } else {
      return {
        label: expiry.toLocaleDateString("en-LK"),
        colorClass: "text-leaf bg-leaf/10 font-medium",
        status: "healthy"
      };
    }
  };

  // Compute live inventory summaries for cards
  const metrics = useMemo(() => {
    let cost = 0;
    let qty = 0;
    let riskCount = 0;
    
    filteredBatches.forEach((b) => {
      cost += (b.remainingQty || 0) * (b.billingPrice || 0);
      qty += b.remainingQty || 0;
      
      if (b.expiryDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiry = new Date(b.expiryDate);
        expiry.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) {
          riskCount++;
        }
      }
    });

    return {
      totalCost: cost,
      totalQty: qty,
      riskCount,
      batchesCount: filteredBatches.length
    };
  }, [filteredBatches]);

  return (
    <section className="space-y-6">
      {/* Header Panel */}
      <div className="rounded-2xl bg-white/80 p-6 shadow border-l-4 border-ink flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Stock Batches & FIFO Logs</h1>
          <p className="text-sm text-ink/60 mt-0.5">
            Review detailed inventory batches, trace received dates, track expiry timelines, and monitor FIFO queues.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay font-medium">
          {error}
        </div>
      )}

      {/* Summary Metrics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cost Metric */}
        <div className="rounded-2xl bg-white/90 p-4 shadow border-b-4 border-leaf flex flex-col justify-between min-h-[100px]">
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Total Inventory Value</span>
          <span className="text-base sm:text-lg font-bold text-ink truncate mt-2">
            {formatCurrency(metrics.totalCost)}
          </span>
          <span className="text-[10px] text-ink/50 mt-1 italic">Based on cost billing price</span>
        </div>

        {/* Total Stock Qty */}
        <div className="rounded-2xl bg-white/90 p-4 shadow border-b-4 border-slatewash flex flex-col justify-between min-h-[100px]">
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Total Remaining Stock</span>
          <span className="text-lg sm:text-xl font-bold text-ink mt-2">
            {metrics.totalQty.toLocaleString("en-LK")} <span className="text-xs font-normal text-ink/55">Units</span>
          </span>
          <span className="text-[10px] text-ink/50 mt-1">Across all matching batches</span>
        </div>

        {/* Batches Count */}
        <div className="rounded-2xl bg-white/90 p-4 shadow border-b-4 border-ink flex flex-col justify-between min-h-[100px]">
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Active Batches</span>
          <span className="text-lg sm:text-xl font-bold text-ink mt-2">
            {metrics.batchesCount} <span className="text-xs font-normal text-ink/55">Record(s)</span>
          </span>
          <span className="text-[10px] text-ink/50 mt-1">FIFO batch groups loaded</span>
        </div>

        {/* Expiry Risk Alerts */}
        <div className="rounded-2xl bg-white/90 p-4 shadow border-b-4 border-clay flex flex-col justify-between min-h-[100px]">
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Expiration Risks</span>
          <span className={`text-lg sm:text-xl font-bold mt-2 ${metrics.riskCount > 0 ? "text-clay" : "text-leaf"}`}>
            {metrics.riskCount} <span className="text-xs font-normal text-ink/55">Batch(es)</span>
          </span>
          <span className="text-[10px] text-ink/50 mt-1">Expiring in &le; 30 days or expired</span>
        </div>
      </div>

      {/* Advanced Filter Controls */}
      <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 space-y-4">
        <div className="text-xs font-bold text-ink/60 uppercase tracking-wider">Filter & Inspect Batches</div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 items-center">
          {/* Search bar */}
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              className="w-full rounded-xl border border-slatewash pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
              placeholder="Search by code, batch, name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {/* Category Dropdown */}
          <select
            className="w-full rounded-xl border border-slatewash px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/80"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>

          {/* Expiry filter days */}
          <input
            className="w-full rounded-xl border border-slatewash px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
            placeholder="Near Expiry Days (e.g. 30)"
            value={nearExpiryDays}
            onChange={(event) => setNearExpiryDays(event.target.value)}
            type="number"
            min="0"
          />

          {/* Remaining Stock Only Checkbox styled */}
          <label className="flex items-center gap-3 p-2 border border-slatewash/50 rounded-xl hover:bg-slatewash/20 cursor-pointer transition select-none bg-white">
            <input
              type="checkbox"
              checked={remainingOnly}
              onChange={(event) => setRemainingOnly(event.target.checked)}
              className="h-4.5 w-4.5 rounded border-slatewash text-ink focus:ring-ink"
            />
            <span className="text-xs font-semibold text-ink/70">Remaining Stock Only</span>
          </label>
        </div>
      </div>

      {/* Batches List Container */}
      <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40">
        <div className="flex items-center justify-between border-b border-slatewash pb-3">
          <h2 className="text-xs font-bold text-ink uppercase tracking-wider">FIFO Batch Records ({filteredBatches.length})</h2>
        </div>
        
        {loading ? (
          <div className="text-center py-12 text-xs text-ink/50 flex items-center justify-center gap-2">
            <div className="h-4 w-4 border-2 border-ink border-t-transparent rounded-full animate-spin"></div>
            Loading batch database...
          </div>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-ink/40 border-b border-slatewash bg-slatewash/20">
                  <th className="px-4 py-3">Batch Number</th>
                  <th className="px-4 py-3">Item Detail</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Received Date</th>
                  <th className="px-4 py-3 text-center">Expiry Timeline</th>
                  <th className="px-4 py-3 text-center">Remaining</th>
                  <th className="px-4 py-3 text-right">Wholesale Cost</th>
                  <th className="px-4 py-3 text-right">Retail Sell</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slatewash">
                {filteredBatches.map((batch) => {
                  const expiryHealth = getExpiryHealth(batch.expiryDate);
                  return (
                    <tr key={batch._id} className="hover:bg-slatewash/10 transition-colors">
                      {/* Batch Number */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex rounded-lg bg-ink/5 border border-ink/10 px-2 py-1 font-bold text-ink">
                          {batch.batchNo}
                        </span>
                      </td>

                      {/* Product Detail */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-ink leading-snug">
                          {batch.productId?.displayName || "-"}
                        </div>
                        <div className="text-[10px] font-bold text-ink/45 mt-0.5 tracking-wide">
                          CODE: {batch.productId?.itemCode || "-"}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5 text-ink/70">
                        {categories.find((c) => c._id === batch.productId?.category)?.name || "-"}
                      </td>

                      {/* Received Date */}
                      <td className="px-4 py-3.5 text-ink/70">
                        {formatDate(batch.receivedDate)}
                      </td>

                      {/* Expiry Health Badge */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-block rounded-full px-3 py-1 text-[10px] tracking-wide leading-none ${expiryHealth.colorClass}`}>
                          {expiryHealth.label}
                        </span>
                      </td>

                      {/* Remaining Qty */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 font-bold px-2 py-1 rounded-lg text-xs
                          ${batch.remainingQty <= 10
                            ? "text-clay bg-clay/10"
                            : "text-ink bg-slatewash/50"
                          }
                        `}>
                          {batch.remainingQty}
                        </span>
                      </td>

                      {/* Cost/Billing Price */}
                      <td className="px-4 py-3.5 text-right font-medium text-ink/75">
                        Rs. {Number(batch.billingPrice || 0).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                      </td>

                      {/* Retail/Selling Price */}
                      <td className="px-4 py-3.5 text-right font-bold text-ink">
                        Rs. {Number(batch.sellingPrice || 0).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                      </td>

                      {/* Actions shortcuts */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => navigate(`/stock/add?productId=${batch.productId?._id}`)}
                          className="rounded-lg border border-slatewash px-2 py-1 text-[10px] font-bold text-ink/60 hover:bg-slatewash hover:text-ink transition flex items-center gap-1 mx-auto"
                          title="Restock this item"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Restock
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredBatches.length === 0 && (
                  <tr>
                    <td className="py-12 text-center text-ink/40 italic" colSpan="9">
                      No stock batch records match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default StockBatchesPage;

