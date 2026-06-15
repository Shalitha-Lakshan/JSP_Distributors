import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/client";

const StockAddPage = () => {
  const [searchParams] = useSearchParams();
  const [product, setProduct] = useState(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");

  const getTodayDateString = () => new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    productId: "",
    billingPrice: "",
    sellingPrice: "",
    quantity: "",
    expiryDate: "",
    receivedDate: getTodayDateString()
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadProductById = async (productId) => {
    if (!productId) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/api/products/${productId}`, { headers: authHeader });
      setProduct(data);
      setForm((prev) => ({
        ...prev,
        productId: data._id,
        billingPrice: prev.billingPrice || data.currentBillingPrice || "",
        sellingPrice: prev.sellingPrice || data.currentSellingPrice || ""
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load product");
    } finally {
      setLoading(false);
    }
  };

  const loadCatalog = async () => {
    try {
      const [categoryRes, productRes] = await Promise.all([
        api.get("/api/categories", { headers: authHeader, params: { status: "active" } }),
        api.get("/api/products", { headers: authHeader })
      ]);
      setCategories(categoryRes.data || []);
      setResults(productRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load products");
    }
  };

  useEffect(() => {
    const productId = searchParams.get("productId");
    if (productId) {
      loadProductById(productId);
    }
    loadCatalog();
  }, [searchParams]);

  const handleSelectProduct = (data) => {
    setProduct(data);
    setForm((prev) => ({
      ...prev,
      productId: data._id,
      billingPrice: data.currentBillingPrice || "",
      sellingPrice: data.currentSellingPrice || ""
    }));
    setSuccess("");
    setError("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleClearSelection = () => {
    setProduct(null);
    setForm({
      productId: "",
      billingPrice: "",
      sellingPrice: "",
      quantity: "",
      expiryDate: "",
      receivedDate: getTodayDateString()
    });
    setSuccess("");
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.productId) {
      setError("Please select a product first.");
      return;
    }

    if (!form.billingPrice || !form.sellingPrice || !form.quantity) {
      setError("Billing price, selling price, and quantity are required.");
      return;
    }

    setSaving(true);
    try {
      await api.post(
        "/api/stock/add",
        {
          productId: form.productId,
          billingPrice: Number(form.billingPrice),
          sellingPrice: Number(form.sellingPrice),
          quantity: Number(form.quantity),
          expiryDate: form.expiryDate || null,
          receivedDate: form.receivedDate || null
        },
        { headers: authHeader }
      );
      
      setSuccess(`Successfully added ${form.quantity} unit(s) of ${product.displayName}.`);
      
      // Update the local product's stock count for the UI preview
      setProduct((prev) => ({
        ...prev,
        totalStock: (prev.totalStock || 0) + Number(form.quantity),
        currentBillingPrice: Number(form.billingPrice),
        currentSellingPrice: Number(form.sellingPrice)
      }));

      // Reload catalog to reflect new stock levels in search results
      loadCatalog();

      // Reset form variables while keeping the product selected for further additions
      setForm((prev) => ({
        ...prev,
        quantity: "",
        expiryDate: ""
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add stock batch.");
    } finally {
      setSaving(false);
    }
  };

  // Filter products locally for search selection
  const filteredProducts = useMemo(() => {
    return results.filter((item) => {
      const text = search.trim().toLowerCase();
      const matchesSearch = !text
        ? true
        : `${item.itemCode} ${item.displayName}`.toLowerCase().includes(text);
      const matchesCategory = categoryFilter ? item.category === categoryFilter : true;
      const matchesSize = sizeFilter
        ? String(item.variant || "").toLowerCase().includes(sizeFilter.trim().toLowerCase())
        : true;
      return matchesSearch && matchesCategory && matchesSize;
    });
  }, [results, search, categoryFilter, sizeFilter]);

  return (
    <section className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-white/80 p-6 shadow border-l-4 border-ink flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Restock & Batch Entry</h1>
          <p className="text-sm text-ink/60 mt-0.5">
            Log incoming shipments, set FIFO batch details, and update default wholesale/retail prices.
          </p>
        </div>
      </div>

      {/* Notifications */}
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

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-6 items-start">
        
        {/* Left Column: Product Search & Selector */}
        <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 space-y-4">
          <div className="border-b border-slatewash pb-3">
            <h2 className="text-sm font-bold text-ink uppercase tracking-wider">1. Select Catalog Item</h2>
            <p className="text-xs text-ink/50 mt-0.5">Find the product you want to add stock for.</p>
          </div>

          <div className="space-y-3">
            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                className="w-full rounded-xl border border-slatewash pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
                placeholder="Search by code or item name..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {/* Sub Filters Grid */}
            <div className="grid grid-cols-2 gap-2">
              <select
                className="rounded-xl border border-slatewash px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/80"
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

              <input
                className="rounded-xl border border-slatewash px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
                placeholder="Size (e.g., 50g)"
                value={sizeFilter}
                onChange={(event) => setSizeFilter(event.target.value)}
              />
            </div>
          </div>

          {/* Results List */}
          <div className="mt-4 space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-8 text-center text-xs text-ink/40">Loading catalog items...</div>
            ) : filteredProducts.length > 0 ? (
              filteredProducts.slice(0, 10).map((item) => {
                const isSelected = product?._id === item._id;
                return (
                  <button
                    key={item._id}
                    className={`w-full rounded-xl border p-3 text-left transition flex items-center justify-between gap-4
                      ${isSelected
                        ? "border-ink bg-slatewash/60 shadow-sm"
                        : "border-slatewash/60 hover:border-ink/40 hover:bg-slatewash/20"
                      }
                    `}
                    type="button"
                    onClick={() => handleSelectProduct(item)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-ink/40 uppercase tracking-wider">{item.itemCode}</div>
                      <div className="text-sm font-semibold text-ink truncate mt-0.5">{item.displayName}</div>
                      <div className="text-xs text-ink/50 mt-1">
                        Catalog: B: Rs.{item.currentBillingPrice || 0} | S: Rs.{item.currentSellingPrice || 0}
                      </div>
                    </div>
                    
                    {/* Stock status indicator */}
                    <div className="text-right flex flex-col items-end shrink-0">
                      <div className="text-[10px] font-bold text-ink/40 uppercase">Stock</div>
                      <div className={`text-xs font-bold mt-0.5 rounded px-2 py-0.5
                        ${item.totalStock <= (item.reorderLevel || 0)
                          ? "bg-clay/10 text-clay"
                          : "bg-leaf/10 text-leaf"
                        }
                      `}>
                        {item.totalStock}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-ink/40 italic">
                No items match your filters.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Restock batch details Form */}
        <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 min-h-[400px] flex flex-col">
          
          <div className="border-b border-slatewash pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-ink uppercase tracking-wider">2. Add Stock Batch</h2>
              <p className="text-xs text-ink/50 mt-0.5">Enter transaction prices, size, and quantities.</p>
            </div>
            {product && (
              <button
                onClick={handleClearSelection}
                className="text-clay hover:text-clay/80 text-xs font-semibold px-2 py-1 rounded hover:bg-clay/5 transition"
              >
                Clear Selected
              </button>
            )}
          </div>

          {!product ? (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="rounded-full bg-slatewash/40 p-4 mb-4">
                <svg className="w-8 h-8 text-ink/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-ink">No Product Selected</h3>
              <p className="text-xs text-ink/50 max-w-xs mt-1 leading-relaxed">
                Click on a product from the list on the left to start adding a new FIFO batch to inventory.
              </p>
            </div>
          ) : (
            /* Selected Product Form */
            <div className="flex-1 flex flex-col justify-between mt-4">
              
              {/* Product Info Block */}
              <div className="rounded-xl bg-slatewash/30 p-4 border border-slatewash/50 flex flex-wrap items-center justify-between gap-4 mb-5">
                <div>
                  <div className="inline-flex rounded bg-ink/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink/70">
                    Active Product
                  </div>
                  <h3 className="text-sm font-bold text-ink mt-1.5">{product.displayName}</h3>
                  <div className="text-xs text-ink/50 mt-0.5">Item code: <span className="font-semibold text-ink/70">{product.itemCode}</span></div>
                </div>
                
                <div className="flex gap-4">
                  <div className="text-right">
                    <div className="text-[10px] font-semibold text-ink/40 uppercase">Total Stock</div>
                    <div className="text-sm font-bold text-ink">{product.totalStock || 0}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-semibold text-ink/40 uppercase">Reorder Level</div>
                    <div className="text-sm font-bold text-clay">{product.reorderLevel || 0}</div>
                  </div>
                </div>
              </div>

              {/* Form inputs */}
              <form onSubmit={handleSubmit} className="space-y-4 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Billing Price */}
                  <div>
                    <label className="block text-xs font-bold text-ink/60 uppercase">Billing Price</label>
                    <div className="mt-1.5 relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-xs font-bold text-ink/40">Rs.</span>
                      </div>
                      <input
                        className="w-full rounded-xl border border-slatewash pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
                        name="billingPrice"
                        value={form.billingPrice}
                        onChange={handleChange}
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-ink/40 mt-1 italic pl-1">
                      Catalog default: Rs. {product.currentBillingPrice || 0}
                    </p>
                  </div>

                  {/* Selling Price */}
                  <div>
                    <label className="block text-xs font-bold text-ink/60 uppercase">Selling Price</label>
                    <div className="mt-1.5 relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-xs font-bold text-ink/40">Rs.</span>
                      </div>
                      <input
                        className="w-full rounded-xl border border-slatewash pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
                        name="sellingPrice"
                        value={form.sellingPrice}
                        onChange={handleChange}
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-ink/40 mt-1 italic pl-1">
                      Catalog default: Rs. {product.currentSellingPrice || 0}
                    </p>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-xs font-bold text-ink/60 uppercase">Quantity (Units)</label>
                    <input
                      className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
                      name="quantity"
                      value={form.quantity}
                      onChange={handleChange}
                      type="number"
                      min="1"
                      placeholder="e.g. 50"
                      required
                    />
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <label className="block text-xs font-bold text-ink/60 uppercase">Expiry Date (Optional)</label>
                    <input
                      className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/70"
                      name="expiryDate"
                      value={form.expiryDate}
                      onChange={handleChange}
                      type="date"
                    />
                  </div>

                  {/* Received Date */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-ink/60 uppercase">Received Date</label>
                    <input
                      className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/70"
                      name="receivedDate"
                      value={form.receivedDate}
                      onChange={handleChange}
                      type="date"
                      required
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-slatewash mt-6 flex justify-end">
                  <button
                    className="rounded-xl bg-ink px-8 py-3 text-sm font-semibold text-sand disabled:opacity-60 hover:bg-ink/90 transition shadow flex items-center gap-2"
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <div className="h-4 w-4 border-2 border-sand border-t-transparent rounded-full animate-spin"></div>
                        Saving Batch...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Stock Batch
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default StockAddPage;

