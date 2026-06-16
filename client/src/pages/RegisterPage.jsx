import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";

const initialForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  role: "rep"
};

const RegisterPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.name || !form.email || !form.password) {
      setError("Name, email, and password are required.");
      return;
    }

    if (form.password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/register", {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: form.role
      });

      localStorage.setItem("pendingEmail", form.email);
      localStorage.setItem(
        "authMessage",
        data.message || "Registration submitted successfully. Please wait for admin approval."
      );
      navigate("/login");
    } catch (err) {
      const message = err.response?.data?.message || "Registration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand dark:bg-slate-950 text-ink">
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-16 -right-20 h-64 w-64 rounded-full bg-clay/20 blur-3xl" />
        <div className="absolute top-40 -left-24 h-72 w-72 rounded-full bg-leaf/25 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 md:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl bg-white/90 dark:bg-slate-800 p-8 shadow-lg">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Create account</h2>
            <p className="text-sm text-ink/60">Set up a new manager or sales representative profile.</p>
          </div>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="text-sm font-semibold text-ink/70">
              Full name
              <input
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
                placeholder="Shalitha Perera"
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
              />
            </label>
            <label className="text-sm font-semibold text-ink/70">
              Email
              <input
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
                placeholder="name@company.com"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
              />
            </label>
            <label className="text-sm font-semibold text-ink/70">
              Phone (optional)
              <input
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
                placeholder="077 123 4567"
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
              />
            </label>
            <label className="text-sm font-semibold text-ink/70">
              Password
              <input
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
                placeholder="Create a password"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
              />
            </label>
            <label className="text-sm font-semibold text-ink/70">
              Confirm password
              <input
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
                placeholder="Repeat password"
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
              />
            </label>
            <label className="text-sm font-semibold text-ink/70">
              Role
              <select
                className="mt-2 w-full rounded-xl border border-slatewash px-4 py-3"
                name="role"
                value={form.role}
                onChange={handleChange}
              >
                <option value="manager">Manager</option>
                <option value="rep">Sales Representative</option>
              </select>
            </label>
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
              {loading ? "Creating..." : "Create account"}
            </button>
            <Link
              className="rounded-xl border border-ink/20 py-3 text-center text-sm font-semibold"
              to="/login"
            >
              Back to sign in
            </Link>
          </form>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="JSP logo" className="h-12 w-12" />
            <div>
              <div className="text-lg font-semibold">JSP Distributors</div>
              <div className="text-sm text-ink/60">Ruhunu Foods POS</div>
            </div>
          </div>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            Set up your POS team and keep daily operations moving.
          </h1>
          <p className="text-ink/70">
            Create accounts for reps and admins, manage access levels, and track
            every sale from the first bill to the daily closing report.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              "Role-based access",
              "Secure credentials",
              "Audit-ready records",
              "Centralized management"
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-white/80 dark:bg-slate-700 p-4 text-sm shadow">
                {item}
              </div>
            ))}
          </div>
          <div className="text-sm text-ink/60">
            Already have access?{" "}
            <Link className="font-semibold text-clay" to="/login">
              Sign in instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default RegisterPage;
