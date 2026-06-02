import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;

const CustomersPage = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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

  const role = useMemo(() => localStorage.getItem("role") || "cashier", []);

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
      return matchesSearch && matchesStatus;
    });
  }, [customers, search, statusFilter]);

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

  const handleSave = async () => {
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
        setSuccess("Customer updated successfully.");
      } else {
        await api.post("/api/customers", payload, { headers: authHeader });
        setSuccess("Customer created successfully.");
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
    const confirmed = window.confirm(`Delete ${customer.name}?`);
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/api/customers/${customer._id}`, { headers: authHeader });
      await loadCustomers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete customer");
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white/80 p-6 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Customers</h1>
            <p className="text-ink/60">Maintain customer profiles and account status.</p>
          </div>
          <button
            className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-sand"
            type="button"
            onClick={openCreate}
          >
            Add Customer
          </button>
        </div>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white/90 p-5 shadow">
          <div className="text-xs uppercase text-ink/60">Total Customers</div>
          <div className="mt-2 text-2xl font-semibold">{stats.total}</div>
        </div>
        <div className="rounded-2xl bg-white/90 p-5 shadow">
          <div className="text-xs uppercase text-ink/60">Active</div>
          <div className="mt-2 text-2xl font-semibold">{stats.active}</div>
        </div>
        <div className="rounded-2xl bg-white/90 p-5 shadow">
          <div className="text-xs uppercase text-ink/60">Credit Accounts</div>
          <div className="mt-2 text-2xl font-semibold">{stats.credit}</div>
        </div>
        <div className="rounded-2xl bg-white/90 p-5 shadow">
          <div className="text-xs uppercase text-ink/60">Outstanding</div>
          <div className="mt-2 text-2xl font-semibold">{formatCurrency(stats.outstanding)}</div>
        </div>
      </div>

      <div className="rounded-2xl bg-white/80 p-6 shadow space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-[220px] rounded-lg border border-slatewash px-3 py-2"
              placeholder="Search customer"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="rounded-lg border border-slatewash px-3 py-2"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="text-xs text-ink/60">{filteredCustomers.length} records</div>
        </div>

        {loading ? (
          <div className="text-sm text-ink/60">Loading customers...</div>
        ) : (
          <div className="space-y-3">
            {filteredCustomers.map((customer) => (
              <div
                key={customer._id}
                className="rounded-2xl border border-slatewash bg-slatewash/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{customer.name}</div>
                    <div className="text-xs text-ink/60">
                      {customer.phone || "No phone"} | {customer.customerType || "retail"}
                    </div>
                    <div className="mt-2 text-xs text-ink/60">
                      {customer.address || "No address"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-ink/60">Outstanding</div>
                    <div className="text-base font-semibold">
                      {formatCurrency(customer.outstandingBalance || 0)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold"
                    type="button"
                    onClick={() => openEdit(customer)}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold"
                    type="button"
                    onClick={() => navigate(`/customers/${customer._id}/ledger`)}
                  >
                    Ledger
                  </button>
                  {(role === "admin" || role === "manager") && (
                    <button
                      className="rounded-full border border-clay/40 px-3 py-1 text-xs font-semibold text-clay"
                      type="button"
                      onClick={() => handleDelete(customer)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredCustomers.length === 0 && (
              <div className="text-sm text-ink/60">No customers found.</div>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">
                {editingCustomer ? "Edit Customer" : "New Customer"}
              </div>
              <button className="text-sm text-ink/60" type="button" onClick={closeForm}>
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs text-ink/60">Name</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slatewash px-3 py-3 text-base"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label className="text-xs text-ink/60">Phone</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slatewash px-3 py-3 text-base"
                  name="phone"
                  value={formData.phone}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label className="text-xs text-ink/60">Customer Type</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slatewash px-3 py-3 text-base"
                  name="customerType"
                  value={formData.customerType}
                  onChange={handleFormChange}
                >
                  <option value="walk-in">Walk-in</option>
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-ink/60">Status</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slatewash px-3 py-3 text-base"
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-ink/60">Address</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slatewash px-3 py-3 text-base"
                  rows="3"
                  name="address"
                  value={formData.address}
                  onChange={handleFormChange}
                />
              </div>
              {editingCustomer && (
                <div className="sm:col-span-2">
                  <label className="text-xs text-ink/60">Outstanding Balance</label>
                  <div className="mt-1 rounded-lg border border-slatewash bg-slatewash/60 px-3 py-3 text-base">
                    {formatCurrency(editingCustomer.outstandingBalance || 0)}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold"
                type="button"
                onClick={closeForm}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-sand"
                type="button"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default CustomersPage;
