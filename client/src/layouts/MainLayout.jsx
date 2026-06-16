import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    /* ── Outer shell: locked to viewport, no page-level scroll ── */
    <div className="h-screen overflow-hidden flex bg-sand dark:bg-slate-950">

      {/* ── Sidebar: full height, never scrolls away ── */}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      {/* ── Right column: also full height, flex column ── */}
      <div className="flex-1 flex flex-col h-screen min-w-0">

        {/* ── TopBar: fixed at top of right column, never scrolls away ── */}
        <TopBar onToggleSidebar={() => setCollapsed((c) => !c)} collapsed={collapsed} />

        {/* ── Scrollable content area: only this region scrolls ── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 dark:bg-slate-950/50">
          <Outlet />
        </main>

      </div>
    </div>
  );
};

export default MainLayout;
