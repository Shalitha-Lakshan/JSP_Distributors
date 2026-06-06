import { NavLink, useNavigate } from "react-router-dom";

const getCurrentRole = () => {
  if (typeof window === "undefined") {
    return "admin";
  }
  return localStorage.getItem("role") || "admin";
};

const getNavItems = (role) => {
  if (role === "manager") {
    return [
      { label: "Manager Dashboard", to: "/dashboard/manager" },
      { label: "POS Billing", to: "/pos" },
      { label: "Products", to: "/products" },
      { label: "Stock Add", to: "/stock/add" },
      { label: "Stock Batches", to: "/stock/batches" },
      { label: "Low Stock", to: "/products?filter=low-stock" },
      { label: "Near Expiry", to: "/stock/batches?filter=near-expiry" },
      { label: "Customers", to: "/customers" },
      { label: "Customer Ledger", to: "/customers?tab=ledger" },
      { label: "Payments", to: "/payments" },
      { label: "Sales History", to: "/sales" },
      { label: "Reports", to: "/reports" },
      { label: "Return Reports", to: "/reports?tab=returns" },
      { label: "Daily Closing", to: "/reports/daily-closing" }
    ];
  }

  if (role === "admin") {
    return [
      { label: "Admin Dashboard", to: "/dashboard/admin" },
      { label: "POS Billing", to: "/pos" },
      { label: "Products", to: "/products" },
      { label: "Stock Add", to: "/stock/add" },
      { label: "Stock Batches", to: "/stock/batches" },
      { label: "Customers", to: "/customers" },
      { label: "Payments", to: "/payments" },
      { label: "Sales History", to: "/sales" },
      { label: "Reports", to: "/reports" },
      { label: "Daily Closing", to: "/reports/daily-closing" },
      { label: "User Approvals", to: "/users" }
    ];
  }

  return [
    { label: "Create Order", to: "/pos" },
    { label: "Sales", to: "/sales" },
    { label: "Receive Payment", to: "/payments" },
    { label: "My Daily Closing", to: "/reports/daily-closing" }
  ];
};

const getStoredUser = () => {
  if (typeof window === "undefined") {
    return { name: "Admin", role: "admin", email: "" };
  }

  const raw = localStorage.getItem("user");
  if (!raw) {
    return { name: "Admin", role: getCurrentRole(), email: "" };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      name: parsed?.name || "Admin",
      role: parsed?.role || getCurrentRole(),
      email: parsed?.email || ""
    };
  } catch {
    return { name: "Admin", role: getCurrentRole(), email: "" };
  }
};

const getInitials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

const Sidebar = () => {
  const navigate = useNavigate();
  const user = getStoredUser();

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <aside className="flex w-64 min-h-screen flex-col bg-ink p-6 text-sand">
      <div className="mb-6 text-xl font-bold">JSP Distributors</div>
      <nav className="flex flex-col gap-2">
        {getNavItems(getCurrentRole()).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 transition ${
                isActive ? "bg-clay text-white" : "hover:bg-slatewash hover:text-ink"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto rounded-2xl bg-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-clay text-white">
            {getInitials(user.name)}
          </div>
          <div>
            <div className="text-sm font-semibold">{user.name}</div>
            <div className="text-xs text-sand/70">{user.role}</div>
          </div>
        </div>
        {user.email && <div className="mt-2 text-xs text-sand/60">{user.email}</div>}
        <button
          className="mt-4 w-full rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-sand hover:bg-white/10"
          onClick={handleSignOut}
          type="button"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
