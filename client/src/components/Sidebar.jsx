import { NavLink, useNavigate } from "react-router-dom";

/* ─── Icons (inline SVG so no extra dependency) ─────────────────────── */
const Icons = {
  dashboard: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  pos: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  ),
  products: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  stock: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  customers: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  payments: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  sales: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  reports: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  closing: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  users: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  ledger: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  batches: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
    </svg>
  ),
  warning: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  order: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  trips: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
  returns: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" d="M16 15v-6a4 4 0 00-4-4H4m0 0l4-4m-4 4l4 4m-4 4h8a4 4 0 014 4v2" />
    </svg>
  ),
};

/* ─── Map route → icon key ──────────────────────────────────────────── */
const iconFor = (to) => {
  if (to.includes("dashboard/admin"))   return Icons.dashboard;
  if (to.includes("dashboard/manager")) return Icons.dashboard;
  if (to === "/pos")                    return Icons.pos;
  if (to.includes("stock/add"))         return Icons.stock;
  if (to.includes("stock/batches") && to.includes("near-expiry")) return Icons.warning;
  if (to.includes("stock/batches"))     return Icons.batches;
  if (to.includes("ledger"))            return Icons.ledger;
  if (to.includes("customers"))         return Icons.customers;
  if (to.includes("payments"))          return Icons.payments;
  if (to.includes("sales"))             return Icons.sales;
  if (to.includes("trips"))             return Icons.trips;
  if (to.includes("daily-closing"))     return Icons.closing;
  if (to.includes("returns"))           return Icons.returns;
  if (to.includes("reports"))           return Icons.reports;
  if (to.includes("users"))             return Icons.users;
  if (to.includes("products") && to.includes("low-stock")) return Icons.warning;
  if (to.includes("products"))          return Icons.products;
  return Icons.order;
};

/* ─── Nav data ──────────────────────────────────────────────────────── */
const getCurrentRole = () => {
  if (typeof window === "undefined") return "admin";
  return localStorage.getItem("role") || "admin";
};

const getNavItems = (role) => {
  if (role === "manager") {
    return [
      {
        section: "Main Operations",
        items: [
          { label: "Manager Dashboard",  to: "/dashboard/manager" },
          { label: "Trip Sessions",      to: "/trips" },
        ]
      },
      {
        section: "Inventory Control",
        items: [
          { label: "Products",           to: "/products" },
          { label: "Stock Add",          to: "/stock/add" },
          { label: "Stock Batches",      to: "/stock/batches" },
        ]
      },
      {
        section: "Finance & Sales",
        items: [
          { label: "Customers",          to: "/customers" },
          { label: "Payments",           to: "/payments" },
          { label: "Sales History",      to: "/sales" },
        ]
      },
      {
        section: "Analytics & Closing",
        items: [
          { label: "Reports",            to: "/reports" },
          { label: "Returns",            to: "/returns" },
          { label: "Daily Closing",      to: "/reports/daily-closing" },
        ]
      }
    ];
  }

  if (role === "admin") {
    return [
      {
        section: "Main Operations",
        items: [
          { label: "Admin Dashboard",    to: "/dashboard/admin" },
          { label: "Trip Sessions",      to: "/trips" },
          { label: "User Approvals",     to: "/users" },
        ]
      },
      {
        section: "Inventory Control",
        items: [
          { label: "Products",           to: "/products" },
          { label: "Stock Add",          to: "/stock/add" },
          { label: "Stock Batches",      to: "/stock/batches" },
        ]
      },
      {
        section: "Finance & Sales",
        items: [
          { label: "Customers",          to: "/customers" },
          { label: "Payments",           to: "/payments" },
          { label: "Sales History",      to: "/sales" },
        ]
      },
      {
        section: "Analytics & Closing",
        items: [
          { label: "Reports",            to: "/reports" },
          { label: "Returns",            to: "/returns" },
          { label: "Daily Closing",      to: "/reports/daily-closing" },
        ]
      }
    ];
  }

  return [
    {
      section: "Sales Representative",
      items: [
        { label: "Create Order",         to: "/pos" },
        { label: "Sales",                to: "/sales" },
        { label: "Receive Payment",      to: "/payments" },
        { label: "My Daily Closing",     to: "/reports/daily-closing" },
        { label: "Trip Sessions",        to: "/trips" },
      ]
    }
  ];
};

/* ─── User helpers ──────────────────────────────────────────────────── */
const getStoredUser = () => {
  if (typeof window === "undefined") return { name: "Admin", role: "admin", email: "" };
  const raw = localStorage.getItem("user");
  if (!raw) return { name: "Admin", role: getCurrentRole(), email: "" };
  try {
    const p = JSON.parse(raw);
    return { name: p?.name || "Admin", role: p?.role || getCurrentRole(), email: p?.email || "" };
  } catch {
    return { name: "Admin", role: getCurrentRole(), email: "" };
  }
};

const getInitials = (name) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

const formatRoleName = (role) => {
  if (role === "rep") return "Sales Representative";
  if (role === "manager") return "Manager";
  if (role === "admin") return "Admin";
  return role;
};

/* ─── Component ─────────────────────────────────────────────────────── */
const Sidebar = ({ collapsed, onToggle }) => {
  const navigate = useNavigate();
  const user = getStoredUser();

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <aside
      className={`
        relative flex flex-col min-h-screen bg-ink text-sand
        transition-all duration-300 ease-in-out shrink-0
        ${collapsed ? "w-[68px]" : "w-64"}
      `}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className={`flex items-center border-b border-white/10 px-4 py-5 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <span className="text-base font-bold tracking-tight whitespace-nowrap overflow-hidden">
            JSP Distributors
          </span>
        )}
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center justify-center rounded-lg p-1.5 text-sand/60 hover:bg-white/10 hover:text-sand transition"
        >
          {/* hamburger / arrow icon */}
          {collapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Nav items ──────────────────────────────────────────── */}
      <nav className="flex flex-col gap-4 px-2 py-4 flex-1 overflow-y-auto overflow-x-hidden">
        {getNavItems(getCurrentRole()).map((group, idx) => (
          <div key={idx} className="space-y-1">
            {!collapsed && (
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-sand/40 mb-1">
                {group.section}
              </div>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition
                  ${isActive
                    ? "bg-clay text-white"
                    : "text-sand/80 hover:bg-white/10 hover:text-sand"
                  }`
                }
              >
                {/* icon */}
                <span className="shrink-0">{iconFor(item.to)}</span>

                {/* label – fades out when collapsed */}
                {!collapsed && (
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.label}
                  </span>
                )}

                {/* tooltip when collapsed */}
                {collapsed && (
                  <span className="
                    pointer-events-none absolute left-full ml-3 z-50
                    rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white
                    opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap
                    shadow-xl
                  ">
                    {item.label}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* ── User card ──────────────────────────────────────────── */}
      <div className={`border-t border-white/10 p-3 ${collapsed ? "flex justify-center" : ""}`}>
        {collapsed ? (
          /* collapsed → just avatar + tooltip */
          <div className="group relative flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-clay text-white text-sm font-bold cursor-default">
              {getInitials(user.name)}
            </div>
            <span className="
              pointer-events-none absolute left-full ml-3 bottom-0 z-50
              rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white
              opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl
            ">
              {user.name} · {formatRoleName(user.role)}
            </span>
          </div>
        ) : (
          /* expanded → full card */
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clay text-white text-sm font-bold">
                {getInitials(user.name)}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{user.name}</div>
                <div className="text-xs text-sand/70 truncate">{formatRoleName(user.role)}</div>
              </div>
            </div>
            {user.email && (
              <div className="mt-2 text-xs text-sand/60 truncate">{user.email}</div>
            )}
            <button
              className="mt-4 w-full rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-sand hover:bg-white/10 transition"
              onClick={handleSignOut}
              type="button"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
