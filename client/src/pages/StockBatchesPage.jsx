import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/client";

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-LK") : "-";

const StockBatchesPage = () => {
  const [searchParams] = useSearchParams();
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

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white/80 p-6 shadow">
        <h1 className="text-2xl font-semibold">Stock Batches</h1>
        <p className="text-ink/60">Review FIFO batches, remaining stock, and expiry dates.</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-white/90 p-6 shadow">
        <div className="text-sm font-semibold text-ink/70">Filters</div>
        <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <input
            className="w-full rounded-xl border border-slatewash px-4 py-3"
            placeholder="Search by item code, batch no, or name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="w-full rounded-xl border border-slatewash px-4 py-3"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            className="w-full rounded-xl border border-slatewash px-4 py-3"
            placeholder="Near expiry (days)"
            value={nearExpiryDays}
            onChange={(event) => setNearExpiryDays(event.target.value)}
            type="number"
            min="0"
          />
          <label className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            <input
              type="checkbox"
              checked={remainingOnly}
              onChange={(event) => setRemainingOnly(event.target.checked)}
              className="h-4 w-4"
            />
            Remaining only
          </label>
        </div>
      </div>

      <div className="rounded-2xl bg-white/90 p-6 shadow">
        <div className="text-sm font-semibold text-ink/70">Batch List</div>
        {loading ? (
          <div className="mt-4 text-sm text-ink/60">Loading batches...</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-ink/50">
                <tr>
                  <th className="py-2 pr-4">Batch No</th>
                  <th className="py-2 pr-4">Item Code</th>
                  <th className="py-2 pr-4">Item Name</th>
                  <th className="py-2 pr-4">Received</th>
                  <th className="py-2 pr-4">Expiry</th>
                  <th className="py-2 pr-4">Remaining</th>
                  <th className="py-2 pr-4">Billing</th>
                  <th className="py-2">Selling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slatewash">
                {filteredBatches.map((batch) => (
                  <tr key={batch._id}>
                    <td className="py-2 pr-4 font-semibold">{batch.batchNo}</td>
                    <td className="py-2 pr-4">{batch.productId?.itemCode || "-"}</td>
                    <td className="py-2 pr-4">{batch.productId?.displayName || "-"}</td>
                    <td className="py-2 pr-4">{formatDate(batch.receivedDate)}</td>
                    <td className="py-2 pr-4">{formatDate(batch.expiryDate)}</td>
                    <td className="py-2 pr-4">{batch.remainingQty}</td>
                    <td className="py-2 pr-4">Rs. {batch.billingPrice}</td>
                    <td className="py-2">Rs. {batch.sellingPrice}</td>
                  </tr>
                ))}
                {filteredBatches.length === 0 && (
                  <tr>
                    <td className="py-3 text-ink/60" colSpan="8">
                      No stock batches found.
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
