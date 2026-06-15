import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const emptyForm = {
  itemCode: "",
  productName: "",
  variant: "",
  category: "",
  barcode: "",
  searchKeywords: "",
  currentBillingPrice: "",
  currentSellingPrice: "",
  reorderLevel: "",
  isFastMoving: false,
  status: "active",
  supplier: "Ruhunu Foods"
};

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;

const ProductsPage = () => {
  const navigate = useNavigate();
  const itemCodeRef = useRef(null);
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Modals & Feedback
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  // Search & Filters states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");
  const [selectedFilterChip, setSelectedFilterChip] = useState("all");

  const role = useMemo(() => localStorage.getItem("role") || "rep", []);
  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const canEdit = role === "admin" || role === "manager";

  const displayName = useMemo(() => {
    if (!form.productName || !form.variant) {
      return "";
    }
    return `${form.productName} ${form.variant}`.trim();
  }, [form.productName, form.variant]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [categoryRes, productRes] = await Promise.all([
        api.get("/api/categories", { headers: authHeader, params: { status: "active" } }),
        api.get("/api/products", { headers: authHeader })
      ]);
      setCategories(categoryRes.data || []);
      setProducts(productRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess(null);

    if (!form.itemCode || !form.productName || !form.variant || !form.category) {
      setError("Item code, product name, variant, and category are required.");
      return;
    }

    if (form.currentBillingPrice === "" || form.currentSellingPrice === "") {
      setError("Billing price and selling price are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        itemCode: form.itemCode.toUpperCase().trim(),
        displayName,
        searchKeywords: form.searchKeywords
          ? form.searchKeywords.split(",").map((keyword) => keyword.trim()).filter(Boolean)
          : []
      };

      let savedProduct;
      if (editingProductId) {
        const { data } = await api.put(`/api/products/${editingProductId}`, payload, { headers: authHeader });
        savedProduct = data;
        setSuccess({ message: "Product updated successfully!", product: data });
      } else {
        const { data } = await api.post("/api/products", payload, { headers: authHeader });
        savedProduct = data;
        setSuccess({ message: "Product created successfully!", product: data });
      }

      setForm(emptyForm);
      setEditingProductId(null);
      setShowProductModal(false);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (product) => {
    setForm({
      itemCode: product.itemCode,
      productName: product.productName,
      variant: product.variant,
      category: product.category,
      barcode: product.barcode || "",
      searchKeywords: (product.searchKeywords || []).join(", "),
      currentBillingPrice: product.currentBillingPrice,
      currentSellingPrice: product.currentSellingPrice,
      reorderLevel: product.reorderLevel || "",
      isFastMoving: product.isFastMoving || false,
      status: product.status || "active",
      supplier: product.supplier || "Ruhunu Foods"
    });
    setEditingProductId(product._id);
    setShowProductModal(true);
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();
    setCategoryError("");

    if (!newCategoryName.trim()) {
      setCategoryError("Category name is required.");
      return;
    }

    try {
      const { data } = await api.post(
        "/api/categories",
        { name: newCategoryName.trim() },
        { headers: authHeader }
      );
      setCategories((prev) => [data, ...prev]);
      setForm((prev) => ({ ...prev, category: data._id }));
      setNewCategoryName("");
      setShowCategoryModal(false);
    } catch (err) {
      setCategoryError(err.response?.data?.message || "Failed to create category");
    }
  };

  // Real-time client-side search & filtering
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // 1. Search Query
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        product.displayName.toLowerCase().includes(query) ||
        product.itemCode.toLowerCase().includes(query) ||
        (product.searchKeywords || []).some((tag) => tag.toLowerCase().includes(query));

      // 2. Category Dropdown
      const matchesCategory =
        !selectedCategoryFilter || product.category === selectedCategoryFilter;

      // 3. Filter Chip Select
      let matchesChip = true;
      if (selectedFilterChip === "fast-moving") {
        matchesChip = product.isFastMoving;
      } else if (selectedFilterChip === "low-stock") {
        matchesChip = product.totalStock <= (product.reorderLevel || 0);
      } else if (selectedFilterChip === "inactive") {
        matchesChip = product.status === "inactive";
      }

      return matchesSearch && matchesCategory && matchesChip;
    });
  }, [products, searchQuery, selectedCategoryFilter, selectedFilterChip]);

  return (
    <section className="space-y-6">
      {/* Page Header */}
      <div className="rounded-2xl bg-white/80 p-6 shadow border-l-4 border-ink flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Products & Inventory</h1>
          <p className="text-sm text-ink/60 mt-0.5">Manage catalog items, pricing, reorder thresholds, and search tags.</p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setForm(emptyForm);
              setEditingProductId(null);
              setShowProductModal(true);
            }}
            className="rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-sand hover:bg-ink/90 transition shadow-sm flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay font-medium">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-leaf/30 bg-leaf/5 p-5 text-sm text-leaf flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-base font-bold">{success.message}</div>
            <div className="mt-1 text-xs text-ink/60">{success.product?.displayName} ({success.product?.itemCode})</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-sand hover:bg-ink/90 transition"
              onClick={() => navigate(`/stock/add?productId=${success.product?._id}`)}
              type="button"
            >
              Add Stock Now
            </button>
            <button
              className="rounded-xl border border-ink/20 px-4 py-2 text-xs font-semibold hover:bg-slatewash transition text-ink"
              onClick={() => setSuccess(null)}
              type="button"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Real-world Search & Filter Controls */}
      <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 space-y-4">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[280px]">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by name, item code, keywords..."
              className="w-full rounded-xl border border-slatewash pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Select Filter */}
          <div className="w-full sm:w-56">
            <select
              className="w-full rounded-xl border border-slatewash px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/80"
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-2 border-t border-slatewash/60 pt-3">
          {[
            { label: "All Items", value: "all" },
            { label: "Fast Moving", value: "fast-moving" },
            { label: "Low Stock Alert", value: "low-stock" },
            { label: "Inactive Items", value: "inactive" }
          ].map((chip) => (
            <button
              key={chip.value}
              onClick={() => setSelectedFilterChip(chip.value)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition border
                ${selectedFilterChip === chip.value
                  ? "bg-clay border-clay text-sand shadow-sm"
                  : "bg-slatewash/30 border-slatewash text-ink/75 hover:bg-slatewash/60"
                }
              `}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div id="products-list" className="rounded-2xl bg-white/90 p-6 shadow border border-slatewash/40">
        <div className="flex items-center justify-between border-b border-slatewash pb-3">
          <h2 className="text-sm font-bold text-ink uppercase tracking-wider">Catalog Items ({filteredProducts.length})</h2>
        </div>
        {loading ? (
          <div className="text-center py-12 text-sm text-ink/50 flex items-center justify-center gap-2">
            <div className="h-4 w-4 border-2 border-ink border-t-transparent rounded-full animate-spin"></div>
            Loading product data...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm mt-3">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-ink/40 border-b border-slatewash bg-slatewash/20">
                  <th className="px-4 py-3">Item Code</th>
                  <th className="px-4 py-3">Product details</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Billing Price</th>
                  <th className="px-4 py-3 text-right">Selling Price</th>
                  <th className="px-4 py-3 text-center">Stock Level</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  {canEdit && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slatewash">
                {filteredProducts.map((product) => (
                  <tr key={product._id} className="hover:bg-slatewash/20 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-ink">{product.itemCode}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-ink leading-snug">{product.displayName}</div>
                      {product.isFastMoving && (
                        <span className="inline-flex mt-1 rounded bg-leaf/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-leaf">
                          Fast Moving
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-ink/75">
                      {categories.find((cat) => cat._id === product.category)?.name || "-"}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-ink/80">
                      {formatCurrency(product.currentBillingPrice)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-ink">
                      {formatCurrency(product.currentSellingPrice)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {product.totalStock <= (product.reorderLevel || 0) ? (
                        <span className="inline-flex items-center gap-1 font-bold text-clay bg-clay/10 px-2.5 py-0.5 rounded-lg text-xs">
                          <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {product.totalStock}
                        </span>
                      ) : (
                        <span className="font-bold text-ink">{product.totalStock}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider
                        ${product.status === "active" ? "bg-leaf/10 text-leaf" : "bg-clay/10 text-clay"}`}>
                        {product.status}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => handleEditClick(product)}
                            className="p-1 hover:text-clay text-ink/50 transition"
                            title="Edit Product Details"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => navigate(`/stock/add?productId=${product._id}`)}
                            className="p-1 hover:text-indigo-600 text-ink/50 transition"
                            title="Quick Add Stock Batch"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td className="py-8 text-center text-ink/40 italic" colSpan={canEdit ? 8 : 7}>
                      No matching products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product Popup Modal (Add / Edit) */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-slatewash max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slatewash pb-3">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  {editingProductId ? "Edit Product Details" : "Create New Product"}
                </h3>
                <p className="text-xs text-ink/50">Enter the inventory specifications below.</p>
              </div>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-ink/40 hover:text-ink transition p-1"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Item Code */}
                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Item Code</label>
                  <input
                    ref={itemCodeRef}
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition uppercase"
                    name="itemCode"
                    value={form.itemCode}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        itemCode: event.target.value.toUpperCase()
                      }))
                    }
                    placeholder="e.g. CP50"
                    required
                  />
                </div>

                {/* Product Name */}
                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Product Name</label>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition"
                    name="productName"
                    value={form.productName}
                    onChange={handleChange}
                    placeholder="e.g. Chillie Powder"
                    required
                  />
                </div>

                {/* Variant / Size */}
                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Variant / Size</label>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition"
                    name="variant"
                    value={form.variant}
                    onChange={handleChange}
                    placeholder="e.g. 50g, 100g, 1L"
                    required
                  />
                </div>

                {/* Display Name Preview */}
                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Display Name Preview</label>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm bg-slatewash/30 text-ink/60 outline-none"
                    value={displayName}
                    readOnly
                  />
                </div>

                {/* Category Select */}
                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Category</label>
                  <div className="mt-1.5 flex gap-2">
                    <select
                      className="w-full rounded-xl border border-slatewash px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCategoryModal(true)}
                      className="rounded-xl border border-slatewash hover:bg-slatewash px-3 text-xs font-bold transition text-ink"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Status</label>
                  <select
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Supplier Company */}
                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Supplier Company</label>
                  <select
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
                    name="supplier"
                    value={form.supplier || "Ruhunu Foods"}
                    onChange={handleChange}
                    required
                  >
                    <option value="Ruhunu Foods">Ruhunu Foods</option>
                    <option value="Gajamuthu Foods">Gajamuthu Foods</option>
                  </select>
                </div>

                {/* Current Billing Price */}
                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Current Billing Price (Rs.)</label>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition"
                    name="currentBillingPrice"
                    value={form.currentBillingPrice}
                    onChange={handleChange}
                    type="number"
                    min="0"
                    step="any"
                    required
                  />
                </div>

                {/* Current Selling Price */}
                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Current Selling Price (Rs.)</label>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition"
                    name="currentSellingPrice"
                    value={form.currentSellingPrice}
                    onChange={handleChange}
                    type="number"
                    min="0"
                    step="any"
                    required
                  />
                </div>

                {/* Reorder Threshold */}
                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Reorder Level (Threshold)</label>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition"
                    name="reorderLevel"
                    value={form.reorderLevel}
                    onChange={handleChange}
                    type="number"
                    min="0"
                  />
                </div>

                {/* Fast Moving Check */}
                <div className="flex items-center gap-2 mt-4 sm:mt-6">
                  <input
                    type="checkbox"
                    name="isFastMoving"
                    id="isFastMoving"
                    checked={form.isFastMoving}
                    onChange={handleChange}
                    className="h-4.5 w-4.5 rounded border-slatewash text-clay focus:ring-clay focus:ring-offset-2"
                  />
                  <label htmlFor="isFastMoving" className="text-xs font-bold text-ink/70 uppercase select-none cursor-pointer">
                    Fast Moving Catalog Item
                  </label>
                </div>
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-xs font-bold text-ink/60 uppercase">Search Keywords (comma-separated)</label>
                <input
                  className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition"
                  name="searchKeywords"
                  value={form.searchKeywords}
                  onChange={handleChange}
                  placeholder="e.g. chili, miris, powder, organic"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slatewash">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="rounded-xl border border-slatewash px-5 py-2.5 text-sm font-semibold hover:bg-slatewash transition text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-ink px-6 py-2.5 text-sm font-semibold text-sand disabled:opacity-60 hover:bg-ink/90 transition shadow-sm"
                >
                  {saving ? "Saving..." : editingProductId ? "Update Product" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Popup Modal (z-[60] so it overlays the product modal if open) */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slatewash space-y-4">
            <div>
              <h4 className="text-base font-bold text-ink">Add Category</h4>
              <p className="text-xs text-ink/50">Create a new product classification tag.</p>
            </div>
            <form className="space-y-3" onSubmit={handleCreateCategory}>
              <input
                className="w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="e.g. Spices, Grains, Liquid"
                required
              />
              {categoryError && (
                <div className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-xs text-clay">
                  {categoryError}
                </div>
              )}
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  className="rounded-xl border border-slatewash px-4 py-2 text-xs font-bold hover:bg-slatewash transition text-ink"
                  onClick={() => setShowCategoryModal(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-xl bg-ink px-4 py-2 text-xs font-bold text-sand hover:bg-ink/90 transition"
                  type="submit"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProductsPage;
