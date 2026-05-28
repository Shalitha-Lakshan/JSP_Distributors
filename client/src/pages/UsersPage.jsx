import { useEffect, useMemo, useState } from "react";
import api from "../api/client";

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-LK") : "-";

const UsersPage = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [roleDraft, setRoleDraft] = useState("cashier");
  const [statusDraft, setStatusDraft] = useState("active");
  const [rejectionReason, setRejectionReason] = useState("");

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        api.get("/api/users/pending", { headers: authHeader }),
        api.get("/api/users", { headers: authHeader, params: { approvalStatus: "approved" } })
      ]);
      setPendingUsers(pendingRes.data || []);
      setApprovedUsers(approvedRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSelect = (user) => {
    setSelectedUser(user);
    setRoleDraft(user.role || "cashier");
    setStatusDraft(user.status || "active");
    setRejectionReason(user.rejectionReason || "");
  };

  const handleApprove = async (user, roleOverride) => {
    try {
      await api.patch(
        `/api/users/${user._id}/approve`,
        { role: roleOverride || user.role },
        { headers: authHeader }
      );
      await loadUsers();
      setSelectedUser(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to approve user");
    }
  };

  const handleReject = async (user, reasonOverride) => {
    try {
      await api.patch(
        `/api/users/${user._id}/reject`,
        { reason: reasonOverride || rejectionReason },
        { headers: authHeader }
      );
      await loadUsers();
      setSelectedUser(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reject user");
    }
  };

  const handleRoleUpdate = async () => {
    if (!selectedUser) {
      return;
    }

    try {
      await api.patch(
        `/api/users/${selectedUser._id}/role`,
        { role: roleDraft },
        { headers: authHeader }
      );
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update role");
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedUser) {
      return;
    }

    try {
      await api.patch(
        `/api/users/${selectedUser._id}/status`,
        { status: statusDraft },
        { headers: authHeader }
      );
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update status");
    }
  };

  const promptRejectReason = async (user) => {
    const reason = window.prompt("Enter rejection reason", "");
    if (reason === null) {
      return;
    }
    await handleReject(user, reason);
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white/80 p-6 shadow">
        <h1 className="text-2xl font-semibold">User Approvals</h1>
        <p className="text-ink/60">Review, approve, and manage access requests.</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl bg-white/80 p-6 text-sm text-ink/60 shadow">
          Loading users...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl bg-white/90 p-6 shadow">
              <div className="text-sm font-semibold text-ink/70">Pending Approvals</div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-ink/50">
                    <tr>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Requested Role</th>
                      <th className="py-2 pr-4">Registered Date</th>
                      <th className="py-2 pr-4">Approval Status</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slatewash">
                    {pendingUsers.map((user) => (
                      <tr key={user._id}>
                        <td className="py-2 pr-4 font-semibold">{user.name}</td>
                        <td className="py-2 pr-4">{user.email}</td>
                        <td className="py-2 pr-4">{user.role}</td>
                        <td className="py-2 pr-4">{formatDate(user.createdAt)}</td>
                        <td className="py-2 pr-4">
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                            {user.approvalStatus}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-sand"
                              onClick={() => handleApprove(user)}
                              type="button"
                            >
                              Approve
                            </button>
                            <button
                              className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold"
                              onClick={() => promptRejectReason(user)}
                              type="button"
                            >
                              Reject
                            </button>
                            <button
                              className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold"
                              onClick={() => handleSelect(user)}
                              type="button"
                            >
                              View Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {pendingUsers.length === 0 && (
                      <tr>
                        <td className="py-3 text-ink/60" colSpan="6">
                          No pending users.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl bg-white/90 p-6 shadow">
              <div className="text-sm font-semibold text-ink/70">Approved Users</div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-ink/50">
                    <tr>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slatewash">
                    {approvedUsers.map((user) => (
                      <tr key={user._id}>
                        <td className="py-2 pr-4 font-semibold">{user.name}</td>
                        <td className="py-2 pr-4">{user.email}</td>
                        <td className="py-2 pr-4">{user.role}</td>
                        <td className="py-2 pr-4">
                          <span className="rounded-full bg-leaf/10 px-2 py-1 text-xs font-semibold text-leaf">
                            {user.status}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold"
                              onClick={() => handleSelect(user)}
                              type="button"
                            >
                              View Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {approvedUsers.length === 0 && (
                      <tr>
                        <td className="py-3 text-ink/60" colSpan="5">
                          No approved users yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/90 p-6 shadow">
            <div className="text-sm font-semibold text-ink/70">User Details</div>
            {selectedUser ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-ink/50">Name</div>
                  <div className="text-sm font-semibold">{selectedUser.name}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-ink/50">Email</div>
                  <div className="text-sm">{selectedUser.email}</div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-ink/50">
                    Role
                    <select
                      className="mt-2 w-full rounded-xl border border-slatewash px-3 py-2 text-sm"
                      value={roleDraft}
                      onChange={(event) => setRoleDraft(event.target.value)}
                    >
                      <option value="manager">Manager</option>
                      <option value="cashier">Cashier</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                </div>

                {selectedUser.approvalStatus === "approved" && (
                  <div>
                    <label className="text-xs uppercase tracking-[0.2em] text-ink/50">
                      Status
                      <select
                        className="mt-2 w-full rounded-xl border border-slatewash px-3 py-2 text-sm"
                        value={statusDraft}
                        onChange={(event) => setStatusDraft(event.target.value)}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                  </div>
                )}

                {selectedUser.approvalStatus !== "approved" && (
                  <div>
                    <label className="text-xs uppercase tracking-[0.2em] text-ink/50">
                      Rejection Reason
                      <textarea
                        className="mt-2 w-full rounded-xl border border-slatewash px-3 py-2 text-sm"
                        rows="3"
                        placeholder="Reason for rejection"
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                      />
                    </label>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold"
                    onClick={handleRoleUpdate}
                    type="button"
                  >
                    Update Role
                  </button>
                  {selectedUser.approvalStatus === "pending" && (
                    <>
                      <button
                        className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-sand"
                        onClick={() => handleApprove(selectedUser, roleDraft)}
                        type="button"
                      >
                        Approve User
                      </button>
                      <button
                        className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold"
                        onClick={() => handleReject(selectedUser, rejectionReason)}
                        type="button"
                      >
                        Reject User
                      </button>
                    </>
                  )}
                  {selectedUser.approvalStatus === "approved" && (
                    <button
                      className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-sand"
                      onClick={handleStatusUpdate}
                      type="button"
                    >
                      Update Status
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-ink/60">Select a user to view details.</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default UsersPage;
