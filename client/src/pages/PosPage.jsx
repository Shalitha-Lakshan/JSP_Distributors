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
  
  const [activeTrip, setActiveTrip] = useState(null);
  const [checkingTrip, setCheckingTrip] = useState(true);
  const role = useMemo(() => localStorage.getItem("role") || "rep", []);
  const isRep = role === "rep";

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setCheckingTrip(true);
      try {
        const [categoryRes, productRes, customerRes, tripRes] = await Promise.all([
          api.get("/api/categories", { headers: authHeader, params: { status: "active" } }),
          api.get("/api/products", { headers: authHeader, params: { status: "active" } }),
          api.get("/api/customers", { headers: authHeader }),
          api.get("/api/trips/active", { headers: authHeader }).catch(() => ({ data: null }))
        ]);
        setCategories(categoryRes.data || []);
        setProducts(productRes.data || []);
        setCustomers(customerRes.data || []);
        setActiveTrip(tripRes.data || null);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load order data");
      } finally {
        setLoading(false);
        setCheckingTrip(false);
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

    if (isRep && !activeTrip) {
      setError("You must have an active trip session to save orders. Please start one on the Trip Sessions page.");
      return;
    }

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

  if (isRep && !activeTrip && !checkingTrip) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white/80 rounded-2xl p-8 shadow text-center space-y-4">
        <div className="rounded-full bg-clay/10 p-4 text-clay">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-ink">Trip Session Required</h2>
        <p className="text-ink/60 max-w-md">
          To book orders in the field, you must have an active trip session. Please start a session first.
        </p>
        <button
          onClick={() => navigate("/trips")}
          className="rounded-lg bg-ink px-6 py-3 text-sm font-semibold text-sand hover:bg-ink/90 transition shadow"
        >
          Go to Trip Sessions
        </button>
      </div>
    );
  }

  // Inline SVGs for POS UI
  const POSIcons = {
    search: (
      <svg className="w-4 h-4 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    filter: (
      <svg className="w-4 h-4 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 13.293A1 1 0 013 12.586V4z" />
      </svg>
    ),
    trash: (
      <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    user: (
      <svg className="w-4 h-4 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    plus: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
    minus: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
      </svg>
    ),
    truck: (
      <svg className="w-5 h-5 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
      </svg>
    ),
    cart: (
      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── ACTIVE ROUTE TRIP BANNER ── */}
      {activeTrip && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-900 to-teal-800 border border-teal-700/50 p-4 text-white shadow-lg shadow-teal-950/20">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 h-24 w-24 rounded-full bg-white/5 blur-2xl"></div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/10 p-2 text-white">
                {POSIcons.truck}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-full">Active Route session</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <h2 className="text-sm font-black mt-0.5">
                  Route: {activeTrip.route} <span className="mx-2 text-white/40">|</span> Trip No: <span className="font-mono text-emerald-300 font-bold">{activeTrip.tripNo}</span>
                </h2>
              </div>
            </div>
            <button
              onClick={() => navigate("/trips")}
              className="rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition duration-200"
            >
              Manage Trip Details
            </button>
          </div>
        </div>
      )}

      {/* ── TWO COLUMN POS INTERFACE ── */}
      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        
        {/* LEFT PANE: PRODUCT CATALOG & SEARCH */}
        <div className="space-y-6">
          
          {/* SEARCH & FILTERS CONTROLLER */}
          <div className="rounded-3xl bg-white p-5 shadow-sm border border-slatewash/55 space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-clay">CATALOG CONTROL</span>
              <h1 className="text-xl font-extrabold text-ink mt-0.5">Product Selection</h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[240px]">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  {POSIcons.search}
                </span>
                <input
                  type="text"
                  placeholder="Search item code, brand name, size..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-2xl border border-slatewash/80 bg-white/50 pl-10 pr-4 py-2.5 text-sm font-semibold text-ink placeholder:text-ink/30 focus:outline-none focus:border-ink/50 focus:bg-white transition"
                />
              </div>

              {/* Category Dropdown */}
              <div className="relative">
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="appearance-none rounded-2xl border border-slatewash/80 bg-white/50 pl-4 pr-10 py-2.5 text-sm font-bold text-ink/80 focus:outline-none focus:border-ink/50 focus:bg-white transition cursor-pointer"
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-ink/40">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </div>

              {/* Variant / Size Dropdown */}
              <div className="relative">
                <select
                  value={sizeFilter}
                  onChange={(event) => setSizeFilter(event.target.value)}
                  className="appearance-none rounded-2xl border border-slatewash/80 bg-white/50 pl-4 pr-10 py-2.5 text-sm font-bold text-ink/80 focus:outline-none focus:border-ink/50 focus:bg-white transition cursor-pointer"
                >
                  <option value="">All Sizes</option>
                  {sizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-ink/40">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </div>
            </div>

            {/* FAST MOVING SHUTTLES */}
            <div className="border-t border-slatewash/40 pt-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink/40 block mb-2.5">Fast Moving Products</span>
              <div className="flex flex-wrap gap-2">
                {fastMoving.map((item) => {
                  const stock = item.totalStock || 0;
                  const isAvailable = stock > 0;
                  return (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => handleAddToCart(item)}
                      disabled={!isAvailable}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition duration-200 ${
                        isAvailable
                          ? "bg-slatewash/50 border-slatewash hover:bg-ink hover:text-sand hover:border-ink text-ink cursor-pointer"
                          : "bg-slatewash/20 border-slatewash/30 text-ink/30 cursor-not-allowed"
                      }`}
                    >
                      <span>{item.displayName}</span>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${isAvailable ? "bg-emerald-500" : "bg-red-400"}`}></span>
                      <span className="font-bold opacity-60">({stock})</span>
                    </button>
                  );
                })}
                {fastMoving.length === 0 && (
                  <span className="text-xs text-ink/40 italic">No fast-moving products highlighted.</span>
                )}
              </div>
            </div>
          </div>

          {/* SEARCH RESULTS PANEL */}
          <div className="rounded-3xl bg-white p-5 shadow-sm border border-slatewash/55 space-y-4">
            <div className="flex items-center justify-between border-b border-slatewash/40 pb-3">
              <span className="text-xs font-bold text-ink/40 uppercase">Search Results</span>
              <span className="text-xs font-semibold text-ink/50">Showing top {Math.min(filteredProducts.length, 12)} entries</span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink border-t-transparent"></div>
                <span className="text-xs text-ink/50 font-medium">Updating product index...</span>
              </div>
            ) : (
              <div className="divide-y divide-slatewash/45">
                {filteredProducts.slice(0, 12).map((item) => {
                  const stock = item.totalStock || 0;
                  const inCart = getCartQty(item._id);
                  const isAvailable = stock > 0;
                  
                  return (
                    <div key={item._id} className="flex flex-wrap items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0 group">
                      <div>
                        <div className="font-extrabold text-ink group-hover:text-leaf transition-colors">{item.displayName}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="font-mono text-xs text-ink/40 font-semibold">{item.itemCode}</span>
                          {item.variant && (
                            <span className="text-[10px] bg-slatewash/60 px-2 py-0.5 rounded text-ink/60 font-bold">{item.variant}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-5">
                        {/* Stock Badge */}
                        <div className="text-right">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide ${
                            stock > 100
                              ? "bg-emerald-50 text-emerald-700"
                              : stock > 0
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-700"
                          }`}>
                            {stock > 0 ? `${stock} Units Available` : "Stock Depleted"}
                          </span>
                          {inCart > 0 && (
                            <div className="text-[10px] font-semibold text-leaf mt-0.5">
                              {inCart} added to order
                            </div>
                          )}
                        </div>

                        {/* Action Button */}
                        <button
                          type="button"
                          onClick={() => handleAddToCart(item)}
                          disabled={!isAvailable}
                          className={`rounded-xl px-4 py-2 text-xs font-black tracking-wide shadow-sm transition duration-200 ${
                            isAvailable
                              ? "bg-ink text-sand hover:bg-leaf hover:shadow-md cursor-pointer"
                              : "bg-slatewash/60 text-ink/30 cursor-not-allowed"
                          }`}
                        >
                          {isAvailable ? "+ Add to Order" : "Unavailable"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                
                {filteredProducts.length === 0 && (
                  <div className="text-center py-10 space-y-1.5">
                    <span className="text-sm font-semibold text-ink/40 block">No matching products found</span>
                    <span className="text-xs text-ink/35 block">Refine your search keyword or selection filters</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: ORDER CART & SUMMARIES */}
        <div className="space-y-6">
          
          {/* BASKET COMMAND */}
          <div className="rounded-3xl bg-white p-5 shadow-sm border border-slatewash/55 space-y-4">
            <div className="flex items-center justify-between border-b border-slatewash/40 pb-3">
              <h2 className="text-lg font-black text-ink">Order Items</h2>
              <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-sand">
                {cart.reduce((sum, item) => sum + item.quantity, 0)} Items
              </span>
            </div>

            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-ink/40">
                <svg className="w-10 h-10 mb-2.5 text-ink/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="text-sm font-bold">Shopping cart is empty</span>
                <span className="text-xs text-ink/45 mt-0.5">Add products from the catalog panel</span>
              </div>
            )}

            <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
              {cart.map((item) => {
                const stock = getProductStock(item.productId);
                return (
                  <div key={item.productId} className="rounded-2xl border border-slatewash/60 p-3.5 space-y-3 hover:border-slatewash transition">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-extrabold text-sm text-ink leading-snug">{item.itemName}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-ink/40 font-bold">{item.itemCode}</span>
                          <span className="text-[10px] text-ink/50">Stock: <strong className="font-bold">{stock}</strong></span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.productId)}
                        className="p-1.5 hover:bg-rose-50 rounded-lg transition duration-200"
                        title="Remove product"
                      >
                        {POSIcons.trash}
                      </button>
                    </div>

                    {/* Stepper & Details */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slatewash/40">
                      
                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-slatewash/70 rounded-xl bg-slatewash/20 p-1">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.productId, item.quantity - 1)}
                          className="p-1 hover:bg-white text-ink/70 hover:text-ink rounded-lg transition"
                        >
                          {POSIcons.minus}
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={stock}
                          value={item.quantity}
                          onChange={(e) => updateCartQty(item.productId, Number(e.target.value))}
                          className="w-10 text-center text-xs font-bold text-ink bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.productId, item.quantity + 1)}
                          className="p-1 hover:bg-white text-ink/70 hover:text-ink rounded-lg transition"
                          disabled={item.quantity >= stock}
                        >
                          {POSIcons.plus}
                        </button>
                      </div>

                      {/* Total */}
                      <div className="text-right">
                        <div className="text-[10px] text-ink/40 font-bold uppercase tracking-wider">Line Total</div>
                        <div className="text-sm font-black text-ink font-mono">{formatCurrency(item.lineTotal)}</div>
                      </div>
                    </div>

                    {/* FIFO Batch Allocation Preview */}
                    {item.usedBatches && item.usedBatches.length > 0 && (
                      <div className="rounded-xl bg-slatewash/40 p-2.5 text-[11px] space-y-1.5">
                        <div className="text-[9px] font-black text-ink/40 uppercase tracking-widest border-b border-slatewash/50 pb-1">
                          FIFO Batch Allocation
                        </div>
                        <div className="space-y-1">
                          {item.usedBatches.map((b, idx) => (
                            <div key={idx} className="flex justify-between items-center text-ink/70">
                              <span className="font-semibold">
                                Batch <strong className="font-mono text-[10px] text-ink">{b.batchNo}</strong>
                              </span>
                              <span className="font-mono">
                                {b.qty} × Rs. {Number(b.billingPrice).toLocaleString("en-LK")} = <strong className="text-ink">Rs. {Number(b.lineTotal).toLocaleString("en-LK")}</strong>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* CUSTOMER PROFILE SELECTOR */}
            <div className="border-t border-slatewash/50 pt-4.5 space-y-3.5">
              <div className="text-xs font-black text-ink/40 uppercase tracking-wider">Customer Details</div>
              
              {/* Search Bar with autocomplete suggestions */}
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  {POSIcons.user}
                </span>
                <input
                  type="text"
                  placeholder="Search customer by name or phone..."
                  value={customerSearch}
                  onChange={(event) => {
                    setCustomerSearch(event.target.value);
                    setCustomerId("");
                    setIsWalkIn(false);
                  }}
                  className="w-full rounded-2xl border border-slatewash/80 bg-white pl-10 pr-4 py-2.5 text-sm font-semibold text-ink focus:outline-none focus:border-ink/50 transition"
                />

                {customerSearch && !customerId && !isWalkIn && customerSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-2 w-full max-h-[220px] overflow-y-auto rounded-2xl border border-slatewash bg-white shadow-xl">
                    {customerSuggestions.map((customer) => (
                      <button
                        key={customer._id}
                        type="button"
                        onClick={() => handleSelectCustomer(customer)}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-slatewash/40 flex items-center gap-3 transition"
                      >
                        <div className="h-8 w-8 rounded-full bg-ink/5 text-ink/60 font-bold text-xs flex items-center justify-center uppercase shrink-0">
                          {customer.name?.charAt(0) || "U"}
                        </div>
                        <div>
                          <div className="font-extrabold text-ink">{customer.name}</div>
                          <div className="text-xs text-ink/50 font-semibold">
                            {customer.phone || "No contact digits"}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {customerSearch && !customerId && !isWalkIn && customerSuggestions.length === 0 && (
                  <div className="absolute z-10 mt-2 w-full rounded-2xl border border-slatewash bg-white px-4 py-3 text-xs text-ink/45 shadow-xl">
                    No customers match your criteria.
                  </div>
                )}
              </div>

              {/* Quick Toggles */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slatewash/15 p-2 rounded-2xl border border-slatewash/30 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsWalkIn(true);
                    setCustomerId("");
                    setCustomerSearch("Walk-in customer");
                  }}
                  className="rounded-xl border border-ink/20 px-3.5 py-1.5 font-bold hover:bg-ink hover:text-sand hover:border-ink transition duration-200 cursor-pointer"
                >
                  Walk-in Customer
                </button>
                <span className="text-[10px] font-semibold text-ink/40 leading-tight shrink text-right">
                  Credit features require a registered profile.
                </span>
              </div>

              {/* Active Selection Info Card */}
              {selectedCustomer && (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-teal-50 border border-teal-100 p-3.5 text-xs text-teal-800">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-teal-600/10 text-teal-800 font-bold text-xs flex items-center justify-center uppercase shrink-0">
                      {selectedCustomer.name?.charAt(0) || "C"}
                    </div>
                    <div>
                      <div className="font-extrabold text-teal-950">{selectedCustomer.name}</div>
                      {selectedCustomer.phone && <div className="text-[10px] opacity-70 font-mono mt-0.5">{selectedCustomer.phone}</div>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerId("");
                      setCustomerSearch("");
                      setIsWalkIn(false);
                    }}
                    className="text-xs font-black text-rose-600 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}

              {!selectedCustomer && isWalkIn && (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 border border-amber-100 p-3.5 text-xs text-amber-800">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-amber-600/10 text-amber-800 font-bold text-xs flex items-center justify-center uppercase shrink-0">
                      W
                    </div>
                    <div>
                      <div className="font-extrabold text-amber-950">Walk-in Customer Profile</div>
                      <div className="text-[10px] opacity-70 mt-0.5">Immediate OTC checkout context</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsWalkIn(false);
                      setCustomerSearch("");
                    }}
                    className="text-xs font-black text-rose-600 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* ORDER VALUE & DISPATCH CONTROL */}
            <div className="border-t-2 border-slatewash pt-4 space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-black text-ink/40 uppercase tracking-wider">Aggregate Bill Total</span>
                <span className="text-2xl font-black text-ink font-mono tracking-tight">{formatCurrency(orderTotal)}</span>
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 font-semibold">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-xs text-emerald-800 space-y-2.5">
                  <div className="font-bold">Order created successfully: <span className="font-mono text-emerald-950 font-extrabold">{success.orderNo}</span></div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigate("/sales")}
                      className="rounded-xl bg-ink px-4 py-2 text-xs font-bold text-sand hover:bg-leaf transition"
                    >
                      View Sales Ledger
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuccess(null)}
                      className="rounded-xl border border-ink/20 px-4 py-2 text-xs font-bold text-ink hover:bg-slatewash/40 transition"
                    >
                      New Checkout
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={saving || cart.length === 0}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-clay text-white py-3.5 text-sm font-black uppercase tracking-widest shadow-md hover:bg-clay/90 hover:shadow-lg active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    {POSIcons.cart}
                    <span>Save & Reconcile Order</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </section>
    </div>
  );
};

export default PosPage;
