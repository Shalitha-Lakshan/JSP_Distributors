import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const formatCurrency = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Initials Avatar Helpers
const getInitials = (name) => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getAvatarColor = (name) => {
  const colors = [
    "bg-indigo-100 text-indigo-700",
    "bg-teal-100 text-teal-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-orange-100 text-orange-700"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const getCustomerTypeBadge = (type) => {
  switch (type) {
    case "credit":
      return "bg-clay/10 text-clay border border-clay/20 font-bold";
    case "wholesale":
      return "bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold";
    case "retail":
      return "bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold";
    case "walk-in":
      return "bg-slatewash/60 text-ink/60 border border-slatewash font-bold";
    default:
      return "bg-slatewash text-ink";
  }
};

const CustomersPage = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    customerType: "retail",
    status: "active"
  });

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const role = useMemo(() => localStorage.getItem("role") || "rep", []);

  const loadCustomers = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/customers", { headers: authHeader });
      setCustomers(data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesSearch =
        !query ||
        `${customer.name} ${customer.phone || ""}`.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" ? true : customer.status === statusFilter;
      const matchesType =
        typeFilter === "all" ? true : customer.customerType === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [customers, search, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((customer) => customer.status === "active").length;
    const credit = customers.filter((customer) => customer.customerType === "credit").length;
    const outstanding = customers.reduce(
      (sum, customer) => sum + (customer.outstandingBalance || 0),
      0
    );
    return { total, active, credit, outstanding };
  }, [customers]);

  const openCreate = () => {
    setEditingCustomer(null);
    setFormData({
      name: "",
      phone: "",
      address: "",
      customerType: "retail",
      status: "active"
    });
    setSuccess("");
    setError("");
    setShowForm(true);
  };

  const openEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || "",
      phone: customer.phone || "",
      address: customer.address || "",
      customerType: customer.customerType || "retail",
      status: customer.status || "active"
    });
    setSuccess("");
    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCustomer(null);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.name.trim()) {
      setError("Customer name is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
        customerType: formData.customerType,
        status: formData.status
      };

      if (editingCustomer) {
        await api.put(`/api/customers/${editingCustomer._id}`, payload, {
          headers: authHeader
        });
        setSuccess(`Successfully updated customer details for "${formData.name}".`);
      } else {
        await api.post("/api/customers", payload, { headers: authHeader });
        setSuccess(`Successfully created customer profile for "${formData.name}".`);
      }

      await loadCustomers();
      closeForm();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save customer");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer) => {
    const confirmed = window.confirm(`Are you sure you want to permanently delete customer profile: "${customer.name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/api/customers/${customer._id}`, { headers: authHeader });
      setSuccess(`Successfully deleted customer "${customer.name}".`);
      await loadCustomers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete customer");
    }
  };

  return (
    <section className="space-y-6">
      {/* Header card banner */}
      <div className="rounded-2xl bg-white/80 p-6 shadow border-l-4 border-ink flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Customer Registry</h1>
          <p className="text-sm text-ink/60 mt-0.5">
            Maintain accounts, track credit types, evaluate ledger balances, and check location details.
          </p>
        </div>
        <button
          className="rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-sand hover:bg-ink/90 transition shadow-sm flex items-center justify-center gap-1.5 self-start sm:self-center"
          type="button"
          onClick={openCreate}
        >
          <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Customer
        </button>
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

      {/* Statistics Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white/90 p-4 shadow border-b-4 border-slatewash flex flex-col justify-between min-h-[90px]">
          <div className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Total Registry</div>
          <div className="mt-2 text-xl font-bold text-ink">{stats.total} <span className="text-xs font-normal text-ink/50">Accounts</span></div>
        </div>
        <div className="rounded-2xl bg-white/90 p-4 shadow border-b-4 border-leaf flex flex-col justify-between min-h-[90px]">
          <div className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Active Customers</div>
          <div className="mt-2 text-xl font-bold text-leaf">{stats.active} <span className="text-xs font-normal text-ink/50">Active</span></div>
        </div>
        <div className="rounded-2xl bg-white/90 p-4 shadow border-b-4 border-indigo-400 flex flex-col justify-between min-h-[90px]">
          <div className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Credit Accounts</div>
          <div className="mt-2 text-xl font-bold text-indigo-700">{stats.credit} <span className="text-xs font-normal text-ink/50">Debtors</span></div>
        </div>
        <div className="rounded-2xl bg-white/90 p-4 shadow border-b-4 border-clay flex flex-col justify-between min-h-[90px]">
          <div className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Outstanding Balance</div>
          <div className="mt-2 text-base sm:text-lg font-bold text-clay truncate">{formatCurrency(stats.outstanding)}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 space-y-4">
        <div className="text-xs font-bold text-ink/60 uppercase tracking-wider">Filter Registry</div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search text field */}
          <div className="relative flex-1 min-w-[260px]">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              className="w-full rounded-xl border border-slatewash pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
              placeholder="Search by customer name or phone number..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {/* Status Select dropdown */}
          <div className="w-full sm:w-44">
            <select
              className="w-full rounded-xl border border-slatewash px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/80"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Type Select dropdown */}
          <div className="w-full sm:w-44">
            <select
              className="w-full rounded-xl border border-slatewash px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/80"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="all">All Customer Types</option>
              <option value="walk-in">Walk-in</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
              <option value="credit">Credit (Debtor)</option>
            </select>
          </div>

          <div className="text-xs font-bold text-ink/40 ml-auto shrink-0 uppercase tracking-wider">
            {filteredCustomers.length} Records Found
          </div>
        </div>
      </div>

      {/* Customers Cards Layout */}
      {loading ? (
        <div className="text-center py-16 text-sm text-ink/50 flex items-center justify-center gap-2 bg-white/60 rounded-2xl shadow-sm border border-slatewash/40">
          <div className="h-5 w-5 border-2 border-ink border-t-transparent rounded-full animate-spin"></div>
          Loading registry files...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCustomers.map((customer) => {
            const avatarColor = getAvatarColor(customer.name);
            const initials = getInitials(customer.name);
            const hasDebt = (customer.outstandingBalance || 0) > 0;

            return (
              <div
                key={customer._id}
                className="rounded-2xl bg-white p-5 border border-slatewash/50 hover:border-ink/20 shadow-sm hover:shadow transition flex flex-col justify-between gap-5 relative overflow-hidden"
              >
                {/* Top header row of customer card */}
                <div className="flex gap-4 items-start">
                  {/* Initials Avatar */}
                  <div className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center font-bold text-sm shadow-inner ${avatarColor}`}>
                    {initials}
                  </div>
                  
                  {/* Info details */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-ink truncate leading-tight" title={customer.name}>
                      {customer.name}
                    </h3>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${getCustomerTypeBadge(customer.customerType)}`}>
                        {customer.customerType || "retail"}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider
                        ${customer.status === "active" ? "bg-leaf/10 text-leaf" : "bg-clay/15 text-clay"}`}>
                        {customer.status || "active"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body contact layout */}
                <div className="space-y-2 text-xs text-ink/70 border-t border-slatewash/40 pt-4">
                  {/* Phone number */}
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-ink/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span className="truncate">{customer.phone || <span className="text-ink/30 italic">No phone cataloged</span>}</span>
                  </div>
                  
                  {/* Address */}
                  <div className="flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 text-ink/40 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="line-clamp-2 leading-relaxed">{customer.address || <span className="text-ink/30 italic">No address registered</span>}</span>
                  </div>
                </div>

                {/* Outstanding balance section */}
                <div className={`rounded-xl p-3 flex items-center justify-between border
                  ${hasDebt
                    ? "bg-clay/5 border-clay/10 text-clay"
                    : "bg-slatewash/20 border-slatewash/40 text-ink/60"
                  }
                `}>
                  <div className="flex items-center gap-1.5">
                    {hasDebt && (
                      <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wider">Outstanding</span>
                  </div>
                  <span className="text-sm font-bold">{formatCurrency(customer.outstandingBalance || 0)}</span>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center gap-2 border-t border-slatewash/40 pt-3.5">
                  <button
                    onClick={() => openEdit(customer)}
                    className="flex-1 rounded-xl border border-slatewash hover:bg-slatewash hover:border-ink/20 py-2 text-xs font-bold text-ink/70 hover:text-ink transition flex items-center justify-center gap-1"
                    type="button"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>

                  <button
                    onClick={() => navigate(`/customers/${customer._id}/ledger`)}
                    className="flex-1 rounded-xl bg-ink hover:bg-ink/90 py-2 text-xs font-bold text-sand transition flex items-center justify-center gap-1 shadow-sm"
                    type="button"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Ledger
                  </button>

                  {(role === "admin" || role === "manager") && (
                    <button
                      onClick={() => handleDelete(customer)}
                      className="rounded-xl border border-clay/20 hover:bg-clay/5 hover:border-clay/40 p-2 text-clay transition"
                      type="button"
                      title="Permanently Delete Account"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filteredCustomers.length === 0 && (
            <div className="col-span-full py-16 text-center text-ink/40 bg-white/40 rounded-2xl border border-dashed border-slatewash italic text-sm">
              No customer profiles match your search criteria.
            </div>
          )}
        </div>
      )}

      {/* Form Popup Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl border border-slatewash max-h-[90vh] overflow-y-auto space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slatewash pb-3">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  {editingCustomer ? "Edit Customer Details" : "Register New Customer"}
                </h3>
                <p className="text-xs text-ink/50 mt-0.5">Define account permissions, contact channels, and addresses.</p>
              </div>
              <button
                onClick={closeForm}
                className="text-ink/40 hover:text-ink transition p-1"
                type="button"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Customer Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-ink/60 uppercase">Customer Name</label>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    placeholder="e.g. Shalitha Lakshan"
                    required
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Phone Number</label>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
                    name="phone"
                    value={formData.phone}
                    onChange={handleFormChange}
                    placeholder="e.g. +94 77 123 4567"
                  />
                </div>

                {/* Customer Type select */}
                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Customer Type</label>
                  <select
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/80"
                    name="customerType"
                    value={formData.customerType}
                    onChange={handleFormChange}
                  >
                    <option value="walk-in">Walk-in</option>
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                    <option value="credit">Credit (Debtor)</option>
                  </select>
                </div>

                {/* Status select */}
                <div>
                  <label className="block text-xs font-bold text-ink/60 uppercase">Account Status</label>
                  <select
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white text-ink/80"
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Outstanding balance (Read-only view on editing) */}
                {editingCustomer && (
                  <div>
                    <label className="block text-xs font-bold text-ink/60 uppercase">Outstanding Balance</label>
                    <div className="mt-1.5 w-full rounded-xl border border-slatewash bg-slatewash/30 px-4 py-2.5 text-sm font-semibold text-ink/75">
                      {formatCurrency(editingCustomer.outstandingBalance || 0)}
                    </div>
                  </div>
                )}

                {/* Address textarea */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-ink/60 uppercase">Location Address</label>
                  <textarea
                    className="mt-1.5 w-full rounded-xl border border-slatewash px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition bg-white"
                    rows="3"
                    name="address"
                    value={formData.address}
                    onChange={handleFormChange}
                    placeholder="e.g. 123 Galle Road, Colombo 03"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slatewash mt-6">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-slatewash px-5 py-2.5 text-sm font-semibold hover:bg-slatewash transition text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-ink px-6 py-2.5 text-sm font-semibold text-sand disabled:opacity-60 hover:bg-ink/90 transition shadow-sm flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <div className="h-4 w-4 border-2 border-sand border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {editingCustomer ? "Update Profile" : "Register Profile"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default CustomersPage;
