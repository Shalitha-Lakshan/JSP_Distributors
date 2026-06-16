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
    itemCode: "",
    itemName: "",
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

  // Advanced Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const query = search.trim().toLowerCase();
      const customerName = order.customer?.name || "Walk-in";
      const cashierName = order.cashier?.name || "";
      const orderNo = order.orderNo || "";
      
      const matchesSearch =
        !query ||
        `${orderNo} ${customerName} ${cashierName}`.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ? true : order.orderStatus === statusFilter;

      const matchesPayment =
        paymentFilter === "all" ? true : order.paymentStatus === paymentFilter;

      let matchesDate = true;
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && new Date(order.createdAt) >= start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && new Date(order.createdAt) <= end;
      }

      return matchesSearch && matchesStatus && matchesPayment && matchesDate;
    });
  }, [orders, search, statusFilter, paymentFilter, startDate, endDate]);

  const salesStats = useMemo(() => {
    let salesTotal = 0;
    let returnsTotal = 0;
    let pendingCount = 0;
    
    filteredOrders.forEach((o) => {
      if (o.orderStatus !== "cancelled") {
        salesTotal += o.netTotal || o.orderTotal || 0;
        returnsTotal += o.returnTotal || 0;
      }
      if (o.orderStatus === "pending_delivery") {
        pendingCount++;
      }
    });

    return {
      salesTotal,
      returnsTotal,
      pendingCount,
      count: filteredOrders.length
    };
  }, [filteredOrders]);

  const grouped = useMemo(() => {
    const map = new Map();
    filteredOrders.forEach((order) => {
      const dateKey = new Date(order.createdAt).toISOString().slice(0, 10);
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey).push(order);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filteredOrders]);

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
      itemCode: "",
      itemName: "",
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
    setError("");
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
      productId: item.productId?._id || item.productId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      usedBatches: item.usedBatches || []
    })));
    // Initialize returns list and discountPercent from order history details
    const orderReturns = order.returns || [];
    setReturns(orderReturns.map((r) => ({
      productId: r.productId?._id || r.productId,
      itemCode: r.itemCode,
      itemName: r.itemName,
      quantity: r.quantity,
      returnPrice: r.returnPrice,
      returnTotal: r.returnTotal || (r.quantity * r.returnPrice),
      condition: r.condition,
      originalInvoiceNo: r.originalInvoiceNo || "",
      reason: r.reason || ""
    })));
    setHasReturns(orderReturns.length > 0);

    const grossTotal = order.orderTotal || 0;
    const discountTotal = order.discount || 0;
    setDiscountPercent(grossTotal > 0 ? Math.round((discountTotal / grossTotal) * 100) : 0);
  };

  const openDeliver = (order) => {
    setSelectedOrder(order);
    setMode("deliver");
    setDeliveryItems(order.items.map((item) => ({
      productId: item.productId?._id || item.productId,
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

      if (returnForm.productId && query === `${returnForm.itemCode} - ${returnForm.itemName}`) {
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
  }, [returnSearch, returnForm.productId, returnForm.itemCode, returnForm.itemName]);

  useEffect(() => {
    const runEditSearch = async () => {
      const query = editSearch.trim();
      if (!query) {
        setEditSuggestions([]);
        return;
      }

      if (editForm.productId && query === `${editForm.itemCode} - ${editForm.itemName}`) {
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
  }, [editSearch, editForm.productId, editForm.itemCode, editForm.itemName]);

  const handleSelectReturnProduct = (product) => {
    setReturnForm((prev) => ({
      ...prev,
      productId: product._id,
      itemCode: product.itemCode,
      itemName: product.displayName
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
      itemCode: "",
      itemName: "",
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

    const logoUrl = `${window.location.origin}/logo.png`;
    const customerName = order.customer?.name || "Walk-in";
    const customerAddress = order.customer?.address || "-";
    const customerPhone = order.customer?.phone || "-";
    const routeLabel = order.tripId?.route || "-";
    const actualPaymentMethod = order.paymentMethod && order.paymentMethod !== "not_collected"
      ? order.paymentMethod
      : (order.saleId?.paymentMethod || (order.paymentStatus === "credit" ? "credit" : "cash"));

    const grossTotal = Number(order.orderTotal || 0);
    const returnTotal = Number(order.returnTotal || 0);
    const discountTotal = Number(order.discount || 0);
    const grossAfterDiscount = Math.max(grossTotal - discountTotal, 0);
    const netTotal = Math.max(grossAfterDiscount - returnTotal, 0);
    const paidTotal = Number(order.paidAmount || 0);
    const dueTotal = Math.max(netTotal - paidTotal, 0);

    const discountPercentVal = grossTotal > 0 ? Math.round((discountTotal / grossTotal) * 100) : 0;

    const getRsCts = (val) => {
      const rs = Math.floor(val || 0);
      const ctsVal = Math.round(((val || 0) - rs) * 100);
      const cts = String(ctsVal).padStart(2, "0");
      return { rs: rs.toLocaleString("en-LK"), cts };
    };

    const grossTotalRsCts = getRsCts(grossTotal);
    const discountTotalRsCts = getRsCts(discountTotal);
    const grossAfterDiscountRsCts = getRsCts(grossAfterDiscount);
    const returnTotalRsCts = getRsCts(returnTotal);
    const netTotalRsCts = getRsCts(netTotal);
    const paidTotalRsCts = getRsCts(paidTotal);
    const dueTotalRsCts = getRsCts(dueTotal);

    const printRows = [];
    (order.items || []).forEach((item) => {
      if (item.usedBatches && item.usedBatches.length > 0) {
        item.usedBatches.forEach((batch) => {
          printRows.push({
            itemName: item.itemName,
            unitPrice: batch.billingPrice,
            quantity: batch.qty,
            lineTotal: batch.lineTotal
          });
        });
      } else {
        printRows.push({
          itemName: item.itemName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal
        });
      }
    });

    const itemsRows = printRows.map((row) => {
      const rate = getRsCts(row.unitPrice);
      const amount = getRsCts(row.lineTotal);
      return `
        <tr>
          <td style="padding: 6px 8px; border: 1px solid #000; font-weight: bold; color: #000;">
            ${row.itemName || "-"}
          </td>
          <td style="padding: 6px 8px; border: 1px solid #000; text-align: right; font-family: monospace; font-weight: bold;">
            ${rate.rs}
          </td>
          <td style="padding: 6px 8px; border: 1px solid #000; text-align: center; font-family: monospace; font-weight: bold;">
            ${rate.cts}
          </td>
          <td style="padding: 6px 8px; border: 1px solid #000; text-align: center; font-weight: bold;">
            ${row.quantity || 0}
          </td>
          <td style="padding: 6px 8px; border: 1px solid #000; text-align: right; font-family: monospace; font-weight: bold;">
            ${amount.rs}
          </td>
          <td style="padding: 6px 8px; border: 1px solid #000; text-align: center; font-family: monospace; font-weight: bold;">
            ${amount.cts}
          </td>
        </tr>
      `;
    });

    const minRows = 12;
    if (itemsRows.length < minRows) {
      const emptyCount = minRows - itemsRows.length;
      for (let i = 0; i < emptyCount; i++) {
        itemsRows.push(`
          <tr>
            <td style="padding: 6px 8px; border: 1px solid #000; height: 26px;">&nbsp;</td>
            <td style="padding: 6px 8px; border: 1px solid #000; height: 26px;">&nbsp;</td>
            <td style="padding: 6px 8px; border: 1px solid #000; height: 26px;">&nbsp;</td>
            <td style="padding: 6px 8px; border: 1px solid #000; height: 26px;">&nbsp;</td>
            <td style="padding: 6px 8px; border: 1px solid #000; height: 26px;">&nbsp;</td>
            <td style="padding: 6px 8px; border: 1px solid #000; height: 26px;">&nbsp;</td>
          </tr>
        `);
      }
    }
    const itemsRowsHtml = itemsRows.join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order ${order.orderNo}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              color: #000;
              padding: 20px;
              margin: 0;
              background: #ffffff;
            }
            .invoice-card {
              max-width: 800px;
              margin: 0 auto;
              border: 2px solid #000;
              padding: 20px;
              position: relative;
            }
            .header-sec {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 15px;
            }
            .brand-block {
              display: flex;
              align-items: center;
            }
            .logo-oval {
              width: 95px;
              height: 44px;
              background-color: #0c4a6e;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-weight: 800;
              font-size: 15px;
              border: 2px solid #000;
              box-shadow: inset 0 0 4px rgba(255, 255, 255, 0.4);
              margin-right: 12px;
            }
            .title-text {
              font-size: 19px;
              font-weight: 900;
              color: #0c4a6e;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            .meta-box {
              border: 1.5px solid #000;
              width: 280px;
              font-size: 11px;
            }
            .meta-row {
              display: flex;
              border-bottom: 1px solid #000;
            }
            .meta-row:last-child {
              border-bottom: none;
            }
            .meta-label {
              width: 40%;
              padding: 4px 6px;
              font-weight: bold;
              border-right: 1px solid #000;
              background-color: #f1f5f9;
            }
            .meta-value {
              width: 60%;
              padding: 4px 6px;
              font-weight: bold;
            }
            .customer-box {
              border: 1.5px solid #000;
              padding: 8px;
              margin-bottom: 15px;
              font-size: 11px;
            }
            .customer-title {
              font-weight: 800;
              text-transform: uppercase;
              color: #0c4a6e;
              margin-bottom: 6px;
              font-size: 11px;
            }
            .customer-line {
              display: flex;
              margin-bottom: 3px;
              font-weight: bold;
            }
            .customer-label {
              width: 65px;
              color: #475569;
            }
            .customer-val {
              color: #000;
            }
            table.items-table {
              width: 100%;
              border-collapse: collapse;
              border: 1.5px solid #000;
            }
            table.items-table th, table.items-table td {
              border: 1px solid #000;
              padding: 6px 8px;
              font-size: 11px;
              vertical-align: middle;
            }
            table.items-table th {
              background-color: #f1f5f9;
              font-weight: bold;
              text-transform: uppercase;
              text-align: center;
            }
            @media print {
              body { padding: 0; }
              .invoice-card { border: 2px solid #000; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-card">
            <div class="header-sec">
              <div class="brand-block">
                <img src="${logoUrl}" alt="JSP Logo" style="height: 48px; object-fit: contain; margin-right: 12px;" />
                <div style="display: flex; flex-direction: column;">
                  <div class="title-text">REDISTRIBUTOR SALES INVOICE</div>
                  <div style="font-size: 11px; font-weight: bold; color: #000; margin-top: 1px;">JSP DISTRIBUTORS</div>
                </div>
              </div>
              
              <div class="meta-box">
                <div style="border-bottom: 1.5px solid #000; padding: 5px 6px; font-weight: 800; font-size: 12px; background-color: #f1f5f9; display: flex; justify-content: space-between;">
                  <span>Invoice No :-</span>
                  <span style="font-family: monospace; color: #b91c1c;">${order.orderNo}</span>
                </div>
                <div class="meta-row">
                  <div class="meta-label">Date</div>
                  <div class="meta-value">${formatDate(order.createdAt)}</div>
                </div>
                <div class="meta-row">
                  <div class="meta-label">Area</div>
                  <div class="meta-value">${routeLabel}</div>
                </div>
                <div class="meta-row">
                  <div class="meta-label">Distributor</div>
                  <div class="meta-value">JSP DISTRIBUTORS</div>
                </div>
              </div>
            </div>

            <div class="customer-box">
              <div class="customer-title">Name & Address of the Customer :-</div>
              <div class="customer-line">
                <span class="customer-label">Name:</span>
                <span class="customer-val">${customerName}</span>
              </div>
              <div class="customer-line">
                <span class="customer-label">Address:</span>
                <span class="customer-val">${customerAddress}</span>
              </div>
              <div class="customer-line">
                <span class="customer-label">Phone:</span>
                <span class="customer-val">${customerPhone}</span>
              </div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th rowspan="2" style="width: 50%; text-align: left;">Product Range</th>
                  <th colspan="2" style="width: 20%;">Rate</th>
                  <th rowspan="2" style="width: 10%;">Qty.</th>
                  <th colspan="2" style="width: 20%;">Amount</th>
                </tr>
                <tr>
                  <th style="border-top: 1px solid #000; width: 13%;">Rs.</th>
                  <th style="border-top: 1px solid #000; border-left: 1px solid #000; width: 7%;">Cts.</th>
                  <th style="border-top: 1px solid #000; border-left: 1px solid #000; width: 13%;">Rs.</th>
                  <th style="border-top: 1px solid #000; border-left: 1px solid #000; width: 7%;">Cts.</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRowsHtml || `
                  <tr>
                    <td colspan="6" style="text-align: center; color: #475569; padding: 14px;">No items fulfilled</td>
                  </tr>
                `}
              </tbody>
            </table>

            <div style="display: flex; border: 1.5px solid #000; border-top: none; width: 100%; font-size: 11px;">
              <!-- Left Side: Payment Details -->
              <div style="width: 50%; border-right: 1.5px solid #000; padding: 8px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="font-weight: 800; text-transform: uppercase; color: #0c4a6e; margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 2px;">Mode of Payment</div>
                  
                  <div style="display: flex; gap: 20px; margin-bottom: 12px; font-weight: bold;">
                    <div style="display: flex; align-items: center;">
                      <span style="border: 1px solid #000; display: inline-block; width: 14px; height: 14px; line-height: 12px; text-align: center; font-size: 10px; margin-right: 6px; font-family: monospace;">
                        ${actualPaymentMethod === "cash" ? "✓" : "&nbsp;"}
                      </span>
                      Cash
                    </div>
                    <div style="display: flex; align-items: center;">
                      <span style="border: 1px solid #000; display: inline-block; width: 14px; height: 14px; line-height: 12px; text-align: center; font-size: 10px; margin-right: 6px; font-family: monospace;">
                        ${actualPaymentMethod === "credit" ? "✓" : "&nbsp;"}
                      </span>
                      Credit
                    </div>
                    <div style="display: flex; align-items: center;">
                      <span style="border: 1px solid #000; display: inline-block; width: 14px; height: 14px; line-height: 12px; text-align: center; font-size: 10px; margin-right: 6px; font-family: monospace;">
                        ${actualPaymentMethod === "cheque" ? "✓" : "&nbsp;"}
                      </span>
                      Cheque
                    </div>
                  </div>
                  
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; align-items: center;">
                      <span style="font-weight: bold; width: 80px; color: #475569;">Bank:</span>
                      <span style="border-bottom: 1px dotted #000; flex-grow: 1; padding-bottom: 2px; font-weight: bold;">
                        ${actualPaymentMethod === "cheque" ? (order.chequeBank || "-") : ""}
                      </span>
                    </div>
                    <div style="display: flex; align-items: center;">
                      <span style="font-weight: bold; width: 80px; color: #475569;">Cheque No:</span>
                      <span style="border-bottom: 1px dotted #000; flex-grow: 1; padding-bottom: 2px; font-family: monospace; font-weight: bold;">
                        ${actualPaymentMethod === "cheque" ? (order.chequeNo || "-") : ""}
                      </span>
                    </div>
                    <div style="display: flex; align-items: center;">
                      <span style="font-weight: bold; width: 80px; color: #475569;">Date:</span>
                      <span style="border-bottom: 1px dotted #000; flex-grow: 1; padding-bottom: 2px; font-weight: bold;">
                        ${actualPaymentMethod === "cheque" && order.chequeDate ? formatDate(order.chequeDate) : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right Side: Totals -->
              <div style="width: 50%;">
                <table style="width: 100%; border-collapse: collapse; height: 100%; font-size: 11px;">
                  <tbody>
                    <tr style="border-bottom: 1px solid #000;">
                      <td style="width: 60%; padding: 5px 8px; font-weight: bold; color: #475569; border-right: 1px solid #000; background-color: #f8fafc;">Total</td>
                      <td style="width: 26%; padding: 5px 8px; text-align: right; font-family: monospace; font-weight: bold; border-right: 1px solid #000;">${grossTotalRsCts.rs}</td>
                      <td style="width: 14%; padding: 5px 8px; text-align: center; font-family: monospace; font-weight: bold;">${grossTotalRsCts.cts}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #000;">
                      <td style="width: 60%; padding: 5px 8px; font-weight: bold; color: #475569; border-right: 1px solid #000; background-color: #f8fafc;">Less Discount: ${discountPercentVal}%</td>
                      <td style="width: 26%; padding: 5px 8px; text-align: right; font-family: monospace; font-weight: bold; border-right: 1px solid #000; color: #b91c1c;">${discountTotalRsCts.rs}</td>
                      <td style="width: 14%; padding: 5px 8px; text-align: center; font-family: monospace; font-weight: bold; color: #b91c1c;">${discountTotalRsCts.cts}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #000;">
                      <td style="width: 60%; padding: 5px 8px; font-weight: bold; color: #475569; border-right: 1px solid #000; background-color: #f8fafc;">Gross Total</td>
                      <td style="width: 26%; padding: 5px 8px; text-align: right; font-family: monospace; font-weight: bold; border-right: 1px solid #000;">${grossAfterDiscountRsCts.rs}</td>
                      <td style="width: 14%; padding: 5px 8px; text-align: center; font-family: monospace; font-weight: bold;">${grossAfterDiscountRsCts.cts}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #000;">
                      <td style="width: 60%; padding: 5px 8px; font-weight: bold; color: #475569; border-right: 1px solid #000; background-color: #f8fafc;">Market Returns</td>
                      <td style="width: 26%; padding: 5px 8px; text-align: right; font-family: monospace; font-weight: bold; border-right: 1px solid #000; color: #b91c1c;">${returnTotalRsCts.rs}</td>
                      <td style="width: 14%; padding: 5px 8px; text-align: center; font-family: monospace; font-weight: bold; color: #b91c1c;">${returnTotalRsCts.cts}</td>
                    </tr>
                    <tr style="background-color: #f1f5f9; ${order.orderStatus === "delivered" ? "border-bottom: 1px solid #000;" : ""}">
                      <td style="width: 60%; padding: 6px 8px; font-weight: 800; color: #0c4a6e; border-right: 1px solid #000; text-transform: uppercase;">Grand Total</td>
                      <td style="width: 26%; padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 900; border-right: 1px solid #000; color: #0c4a6e; font-size: 12px;">${netTotalRsCts.rs}</td>
                      <td style="width: 14%; padding: 6px 8px; text-align: center; font-family: monospace; font-weight: 900; color: #0c4a6e; font-size: 12px;">${netTotalRsCts.cts}</td>
                    </tr>
                    ${order.orderStatus === "delivered" ? `
                    <tr style="border-bottom: 1px solid #000;">
                      <td style="width: 60%; padding: 5px 8px; font-weight: bold; color: #475569; border-right: 1px solid #000; background-color: #f8fafc;">Paid Amount</td>
                      <td style="width: 26%; padding: 5px 8px; text-align: right; font-family: monospace; font-weight: bold; border-right: 1px solid #000;">${paidTotalRsCts.rs}</td>
                      <td style="width: 14%; padding: 5px 8px; text-align: center; font-family: monospace; font-weight: bold;">${paidTotalRsCts.cts}</td>
                    </tr>
                    <tr style="background-color: #fef2f2;">
                      <td style="width: 60%; padding: 6px 8px; font-weight: 800; color: #b91c1c; border-right: 1px solid #000; text-transform: uppercase;">Due Balance</td>
                      <td style="width: 26%; padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 900; border-right: 1px solid #000; color: #b91c1c; font-size: 12px;">${dueTotalRsCts.rs}</td>
                      <td style="width: 14%; padding: 6px 8px; text-align: center; font-family: monospace; font-weight: 900; color: #b91c1c; font-size: 12px;">${dueTotalRsCts.cts}</td>
                    </tr>
                    ` : ""}
                  </tbody>
                </table>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 55px; padding: 0 10px; font-size: 11px;">
              <div style="text-align: center; width: 250px;">
                <div style="border-top: 1px dotted #000; margin-bottom: 4px;"></div>
                <div style="font-weight: bold;">Name & Signature of Customer</div>
              </div>
              <div style="text-align: center; width: 250px;">
                <div style="border-top: 1px dotted #000; margin-bottom: 4px;"></div>
                <div style="font-weight: bold;">Name & Signature of Rep</div>
              </div>
            </div>

            <div style="margin-top: 35px; padding-top: 10px; border-top: 1px solid #000; font-size: 9px; color: #475569; line-height: 1.4;">
              <strong style="color: #0f172a; text-transform: uppercase;">JSP DISTRIBUTORS</strong><br/>
              130/B, Padavi - Parackramapura<br/>
              Tel: 0767761382 | Email: dilshanrajitha201@gmail.com
            </div>
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

    const orderTotal = editItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const returnTotal = hasReturns ? returns.reduce((sum, item) => sum + item.returnTotal, 0) : 0;
    const baseTotal = Math.max(orderTotal - returnTotal, 0);
    const discountAmount = Math.max((baseTotal * Number(discountPercent || 0)) / 100, 0);

    if (hasReturns && returnTotal > orderTotal) {
      setError("Return total cannot exceed order total.");
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
          })),
          returns: hasReturns ? returns : [],
          discount: discountAmount
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
      {/* Page Header */}
      <div className="rounded-2xl bg-white/80 p-6 shadow border-l-4 border-ink flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink font-display">Sales History</h1>
          <p className="text-sm text-ink/60 mt-0.5">
            Monitor transaction records, track invoice statuses, log returns, and manage deliveries.
          </p>
        </div>

        {/* Cleanup button – visible to admin only */}
        {role === "admin" && (
          <div className="flex flex-col items-end gap-2 shrink-0">
            {cleanupState === "idle" && (
              <button
                id="btn-tablet-cleanup"
                type="button"
                onClick={() => setCleanupState("confirm")}
                className="flex items-center gap-2 rounded-xl border border-clay/40 bg-clay/10 px-4 py-2.5 text-xs font-bold text-clay hover:bg-clay/20 transition shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear Paid Bills
              </button>
            )}

            {cleanupState === "confirm" && (
              <div className="rounded-xl border border-clay/30 bg-clay/5 p-4 text-xs text-ink shadow max-w-sm">
                <p className="font-bold text-clay mb-1">⚠ End-of-Month Cleanup</p>
                <p className="text-ink/70 mb-3 leading-relaxed">
                  This will permanently delete all <strong>fully-paid</strong> invoices older than 30 days.
                  Their totals will be archived to the snapshot history first.
                  <br /><strong>Credit &amp; partial bills are never deleted.</strong>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    id="btn-cleanup-confirm"
                    onClick={handleTabletCleanup}
                    className="rounded-lg bg-clay px-3 py-1.5 font-bold text-white hover:bg-clay/90 transition text-[10px]"
                  >
                    Yes, Archive &amp; Delete
                  </button>
                  <button
                    type="button"
                    id="btn-cleanup-cancel"
                    onClick={() => setCleanupState("idle")}
                    className="rounded-lg border border-ink/20 px-3 py-1.5 font-semibold hover:bg-slatewash transition text-[10px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {cleanupState === "working" && (
              <div className="rounded-xl border border-slatewash bg-slatewash/50 px-4 py-2 text-xs text-ink/60">
                Archiving &amp; cleaning up…
              </div>
            )}

            {cleanupState === "done" && (
              <div className="rounded-xl border border-leaf/30 bg-leaf/10 px-4 py-3 text-xs text-leaf">
                <p className="font-bold">✓ {cleanupResult?.message}</p>
                {cleanupResult?.monthsArchived?.length > 0 && (
                  <p className="text-[10px] mt-1 text-ink/60">
                    Months archived: {cleanupResult.monthsArchived.join(", ")}
                  </p>
                )}
                <button
                  type="button"
                  className="mt-2 text-[10px] underline text-ink/50"
                  onClick={() => { setCleanupState("idle"); setCleanupResult(null); }}
                >
                  Dismiss
                </button>
              </div>
            )}

            {cleanupState === "error" && (
              <div className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-xs text-clay">
                <p>{cleanupResult?.message || "Cleanup failed."}</p>
                <button
                  type="button"
                  className="mt-2 text-[10px] underline"
                  onClick={() => { setCleanupState("idle"); setCleanupResult(null); }}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay font-medium">
          {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white/90 p-4 shadow border-b-4 border-leaf flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Total Sales Volume</span>
          <span className="text-base sm:text-lg font-bold text-ink mt-2 truncate">
            {formatCurrency(salesStats.salesTotal)}
          </span>
          <span className="text-[10px] text-ink/50 mt-1">Sum of non-cancelled orders</span>
        </div>

        <div className="rounded-2xl bg-white/90 p-4 shadow border-b-4 border-slatewash flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Total Orders Count</span>
          <span className="text-lg sm:text-xl font-bold text-ink mt-2">
            {salesStats.count} <span className="text-xs font-normal text-ink/55">Invoices</span>
          </span>
          <span className="text-[10px] text-ink/50 mt-1">Filtered database records</span>
        </div>

        <div className="rounded-2xl bg-white/90 p-4 shadow border-b-4 border-clay flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Pending Deliveries</span>
          <span className={`text-lg sm:text-xl font-bold mt-2 ${salesStats.pendingCount > 0 ? "text-clay" : "text-leaf"}`}>
            {salesStats.pendingCount} <span className="text-xs font-normal text-ink/55">Pending</span>
          </span>
          <span className="text-[10px] text-ink/50 mt-1">Orders awaiting route dispatch</span>
        </div>

        <div className="rounded-2xl bg-white/90 p-4 shadow border-b-4 border-amber-400 flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Return Deductions</span>
          <span className="text-base sm:text-lg font-bold text-amber-700 mt-2 truncate">
            {formatCurrency(salesStats.returnsTotal)}
          </span>
          <span className="text-[10px] text-ink/50 mt-1">Damaged/resellable returns</span>
        </div>
      </div>

      {/* Advanced Auditing Toolbar */}
      <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 space-y-4">
        <div className="text-xs font-bold text-ink/60 uppercase tracking-wider">Filter Transactions</div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-6 items-end">
          {/* Search bar */}
          <div className="md:col-span-2 relative">
            <label className="block text-[10px] font-bold text-ink/50 uppercase mb-1">Search Details</label>
            <span className="absolute inset-y-0 left-0 pl-3 pt-6 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              className="w-full rounded-xl border border-slatewash pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
              placeholder="Order Number, Customer, Rep..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Order Status Selector */}
          <div>
            <label className="block text-[10px] font-bold text-ink/50 uppercase mb-1">Order Status</label>
            <select
              className="w-full rounded-xl border border-slatewash px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/80"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="pending_delivery">Pending Delivery</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Payment Status Selector */}
          <div>
            <label className="block text-[10px] font-bold text-ink/50 uppercase mb-1">Payment Status</label>
            <select
              className="w-full rounded-xl border border-slatewash px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/80"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option value="all">All Payments</option>
              <option value="not_collected">Not Collected</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[10px] font-bold text-ink/50 uppercase mb-1">Start Date</label>
            <input
              className="w-full rounded-xl border border-slatewash px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/75"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[10px] font-bold text-ink/50 uppercase mb-1">End Date</label>
            <input
              className="w-full rounded-xl border border-slatewash px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/75"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

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
                        className="flex items-center rounded-full border border-ink/15 hover:border-ink hover:bg-slatewash/30 p-2 text-xs font-semibold transition text-ink/70 hover:text-ink"
                        type="button"
                        onClick={() => openView(order)}
                        title="View"
                        aria-label="View"
                      >
                        <IconEye />
                      </button>
                      <button
                        className="flex items-center rounded-full border border-ink/15 hover:border-ink hover:bg-slatewash/30 p-2 text-xs font-semibold transition text-ink/70 hover:text-ink"
                        type="button"
                        onClick={() => handlePrintOrder(order)}
                        title="Print"
                        aria-label="Print"
                      >
                        <IconPrint />
                      </button>
                      {order.orderStatus === "pending_delivery" && (
                        <>
                          {role === "rep" && (
                            <>
                              <button
                                className="flex items-center rounded-full border border-ink/20 p-2 text-xs font-semibold hover:border-ink transition"
                                type="button"
                                onClick={() => openEdit(order)}
                                title="Edit order"
                                aria-label="Edit order"
                              >
                                <IconEdit />
                              </button>
                              <button
                                className="flex items-center rounded-full bg-ink p-2 text-xs font-semibold text-sand hover:bg-ink/90 transition shadow-sm"
                                type="button"
                                onClick={() => openDeliver(order)}
                                title="Deliver and collect payment"
                                aria-label="Deliver and collect payment"
                              >
                                <IconTruck />
                              </button>
                            </>
                          )}
                          <button
                            className="flex items-center rounded-full border border-clay/40 p-2 text-xs font-semibold text-clay hover:bg-clay/5 transition"
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
                          className="flex items-center rounded-full border border-clay/20 hover:border-clay/40 hover:bg-clay/5 p-2 text-xs font-semibold text-clay transition"
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 px-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-slatewash/50">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slatewash pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-clay">Transaction Audit File</span>
                <div className="flex items-center gap-3 mt-0.5">
                  <h2 className="text-2xl font-black text-ink">{selectedOrder.orderNo}</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                    selectedOrder.orderStatus === "delivered"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : selectedOrder.orderStatus === "cancelled"
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                    {selectedOrder.orderStatus.replace("_", " ")}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                    selectedOrder.paymentStatus === "paid"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : selectedOrder.paymentStatus === "credit"
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                      : selectedOrder.paymentStatus === "partial"
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-slatewash/60 text-ink/50 border border-slatewash"
                  }`}>
                    {selectedOrder.paymentStatus.replace("_", " ")}
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={resetModal}
                className="rounded-xl border border-slatewash px-4 py-2 text-xs font-bold text-ink hover:bg-slatewash/30 transition"
              >
                Close Audit
              </button>
            </div>

            {mode === "view" && (
              <div className="mt-6 space-y-6">
                
                {/* Logistics & Financial Overview Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                  
                  {/* Customer & Route Logistics */}
                  <div className="rounded-2xl bg-slatewash/20 border border-slatewash/45 p-4 space-y-3.5">
                    <div className="text-[10px] font-black text-ink/40 uppercase tracking-wider">Logistics & Route</div>
                    
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-ink/5 text-ink/70 font-bold text-xs flex items-center justify-center uppercase shrink-0">
                        {selectedOrder.customer?.name?.charAt(0) || "W"}
                      </div>
                      <div>
                        <div className="text-[10px] text-ink/45 font-bold uppercase">Customer Profile</div>
                        <div className="text-sm font-extrabold text-ink leading-tight">
                          {selectedOrder.customer?.name || "Walk-in Customer"}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slatewash/40 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-ink/50">Booked By:</span>
                        <span className="font-semibold text-ink">{selectedOrder.cashier?.name || "System Office"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-ink/50">Order Date:</span>
                        <span className="font-semibold text-ink">{formatDate(selectedOrder.createdAt)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-ink/50">Delivery Date:</span>
                        <span className="font-semibold text-ink">{formatDate(selectedOrder.deliveryDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Operational Flow Status */}
                  <div className="rounded-2xl bg-slatewash/20 border border-slatewash/45 p-4 space-y-3.5">
                    <div className="text-[10px] font-black text-ink/40 uppercase tracking-wider">FMCG Audit Status</div>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="text-[10px] text-ink/45 font-bold uppercase">Order Lifecycle</div>
                        <div className="text-sm font-extrabold text-ink mt-0.5">
                          {selectedOrder.orderStatus === "pending_delivery" && "Awaiting Dispatch / Route Assignment"}
                          {selectedOrder.orderStatus === "delivered" && "Delivered & Reconciled"}
                          {selectedOrder.orderStatus === "cancelled" && "Voided / Cancelled"}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-ink/45 font-bold uppercase">Payment Mode</div>
                        <div className="text-sm font-extrabold text-ink mt-0.5">
                          {selectedOrder.paymentStatus === "credit" && "Credit Account Agreement"}
                          {selectedOrder.paymentStatus === "paid" && "Paid In Full (Settled)"}
                          {selectedOrder.paymentStatus === "partial" && "Partial Payment Collected"}
                          {selectedOrder.paymentStatus === "not_collected" && "No Collection Logged"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Financial Balance Summary */}
                  <div className="rounded-2xl bg-slatewash/20 border border-slatewash/45 p-4 space-y-3">
                    <div className="text-[10px] font-black text-ink/40 uppercase tracking-wider">Financial Statement</div>
                    
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-ink/50">Gross Invoice:</span>
                        <span className="font-mono text-ink font-semibold">{formatCurrency(selectedOrder.orderTotal)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-ink/50">Returns Adjust:</span>
                        <span className="font-mono text-amber-700">-{formatCurrency(selectedOrder.returnTotal || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-ink/50">Discounts:</span>
                        <span className="font-mono text-rose-600">-{formatCurrency(selectedOrder.discount || 0)}</span>
                      </div>
                      
                      <div className="pt-2 border-t border-slatewash/50 flex justify-between items-baseline">
                        <span className="text-sm font-extrabold text-ink">Net Payable:</span>
                        <span className="font-mono text-base font-black text-leaf">
                          {formatCurrency(selectedOrder.netTotal || selectedOrder.orderTotal)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-ink/50">Total Paid:</span>
                        <span className="font-mono text-emerald-700 font-semibold">{formatCurrency(selectedOrder.paidAmount || 0)}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-ink/50">Outstanding Due:</span>
                        <span className={`font-mono font-bold ${selectedOrder.dueAmount > 0 ? "text-rose-600" : "text-ink"}`}>
                          {formatCurrency(selectedOrder.dueAmount || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Items Audit Table */}
                <div className="rounded-2xl border border-slatewash overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slatewash bg-slatewash/30 px-4 py-3 text-xs font-bold text-ink/70 uppercase tracking-wider">
                    <span>Fulfillment Lines</span>
                    <span>{selectedOrder.items.length} unique items</span>
                  </div>
                  
                  <div className="divide-y divide-slatewash/60">
                    {selectedOrder.items.map((item, index) => (
                      <div key={item.itemCode || index} className="p-4 space-y-3 hover:bg-slatewash/10 transition">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="font-extrabold text-ink">{item.itemName}</div>
                            <div className="text-xs font-mono text-ink/40 font-semibold mt-0.5">Code: {item.itemCode}</div>
                          </div>
                          
                          <div className="flex items-center gap-6 text-right">
                            <div className="text-xs text-ink/50">
                              <div className="font-mono font-semibold">{item.quantity} units × {formatCurrency(item.unitPrice)}</div>
                              <div className="text-sm font-black text-ink font-mono mt-0.5">
                                {formatCurrency(item.lineTotal)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* FIFO Batch Allocation Log */}
                        {item.usedBatches && item.usedBatches.length > 0 && (
                          <div className="rounded-xl bg-slatewash/35 p-3 text-xs space-y-2 border border-slatewash/30">
                            <div className="text-[9px] font-black text-ink/40 uppercase tracking-widest border-b border-slatewash/40 pb-1">
                              Fulfillment Batches (FIFO Traceability)
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                              {item.usedBatches.map((batch, bIdx) => (
                                <div key={bIdx} className="bg-white/80 border border-slatewash/30 rounded-lg p-2 flex flex-col justify-between">
                                  <div className="text-[10px] text-ink/40 font-bold uppercase">Batch Reference</div>
                                  <div className="font-mono font-bold text-ink text-xs mt-0.5">{batch.batchNo}</div>
                                  <div className="text-[10px] text-ink/60 mt-1 flex justify-between">
                                    <span>Qty: <strong className="text-ink font-bold">{batch.qty}</strong></span>
                                    <span>Rate: <strong className="text-ink font-mono">{formatCurrency(batch.billingPrice)}</strong></span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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

                {/* Discount percentage input */}
                <div className="mt-4 p-4 rounded-2xl bg-slatewash/60 border border-slatewash text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-ink/60 font-semibold uppercase tracking-wider">Discount (%)</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-slatewash px-3 py-2 text-sm"
                        type="number"
                        min="0"
                        max="100"
                        value={discountPercent}
                        onChange={(event) => setDiscountPercent(event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ink/60 font-semibold uppercase tracking-wider">Discount Amount</label>
                      <div className="mt-1 rounded-lg bg-white px-3 py-2 text-sm border border-slatewash/40 font-mono font-bold">
                        {(() => {
                          const orderTotal = editItems.reduce((sum, item) => sum + item.lineTotal, 0);
                          const returnTotal = hasReturns ? returns.reduce((sum, item) => sum + item.returnTotal, 0) : 0;
                          const baseTotal = Math.max(orderTotal - returnTotal, 0);
                          const discountAmount = Math.max((baseTotal * Number(discountPercent || 0)) / 100, 0);
                          return formatCurrency(discountAmount);
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Returns section */}
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
                            itemCode: "",
                            itemName: "",
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

                {/* Edit Totals Summary Preview */}
                <div className="p-4 rounded-2xl bg-ink/5 border border-slatewash/60 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-ink/60">Gross Order Total:</span>
                    <span className="font-semibold">{formatCurrency(editItems.reduce((sum, item) => sum + item.lineTotal, 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink/60">Discount Adjustments:</span>
                    <span className="font-semibold text-rose-600">
                      -{(() => {
                        const orderTotal = editItems.reduce((sum, item) => sum + item.lineTotal, 0);
                        const returnTotal = hasReturns ? returns.reduce((sum, item) => sum + item.returnTotal, 0) : 0;
                        const baseTotal = Math.max(orderTotal - returnTotal, 0);
                        return formatCurrency(Math.max((baseTotal * Number(discountPercent || 0)) / 100, 0));
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink/60">Market Return Deductions:</span>
                    <span className="font-semibold text-amber-700">
                      -{formatCurrency(hasReturns ? returns.reduce((sum, item) => sum + item.returnTotal, 0) : 0)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slatewash/60 flex justify-between items-baseline font-bold text-sm">
                    <span className="text-ink">Estimated Net Payable:</span>
                    <span className="text-leaf font-black font-mono">
                      {(() => {
                        const orderTotal = editItems.reduce((sum, item) => sum + item.lineTotal, 0);
                        const returnTotal = hasReturns ? returns.reduce((sum, item) => sum + item.returnTotal, 0) : 0;
                        const baseTotal = Math.max(orderTotal - returnTotal, 0);
                        const discountAmount = Math.max((baseTotal * Number(discountPercent || 0)) / 100, 0);
                        return formatCurrency(Math.max(baseTotal - discountAmount, 0));
                      })()}
                    </span>
                  </div>
                </div>

                <button
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90 transition shadow-sm"
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
                            itemCode: "",
                            itemName: "",
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
