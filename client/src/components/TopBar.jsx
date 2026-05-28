const TopBar = () => (
  <header className="flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur border-b border-slatewash">
    <div>
      <div className="text-lg font-semibold">POS Control Center</div>
      <div className="text-sm text-ink/60">Ruhunu Foods daily operations</div>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-sm">Admin</span>
      <div className="h-9 w-9 rounded-full bg-clay text-white flex items-center justify-center">A</div>
    </div>
  </header>
);

export default TopBar;
