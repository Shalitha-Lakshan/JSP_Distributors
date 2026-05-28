import { NavLink } from "react-router-dom";

const getCurrentRole = () => {
  if (typeof window === "undefined") {
    return "admin";
  }
  return localStorage.getItem("role") || "admin";
};

const getNavItems = (role) => {
  const dashboardItem =
    role === "manager"
      ? { label: "Manager Dashboard", to: "/dashboard/manager" }
      : role === "admin"
        ? { label: "Admin Dashboard", to: "/dashboard/admin" }
        : { label: "POS Billing", to: "/pos" };

  const items = [dashboardItem];

  if (role !== "cashier") {
    items.push(
      { label: "Products", to: "/products" },
      { label: "Stock Add", to: "/stock/add" },
      { label: "Stock Batches", to: "/stock/batches" },
      { label: "Customers", to: "/customers" },
      { label: "Reports", to: "/reports" }
    );
  }

  items.push(
    { label: "POS Billing", to: "/pos" },
    { label: "Payments", to: "/payments" },
    { label: "Sales History", to: "/sales" }
  );

  if (role === "admin") {
    items.push({ label: "Users", to: "/users" });
  }

  return items;
};

const Sidebar = () => (
  <aside className="w-64 bg-ink text-sand min-h-screen p-6">
    <div className="text-xl font-bold mb-6">JSP Distributors</div>
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
  </aside>
);

export default Sidebar;
