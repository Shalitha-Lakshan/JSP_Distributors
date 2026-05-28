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
  const [form, setForm] = useState({
    productId: "",
    billingPrice: "",
    sellingPrice: "",
    quantity: "",
    expiryDate: "",
    receivedDate: ""
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
      billingPrice: prev.billingPrice || data.currentBillingPrice || "",
      sellingPrice: prev.sellingPrice || data.currentSellingPrice || ""
    }));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.productId) {
      setError("Select a product first.");
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
      setSuccess("Stock batch added successfully.");
      setForm((prev) => ({
        ...prev,
        quantity: "",
        expiryDate: "",
        receivedDate: ""
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white/80 p-6 shadow">
        <h1 className="text-2xl font-semibold">Stock Add</h1>
        <p className="text-ink/60">Scan barcode or select a product to add a new batch.</p>
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

      <div className="rounded-2xl bg-white/90 p-6 shadow">
        <div className="text-sm font-semibold text-ink/70">Find Product</div>
        <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <input
            className="w-full rounded-xl border border-slatewash px-4 py-3"
            placeholder="Search by item code or name"
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
            placeholder="Size (e.g., 50g)"
            value={sizeFilter}
            onChange={(event) => setSizeFilter(event.target.value)}
          />
        </div>

        <div className="mt-4 space-y-2">
          {results
            .filter((item) => {
              const text = search.trim().toLowerCase();
              const matchesSearch = !text
                ? true
                : `${item.itemCode} ${item.displayName}`.toLowerCase().includes(text);
              const matchesCategory = categoryFilter ? item.category === categoryFilter : true;
              const matchesSize = sizeFilter
                ? String(item.variant || "").toLowerCase().includes(sizeFilter.trim().toLowerCase())
                : true;
              return matchesSearch && matchesCategory && matchesSize;
            })
            .slice(0, 8)
            .map((item) => (
              <button
                key={item._id}
                className="w-full rounded-2xl border border-slatewash p-3 text-left hover:bg-slatewash/40"
                type="button"
                onClick={() => handleSelectProduct(item)}
              >
                <div className="text-sm font-semibold">{item.displayName}</div>
                <div className="text-xs text-ink/60">Item code: {item.itemCode}</div>
              </button>
            ))}
        </div>

        {product && (
          <div className="mt-4 rounded-2xl bg-slatewash/60 p-4">
            <div className="text-sm font-semibold">{product.displayName}</div>
            <div className="text-xs text-ink/60">Item code: {product.itemCode}</div>
            <div className="mt-2 text-xs text-ink/60">
              Current Billing: Rs. {product.currentBillingPrice} | Selling: Rs. {product.currentSellingPrice}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white/90 p-6 shadow">
        <div className="text-sm font-semibold text-ink/70">Add Stock Batch</div>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="text-sm font-semibold text-ink/70">
            Billing Price
            <input
              className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
              name="billingPrice"
              value={form.billingPrice}
              onChange={handleChange}
              type="number"
              min="0"
              required
            />
          </label>
          <label className="text-sm font-semibold text-ink/70">
            Selling Price
            <input
              className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
              name="sellingPrice"
              value={form.sellingPrice}
              onChange={handleChange}
              type="number"
              min="0"
              required
            />
          </label>
          <label className="text-sm font-semibold text-ink/70">
            Quantity
            <input
              className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
              name="quantity"
              value={form.quantity}
              onChange={handleChange}
              type="number"
              min="0"
              required
            />
          </label>
          <label className="text-sm font-semibold text-ink/70">
            Expiry Date (optional)
            <input
              className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
              name="expiryDate"
              value={form.expiryDate}
              onChange={handleChange}
              type="date"
            />
          </label>
          <label className="text-sm font-semibold text-ink/70">
            Received Date (optional)
            <input
              className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
              name="receivedDate"
              value={form.receivedDate}
              onChange={handleChange}
              type="date"
            />
          </label>
          <div className="md:col-span-2">
            <button
              className="rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-sand disabled:opacity-60"
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving..." : "Add Stock"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default StockAddPage;
