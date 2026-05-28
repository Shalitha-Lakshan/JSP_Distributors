import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../api/client";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const location = useLocation();
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    const verify = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setState({ status: "unauthorized", message: "Please sign in to continue." });
        return;
      }

      try {
        const { data } = await api.get("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` }
        });

        const role = data?.user?.role || localStorage.getItem("role");
        if (allowedRoles && !allowedRoles.includes(role)) {
          setState({ status: "forbidden", message: "You do not have access to this page." });
          return;
        }

        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("role", data.user.role);
        setState({ status: "ready" });
      } catch (err) {
        const message = err.response?.data?.message || "Please sign in to continue.";
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        setState({ status: "unauthorized", message });
      }
    };

    verify();
  }, [allowedRoles]);

  if (state.status === "loading") {
    return (
      <div className="min-h-screen bg-sand text-ink flex items-center justify-center">
        <div className="rounded-2xl bg-white/90 px-6 py-4 shadow text-sm text-ink/70">
          Checking access...
        </div>
      </div>
    );
  }

  if (state.status !== "ready") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, message: state.message }}
      />
    );
  }

  return children;
};

export default ProtectedRoute;
