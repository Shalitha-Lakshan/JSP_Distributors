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

/* ─── Inline SVGs for consistent premium visuals ────────────────────── */
const SVGIcons = {
  route: (
    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
  cash: (
    <svg className="w-5 h-5 text-leaf" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  cheque: (
    <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4 text-leaf" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4 text-clay" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  expenses: (
    <svg className="w-5 h-5 text-clay" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1" />
    </svg>
  ),
  audit: (
    <svg className="w-12 h-12 text-ink/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
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
        const res = await api.get("/api/trips", { headers: authHeader });
        setTripsList(res.data || []);
      } else {
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
      <div className="rounded-2xl bg-white/80 p-6 shadow border-l-4 border-ink">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">Trip Sessions</h1>
            <p className="text-sm text-ink/60 mt-0.5">
              {isManagerOrAdmin
                ? "Reconcile Rep collections, check trip route audits, and track live session closures."
                : "Manage active route bookings, log field collections, and submit counts for audit."}
            </p>
          </div>
          {activeTrip && (
            <div className="rounded-xl bg-leaf/10 border border-leaf/20 p-3 flex items-center gap-3">
              <div className="p-2 bg-leaf/10 rounded-lg shrink-0">
                {SVGIcons.route}
              </div>
              <div>
                <div className="text-[10px] font-bold text-leaf uppercase tracking-wider">Active Trip</div>
                <div className="text-sm font-bold text-ink leading-tight">{activeTrip.tripNo}</div>
                <div className="text-xs text-ink/60 truncate max-w-[150px]">{activeTrip.route}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay font-medium animate-pulse">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-leaf/30 bg-leaf/5 px-4 py-3 text-sm text-leaf font-medium">
          {success}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl bg-white/80 p-6 text-sm text-ink/60 shadow flex items-center justify-center gap-2">
          <div className="h-4 w-4 border-2 border-ink border-t-transparent rounded-full animate-spin"></div>
          Loading trip session details...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.26fr_0.74fr]">
          
          {/* Main Left Column (Active Trip / Selected Audit) */}
          <div className="space-y-6">
            {!isManagerOrAdmin && !selectedTrip && (
              <>
                {/* Rep Mode - Start Trip Panel */}
                {!activeTrip && (
                  <div className="rounded-2xl bg-white/90 p-6 shadow space-y-4 border border-slatewash/40">
                    <div className="flex items-center gap-2 border-b border-slatewash pb-3">
                      <span className="p-1.5 bg-indigo-50 rounded-lg">{SVGIcons.route}</span>
                      <h2 className="text-lg font-bold text-ink">Start Route Trip</h2>
                    </div>
                    <form onSubmit={handleStartTrip} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-ink/50 uppercase tracking-wider">Route Name</label>
                        <input
                          className="mt-1.5 w-full rounded-lg border border-slatewash px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition"
                          placeholder="e.g. Negombo Town Area, Colombo Outer Route"
                          value={routeInput}
                          onChange={(e) => setRouteInput(e.target.value)}
                          disabled={submitting}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-lg bg-ink py-3 text-sm font-semibold text-sand hover:bg-ink/90 transition disabled:opacity-60 shadow-sm"
                      >
                        {submitting ? "Starting Trip..." : "Start Trip Session"}
                      </button>
                    </form>
                  </div>
                )}

                {/* Rep Mode - Active Trip Stats & Action */}
                {activeTrip && (
                  <div className="rounded-2xl bg-white/90 p-6 shadow space-y-6 border border-slatewash/40">
                    <div className="flex items-center justify-between border-b border-slatewash pb-4">
                      <div>
                        <h2 className="text-lg font-bold text-ink">Active Session Details</h2>
                        <p className="text-xs text-ink/50 mt-0.5">Started at {formatDateTime(activeTrip.startTime)}</p>
                      </div>
                      {!endingTrip ? (
                        <button
                          onClick={() => {
                            setActualCash(activeTrip.expectedCollections?.cash || "");
                            setActualCheque(activeTrip.expectedCollections?.cheque || "");
                            setEndingTrip(true);
                          }}
                          className="rounded-lg bg-clay px-4 py-2.5 text-xs font-bold text-sand hover:bg-clay/90 transition shadow-sm"
                        >
                          End Trip Session
                        </button>
                      ) : (
                        <button
                          onClick={() => setEndingTrip(false)}
                          className="rounded-lg border border-slatewash px-4 py-2.5 text-xs font-bold text-ink/70 hover:bg-slatewash transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {!endingTrip ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {/* Expected Cash */}
                        <div className="rounded-xl border border-slatewash/60 bg-slatewash/20 p-4 border-l-4 border-leaf flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider block">Expected Cash</span>
                            <span className="text-2xl font-extrabold text-ink block mt-1">
                              {formatCurrency(activeTrip.expectedCollections?.cash)}
                            </span>
                          </div>
                          <div className="p-2.5 bg-leaf/10 rounded-lg shrink-0">
                            {SVGIcons.cash}
                          </div>
                        </div>
                        {/* Expected Cheque */}
                        <div className="rounded-xl border border-slatewash/60 bg-slatewash/20 p-4 border-l-4 border-indigo-500 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider block">Expected Cheque</span>
                            <span className="text-2xl font-extrabold text-ink block mt-1">
                              {formatCurrency(activeTrip.expectedCollections?.cheque)}
                            </span>
                          </div>
                          <div className="p-2.5 bg-indigo-50 rounded-lg shrink-0">
                            {SVGIcons.cheque}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmitAudit} className="space-y-4 rounded-xl border border-slatewash p-4 bg-slatewash/10">
                        <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Declare Physical Collections</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-bold text-ink/50 uppercase">Physical Cash Count (Rs.)</label>
                            <input
                              type="number"
                              className="mt-1.5 w-full rounded-lg border border-slatewash px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition"
                              value={actualCash}
                              onChange={(e) => setActualCash(e.target.value)}
                              disabled={submitting}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-ink/50 uppercase">Physical Cheque Count (Rs.)</label>
                            <input
                              type="number"
                              className="mt-1.5 w-full rounded-lg border border-slatewash px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition"
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
                          className="w-full rounded-lg bg-clay py-3 text-sm font-semibold text-sand hover:bg-clay/90 transition disabled:opacity-60 shadow-sm mt-2"
                        >
                          {submitting ? "Submitting..." : "Submit to Manager for Audit"}
                        </button>
                      </form>
                    )}

                    {/* Booked Orders in this Session */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Booked Orders ({activeTrip.ordersBooked?.length || 0})</h3>
                      <div className="overflow-x-auto rounded-xl border border-slatewash">
                        <table className="w-full border-collapse text-left text-sm">
                          <thead>
                            <tr className="bg-slatewash/50 text-[10px] font-bold uppercase tracking-wider text-ink/50 border-b border-slatewash">
                              <th className="px-4 py-3">Order No</th>
                              <th className="px-4 py-3">Customer</th>
                              <th className="px-4 py-3">Total</th>
                              <th className="px-4 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slatewash">
                            {(activeTrip.ordersBooked || []).map((order) => (
                              <tr key={order._id} className="hover:bg-slatewash/20 transition-colors">
                                <td className="px-4 py-3 font-semibold text-ink">{order.orderNo}</td>
                                <td className="px-4 py-3 text-ink/80">{order.customer?.name || "Walk-in"}</td>
                                <td className="px-4 py-3 font-bold text-ink">{formatCurrency(order.netTotal)}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold
                                    ${order.orderStatus === "delivered" ? "bg-leaf/10 text-leaf" : "bg-clay/10 text-clay"}`}>
                                    {order.orderStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {!activeTrip.ordersBooked?.length && (
                              <tr>
                                <td colSpan="4" className="px-4 py-8 text-center text-ink/40">
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
                      <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Payments Collected ({activeTrip.paymentsCollected?.length || 0})</h3>
                      <div className="overflow-x-auto rounded-xl border border-slatewash">
                        <table className="w-full border-collapse text-left text-sm">
                          <thead>
                            <tr className="bg-slatewash/50 text-[10px] font-bold uppercase tracking-wider text-ink/50 border-b border-slatewash">
                              <th className="px-4 py-3">Receipt No</th>
                              <th className="px-4 py-3">Customer</th>
                              <th className="px-4 py-3">Method</th>
                              <th className="px-4 py-3">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slatewash">
                            {(activeTrip.paymentsCollected || []).map((pay) => (
                              <tr key={pay._id} className="hover:bg-slatewash/20 transition-colors">
                                <td className="px-4 py-3 font-semibold text-ink">{pay.paymentNo}</td>
                                <td className="px-4 py-3 text-ink/80">{pay.customer?.name}</td>
                                <td className="px-4 py-3 uppercase text-xs font-bold text-ink/50">{pay.paymentMethod}</td>
                                <td className="px-4 py-3 font-bold text-leaf">{formatCurrency(pay.amount)}</td>
                              </tr>
                            ))}
                            {!activeTrip.paymentsCollected?.length && (
                              <tr>
                                <td colSpan="4" className="px-4 py-8 text-center text-ink/40">
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

            {/* Read-Only Details Panel for Rep OR Auditing Panel for Manager */}
            {selectedTrip && (
              <div className="rounded-2xl bg-white/90 p-6 shadow space-y-6 border border-slatewash/40">
                <div className="flex items-center justify-between border-b border-slatewash pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-ink">Trip Details: {selectedTrip.tripNo}</h2>
                    <p className="text-xs text-ink/50 mt-0.5">
                      Rep: <span className="font-semibold text-ink/80">{selectedTrip.rep?.name}</span> | Route: <span className="font-semibold text-ink/80">{selectedTrip.route}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedTrip(null)}
                    className="rounded-lg border border-slatewash px-4 py-2 text-xs font-semibold text-ink/75 hover:bg-slatewash hover:text-ink transition"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Cash & Cheque Reconciliation</h3>
                  <div className="overflow-x-auto rounded-xl border border-slatewash">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="bg-slatewash/50 text-[10px] font-bold uppercase tracking-wider text-ink/50 border-b border-slatewash">
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Expected (System)</th>
                          <th className="px-4 py-3">Actual (Declared)</th>
                          <th className="px-4 py-3">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slatewash">
                        {/* Cash Row */}
                        <tr className="hover:bg-slatewash/20 transition-colors">
                          <td className="px-4 py-3 font-semibold text-ink flex items-center gap-2">
                            {SVGIcons.cash} Cash
                          </td>
                          <td className="px-4 py-3 font-medium text-ink">{formatCurrency(selectedTrip.expectedCollections?.cash)}</td>
                          <td className="px-4 py-3 font-medium text-ink">
                            {selectedTrip.status === "active" ? "-" : formatCurrency(selectedTrip.actualCollections?.cash)}
                          </td>
                          <td className="px-4 py-3">
                            {selectedTrip.status === "active" ? (
                              <span className="text-ink/40">-</span>
                            ) : (
                              <div className="flex items-center gap-1.5 font-bold">
                                {Number(selectedTrip.varianceCollections?.cash || 0) === 0 ? (
                                  <>
                                    <span className="p-0.5 bg-leaf/10 rounded-full">{SVGIcons.check}</span>
                                    <span className="text-leaf">0.00</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="p-0.5 bg-clay/10 rounded-full">{SVGIcons.warning}</span>
                                    <span className={Number(selectedTrip.varianceCollections?.cash || 0) < 0 ? "text-clay" : "text-leaf"}>
                                      {formatCurrency(selectedTrip.varianceCollections?.cash)}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                        {/* Cheque Row */}
                        <tr className="hover:bg-slatewash/20 transition-colors">
                          <td className="px-4 py-3 font-semibold text-ink flex items-center gap-2">
                            {SVGIcons.cheque} Cheque
                          </td>
                          <td className="px-4 py-3 font-medium text-ink">{formatCurrency(selectedTrip.expectedCollections?.cheque)}</td>
                          <td className="px-4 py-3 font-medium text-ink">
                            {selectedTrip.status === "active" ? "-" : formatCurrency(selectedTrip.actualCollections?.cheque)}
                          </td>
                          <td className="px-4 py-3">
                            {selectedTrip.status === "active" ? (
                              <span className="text-ink/40">-</span>
                            ) : (
                              <div className="flex items-center gap-1.5 font-bold">
                                {Number(selectedTrip.varianceCollections?.cheque || 0) === 0 ? (
                                  <>
                                    <span className="p-0.5 bg-leaf/10 rounded-full">{SVGIcons.check}</span>
                                    <span className="text-leaf">0.00</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="p-0.5 bg-clay/10 rounded-full">{SVGIcons.warning}</span>
                                    <span className={Number(selectedTrip.varianceCollections?.cheque || 0) < 0 ? "text-clay" : "text-leaf"}>
                                      {formatCurrency(selectedTrip.varianceCollections?.cheque)}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
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
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Orders Booked ({selectedTrip.ordersBooked?.length || 0})</h4>
                    <div className="max-h-[240px] overflow-y-auto rounded-xl border border-slatewash p-2.5 space-y-2 bg-slate-50">
                      {selectedTrip.ordersBooked?.map((o) => (
                        <div key={o._id} className="flex items-center justify-between text-xs bg-white border border-slatewash p-2.5 rounded-lg shadow-sm">
                          <div>
                            <div className="font-semibold text-ink">{o.orderNo}</div>
                            <div className="text-[10px] text-ink/50 mt-0.5">{o.customer?.name || "Walk-in"}</div>
                          </div>
                          <div className="font-bold text-ink">{formatCurrency(o.netTotal)}</div>
                        </div>
                      ))}
                      {!selectedTrip.ordersBooked?.length && (
                        <div className="text-center py-8 text-xs text-ink/40">No orders booked.</div>
                      )}
                    </div>
                  </div>

                  {/* Collected payments */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Payments Received ({selectedTrip.paymentsCollected?.length || 0})</h4>
                    <div className="max-h-[240px] overflow-y-auto rounded-xl border border-slatewash p-2.5 space-y-2 bg-slate-50">
                      {selectedTrip.paymentsCollected?.map((p) => (
                        <div key={p._id} className="flex items-center justify-between text-xs bg-white border border-slatewash p-2.5 rounded-lg shadow-sm">
                          <div>
                            <div className="font-semibold text-ink">{p.paymentNo}</div>
                            <div className="text-[10px] text-ink/50 mt-0.5">{p.customer?.name} ({p.paymentMethod})</div>
                          </div>
                          <div className="font-bold text-leaf">{formatCurrency(p.amount)}</div>
                        </div>
                      ))}
                      {!selectedTrip.paymentsCollected?.length && (
                        <div className="text-center py-8 text-xs text-ink/40">No payments collected.</div>
                      )}
                    </div>
                  </div>

                  {/* Trip Expenses */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Trip Expenses ({(selectedTrip.expenses || []).length})</h4>
                    <div className="max-h-[240px] overflow-y-auto rounded-xl border border-slatewash p-2.5 space-y-2 bg-slate-50">
                      {(selectedTrip.expenses || []).map((exp, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-white border border-slatewash p-2.5 rounded-lg shadow-sm">
                          <div>
                            <div className="font-semibold text-ink">{exp.reason}</div>
                          </div>
                          <div className="font-bold text-clay">{formatCurrency(exp.amount)}</div>
                        </div>
                      ))}
                      {!(selectedTrip.expenses || []).length && (
                        <div className="text-center py-8 text-xs text-ink/40">No expenses recorded.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Audit Action section */}
                {isManagerOrAdmin && selectedTrip.status === "pending_audit" ? (
                  <div className="space-y-3 pt-4 border-t border-slatewash">
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-wider">Audit Notes & Comments</label>
                    <textarea
                      rows="3"
                      className="w-full rounded-lg border border-slatewash p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition"
                      placeholder="Add reconciliation comments, variance explanation notes..."
                      value={auditNotes}
                      onChange={(e) => setAuditNotes(e.target.value)}
                      disabled={submitting}
                    />
                    <button
                      onClick={handleApproveTrip}
                      disabled={submitting}
                      className="w-full rounded-lg bg-ink py-3.5 text-sm font-semibold text-sand hover:bg-ink/90 transition disabled:opacity-60 shadow-sm"
                    >
                      {submitting ? "Approving & Closing Session..." : "Approve Audit & Close Session"}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slatewash/80 bg-slatewash/10 p-4 text-xs space-y-3 text-ink/80 border-l-4 border-leaf">
                    <div className="flex items-center justify-between border-b border-slatewash pb-2">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-ink/50">Audit Details</span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider
                        ${selectedTrip.status === "approved" ? "bg-leaf/10 text-leaf" : "bg-amber-500/10 text-amber-600 animate-pulse"}`}>
                        {selectedTrip.status === "approved" ? "Audited & Closed" : selectedTrip.status}
                      </span>
                    </div>
                    {selectedTrip.auditedBy && (
                      <div>
                        <span className="font-bold text-ink/60 uppercase text-[9px] tracking-wider block">Audited By</span>
                        <span className="text-sm font-semibold text-ink">{selectedTrip.auditedBy.name}</span>
                      </div>
                    )}
                    {selectedTrip.auditedAt && (
                      <div>
                        <span className="font-bold text-ink/60 uppercase text-[9px] tracking-wider block">Audited At</span>
                        <span className="text-xs text-ink/80">{formatDateTime(selectedTrip.auditedAt)}</span>
                      </div>
                    )}
                    {selectedTrip.auditNotes && (
                      <div className="bg-white p-3 rounded-lg border border-slatewash italic text-ink/80">
                        "{selectedTrip.auditNotes}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Placeholder state for Managers when no trip is selected */}
            {isManagerOrAdmin && !selectedTrip && (
              <div className="rounded-2xl bg-white/50 border border-dashed border-slatewash p-12 text-center flex flex-col items-center justify-center space-y-4">
                <div className="p-4 bg-slatewash/50 rounded-full">
                  {SVGIcons.audit}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-ink">No Trip Session Selected</h3>
                  <p className="text-sm text-ink/50 max-w-sm mx-auto mt-1">
                    Select an active or pending session from the Audit Log on the right side to start reconciliations.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column (Sessions History / Audit Log) */}
          <div className="rounded-2xl bg-white/90 p-5 shadow border border-slatewash/40 space-y-4 h-fit">
            <h2 className="text-lg font-bold text-ink uppercase tracking-wider border-b border-slatewash pb-3">
              {isManagerOrAdmin ? "Trip Audit Log" : "My Trip History"}
            </h2>
            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
              {tripsList.map((trip) => (
                <button
                  key={trip._id}
                  onClick={() => handleViewDetails(trip._id)}
                  className={`w-full text-left rounded-xl p-4 transition border flex flex-col gap-2.5 group
                    ${selectedTrip?._id === trip._id 
                      ? "bg-slatewash border-ink shadow-sm" 
                      : "bg-slatewash/30 border-slatewash hover:bg-slatewash/60 hover:border-slatewash"
                    }
                  `}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-sm text-ink group-hover:text-clay transition-colors">{trip.tripNo}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider
                      ${trip.status === "approved" 
                        ? "bg-leaf/10 text-leaf" 
                        : trip.status === "pending_audit" 
                          ? "bg-clay/10 text-clay animate-pulse" 
                          : "bg-ink/10 text-ink"
                      }
                    `}>
                      {trip.status === "pending_audit" ? "Pending Audit" : trip.status}
                    </span>
                  </div>
                  <div className="text-xs text-ink/60 space-y-1.5 w-full">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-ink/40 uppercase font-bold tracking-wider shrink-0">Route:</span> 
                      <span className="font-semibold text-ink/80 truncate">{trip.route}</span>
                    </div>
                    {isManagerOrAdmin && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-ink/40 uppercase font-bold tracking-wider shrink-0">Rep:</span> 
                        <span className="font-semibold text-ink/80 truncate">{trip.rep?.name}</span>
                      </div>
                    )}
                    <div className="text-[10px] text-ink/40 pt-1 border-t border-slatewash/60">
                      Started: {formatDateTime(trip.startTime)}
                    </div>
                  </div>
                </button>
              ))}

              {tripsList.length === 0 && (
                <div className="text-center py-12 text-sm text-ink/40 italic">
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
