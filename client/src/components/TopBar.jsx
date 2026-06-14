import { useNavigate } from "react-router-dom";

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

const TopBar = ({ onToggleSidebar, collapsed }) => {
  const navigate = useNavigate();
  const user = getStoredUser();

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <header className="flex items-center justify-between border-b border-slatewash bg-white/70 px-4 py-3 backdrop-blur sticky top-0 z-10">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3">
        {/* hamburger button – mirrors the sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink/60 hover:bg-slatewash hover:text-ink transition"
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
          <div className="text-base font-semibold leading-tight">POS Control Center</div>
          <div className="text-xs text-ink/50">JSP Distributors daily operations</div>
        </div>
      </div>

      {/* Right: user info + sign out */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <div className="text-sm font-semibold">{user.name}</div>
          <div className="text-xs text-ink/60">{formatRoleName(user.role)}</div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-clay text-white text-sm font-bold shrink-0">
          {getInitials(user.name)}
        </div>
        <button
          className="hidden sm:inline-flex rounded-full border border-ink/20 px-4 py-1.5 text-xs font-semibold text-ink hover:bg-slatewash transition"
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
