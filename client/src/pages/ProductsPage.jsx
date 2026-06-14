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
  status: "active"
};

const ProductsPage = () => {
  const navigate = useNavigate();
  const itemCodeRef = useRef(null);
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");

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

    if (!form.currentBillingPrice || !form.currentSellingPrice) {
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

      const { data } = await api.post("/api/products", payload, { headers: authHeader });
      setSuccess(data);
      setForm(emptyForm);
      await loadData();
      itemCodeRef.current?.focus();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create product");
    } finally {
      setSaving(false);
    }
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

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white/80 p-6 shadow">
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="text-ink/60">Manage items, categories, and search keywords.</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-leaf/30 bg-leaf/10 p-5 text-sm text-leaf">
          <div className="text-base font-semibold">Product created successfully.</div>
          <div className="mt-2 text-sm text-ink/70">{success.displayName}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-sand"
              onClick={() => navigate(`/stock/add?productId=${success._id}`)}
              type="button"
            >
              Add Stock Now
            </button>
            <button
              className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold"
              onClick={() => itemCodeRef.current?.focus()}
              type="button"
            >
              Add Another Product
            </button>
            <button
              className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold"
              onClick={() => document.getElementById("products-list")?.scrollIntoView({ behavior: "smooth" })}
              type="button"
            >
              View Products
            </button>
          </div>
        </div>
      )}

      {canEdit && (
        <div className="rounded-2xl bg-white/90 p-6 shadow">
          <div className="text-sm font-semibold text-ink/70">Add Product</div>
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="text-sm font-semibold text-ink/70">
              Item Code
              <input
                ref={itemCodeRef}
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
                name="itemCode"
                value={form.itemCode}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    itemCode: event.target.value.toUpperCase()
                  }))
                }
                placeholder="CP50"
                required
              />
            </label>
            <label className="text-sm font-semibold text-ink/70">
              Product Name
              <input
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
                name="productName"
                value={form.productName}
                onChange={handleChange}
                placeholder="Chillie Powder"
                required
              />
            </label>
            <label className="text-sm font-semibold text-ink/70">
              Variant / Size
              <input
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
                name="variant"
                value={form.variant}
                onChange={handleChange}
                placeholder="50g"
                required
              />
            </label>
            <label className="text-sm font-semibold text-ink/70">
              Display Name
              <input
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3 bg-slatewash/40"
                value={displayName}
                readOnly
              />
            </label>
            <label className="text-sm font-semibold text-ink/70">
              Category
              <div className="mt-2 flex gap-2">
                <select
                  className="w-full rounded-xl border border-slatewash px-4 py-3"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <button
                  className="rounded-xl border border-ink/20 px-3 text-xs font-semibold"
                  onClick={() => setShowCategoryModal(true)}
                  type="button"
                >
                  + Add
                </button>
              </div>
            </label>
            <label className="text-sm font-semibold text-ink/70">
              Current Billing Price
              <input
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
                name="currentBillingPrice"
                value={form.currentBillingPrice}
                onChange={handleChange}
                type="number"
                min="0"
                required
              />
            </label>
            <label className="text-sm font-semibold text-ink/70">
              Current Selling Price
              <input
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
                name="currentSellingPrice"
                value={form.currentSellingPrice}
                onChange={handleChange}
                type="number"
                min="0"
                required
              />
            </label>
            <label className="text-sm font-semibold text-ink/70">
              Reorder Level
              <input
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
                name="reorderLevel"
                value={form.reorderLevel}
                onChange={handleChange}
                type="number"
                min="0"
              />
            </label>
            <label className="text-sm font-semibold text-ink/70">
              Status
              <select
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-ink/70">
              <input
                type="checkbox"
                name="isFastMoving"
                checked={form.isFastMoving}
                onChange={handleChange}
                className="h-4 w-4"
              />
              Fast Moving Item
            </label>
            <label className="md:col-span-2 text-sm font-semibold text-ink/70">
              Search Keywords (comma-separated)
              <input
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
                name="searchKeywords"
                value={form.searchKeywords}
                onChange={handleChange}
                placeholder="chili, miris, powder, 50g"
              />
            </label>
            <div className="md:col-span-2 flex flex-wrap gap-3">
              <button
                className="rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-sand disabled:opacity-60"
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving..." : "Create Product"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div id="products-list" className="rounded-2xl bg-white/90 p-6 shadow">
        <div className="text-sm font-semibold text-ink/70">Products List</div>
        {loading ? (
          <div className="mt-4 text-sm text-ink/60">Loading products...</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-ink/50">
                <tr>
                  <th className="py-2 pr-4">Item Code</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Stock</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slatewash">
                {products.map((product) => (
                  <tr key={product._id}>
                    <td className="py-2 pr-4 font-semibold">{product.itemCode}</td>
                    <td className="py-2 pr-4">{product.displayName}</td>
                    <td className="py-2 pr-4">
                      {categories.find((category) => category._id === product.category)?.name || "-"}
                    </td>
                    <td className="py-2 pr-4">{product.totalStock}</td>
                    <td className="py-2 pr-4">
                      <span className="rounded-full bg-slatewash px-2 py-1 text-xs font-semibold">
                        {product.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td className="py-3 text-ink/60" colSpan="5">
                      No products available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCategoryModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <div className="text-lg font-semibold">Add Category</div>
            <p className="text-sm text-ink/60">Create a new product category.</p>
            <form className="mt-4 space-y-3" onSubmit={handleCreateCategory}>
              <input
                className="w-full rounded-xl border border-slatewash px-4 py-3"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="Spices"
              />
              {categoryError && (
                <div className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
                  {categoryError}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold"
                  onClick={() => setShowCategoryModal(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-sand"
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
