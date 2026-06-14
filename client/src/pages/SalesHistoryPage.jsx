import { useEffect, useMemo, useState } from "react";
import api from "../api/client";

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-LK") : "-");
const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-LK", { hour: "2-digit", minute: "2-digit" })
    : "-";

const formatQty = (value) => Number(value || 0).toLocaleString("en-LK");

const IconEye = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
    <path
      d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
      strokeWidth="1.5"
    />
    <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
  </svg>
);

const IconEdit = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
    <path
      d="M4 20h4l10-10-4-4L4 16v4Z"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M14 6l4 4" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconTruck = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
    <path d="M2 7h12v9H2z" strokeWidth="1.5" />
    <path d="M14 10h5l3 3v3h-8" strokeWidth="1.5" />
    <circle cx="7" cy="18" r="2" strokeWidth="1.5" />
    <circle cx="17" cy="18" r="2" strokeWidth="1.5" />
  </svg>
);

const IconBan = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
    <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
    <path d="M7 7l10 10" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
    <path d="M4 7h16" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9 7V5h6v2" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M7 7l1 12h8l1-12" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const IconPrint = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
    <path d="M7 8V4h10v4" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="6" y="12" width="12" height="8" rx="1" strokeWidth="1.5" />
    <path d="M6 12H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2" strokeWidth="1.5" />
  </svg>
);

const SalesHistoryPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [mode, setMode] = useState("");
  const [editItems, setEditItems] = useState([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editSearch, setEditSearch] = useState("");
  const [editSuggestions, setEditSuggestions] = useState([]);
  const [editForm, setEditForm] = useState({
    productId: "",
    itemCode: "",
    itemName: "",
    unitPrice: 0,
    quantity: ""
  });
  const [editPreview, setEditPreview] = useState(null);
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
  const [discountPercent, setDiscountPercent] = useState(0);
  const [saving, setSaving] = useState(false);

  // ── End-of-Month Cleanup state ────────────────────────────────────────
  // States: 'idle' | 'confirm' | 'working' | 'done' | 'error'
  const [cleanupState, setCleanupState] = useState("idle");
  const [cleanupResult, setCleanupResult] = useState(null);

  const computeFifoAllocation = async (productId, quantity) => {
    const qtyNeeded = Number(quantity || 0);
    if (!productId || qtyNeeded <= 0) {
      throw new Error("Product and quantity are required");
    }

    const { data: batches = [] } = await api.get(`/api/stock/product/${productId}`, {
      headers: authHeader
    });

    const availableBatches = (batches || []).filter((batch) => Number(batch.remainingQty || 0) > 0);
    let remaining = qtyNeeded;
    let lineTotal = 0;
    const usedBatches = [];

    for (const batch of availableBatches) {
      if (remaining <= 0) {
        break;
      }

      const takeQty = Math.min(Number(batch.remainingQty || 0), remaining);
      remaining -= takeQty;

      const billingPrice = Number(batch.billingPrice || 0);
      const batchLineTotal = takeQty * billingPrice;
      lineTotal += batchLineTotal;

      usedBatches.push({
        batchId: batch._id,
        batchNo: batch.batchNo,
        qty: takeQty,
        billingPrice,
        lineTotal: batchLineTotal
      });
    }

    if (remaining > 0) {
      throw new Error("Insufficient stock for selected item");
    }

    return {
      quantity: qtyNeeded,
      lineTotal,
      unitPrice: qtyNeeded > 0 ? lineTotal / qtyNeeded : 0,
      usedBatches
    };
  };

  useEffect(() => {
    let mounted = true;
    const productId = editForm.productId;
    const qty = Number(editForm.quantity || 0);
    if (!productId || qty <= 0) {
      setEditPreview(null);
      return () => (mounted = false);
    }

    setEditPreview({ loading: true });
    computeFifoAllocation(productId, qty)
      .then((res) => {
        if (mounted) setEditPreview(res);
      })
      .catch(() => {
        if (mounted) setEditPreview(null);
      });

    return () => {
      mounted = false;
    };
  }, [editForm.productId, editForm.quantity]);

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const role = useMemo(() => localStorage.getItem("role") || "rep", []);

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/orders", {
        headers: authHeader,
        params: role === "rep" ? { mine: "true" } : undefined
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
    setShowAddItem(false);
    setEditSearch("");
    setEditSuggestions([]);
    setEditForm({
      productId: "",
      itemCode: "",
      itemName: "",
      unitPrice: 0,
      quantity: ""
    });
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
    setDiscountPercent(0);
  };

  const openView = (order) => {
    setSelectedOrder(order);
    setMode("view");
  };

  const openEdit = (order) => {
    setSelectedOrder(order);
    setMode("edit");
    setShowAddItem(false);
    setEditSearch("");
    setEditSuggestions([]);
    setEditForm({
      productId: "",
      itemCode: "",
      itemName: "",
      unitPrice: 0,
      quantity: ""
    });
    setEditItems(order.items.map((item) => ({
      productId: item.productId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      usedBatches: item.usedBatches || []
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
    setDiscountPercent(0);
  };

  const updateEditQty = async (index, nextQty) => {
    const nextValue = Number(nextQty || 0);
    if (nextValue <= 0) {
      setEditItems((prev) => prev.filter((_, idx) => idx !== index));
      return;
    }

    try {
      const current = editItems[index];
      const allocation = await computeFifoAllocation(current.productId, nextValue);
      setEditItems((prev) =>
        prev.map((item, idx) =>
          idx === index
            ? {
                ...item,
                quantity: allocation.quantity,
                unitPrice: allocation.unitPrice,
                lineTotal: allocation.lineTotal,
                usedBatches: allocation.usedBatches
              }
            : item
        )
      );
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to update item quantity");
    }
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

  useEffect(() => {
    const runEditSearch = async () => {
      const query = editSearch.trim();
      if (!query) {
        setEditSuggestions([]);
        return;
      }

      try {
        const { data } = await api.get("/api/products/search", {
          headers: authHeader,
          params: { q: query }
        });
        setEditSuggestions(data || []);
      } catch {
        setEditSuggestions([]);
      }
    };

    runEditSearch();
  }, [editSearch]);

  const handleSelectReturnProduct = (product) => {
    setReturnForm((prev) => ({
      ...prev,
      productId: product._id
    }));
    setReturnSearch(`${product.itemCode} - ${product.displayName}`);
    setReturnSuggestions([]);
  };

  const handleSelectEditProduct = (product) => {
    setEditForm({
      productId: product._id,
      itemCode: product.itemCode,
      itemName: product.displayName,
      unitPrice: 0,
      quantity: "1"
    });
    setEditSearch(`${product.itemCode} - ${product.displayName}`);
    setEditSuggestions([]);
  };

  const handleEditFormChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const addEditItem = () => {
    if (!editForm.productId || !editForm.quantity) {
      setError("Select an item and quantity to add.");
      return;
    }

    const qty = Number(editForm.quantity);
    if (qty <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }

    (async () => {
      try {
        const allocation = await computeFifoAllocation(editForm.productId, qty);
        setEditItems((prev) => {
          const existing = prev.find((item) => item.productId === editForm.productId);
          if (existing) {
            return prev.map((item) =>
              item.productId === editForm.productId
                ? {
                    ...item,
                    quantity: item.quantity + allocation.quantity,
                    lineTotal: item.lineTotal + allocation.lineTotal,
                    unitPrice:
                      (item.lineTotal + allocation.lineTotal) /
                      (item.quantity + allocation.quantity),
                    usedBatches: [...(item.usedBatches || []), ...allocation.usedBatches]
                  }
                : item
            );
          }

          return [
            ...prev,
            {
              productId: editForm.productId,
              itemCode: editForm.itemCode,
              itemName: editForm.itemName,
              quantity: allocation.quantity,
              unitPrice: allocation.unitPrice,
              lineTotal: allocation.lineTotal,
              usedBatches: allocation.usedBatches
            }
          ];
        });

        setEditForm({
          productId: "",
          itemCode: "",
          itemName: "",
          unitPrice: 0,
          quantity: ""
        });
        setEditSearch("");
        setShowAddItem(false);
      } catch (err) {
        setError(err.response?.data?.message || err.message || "Failed to add item");
      }
    })();
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

  const handleDeleteOrder = async (order) => {
    const confirmed = window.confirm("Delete this cancelled order permanently?");
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/api/orders/${order._id}`, { headers: authHeader });
      await loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete order");
    }
  };

  const handlePrintOrder = (order) => {
    const printWindow = window.open("", "_blank", "width=900,height=900");
    if (!printWindow) {
      setError("Pop-up blocked. Allow pop-ups to print.");
      return;
    }

    const itemsRows = (order.items || [])
      .map(
        (item) => `
          <tr>
            <td>${item.itemName || "-"}</td>
            <td style="text-align:right;">${formatCurrency(item.unitPrice)}</td>
            <td style="text-align:right;">${item.quantity || 0}</td>
            <td style="text-align:right;">${formatCurrency(item.lineTotal)}</td>
          </tr>
        `
      )
      .join("");

    const logoUrl = `${window.location.origin}/logo.png`;
    const customerName = order.customer?.name || "Walk-in";
    const paymentStatus = order.paymentStatus?.replace("_", " ") || "-";
    const orderStatus = order.orderStatus?.replace("_", " ") || "-";
    const grossTotal = Number(order.orderTotal || 0);
    const returnTotal = Number(order.returnTotal || 0);
    const discountTotal = Number(order.discount || 0);
    const netTotal = Math.max(grossTotal - returnTotal - discountTotal, 0);
    const paidTotal = Number(order.paidAmount || 0);
    const dueTotal = Math.max(netTotal - paidTotal, 0);
    const paymentMethodLabel = order.paymentMethod
      ? order.paymentMethod === "credit"
        ? "Credit Bill"
        : order.paymentMethod === "cheque"
          ? "Cheque"
          : "Cash"
      : "-";
    const paidLabel = order.paymentMethod === "credit" ? "Credit Bill Amount" : "Paid Amount";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order ${order.orderNo}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; color: #111827; padding: 28px 32px; }
            .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
            .brand { display: flex; align-items: center; gap: 12px; }
            .brand img { height: 44px; width: 44px; }
            .brand h1 { margin: 0; font-size: 20px; letter-spacing: 0.5px; }
            .brand .meta { font-size: 12px; color: #374151; margin-top: 2px; }
            .invoice-block { text-align: right; font-size: 12px; }
            .invoice-block strong { display: block; font-size: 12px; letter-spacing: 0.5px; }
            .divider { height: 1px; background: #e5e7eb; margin: 14px 0; }
            .muted { color: #6b7280; font-size: 11px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
            .box { border: 1px solid #e5e7eb; padding: 10px 12px; border-radius: 6px; }
            .box strong { font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
            th { text-align: left; background: #f8fafc; color: #6b7280; font-weight: 700; letter-spacing: 0.4px; }
            .summary-card { margin-top: 12px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
            .summary-title { font-weight: 700; font-size: 13px; margin-bottom: 6px; }
            .summary-row { display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #e5e7eb; }
            .summary-row:last-child { border-bottom: none; }
            .summary-label { font-weight: 700; }
            .summary-strong { font-size: 16px; font-weight: 800; }
            .summary-negative { color: #b91c1c; }
            .summary-due { color: #b91c1c; font-weight: 800; }
            .summary-divider { height: 1px; background: #d1d5db; margin: 10px 0; }
            .signatures { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-top: 32px; }
            .signature-line { border-top: 1px dotted #6b7280; padding-top: 6px; font-size: 11px; text-align: center; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">
              <img src="${logoUrl}" alt="Logo" />
              <div>
                <h1>JSP DISTRIBUTORS</h1>
                <div class="meta">130/B, Padavi - parackramapura</div>
                <div class="meta">070 - 4407191</div>
              </div>
            </div>
            <div class="invoice-block">
              <strong>INVOICE #</strong>
              <div>${order.orderNo}</div>
            </div>
          </div>

          <div class="divider"></div>

          <div class="grid">
            <div class="box">
              <div class="muted">Date</div>
              <strong>${formatDate(order.createdAt)}</strong>
              <div class="muted" style="margin-top:6px;">Time</div>
              <strong>${formatDateTime(order.createdAt)}</strong>
            </div>
            <div class="box">
              <div class="muted">Bill To</div>
              <strong>${customerName}</strong>
              <div class="muted" style="margin-top:6px;">Payment</div>
              <strong>${paymentStatus}</strong>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:46%;">ITEM DESCRIPTION</th>
                <th style="width:18%; text-align:right;">PRICE</th>
                <th style="width:12%; text-align:right;">QTY</th>
                <th style="width:24%; text-align:right;">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows || "<tr><td colspan=\"4\" class=\"muted\">No items</td></tr>"}
            </tbody>
          </table>

          <div class="summary-card">
            <div class="summary-title">Order Summary</div>
            <div class="summary-row"><span class="summary-label">Gross Order Total</span><span>${formatCurrency(grossTotal)}</span></div>
            <div class="summary-row"><span class="summary-label">Return Deductions</span><span class="summary-negative">-${formatCurrency(returnTotal)}</span></div>
            <div class="summary-row"><span class="summary-label">Discount</span><span class="summary-negative">-${formatCurrency(discountTotal)}</span></div>
            <div class="summary-divider"></div>
            <div class="summary-row"><span class="summary-label">Net Payable</span><span class="summary-strong">${formatCurrency(netTotal)}</span></div>

            <div class="summary-title" style="margin-top:10px;">Payment Summary</div>
            <div class="summary-row"><span class="summary-label">Payment Method</span><span>${paymentMethodLabel}</span></div>
            <div class="summary-row"><span class="summary-label">${paidLabel}</span><span>${formatCurrency(paidTotal)}</span></div>
            <div class="summary-row"><span class="summary-label">Due Amount</span><span class="${dueTotal > 0 ? "summary-due" : ""}">${formatCurrency(dueTotal)}</span></div>
          </div>

          ${
            order.paymentMethod === "cheque"
              ? `
                <div class="summary-card" style="margin-top:12px;">
                  <div class="summary-title">Cheque Details</div>
                  <div class="summary-row"><span class="summary-label">Cheque No</span><span>-</span></div>
                  <div class="summary-row"><span class="summary-label">Bank Name</span><span>-</span></div>
                  <div class="summary-row"><span class="summary-label">Cheque Date</span><span>-</span></div>
                  <div class="summary-row"><span class="summary-label">Cheque Status</span><span>-</span></div>
                </div>
              `
              : ""
          }

          <div class="signatures">
            <div class="signature-line">Signature of Customer</div>
            <div class="signature-line">Signature of Rep</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
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
            quantity: item.quantity,
            usedBatches: item.usedBatches || []
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
    const baseTotal = Math.max(orderTotal - returnTotal, 0);
    const discountAmount = Math.max((baseTotal * Number(discountPercent || 0)) / 100, 0);
    const netTotal = Math.max(baseTotal - discountAmount, 0);
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
            quantity: item.quantity,
            usedBatches: item.usedBatches || []
          })),
          returns: hasReturns ? returns : [],
          discount: discountAmount,
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

  const handleTabletCleanup = async () => {
    setCleanupState("working");
    setCleanupResult(null);
    try {
      const { data } = await api.delete("/api/sales/tablet-cleanup", {
        headers: authHeader
      });
      setCleanupResult(data);
      setCleanupState("done");
      // Refresh the order list so deleted invoices disappear immediately
      await loadOrders();
    } catch (err) {
      setCleanupResult({ message: err.response?.data?.message || "Cleanup failed" });
      setCleanupState("error");
    }
  };

  return (
    <section className="space-y-6">
      {/* ── Page header with End-of-Month Cleanup button ── */}
      <div className="rounded-2xl bg-white/80 p-6 shadow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Sales</h1>
            <p className="text-ink/60">Orders grouped by date for delivery and payment.</p>
          </div>

          {/* Cleanup button – visible to admin only */}
          {role === "admin" && (
            <div className="flex flex-col items-end gap-2">
              {cleanupState === "idle" && (
                <button
                  id="btn-tablet-cleanup"
                  type="button"
                  onClick={() => setCleanupState("confirm")}
                  className="flex items-center gap-2 rounded-xl border border-clay/40 bg-clay/10 px-4 py-2 text-sm font-semibold text-clay hover:bg-clay/20 transition"
                >
                  {/* trash icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear Paid Bills
                </button>
              )}

              {cleanupState === "confirm" && (
                <div className="rounded-xl border border-clay/30 bg-clay/5 p-4 text-sm text-ink shadow">
                  <p className="font-semibold text-clay mb-1">⚠ End-of-Month Cleanup</p>
                  <p className="text-ink/70 mb-3">
                    This will permanently delete all <strong>fully-paid</strong> invoices older than 30 days.
                    Their totals will be archived to the snapshot history first.
                    <br /><strong>Credit &amp; partial bills are never deleted.</strong>
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      id="btn-cleanup-confirm"
                      onClick={handleTabletCleanup}
                      className="rounded-lg bg-clay px-4 py-2 text-xs font-bold text-white hover:bg-clay/90 transition"
                    >
                      Yes, Archive &amp; Delete
                    </button>
                    <button
                      type="button"
                      id="btn-cleanup-cancel"
                      onClick={() => setCleanupState("idle")}
                      className="rounded-lg border border-ink/20 px-4 py-2 text-xs font-semibold hover:bg-slatewash transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {cleanupState === "working" && (
                <div className="rounded-xl border border-slatewash bg-slatewash/50 px-4 py-2 text-sm text-ink/60">
                  Archiving &amp; cleaning up…
                </div>
              )}

              {cleanupState === "done" && (
                <div className="rounded-xl border border-leaf/30 bg-leaf/10 px-4 py-3 text-sm text-leaf">
                  <p className="font-semibold">✓ {cleanupResult?.message}</p>
                  {cleanupResult?.monthsArchived?.length > 0 && (
                    <p className="text-xs mt-1 text-ink/60">
                      Months archived: {cleanupResult.monthsArchived.join(", ")}
                    </p>
                  )}
                  <button
                    type="button"
                    className="mt-2 text-xs underline text-ink/50"
                    onClick={() => { setCleanupState("idle"); setCleanupResult(null); }}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {cleanupState === "error" && (
                <div className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
                  <p>{cleanupResult?.message || "Cleanup failed."}</p>
                  <button
                    type="button"
                    className="mt-2 text-xs underline"
                    onClick={() => { setCleanupState("idle"); setCleanupResult(null); }}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
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
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((order) => (
                  <div
                    key={order._id}
                    className="rounded-2xl border border-slatewash bg-slatewash/40 p-4 text-sm shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-ink/60">Order</div>
                        <div className="text-lg font-semibold">{order.orderNo}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink/70">
                          {order.orderStatus.replace("_", " ")}
                        </span>
                        <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink/70">
                          {order.paymentStatus.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-ink/70">
                      <div className="flex items-center justify-between">
                        <span>Customer</span>
                        <span className="font-semibold">
                          {order.customer?.name || "Walk-in"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Order Date</span>
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Delivery Date</span>
                        <span>{formatDate(order.deliveryDate)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Order Total</span>
                        <span className="font-semibold">{formatCurrency(order.orderTotal)}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="flex items-center rounded-full border border-ink/20 p-2 text-xs font-semibold"
                        type="button"
                        onClick={() => openView(order)}
                        title="View"
                        aria-label="View"
                      >
                        <IconEye />
                      </button>
                      <button
                        className="flex items-center rounded-full border border-ink/20 p-2 text-xs font-semibold"
                        type="button"
                        onClick={() => handlePrintOrder(order)}
                        title="Print"
                        aria-label="Print"
                      >
                        <IconPrint />
                      </button>
                      {order.orderStatus === "pending_delivery" && (
                        <>
                          <button
                            className="flex items-center rounded-full border border-ink/20 p-2 text-xs font-semibold"
                            type="button"
                            onClick={() => openEdit(order)}
                            title="Edit order"
                            aria-label="Edit order"
                          >
                            <IconEdit />
                          </button>
                          <button
                            className="flex items-center rounded-full bg-ink p-2 text-xs font-semibold text-sand"
                            type="button"
                            onClick={() => openDeliver(order)}
                            title="Deliver and collect payment"
                            aria-label="Deliver and collect payment"
                          >
                            <IconTruck />
                          </button>
                          <button
                            className="flex items-center rounded-full border border-clay/40 p-2 text-xs font-semibold text-clay"
                            type="button"
                            onClick={() => handleCancelOrder(order)}
                            title="Cancel"
                            aria-label="Cancel"
                          >
                            <IconBan />
                          </button>
                        </>
                      )}
                      {order.orderStatus === "cancelled" && (
                        <button
                          className="flex items-center rounded-full border border-clay/40 p-2 text-xs font-semibold text-clay"
                          type="button"
                          onClick={() => handleDeleteOrder(order)}
                          title="Delete"
                          aria-label="Delete"
                        >
                          <IconTrash />
                        </button>
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
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-slatewash/60 p-4">
                    <div className="text-xs text-ink/60">Customer</div>
                    <div className="text-sm font-semibold">
                      {selectedOrder.customer?.name || "Walk-in"}
                    </div>
                    <div className="mt-2 text-xs text-ink/60">Order Date</div>
                    <div className="text-sm font-semibold">
                      {formatDate(selectedOrder.createdAt)}
                    </div>
                    <div className="mt-2 text-xs text-ink/60">Delivery Date</div>
                    <div className="text-sm font-semibold">
                      {formatDate(selectedOrder.deliveryDate)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slatewash/60 p-4">
                    <div className="text-xs text-ink/60">Order Status</div>
                    <div className="text-sm font-semibold">
                      {selectedOrder.orderStatus.replace("_", " ")}
                    </div>
                    <div className="mt-2 text-xs text-ink/60">Payment Status</div>
                    <div className="text-sm font-semibold">
                      {selectedOrder.paymentStatus.replace("_", " ")}
                    </div>
                    <div className="mt-2 text-xs text-ink/60">Order Total</div>
                    <div className="text-sm font-semibold">
                      {formatCurrency(selectedOrder.orderTotal)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slatewash/60 p-4">
                    <div className="text-xs text-ink/60">Returns</div>
                    <div className="text-sm font-semibold">
                      {formatCurrency(selectedOrder.returnTotal || 0)}
                    </div>
                    <div className="mt-2 text-xs text-ink/60">Net Total</div>
                    <div className="text-sm font-semibold">
                      {formatCurrency(selectedOrder.netTotal || selectedOrder.orderTotal)}
                    </div>
                    <div className="mt-2 text-xs text-ink/60">Paid</div>
                    <div className="text-sm font-semibold">
                      {formatCurrency(selectedOrder.paidAmount || 0)}
                    </div>
                    <div className="mt-2 text-xs text-ink/60">Due</div>
                    <div className="text-sm font-semibold">
                      {formatCurrency(selectedOrder.dueAmount || 0)}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slatewash">
                  <div className="flex items-center justify-between border-b border-slatewash px-4 py-3 text-sm font-semibold">
                    <span>Items</span>
                    <span>{selectedOrder.items.length} lines</span>
                  </div>
                  <div className="divide-y divide-slatewash">
                    {selectedOrder.items.map((item) => (
                      <div
                        key={item.itemCode}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                      >
                        <div>
                          <div className="font-semibold">{item.itemName}</div>
                          <div className="text-xs text-ink/60">Item code: {item.itemCode}</div>
                        </div>
                        <div className="text-right text-xs text-ink/60">
                          <div>{item.quantity} x {formatCurrency(item.unitPrice)}</div>
                          <div className="text-sm font-semibold">
                            {formatCurrency(item.lineTotal)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {mode === "edit" && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-ink/70">Edit Items</div>
                  <button
                    className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold"
                    type="button"
                    onClick={() => setShowAddItem((prev) => !prev)}
                  >
                    {showAddItem ? "Hide Add Item" : "Add Item"}
                  </button>
                </div>
                {showAddItem && (
                  <div className="space-y-3 rounded-2xl border border-slatewash p-4">
                    <div className="relative">
                      <input
                        className="w-full rounded-lg border border-slatewash px-3 py-3 text-base"
                        placeholder="Search item by code or name"
                        value={editSearch}
                        onChange={(event) => {
                          setEditSearch(event.target.value);
                          setEditForm((prev) => ({
                            ...prev,
                            productId: "",
                            itemCode: "",
                            itemName: "",
                            unitPrice: 0
                          }));
                        }}
                      />
                      {editSuggestions.length > 0 && (
                        <div className="absolute z-10 mt-2 w-full rounded-2xl border border-slatewash bg-white shadow">
                          {editSuggestions.slice(0, 6).map((product) => (
                            <button
                              key={product._id}
                              type="button"
                              className="w-full px-4 py-3 text-left text-sm hover:bg-slatewash/60"
                              onClick={() => handleSelectEditProduct(product)}
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
                        value={editForm.quantity}
                        onChange={handleEditFormChange}
                      />
                      <div className="rounded-lg bg-slatewash/60 px-3 py-3 text-sm">
                        {editPreview ? (
                          editPreview.loading ? (
                            <span className="text-ink/60">Calculating...</span>
                          ) : (
                            <div className="text-sm font-semibold">{formatCurrency(editPreview.lineTotal)}</div>
                          )
                        ) : (
                          <span className="text-ink/60">Enter quantity to preview total</span>
                        )}
                      </div>
                    </div>
                    <button
                      className="w-full rounded-lg bg-ink py-3 text-sand"
                      type="button"
                      onClick={addEditItem}
                    >
                      Add Item
                    </button>
                  </div>
                )}
                {editItems.map((item, index) => (
                  <div key={item.itemCode} className="rounded-2xl bg-slatewash/60 p-3">
                    <div className="font-semibold">{item.itemName}</div>
                    {item.usedBatches && item.usedBatches.length > 0 && (
                      <div className="mt-2 space-y-1 rounded-lg bg-white/80 px-3 py-2 text-xs text-ink/70">
                        {item.usedBatches.map((batch, batchIndex) => (
                          <div
                            key={`${item.itemCode}-${batch.batchNo || batchIndex}`}
                            className="flex items-center justify-between gap-2"
                          >
                            <span>
                              {Number(batch.qty || 0).toLocaleString("en-LK")} × {formatCurrency(batch.billingPrice)}
                            </span>
                            <span>{formatCurrency(batch.lineTotal)}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
                <div className="rounded-2xl bg-slatewash/60 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-ink/60">Order Total</span>
                    <span className="font-semibold">
                      {formatCurrency(deliveryItems.reduce((sum, item) => sum + item.lineTotal, 0))}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-ink/60">Returns</span>
                    <span className="font-semibold">
                      {formatCurrency(returns.reduce((sum, item) => sum + item.returnTotal, 0))}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-ink/60">Discount (%)</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-slatewash px-3 py-2"
                        type="number"
                        min="0"
                        max="100"
                        value={discountPercent}
                        onChange={(event) => setDiscountPercent(event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ink/60">Discount Amount</label>
                      <div className="mt-1 rounded-lg bg-white px-3 py-2 text-sm">
                        {(() => {
                          const orderTotal = deliveryItems.reduce(
                            (sum, item) => sum + item.lineTotal,
                            0
                          );
                          const returnTotal = returns.reduce(
                            (sum, item) => sum + item.returnTotal,
                            0
                          );
                          const baseTotal = Math.max(orderTotal - returnTotal, 0);
                          const discountAmount = Math.max(
                            (baseTotal * Number(discountPercent || 0)) / 100,
                            0
                          );
                          return formatCurrency(discountAmount);
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-ink/60">Net Total</span>
                    <span className="font-semibold">
                      {(() => {
                        const orderTotal = deliveryItems.reduce(
                          (sum, item) => sum + item.lineTotal,
                          0
                        );
                        const returnTotal = returns.reduce(
                          (sum, item) => sum + item.returnTotal,
                          0
                        );
                        const baseTotal = Math.max(orderTotal - returnTotal, 0);
                        const discountAmount = Math.max(
                          (baseTotal * Number(discountPercent || 0)) / 100,
                          0
                        );
                        return formatCurrency(Math.max(baseTotal - discountAmount, 0));
                      })()}
                    </span>
                  </div>
                </div>

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
                  <div className="rounded-xl border border-slatewash bg-slatewash/50 px-3 py-2 text-xs text-ink/60">
                    {(() => {
                      const orderTotal = deliveryItems.reduce(
                        (sum, item) => sum + item.lineTotal,
                        0
                      );
                      const returnTotal = returns.reduce(
                        (sum, item) => sum + item.returnTotal,
                        0
                      );
                      const baseTotal = Math.max(orderTotal - returnTotal, 0);
                      const discountAmount = Math.max(
                        (baseTotal * Number(discountPercent || 0)) / 100,
                        0
                      );
                      const netTotal = Math.max(baseTotal - discountAmount, 0);
                      const paid = paymentMethod === "credit" ? 0 : Number(paidAmount || 0);
                      const balance = Math.max(paid - netTotal, 0);
                      const due = Math.max(netTotal - paid, 0);
                      if (paymentMethod === "credit") {
                        return `Due: ${formatCurrency(netTotal)}`;
                      }
                      if (due > 0) {
                        return `Due: ${formatCurrency(due)}`;
                      }
                      return `Balance: ${formatCurrency(balance)}`;
                    })()}
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
