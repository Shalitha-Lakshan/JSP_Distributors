import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

const getStoredUser = () => {
  if (typeof window === "undefined") {
    return { name: "Admin", role: "admin", email: "" };
  }

  const raw = localStorage.getItem("user");
  if (!raw) {
    return { name: "Admin", role: localStorage.getItem("role") || "admin", email: "" };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      name: parsed?.name || "Admin",
      role: parsed?.role || localStorage.getItem("role") || "admin",
      email: parsed?.email || "",
    };
  } catch {
    return { name: "Admin", role: localStorage.getItem("role") || "admin", email: "" };
  }
};

const getInitials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

const formatRoleName = (role) => {
  if (role === "rep") return "Sales Representative";
  if (role === "manager") return "Manager";
  if (role === "admin") return "Admin";
  return role;
};

/* ── Sun icon (light mode indicator) ─────────────────────────────── */
const SunIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <circle cx="12" cy="12" r="5" />
    <path
      strokeLinecap="round"
      d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
    />
  </svg>
);

/* ── Moon icon (dark mode indicator) ─────────────────────────────── */
const MoonIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
    />
  </svg>
);

const TopBar = ({ onToggleSidebar, collapsed }) => {
  const navigate = useNavigate();
  const user = getStoredUser();
  const { darkMode, toggleDarkMode } = useTheme();

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <header className="flex items-center justify-between border-b border-slatewash dark:border-slate-700 bg-white/70 dark:bg-slate-900/80 px-4 py-3 backdrop-blur sticky top-0 z-10">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3">
        {/* hamburger button – mirrors the sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink/60 hover:bg-slatewash hover:text-ink transition dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div>
          <div className="text-base font-semibold leading-tight dark:text-slate-100">POS Control Center</div>
          <div className="text-xs text-ink/50 dark:text-slate-400">JSP Distributors daily operations</div>
        </div>
      </div>

      {/* Right: dark mode toggle + user info + sign out */}
      <div className="flex items-center gap-3">

        {/* ── Dark Mode Toggle ─────────────────────────── */}
        <button
          id="dark-mode-toggle"
          onClick={toggleDarkMode}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          className={`
            relative flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-300
            ${darkMode
              ? "bg-slate-700 border-slate-600 text-amber-300 hover:bg-slate-600 shadow-inner"
              : "bg-amber-50 border-amber-200 text-amber-500 hover:bg-amber-100"
            }
          `}
        >
          <span
            className="transition-transform duration-300"
            style={{ transform: darkMode ? "rotate(0deg)" : "rotate(0deg)" }}
          >
            {darkMode ? <SunIcon /> : <MoonIcon />}
          </span>

          {/* Ripple glow on dark mode active */}
          {darkMode && (
            <span className="absolute inset-0 rounded-full bg-amber-300/10 animate-ping pointer-events-none" />
          )}
        </button>

        <div className="hidden sm:block text-right">
          <div className="text-sm font-semibold dark:text-slate-100">{user.name}</div>
          <div className="text-xs text-ink/60 dark:text-slate-400">{formatRoleName(user.role)}</div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-clay text-white text-sm font-bold shrink-0">
          {getInitials(user.name)}
        </div>
        <button
          className="hidden sm:inline-flex rounded-full border border-ink/20 dark:border-slate-600 px-4 py-1.5 text-xs font-semibold text-ink dark:text-slate-200 hover:bg-slatewash dark:hover:bg-slate-700 transition"
          onClick={handleSignOut}
          type="button"
        >
          Sign out
        </button>
      </div>
    </header>
  );
};

export default TopBar;
