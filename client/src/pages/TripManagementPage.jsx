import { useEffect, useMemo, useState } from "react";
import api from "../api/client";

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;

const formatDateTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-LK", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

const TripManagementPage = () => {
  const role = useMemo(() => localStorage.getItem("role") || "rep", []);
  const isManagerOrAdmin = role === "manager" || role === "admin";

  const [activeTrip, setActiveTrip] = useState(null);
  const [tripsList, setTripsList] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form states
  const [routeInput, setRouteInput] = useState("");
  const [actualCash, setActualCash] = useState("");
  const [actualCheque, setActualCheque] = useState("");
  const [auditNotes, setAuditNotes] = useState("");
  const [endingTrip, setEndingTrip] = useState(false);

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      if (isManagerOrAdmin) {
        // Managers see all trips
        const res = await api.get("/api/trips", { headers: authHeader });
        setTripsList(res.data || []);
      } else {
        // Reps see active trip + their own past trips
        const [activeRes, historyRes] = await Promise.all([
          api.get("/api/trips/active", { headers: authHeader }),
          api.get("/api/trips", { headers: authHeader })
        ]);
        setActiveTrip(activeRes.data || null);
        setTripsList(historyRes.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load trip data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isManagerOrAdmin]);

  const handleStartTrip = async (e) => {
    e.preventDefault();
    if (!routeInput.trim()) {
      setError("Please specify a route name.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.post(
        "/api/trips/start",
        { route: routeInput },
        { headers: authHeader }
      );
      setActiveTrip(data);
      setSuccess(`Trip Session ${data.tripNo} started successfully!`);
      setRouteInput("");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to start trip session");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAudit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        actualCollections: {
          cash: Number(actualCash || 0),
          cheque: Number(actualCheque || 0)
        }
      };
      await api.post("/api/trips/submit-audit", payload, { headers: authHeader });
      setSuccess("Trip session submitted to manager for audit.");
      setActualCash("");
      setActualCheque("");
      setEndingTrip(false);
      setActiveTrip(null);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit trip for audit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveTrip = async () => {
    if (!selectedTrip) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.post(
        `/api/trips/${selectedTrip._id}/approve`,
        { auditNotes },
        { headers: authHeader }
      );
      setSuccess(`Trip Session ${data.tripNo} successfully audited and closed.`);
      setAuditNotes("");
      setSelectedTrip(null);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to approve trip audit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = async (tripId) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/api/trips/${tripId}`, { headers: authHeader });
      setSelectedTrip(data);
      setAuditNotes(data.auditNotes || "");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to get trip details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Header Panel */}
      <div className="rounded-2xl bg-white/80 p-6 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Trip Session Management</h1>
            <p className="text-sm text-ink/60">
              {isManagerOrAdmin
                ? "Reconcile cash/cheque collections and approve Sales Representatives' trips."
                : "Manage your route trips, track active bookings, and submit shift payments for audit."}
            </p>
          </div>
          {activeTrip && (
            <div className="rounded-2xl bg-leaf/10 border border-leaf/20 px-4 py-3 text-leaf">
              <div className="text-xs font-medium uppercase tracking-wider">Active Trip</div>
              <div className="text-base font-semibold">{activeTrip.tripNo}</div>
              <div className="text-xs text-leaf/80">{activeTrip.route}</div>
            </div>
          )}
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

      {loading ? (
        <div className="rounded-2xl bg-white/80 p-6 text-sm text-ink/60 shadow">
          Loading trip data...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          
          {/* Main Left Column (Rep Active Trip OR Manager Audits) */}
          <div className="space-y-6">
            {!isManagerOrAdmin && (
              <>
                {/* Rep Mode - Start Trip Panel */}
                {!activeTrip && (
                  <div className="rounded-2xl bg-white/80 p-6 shadow space-y-4">
                    <h2 className="text-lg font-semibold text-ink">Start Route Trip</h2>
                    <form onSubmit={handleStartTrip} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-ink/60 uppercase">Route Name</label>
                        <input
                          className="mt-1.5 w-full rounded-lg border border-slatewash px-3 py-3 text-base"
                          placeholder="e.g. Colombo Outer Route, Kandy Town"
                          value={routeInput}
                          onChange={(e) => setRouteInput(e.target.value)}
                          disabled={submitting}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-lg bg-ink py-3 text-sm font-semibold text-sand hover:bg-ink/90 transition disabled:opacity-60"
                      >
                        {submitting ? "Starting Trip..." : "Start Trip Session"}
                      </button>
                    </form>
                  </div>
                )}

                {/* Rep Mode - Active Trip Stats & Action */}
                {activeTrip && (
                  <div className="rounded-2xl bg-white/80 p-6 shadow space-y-6">
                    <div className="flex items-center justify-between border-b border-slatewash pb-4">
                      <div>
                        <h2 className="text-lg font-semibold text-ink">Active Session Details</h2>
                        <p className="text-xs text-ink/50">Started at {formatDateTime(activeTrip.startTime)}</p>
                      </div>
                      {!endingTrip ? (
                        <button
                          onClick={() => {
                            setActualCash(activeTrip.expectedCollections?.cash || "");
                            setActualCheque(activeTrip.expectedCollections?.cheque || "");
                            setEndingTrip(true);
                          }}
                          className="rounded-lg bg-clay px-4 py-2.5 text-xs font-semibold text-sand hover:bg-clay/90 transition"
                        >
                          End Trip Session
                        </button>
                      ) : (
                        <button
                          onClick={() => setEndingTrip(false)}
                          className="rounded-lg border border-slatewash px-4 py-2.5 text-xs font-semibold text-ink/70 hover:bg-slatewash transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {!endingTrip ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl bg-slatewash/60 p-4">
                          <span className="text-xs font-medium text-ink/50 uppercase block">Expected Cash Collected</span>
                          <span className="text-2xl font-bold text-ink block mt-1">
                            {formatCurrency(activeTrip.expectedCollections?.cash)}
                          </span>
                        </div>
                        <div className="rounded-xl bg-slatewash/60 p-4">
                          <span className="text-xs font-medium text-ink/50 uppercase block">Expected Cheque Collected</span>
                          <span className="text-2xl font-bold text-ink block mt-1">
                            {formatCurrency(activeTrip.expectedCollections?.cheque)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmitAudit} className="space-y-4 rounded-xl border border-slatewash p-4">
                        <h3 className="text-sm font-semibold text-ink">Declare Physical Collections</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-semibold text-ink/60 uppercase">Physical Cash Count (Rs.)</label>
                            <input
                              type="number"
                              className="mt-1 w-full rounded-lg border border-slatewash px-3 py-2 text-base"
                              value={actualCash}
                              onChange={(e) => setActualCash(e.target.value)}
                              disabled={submitting}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-ink/60 uppercase">Physical Cheque Count (Rs.)</label>
                            <input
                              type="number"
                              className="mt-1 w-full rounded-lg border border-slatewash px-3 py-2 text-base"
                              value={actualCheque}
                              onChange={(e) => setActualCheque(e.target.value)}
                              disabled={submitting}
                              required
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full rounded-lg bg-clay py-3 text-sm font-semibold text-sand hover:bg-clay/90 transition disabled:opacity-60 mt-2"
                        >
                          {submitting ? "Submitting..." : "Submit to Manager for Audit"}
                        </button>
                      </form>
                    )}

                    {/* Booked Orders in this Session */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-ink">Booked Orders ({activeTrip.ordersBooked?.length || 0})</h3>
                      <div className="overflow-x-auto rounded-xl border border-slatewash">
                        <table className="w-full border-collapse text-left text-sm">
                          <thead>
                            <tr className="bg-slatewash/50 text-xs font-semibold uppercase text-ink/60">
                              <th className="px-4 py-3">Order No</th>
                              <th className="px-4 py-3">Customer</th>
                              <th className="px-4 py-3">Total</th>
                              <th className="px-4 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slatewash">
                            {(activeTrip.ordersBooked || []).map((order) => (
                              <tr key={order._id} className="hover:bg-slatewash/20">
                                <td className="px-4 py-3 font-semibold">{order.orderNo}</td>
                                <td className="px-4 py-3 text-ink/80">{order.customer?.name || "Walk-in"}</td>
                                <td className="px-4 py-3 font-medium">{formatCurrency(order.netTotal)}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                                    ${order.orderStatus === "delivered" ? "bg-leaf/10 text-leaf" : "bg-clay/10 text-clay"}`}>
                                    {order.orderStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {!activeTrip.ordersBooked?.length && (
                              <tr>
                                <td colSpan="4" className="px-4 py-6 text-center text-ink/40">
                                  No orders booked in this session yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Payments Collected in this Session */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-ink">Payments Collected ({activeTrip.paymentsCollected?.length || 0})</h3>
                      <div className="overflow-x-auto rounded-xl border border-slatewash">
                        <table className="w-full border-collapse text-left text-sm">
                          <thead>
                            <tr className="bg-slatewash/50 text-xs font-semibold uppercase text-ink/60">
                              <th className="px-4 py-3">Receipt No</th>
                              <th className="px-4 py-3">Customer</th>
                              <th className="px-4 py-3">Method</th>
                              <th className="px-4 py-3">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slatewash">
                            {(activeTrip.paymentsCollected || []).map((pay) => (
                              <tr key={pay._id} className="hover:bg-slatewash/20">
                                <td className="px-4 py-3 font-semibold">{pay.paymentNo}</td>
                                <td className="px-4 py-3 text-ink/80">{pay.customer?.name}</td>
                                <td className="px-4 py-3 uppercase text-xs font-medium text-ink/60">{pay.paymentMethod}</td>
                                <td className="px-4 py-3 font-medium text-leaf">{formatCurrency(pay.amount)}</td>
                              </tr>
                            ))}
                            {!activeTrip.paymentsCollected?.length && (
                              <tr>
                                <td colSpan="4" className="px-4 py-6 text-center text-ink/40">
                                  No payments collected in this session yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Manager Mode - Auditing Panel */}
            {isManagerOrAdmin && selectedTrip && (
              <div className="rounded-2xl bg-white/80 p-6 shadow space-y-6">
                <div className="flex items-center justify-between border-b border-slatewash pb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">Auditing: {selectedTrip.tripNo}</h2>
                    <p className="text-xs text-ink/50">
                      Rep: <span className="font-semibold">{selectedTrip.rep?.name}</span> | Route: <span className="font-semibold">{selectedTrip.route}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedTrip(null)}
                    className="rounded-lg border border-slatewash px-4 py-2 text-xs font-semibold text-ink/75 hover:bg-slatewash transition"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-ink">Cash & Cheque Reconciliation</h3>
                  <div className="overflow-x-auto rounded-xl border border-slatewash">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="bg-slatewash/50 text-xs font-semibold uppercase text-ink/60">
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Expected (System)</th>
                          <th className="px-4 py-3">Actual (Declared)</th>
                          <th className="px-4 py-3">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slatewash">
                        {/* Cash Row */}
                        <tr className="hover:bg-slatewash/20">
                          <td className="px-4 py-3 font-semibold">Cash</td>
                          <td className="px-4 py-3">{formatCurrency(selectedTrip.expectedCollections?.cash)}</td>
                          <td className="px-4 py-3 font-medium">
                            {selectedTrip.status === "active" ? "-" : formatCurrency(selectedTrip.actualCollections?.cash)}
                          </td>
                          <td className={`px-4 py-3 font-semibold ${
                            (selectedTrip.varianceCollections?.cash || 0) < 0 ? "text-clay" : (selectedTrip.varianceCollections?.cash || 0) > 0 ? "text-leaf" : "text-ink"
                          }`}>
                            {selectedTrip.status === "active" ? "-" : formatCurrency(selectedTrip.varianceCollections?.cash)}
                          </td>
                        </tr>
                        {/* Cheque Row */}
                        <tr className="hover:bg-slatewash/20">
                          <td className="px-4 py-3 font-semibold">Cheque</td>
                          <td className="px-4 py-3">{formatCurrency(selectedTrip.expectedCollections?.cheque)}</td>
                          <td className="px-4 py-3 font-medium">
                            {selectedTrip.status === "active" ? "-" : formatCurrency(selectedTrip.actualCollections?.cheque)}
                          </td>
                          <td className={`px-4 py-3 font-semibold ${
                            (selectedTrip.varianceCollections?.cheque || 0) < 0 ? "text-clay" : (selectedTrip.varianceCollections?.cheque || 0) > 0 ? "text-leaf" : "text-ink"
                          }`}>
                            {selectedTrip.status === "active" ? "-" : formatCurrency(selectedTrip.varianceCollections?.cheque)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Lists of booked orders/payments/expenses */}
                <div className="grid gap-6 md:grid-cols-3">
                  {/* Booked orders */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase text-ink/60">Orders Booked ({selectedTrip.ordersBooked?.length || 0})</h4>
                    <div className="max-h-[220px] overflow-y-auto rounded-xl border border-slatewash p-2 space-y-2">
                      {selectedTrip.ordersBooked?.map((o) => (
                        <div key={o._id} className="flex items-center justify-between text-xs bg-slatewash/40 p-2.5 rounded-lg">
                          <div>
                            <div className="font-semibold text-ink">{o.orderNo}</div>
                            <div className="text-ink/60">{o.customer?.name || "Walk-in"}</div>
                          </div>
                          <div className="font-bold text-ink">{formatCurrency(o.netTotal)}</div>
                        </div>
                      ))}
                      {!selectedTrip.ordersBooked?.length && (
                        <div className="text-center py-6 text-xs text-ink/40">No orders booked.</div>
                      )}
                    </div>
                  </div>

                  {/* Collected payments */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase text-ink/60">Payments Received ({selectedTrip.paymentsCollected?.length || 0})</h4>
                    <div className="max-h-[220px] overflow-y-auto rounded-xl border border-slatewash p-2 space-y-2">
                      {selectedTrip.paymentsCollected?.map((p) => (
                        <div key={p._id} className="flex items-center justify-between text-xs bg-slatewash/40 p-2.5 rounded-lg">
                          <div>
                            <div className="font-semibold text-ink">{p.paymentNo}</div>
                            <div className="text-ink/60">{p.customer?.name} ({p.paymentMethod})</div>
                          </div>
                          <div className="font-bold text-leaf">{formatCurrency(p.amount)}</div>
                        </div>
                      ))}
                      {!selectedTrip.paymentsCollected?.length && (
                        <div className="text-center py-6 text-xs text-ink/40">No payments collected.</div>
                      )}
                    </div>
                  </div>

                  {/* Trip Expenses */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase text-ink/60">Trip Expenses ({(selectedTrip.expenses || []).length})</h4>
                    <div className="max-h-[220px] overflow-y-auto rounded-xl border border-slatewash p-2 space-y-2">
                      {(selectedTrip.expenses || []).map((exp, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-slatewash/40 p-2.5 rounded-lg">
                          <div>
                            <div className="font-semibold text-ink">{exp.reason}</div>
                          </div>
                          <div className="font-bold text-clay">{formatCurrency(exp.amount)}</div>
                        </div>
                      ))}
                      {!(selectedTrip.expenses || []).length && (
                        <div className="text-center py-6 text-xs text-ink/40">No expenses recorded.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Audit Action section */}
                {selectedTrip.status === "pending_audit" ? (
                  <div className="space-y-3 pt-4 border-t border-slatewash">
                    <label className="block text-xs font-semibold text-ink/60 uppercase">Audit Notes & Comments</label>
                    <textarea
                      rows="3"
                      className="w-full rounded-lg border border-slatewash p-3 text-sm focus:outline-none focus:ring-1 focus:ring-ink"
                      placeholder="Enter discrepancy explanations, manager notes..."
                      value={auditNotes}
                      onChange={(e) => setAuditNotes(e.target.value)}
                      disabled={submitting}
                    />
                    <button
                      onClick={handleApproveTrip}
                      disabled={submitting}
                      className="w-full rounded-lg bg-ink py-3 text-sm font-semibold text-sand hover:bg-ink/90 transition disabled:opacity-60"
                    >
                      {submitting ? "Approving & Closing Session..." : "Approve Audit & Close Session"}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl bg-slatewash/50 p-4 text-xs space-y-2 text-ink/70">
                    <div>
                      <span className="font-bold uppercase">Status:</span> Audited & Approved
                    </div>
                    {selectedTrip.auditedBy && (
                      <div>
                        <span className="font-bold uppercase">Audited By:</span> {selectedTrip.auditedBy.name}
                      </div>
                    )}
                    {selectedTrip.auditedAt && (
                      <div>
                        <span className="font-bold uppercase">Audited At:</span> {formatDateTime(selectedTrip.auditedAt)}
                      </div>
                    )}
                    {selectedTrip.auditNotes && (
                      <div className="mt-1">
                        <span className="font-bold uppercase block">Notes:</span>
                        <p className="italic text-ink mt-0.5">"{selectedTrip.auditNotes}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column (Sessions History) */}
          <div className="rounded-2xl bg-white/80 p-6 shadow space-y-4 h-fit">
            <h2 className="text-lg font-semibold text-ink">
              {isManagerOrAdmin ? "Trip Audit Log" : "My Trip History"}
            </h2>
            <div className="space-y-3">
              {tripsList.map((trip) => (
                <button
                  key={trip._id}
                  onClick={() => {
                    if (isManagerOrAdmin) {
                      handleViewDetails(trip._id);
                    } else {
                      // reps can just view their history details too
                      handleViewDetails(trip._id);
                    }
                  }}
                  className={`w-full text-left rounded-xl p-4 transition border border-transparent
                    ${selectedTrip?._id === trip._id ? "bg-slatewash border-ink/20" : "bg-slatewash/60 hover:bg-slatewash"}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-ink">{trip.tripNo}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold
                      ${trip.status === "approved" ? "bg-leaf/10 text-leaf" : trip.status === "pending_audit" ? "bg-clay/10 text-clay" : "bg-ink/10 text-ink"}`}>
                      {trip.status === "pending_audit" ? "Pending Audit" : trip.status}
                    </span>
                  </div>
                  <div className="text-xs text-ink/60 mt-1.5 space-y-1">
                    <div>Route: <span className="font-medium text-ink/80">{trip.route}</span></div>
                    {isManagerOrAdmin && (
                      <div>Rep: <span className="font-medium text-ink/80">{trip.rep?.name}</span></div>
                    )}
                    <div className="text-[10px] text-ink/40 mt-1">Started: {formatDateTime(trip.startTime)}</div>
                  </div>
                </button>
              ))}

              {tripsList.length === 0 && (
                <div className="text-center py-6 text-sm text-ink/40">
                  No trip session logs found.
                </div>
              )}
            </div>
          </div>
          
        </div>
      )}
    </section>
  );
};

export default TripManagementPage;
