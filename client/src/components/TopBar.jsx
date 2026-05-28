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
      email: parsed?.email || ""
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

const TopBar = () => {
  const navigate = useNavigate();
  const user = getStoredUser();

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <header className="flex items-center justify-between border-b border-slatewash bg-white/70 px-6 py-4 backdrop-blur">
      <div>
        <div className="text-lg font-semibold">POS Control Center</div>
        <div className="text-sm text-ink/60">Ruhunu Foods daily operations</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-semibold">{user.name}</div>
          <div className="text-xs text-ink/60">{user.role}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-clay text-white">
          {getInitials(user.name)}
        </div>
        <button
          className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold text-ink hover:bg-slatewash"
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
