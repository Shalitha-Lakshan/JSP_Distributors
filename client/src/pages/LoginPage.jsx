import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";

const getRedirectPath = (role) => {
  if (role === "cashier") {
    return "/pos";
  }
  if (role === "manager") {
    return "/dashboard/manager";
  }
  return "/dashboard/admin";
};

const LoginPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: localStorage.getItem("pendingEmail") || "",
    password: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.email || !form.password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", {
        email: form.email,
        password: form.password
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.user.role);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.removeItem("pendingEmail");
      navigate(getRedirectPath(data.user.role));
    } catch (err) {
      const message = err.response?.data?.message || "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand text-ink">
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -left-16 h-64 w-64 rounded-full bg-clay/20 blur-3xl" />
        <div className="absolute top-32 -right-20 h-72 w-72 rounded-full bg-leaf/25 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="JSP logo" className="h-12 w-12" />
            <div>
              <div className="text-lg font-semibold">JSP Distributors</div>
              <div className="text-sm text-ink/60">Ruhunu Foods POS</div>
            </div>
          </div>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            Sign in to manage daily sales, stock, and customer credit.
          </h1>
          <p className="text-ink/70">
            Fast POS billing, FIFO batch stock, and clean daily closing reports in one system.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              "Smart item search",
              "Barcode stock intake",
              "Credit sales & ledger",
              "Daily closing summaries"
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-white/80 p-4 text-sm shadow">
                {item}
              </div>
            ))}
          </div>
          <div className="text-sm text-ink/60">
            Need an account?{" "}
            <Link className="font-semibold text-clay" to="/register">
              Create one
            </Link>
          </div>
        </div>

        <div className="rounded-3xl bg-white/90 p-8 shadow-lg">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Welcome back</h2>
            <p className="text-sm text-ink/60">Use your admin, manager, or cashier credentials.</p>
          </div>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="text-sm font-semibold text-ink/70">
              Email
              <input
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
                placeholder="admin@jsp.com"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
              />
            </label>
            <label className="text-sm font-semibold text-ink/70">
              Password
              <input
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
                placeholder="••••••••"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
              />
            </label>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-ink/60">
                <input type="checkbox" className="h-4 w-4" />
                Remember me
              </label>
              <button className="text-sm font-semibold text-clay" type="button">
                Forgot password?
              </button>
            </div>
            {error && (
              <div className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
                {error}
              </div>
            )}
            <button
              className="rounded-xl bg-ink py-3 text-sm font-semibold text-sand disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
            <Link
              className="rounded-xl border border-ink/20 py-3 text-center text-sm font-semibold"
              to="/"
            >
              Back to home
            </Link>
          </form>
        </div>
      </div>
    </div>
  </div>
  );
};

export default LoginPage;
