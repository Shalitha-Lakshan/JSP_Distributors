import { useEffect, useMemo, useState } from "react";
import api from "../api/client";

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-LK") : "-");

const SalesHistoryPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [mode, setMode] = useState("");
  const [editItems, setEditItems] = useState([]);
  const [deliveryItems, setDeliveryItems] = useState([]);
  const [hasReturns, setHasReturns] = useState(false);
  const [returns, setReturns] = useState([]);
  const [returnForm, setReturnForm] = useState({
    productId: "",
    quantity: "",
    returnPrice: "",
    condition: "resellable",
    originalInvoiceNo: "",
    reason: ""
  });
  const [returnSearch, setReturnSearch] = useState("");
  const [returnSuggestions, setReturnSuggestions] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [saving, setSaving] = useState(false);

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const role = useMemo(() => localStorage.getItem("role") || "cashier", []);

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/orders", {
        headers: authHeader,
        params: role === "cashier" ? { mine: "true" } : undefined
      });
      setOrders(data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [role]);

  const grouped = useMemo(() => {
    const map = new Map();
    orders.forEach((order) => {
      const dateKey = new Date(order.createdAt).toISOString().slice(0, 10);
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey).push(order);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [orders]);

  const resetModal = () => {
    setSelectedOrder(null);
    setMode("");
    setEditItems([]);
    setDeliveryItems([]);
    setHasReturns(false);
    setReturns([]);
    setReturnForm({
      productId: "",
      quantity: "",
      returnPrice: "",
      condition: "resellable",
      originalInvoiceNo: "",
      reason: ""
    });
    setReturnSearch("");
    setReturnSuggestions([]);
    setPaymentMethod("cash");
    setPaidAmount(0);
  };

  const openView = (order) => {
    setSelectedOrder(order);
    setMode("view");
  };

  const openEdit = (order) => {
    setSelectedOrder(order);
    setMode("edit");
    setEditItems(order.items.map((item) => ({
      productId: item.productId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal
    })));
  };

  const openDeliver = (order) => {
    setSelectedOrder(order);
    setMode("deliver");
    setDeliveryItems(order.items.map((item) => ({
      productId: item.productId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal
    })));
    if (!order.customer) {
      setPaymentMethod("cash");
      setPaidAmount(order.orderTotal || 0);
    }
  };

  const updateEditQty = (index, nextQty) => {
    setEditItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              quantity: nextQty,
              lineTotal: nextQty * item.unitPrice
            }
          : item
      )
    );
  };

  const updateDeliveryQty = (index, nextQty) => {
    setDeliveryItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              quantity: nextQty,
              lineTotal: nextQty * item.unitPrice
            }
          : item
      )
    );
  };

  useEffect(() => {
    const runSearch = async () => {
      const query = returnSearch.trim();
      if (!query) {
        setReturnSuggestions([]);
        return;
      }

      try {
        const { data } = await api.get("/api/products/search", {
          headers: authHeader,
          params: { q: query }
        });
        setReturnSuggestions(data || []);
      } catch {
        setReturnSuggestions([]);
      }
    };

    runSearch();
  }, [returnSearch]);

  const handleSelectReturnProduct = (product) => {
    setReturnForm((prev) => ({
      ...prev,
      productId: product._id
    }));
    setReturnSearch(`${product.itemCode} - ${product.displayName}`);
    setReturnSuggestions([]);
  };

  const handleReturnChange = (event) => {
    const { name, value } = event.target;
    setReturnForm((prev) => ({ ...prev, [name]: value }));
  };

  const addReturnItem = () => {
    if (!returnForm.productId || !returnForm.quantity) {
      setError("Return product and quantity are required.");
      return;
    }

    const qty = Number(returnForm.quantity);
    const price = Number(returnForm.returnPrice || 0);
    if (qty <= 0 || price < 0) {
      setError("Return quantity must be greater than 0 and price must be 0 or more.");
      return;
    }

    const itemLabel = returnSearch.split(" - ")[1] || returnSearch;

    setReturns((prev) => [
      ...prev,
      {
        productId: returnForm.productId,
        itemCode: returnSearch.split(" - ")[0],
        itemName: itemLabel,
        quantity: qty,
        returnPrice: price,
        returnTotal: qty * price,
        condition: returnForm.condition,
        originalInvoiceNo: returnForm.originalInvoiceNo,
        reason: returnForm.reason
      }
    ]);

    setReturnForm({
      productId: "",
      quantity: "",
      returnPrice: "",
      condition: "resellable",
      originalInvoiceNo: "",
      reason: ""
    });
    setReturnSearch("");
  };

  const updateReturnQty = (index, nextQty) => {
    setReturns((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? { ...item, quantity: nextQty, returnTotal: nextQty * item.returnPrice }
          : item
      )
    );
  };

  const removeReturn = (index) => {
    setReturns((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCancelOrder = async (order) => {
    const confirmed = window.confirm("Cancel this order?");
    if (!confirmed) {
      return;
    }

    try {
      await api.patch(`/api/orders/${order._id}/cancel`, {}, { headers: authHeader });
      await loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel order");
    }
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder) {
      return;
    }

    setSaving(true);
    try {
      await api.put(
        `/api/orders/${selectedOrder._id}`,
        {
          items: editItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        },
        { headers: authHeader }
      );
      await loadOrders();
      resetModal();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update order");
    } finally {
      setSaving(false);
    }
  };

  const handleDeliver = async () => {
    if (!selectedOrder) {
      return;
    }

    const orderTotal = deliveryItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const returnTotal = returns.reduce((sum, item) => sum + item.returnTotal, 0);
    const netTotal = Math.max(orderTotal - returnTotal, 0);
    if (hasReturns && returnTotal > orderTotal) {
      setError("Return total cannot exceed order total.");
      return;
    }

    if (!selectedOrder.customer && Number(paidAmount || 0) < netTotal) {
      setError("Walk-in orders must be fully paid.");
      return;
    }

    if (paymentMethod !== "credit" && Number(paidAmount || 0) <= 0) {
      setError("Enter paid amount.");
      return;
    }

    setSaving(true);
    try {
      await api.post(
        `/api/orders/${selectedOrder._id}/deliver`,
        {
          items: deliveryItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity
          })),
          returns: hasReturns ? returns : [],
          paidAmount: paymentMethod === "credit" ? 0 : Number(paidAmount || 0),
          paymentMethod
        },
        { headers: authHeader }
      );
      await loadOrders();
      resetModal();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to deliver order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white/80 p-6 shadow">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <p className="text-ink/60">Orders grouped by date for delivery and payment.</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl bg-white/80 p-6 text-sm text-ink/60 shadow">
          Loading orders...
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, items]) => (
            <div key={date} className="rounded-2xl bg-white/90 p-5 shadow">
              <div className="text-sm font-semibold text-ink/70">{date}</div>
              <div className="mt-3 space-y-2">
                {items.map((order) => (
                  <div
                    key={order._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slatewash/60 px-3 py-2 text-sm"
                  >
                    <div className="font-semibold">{order.orderNo}</div>
                    <div className="text-ink/70">{order.customer?.name || "Walk-in"}</div>
                    <div className="text-ink/70">{formatDate(order.createdAt)}</div>
                    <div className="text-ink/70">{formatDate(order.deliveryDate)}</div>
                    <div className="text-ink/70">{formatCurrency(order.orderTotal)}</div>
                    <div className="text-xs font-semibold uppercase text-ink/60">
                      {order.orderStatus}
                    </div>
                    <div className="text-xs font-semibold uppercase text-ink/60">
                      {order.paymentStatus}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold"
                        type="button"
                        onClick={() => openView(order)}
                      >
                        View
                      </button>
                      {order.orderStatus === "pending_delivery" && (
                        <>
                          <button
                            className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold"
                            type="button"
                            onClick={() => openEdit(order)}
                          >
                            Edit Order
                          </button>
                          <button
                            className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-sand"
                            type="button"
                            onClick={() => openDeliver(order)}
                          >
                            Deliver & Collect Payment
                          </button>
                          <button
                            className="rounded-full border border-clay/40 px-3 py-1 text-xs font-semibold text-clay"
                            type="button"
                            onClick={() => handleCancelOrder(order)}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {grouped.length === 0 && (
            <div className="rounded-2xl bg-white/80 p-6 text-sm text-ink/60 shadow">
              No orders recorded yet.
            </div>
          )}
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 px-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{selectedOrder.orderNo}</div>
                <div className="text-sm text-ink/60">{selectedOrder.customer?.name}</div>
              </div>
              <button className="text-sm text-ink/60" type="button" onClick={resetModal}>
                Close
              </button>
            </div>

            {mode === "view" && (
              <div className="mt-4 space-y-3">
                {selectedOrder.items.map((item) => (
                  <div key={item.itemCode} className="rounded-2xl bg-slatewash/60 p-3">
                    <div className="font-semibold">{item.itemName}</div>
                    <div className="text-xs text-ink/60">
                      {item.quantity} x {formatCurrency(item.unitPrice)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {mode === "edit" && (
              <div className="mt-4 space-y-3">
                {editItems.map((item, index) => (
                  <div key={item.itemCode} className="rounded-2xl bg-slatewash/60 p-3">
                    <div className="font-semibold">{item.itemName}</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <input
                        className="rounded-lg border border-slatewash px-3 py-2"
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) => updateEditQty(index, Number(event.target.value))}
                      />
                      <div className="rounded-lg bg-white px-3 py-2 text-sm">
                        {formatCurrency(item.lineTotal)}
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-sand"
                  type="button"
                  onClick={handleUpdateOrder}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}

            {mode === "deliver" && (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-sm font-semibold text-ink/70">Delivered Items</div>
                  <div className="mt-2 space-y-3">
                    {deliveryItems.map((item, index) => (
                      <div key={item.itemCode} className="rounded-2xl bg-slatewash/60 p-3">
                        <div className="font-semibold">{item.itemName}</div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <input
                            className="rounded-lg border border-slatewash px-3 py-2"
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(event) =>
                              updateDeliveryQty(index, Number(event.target.value))
                            }
                          />
                          <div className="rounded-lg bg-white px-3 py-2 text-sm">
                            {formatCurrency(item.lineTotal)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 border-t border-slatewash pt-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-ink/70">
                    <input
                      type="checkbox"
                      checked={hasReturns}
                      onChange={(event) => {
                        if (!event.target.checked && returns.length > 0) {
                          const confirmClear = window.confirm(
                            "Remove all return items and hide return section?"
                          );
                          if (!confirmClear) {
                            return;
                          }
                          setReturns([]);
                          setReturnForm({
                            productId: "",
                            quantity: "",
                            returnPrice: "",
                            condition: "resellable",
                            originalInvoiceNo: "",
                            reason: ""
                          });
                          setReturnSearch("");
                        }
                        setHasReturns(event.target.checked);
                      }}
                      className="h-4 w-4"
                    />
                    Has Returns
                  </label>

                  {hasReturns && (
                    <div className="space-y-3 rounded-2xl border border-slatewash p-4">
                      <div className="relative">
                        <input
                          className="w-full rounded-lg border border-slatewash px-3 py-3 text-base"
                          placeholder="Search return item by code or name"
                          value={returnSearch}
                          onChange={(event) => {
                            setReturnSearch(event.target.value);
                            setReturnForm((prev) => ({ ...prev, productId: "" }));
                          }}
                        />
                        {returnSuggestions.length > 0 && (
                          <div className="absolute z-10 mt-2 w-full rounded-2xl border border-slatewash bg-white shadow">
                            {returnSuggestions.slice(0, 6).map((product) => (
                              <button
                                key={product._id}
                                type="button"
                                className="w-full px-4 py-3 text-left text-sm hover:bg-slatewash/60"
                                onClick={() => handleSelectReturnProduct(product)}
                              >
                                {product.itemCode} - {product.displayName}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          className="rounded-lg border border-slatewash px-3 py-3 text-base"
                          name="quantity"
                          placeholder="Qty"
                          type="number"
                          min="1"
                          value={returnForm.quantity}
                          onChange={handleReturnChange}
                        />
                        <input
                          className="rounded-lg border border-slatewash px-3 py-3 text-base"
                          name="returnPrice"
                          placeholder="Return price"
                          type="number"
                          min="0"
                          value={returnForm.returnPrice}
                          onChange={handleReturnChange}
                        />
                      </div>
                      <select
                        className="rounded-lg border border-slatewash px-3 py-3 text-base"
                        name="condition"
                        value={returnForm.condition}
                        onChange={handleReturnChange}
                      >
                        <option value="resellable">Resellable</option>
                        <option value="damaged">Damaged</option>
                        <option value="expired">Expired</option>
                      </select>
                      <input
                        className="rounded-lg border border-slatewash px-3 py-3 text-base"
                        name="originalInvoiceNo"
                        placeholder="Original invoice (optional)"
                        value={returnForm.originalInvoiceNo}
                        onChange={handleReturnChange}
                      />
                      <input
                        className="rounded-lg border border-slatewash px-3 py-3 text-base"
                        name="reason"
                        placeholder="Reason (optional)"
                        value={returnForm.reason}
                        onChange={handleReturnChange}
                      />
                      <button
                        className="w-full rounded-lg bg-ink py-3 text-sand"
                        type="button"
                        onClick={addReturnItem}
                      >
                        Add Return Item
                      </button>
                    </div>
                  )}

                  {hasReturns && returns.length > 0 && (
                    <div className="space-y-2">
                      {returns.map((item, index) => (
                        <div
                          key={`${item.productId}-${index}`}
                          className="rounded-2xl bg-slatewash/60 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-semibold">{item.itemName}</div>
                              <div className="text-xs text-ink/60">
                                {formatCurrency(item.returnPrice)} each - {item.condition}
                              </div>
                            </div>
                            <button
                              className="text-xs font-semibold text-clay"
                              type="button"
                              onClick={() => removeReturn(index)}
                            >
                              Remove
                            </button>
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <input
                              className="rounded-lg border border-slatewash px-3 py-2"
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(event) =>
                                updateReturnQty(index, Number(event.target.value))
                              }
                            />
                            <div className="rounded-lg bg-white px-3 py-2 text-sm">
                              {formatCurrency(item.returnTotal)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t border-slatewash pt-4">
                  <div className="text-sm font-semibold text-ink/70">Payment</div>
                  {!selectedOrder.customer && (
                    <div className="rounded-xl border border-slatewash bg-slatewash/50 px-3 py-2 text-xs text-ink/60">
                      Walk-in orders must be fully paid. Credit is disabled.
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-lg border border-slatewash px-3 py-2"
                      placeholder="Paid amount"
                      type="number"
                      min="0"
                      value={paymentMethod === "credit" ? 0 : paidAmount}
                      onChange={(event) => setPaidAmount(event.target.value)}
                      disabled={paymentMethod === "credit"}
                    />
                    <select
                      className="rounded-lg border border-slatewash px-3 py-2"
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                    >
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                      {selectedOrder.customer && <option value="credit">Credit</option>}
                    </select>
                  </div>
                  <button
                    className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-sand"
                    type="button"
                    onClick={handleDeliver}
                    disabled={saving}
                  >
                    {saving ? "Processing..." : "Complete Delivery"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default SalesHistoryPage;
