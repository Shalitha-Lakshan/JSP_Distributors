import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;

const PosPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [categoryRes, productRes, customerRes] = await Promise.all([
          api.get("/api/categories", { headers: authHeader, params: { status: "active" } }),
          api.get("/api/products", { headers: authHeader, params: { status: "active" } }),
          api.get("/api/customers", { headers: authHeader })
        ]);
        setCategories(categoryRes.data || []);
        setProducts(productRes.data || []);
        setCustomers(customerRes.data || []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load order data");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const sizeOptions = useMemo(() => {
    const unique = new Set();
    products.forEach((product) => {
      if (product.variant) {
        unique.add(product.variant);
      }
    });
    return [...unique];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const text = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        !text ||
        `${product.itemCode} ${product.displayName}`.toLowerCase().includes(text) ||
        (product.searchKeywords || []).some((keyword) => keyword.includes(text));
      const matchesCategory = categoryFilter ? product.category === categoryFilter : true;
      const matchesSize = sizeFilter ? product.variant === sizeFilter : true;
      return matchesSearch && matchesCategory && matchesSize;
    });
  }, [products, search, categoryFilter, sizeFilter]);

  const fastMoving = useMemo(
    () => products.filter((product) => product.isFastMoving).slice(0, 8),
    [products]
  );

  const orderTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.lineTotal, 0),
    [cart]
  );

  const customerSuggestions = useMemo(() => {
    const text = customerSearch.trim().toLowerCase();
    if (!text) {
      return [];
    }

    return customers
      .filter((customer) => {
        const haystack = `${customer.name} ${customer.phone || ""} ${
          customer.address || ""
        }`.toLowerCase();
        return haystack.includes(text);
      })
      .slice(0, 8);
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer._id === customerId),
    [customers, customerId]
  );

  const getProductStock = (productId) => {
    const product = products.find((entry) => entry._id === productId);
    return Number(product?.totalStock || 0);
  };

  const getCartQty = (productId) =>
    cart.find((item) => item.productId === productId)?.quantity || 0;

  const computeBillingForQty = async (productId, qty) => {
    // fetch FIFO batches for product and compute billing total for qty
    const { data: batches = [] } = await api.get(`/api/stock/product/${productId}`, {
      headers: authHeader
    });
    const availableBatches = (batches || []).filter((b) => Number(b.remainingQty || 0) > 0);
    let remaining = qty;
    let billingTotal = 0;
    const usedBatches = [];

    for (const batch of availableBatches) {
      if (remaining <= 0) break;
      const take = Math.min(Number(batch.remainingQty || 0), remaining);
      remaining -= take;
      const bp = Number(batch.billingPrice || 0);
      billingTotal += take * bp;
      usedBatches.push({ batchId: batch._id, batchNo: batch.batchNo, qty: take, billingPrice: bp, lineTotal: take * bp });
    }

    if (remaining > 0) {
      throw new Error("Insufficient stock to compute billing price");
    }

    return { unitPrice: billingTotal / qty, lineTotal: billingTotal, usedBatches };
  };

  // Tracks product IDs that currently have an in-flight addToCart request.
  // Prevents duplicate rows when a user clicks/double-clicks rapidly.
  const pendingRef = useRef(new Set());

  const handleAddToCart = async (product) => {
    const pid = product._id;

    // ── Guard: ignore if a request for this product is already in flight ──
    if (pendingRef.current.has(pid)) return;
    pendingRef.current.add(pid);

    try {
      const availableStock = Number(product.totalStock || 0);

      if (availableStock <= 0) {
        setError(`No stock available for ${product.displayName}.`);
        return;
      }

      // Read the latest cart snapshot to decide qty.
      // We use a local variable updated via functional setter so it
      // reflects any state changes that occurred since the last render.
      let currentQty = 0;
      setCart((prevCart) => {
        const existing = prevCart.find((item) => item.productId === pid);
        currentQty = existing?.quantity ?? 0;
        return prevCart; // no-op read to get latest value
      });

      // Wait one microtask tick so the state read above has resolved.
      await Promise.resolve();

      // Re-read from DOM-stable ref after the microtask
      // (setCart above may not have flushed yet; use a snapshot approach)
      // Actually, we capture currentQty from the functional updater above.

      if (currentQty >= availableStock) {
        setError(`No stock available for ${product.displayName}.`);
        return;
      }

      const nextQty = currentQty + 1;
      const billing = await computeBillingForQty(pid, nextQty);

      // Functional update: always operates on the freshest prevCart
      setCart((prevCart) => {
        const existingIndex = prevCart.findIndex((item) => item.productId === pid);

        if (existingIndex !== -1) {
          // Item already in cart → update quantity + billing in-place
          return prevCart.map((item) =>
            item.productId === pid
              ? {
                  ...item,
                  quantity: nextQty,
                  unitPrice: billing.unitPrice,
                  lineTotal: billing.lineTotal,
                  usedBatches: billing.usedBatches
                }
              : item
          );
        }

        // Item not yet in cart → append as a new row
        return [
          ...prevCart,
          {
            productId: pid,
            itemCode: product.itemCode,
            itemName: product.displayName,
            quantity: 1,
            unitPrice: billing.unitPrice,
            lineTotal: billing.lineTotal,
            usedBatches: billing.usedBatches
          }
        ];
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to compute billing price");
    } finally {
      // Always release the lock so future clicks work normally
      pendingRef.current.delete(pid);
    }
  };

  const updateCartQty = async (productId, nextQty) => {
    const availableStock = getProductStock(productId);
    const safeQty = Math.min(Math.max(nextQty, 0), availableStock);

    if (safeQty <= 0) {
      setCart((prev) => prev.filter((item) => item.productId !== productId));
      return;
    }

    try {
      const billing = await computeBillingForQty(productId, safeQty);
      setCart((prev) =>
        prev
          .map((item) =>
            item.productId === productId
              ? { ...item, quantity: safeQty, unitPrice: billing.unitPrice, lineTotal: billing.lineTotal, usedBatches: billing.usedBatches }
              : item
          )
          .filter((item) => item.quantity > 0)
      );
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to compute billing price");
    }

    if (nextQty > availableStock) {
      setError("Quantity exceeds available stock.");
    }
  };

  const removeCartItem = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleCreateOrder = async () => {
    setError("");
    setSuccess(null);

    if (!customerId && !isWalkIn) {
      setError("Select a customer or choose walk-in before saving the order.");
      return;
    }

    if (cart.length === 0) {
      setError("Add at least one item to the order.");
      return;
    }

    const stockIssue = cart.find((item) => item.quantity > getProductStock(item.productId));
    if (stockIssue) {
      setError(`Insufficient stock for ${stockIssue.itemName}.`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          usedBatches: item.usedBatches || []
        }))
      };

      if (customerId) {
        payload.customer = customerId;
      }

      const { data } = await api.post("/api/orders", payload, { headers: authHeader });
      setSuccess(data);
      setCart([]);
      setCustomerId("");
      setCustomerSearch("");
      setIsWalkIn(false);
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create order");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectCustomer = (customer) => {
    setCustomerId(customer._id);
    setCustomerSearch(
      `${customer.name}${customer.phone ? ` - ${customer.phone}` : ""}`
    );
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <div className="rounded-2xl bg-white/80 p-4 shadow">
          <div className="text-lg font-semibold">Create Order</div>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              className="flex-1 min-w-[220px] rounded-lg border border-slatewash px-3 py-2"
              placeholder="Search by item code, name, size or keyword"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="rounded-lg border border-slatewash px-3 py-2"
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
            <select
              className="rounded-lg border border-slatewash px-3 py-2"
              value={sizeFilter}
              onChange={(event) => setSizeFilter(event.target.value)}
            >
              <option value="">All sizes</option>
              {sizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {fastMoving.map((item) => (
              <button
                key={item._id}
                className={`rounded-full px-3 py-1 text-sm ${
                  item.totalStock > 0
                    ? "bg-slatewash text-ink"
                    : "bg-slatewash/40 text-ink/40 cursor-not-allowed"
                }`}
                type="button"
                onClick={() => handleAddToCart(item)}
                disabled={item.totalStock <= 0}
              >
                {item.displayName} ({item.totalStock || 0})
              </button>
            ))}
            {fastMoving.length === 0 && (
              <span className="text-xs text-ink/60">No fast-moving items set.</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl bg-white/80 p-4 shadow">
          <div className="mb-3 text-sm text-ink/60">Search results</div>
          {loading ? (
            <div className="text-sm text-ink/60">Loading products...</div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.slice(0, 12).map((item) => (
                <div key={item._id} className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{item.displayName}</div>
                    <div className="text-sm text-ink/60">Item code: {item.itemCode}</div>
                    <div className="text-xs text-ink/60">Available: {item.totalStock || 0}</div>
                  </div>
                  <button
                    className={`rounded-lg px-3 py-1 ${
                      item.totalStock > 0
                        ? "bg-ink text-sand"
                        : "bg-slatewash text-ink/40 cursor-not-allowed"
                    }`}
                    type="button"
                    onClick={() => handleAddToCart(item)}
                    disabled={item.totalStock <= 0}
                  >
                    {item.totalStock > 0 ? "Add" : "Out of stock"}
                  </button>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="text-sm text-ink/60">No products found.</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl bg-white/80 p-4 shadow">
        <div className="text-lg font-semibold">Order Items</div>
        {cart.length === 0 && <div className="text-sm text-ink/60">Cart is empty.</div>}
        <div className="space-y-3">
          {cart.map((item) => (
            <div key={item.productId} className="rounded-2xl border border-slatewash p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{item.itemName}</div>
                  <div className="text-sm text-ink/60">Item code: {item.itemCode}</div>
                  <div className="text-xs text-ink/60">
                    Available: {getProductStock(item.productId)}
                  </div>
                </div>
                <button
                  className="text-xs font-semibold text-clay"
                  type="button"
                  onClick={() => removeCartItem(item.productId)}
                >
                  Remove
                </button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input
                  className="rounded-lg border border-slatewash px-3 py-2"
                  type="number"
                  min="1"
                  max={getProductStock(item.productId)}
                  value={item.quantity}
                  onChange={(event) => updateCartQty(item.productId, Number(event.target.value))}
                />

                <div className="rounded-lg bg-slatewash/70 px-3 py-2 text-sm">
                  {item.usedBatches && item.usedBatches.length > 0 ? (
                    <div>
                      <div className="text-xs text-ink/70">
                        {item.usedBatches.map((b, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>
                              {b.qty} × Rs. {Number(b.billingPrice).toLocaleString("en-LK")}
                            </span>
                            <span>Rs. {Number(b.lineTotal).toLocaleString("en-LK")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-ink/60">Billing preview unavailable</div>
                  )}
                </div>

                <div className="rounded-lg bg-slatewash/70 px-3 py-2 text-sm">
                  <div className="text-xs text-ink/60">Item Total</div>
                  <div className="font-semibold">{formatCurrency(item.lineTotal)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-slatewash pt-4">
          <div className="text-sm font-semibold text-ink/70">Customer</div>
          <div className="relative">
            <input
              className="w-full rounded-lg border border-slatewash px-3 py-2"
              placeholder="Search customer by name or phone"
              value={customerSearch}
              onChange={(event) => {
                setCustomerSearch(event.target.value);
                setCustomerId("");
                setIsWalkIn(false);
              }}
            />
            {customerSearch && !customerId && !isWalkIn && customerSuggestions.length > 0 && (
              <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-slatewash bg-white shadow">
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
            {customerSearch && !customerId && !isWalkIn && customerSuggestions.length === 0 && (
              <div className="absolute z-10 mt-2 w-full rounded-2xl border border-slatewash bg-white px-4 py-3 text-sm text-ink/60 shadow">
                No customers found.
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              className="rounded-full border border-ink/20 px-3 py-1 font-semibold"
              onClick={() => {
                setIsWalkIn(true);
                setCustomerId("");
                setCustomerSearch("Walk-in customer");
              }}
            >
              Walk-in (no saved customer)
            </button>
            <span className="text-ink/50">
              Credit is available only for registered customers.
            </span>
          </div>
          {selectedCustomer && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slatewash/60 px-3 py-2 text-xs text-ink/70">
              <span>
                Selected: {selectedCustomer.name}
                {selectedCustomer.phone ? ` - ${selectedCustomer.phone}` : ""}
              </span>
              <button
                type="button"
                className="text-xs font-semibold text-clay"
                onClick={() => {
                  setCustomerId("");
                  setCustomerSearch("");
                  setIsWalkIn(false);
                }}
              >
                Clear
              </button>
            </div>
          )}
          {!selectedCustomer && isWalkIn && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slatewash/60 px-3 py-2 text-xs text-ink/70">
              <span>Selected: Walk-in customer</span>
              <button
                type="button"
                className="text-xs font-semibold text-clay"
                onClick={() => {
                  setIsWalkIn(false);
                  setCustomerSearch("");
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-slatewash pt-4">
          <div className="flex justify-between text-sm">
            <span>Order Total</span>
            <span className="font-semibold">{formatCurrency(orderTotal)}</span>
          </div>
          {error && (
            <div className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-leaf/30 bg-leaf/10 px-4 py-3 text-sm text-leaf">
              Order created: {success.orderNo}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-sand"
                  type="button"
                  onClick={() => navigate("/sales")}
                >
                  Go to Sales
                </button>
                <button
                  className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold"
                  type="button"
                  onClick={() => setSuccess(null)}
                >
                  New Order
                </button>
              </div>
            </div>
          )}
          <button
            className="w-full rounded-lg bg-clay py-2 text-white disabled:opacity-60"
            type="button"
            onClick={handleCreateOrder}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Order"}
          </button>
        </div>
      </div>
    </section>
  );
};

export default PosPage;
