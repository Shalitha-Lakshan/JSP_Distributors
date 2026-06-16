import { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";

const MainLayout = () => {
  // Desktop: collapsed/expanded sidebar
  const [collapsed, setCollapsed] = useState(false);
  // Mobile: off-canvas drawer open/closed
  const [mobileOpen, setMobileOpen] = useState(false);

  // Unified toggle: opens mobile drawer on small screens, collapses on desktop
  const handleToggle = useCallback(() => {
    if (window.innerWidth < 768) {
      setMobileOpen((o) => !o);
    } else {
      setCollapsed((c) => !c);
    }
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="h-screen overflow-hidden flex bg-sand dark:bg-slate-950 relative">

      {/* ── Mobile backdrop — tap to close sidebar ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobile}
      />

      {/* ── Right column: TopBar + scrollable content ── */}
      <div className="flex-1 flex flex-col h-screen min-w-0">

        {/* ── TopBar ── */}
        <TopBar
          onToggle={handleToggle}
          collapsed={collapsed}
        />

        {/* ── Scrollable content area ── */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 dark:bg-slate-950/50">
          <Outlet />
        </main>

      </div>
    </div>
  );
};

export default MainLayout;
