import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

/* ─── Mock Data for Interactive POS Simulator ─────────────────────── */
const demoProducts = [
  { code: "CP50", name: "Chili Powder 50g", price: 120, category: "Spices" },
  { code: "KS5K", name: "Keeri Samba 5kg", price: 1450, category: "Rice" },
  { code: "MD1K", name: "Masoor Dhal 1kg", price: 380, category: "Lentils" },
  { code: "KF400", name: "Kist Nectar 400ml", price: 290, category: "Beverages" },
  { code: "WPP1", name: "White Pepper 100g", price: 450, category: "Spices" },
  { code: "ND500", name: "Noodles 500g", price: 220, category: "Packaged" },
  { code: "SB100", name: "Soya Meat 100g", price: 90, category: "Packaged" }
];

const highlights = [
  {
    title: "Fast POS Billing",
    description: "Search by item code, size, or keyword and bill in seconds with FIFO accuracy.",
    icon: (
      <svg className="h-6 w-6 text-clay" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
      </svg>
    ),
    color: "orange"
  },
  {
    title: "Smart Stock Batches",
    description: "Track batch prices, expiry dates, and stock inflow with barcode-assisted entries.",
    icon: (
      <svg className="h-6 w-6 text-leaf" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    color: "teal"
  },
  {
    title: "Customer Credit Ledger",
    description: "Handle credit sales, old bill payments, and clean customer ledgers automatically.",
    icon: (
      <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    color: "blue"
  }
];

const steps = [
  {
    title: "Receive Stock",
    description: "Scan barcode, enter buying price, and create FIFO batches in seconds."
  },
  {
    title: "Sell & Collect",
    description: "Use smart search, add to cart, accept payments or log under credit."
  },
  {
    title: "Close the Day",
    description: "Review cash vs outstanding balances and print daily summary reports."
  }
];

const HomePage = () => {
  const { darkMode, toggleDarkMode } = useTheme();

  /* ─── State for Interactive POS Simulator ─── */
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [cashGiven, setCashGiven] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);

  /* Filter items for simulator */
  const filteredProducts = useMemo(() => {
    return demoProducts.filter((product) => {
      const matchSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === "All" || product.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [searchQuery, selectedCategory]);

  /* Simulator actions */
  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.code === product.code);
      if (existing) {
        return prev.map((item) =>
          item.code === product.code ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (code, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.code === code) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (code) => {
    setCart((prev) => prev.filter((item) => item.code !== code));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const changeDue = useMemo(() => {
    const cash = parseFloat(cashGiven);
    if (isNaN(cash) || cash < cartTotal) return 0;
    return cash - cartTotal;
  }, [cashGiven, cartTotal]);

  const clearCart = () => {
    setCart([]);
    setCashGiven("");
    setShowReceipt(false);
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setShowReceipt(true);
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-sand dark:bg-slate-950 text-ink flex flex-col font-display">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-clay/20 blur-3xl float-slow" />
        <div className="absolute top-48 -right-20 h-96 w-96 rounded-full bg-leaf/20 blur-3xl float-medium" />
        <div className="absolute bottom-10 left-1/4 h-80 w-80 rounded-full bg-blue-500/10 blur-2xl float-fast" />
      </div>

      {/* ─── Navigation Header ────────────────────────────────────────── */}
      <header className="relative z-20 border-b border-ink/5 dark:border-white/5 bg-white/40 dark:bg-slate-900/30 backdrop-blur-md px-4 py-4 sm:px-6 md:px-12 sticky top-0">
        <nav className="mx-auto flex max-w-[1440px] items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="JSP logo" className="h-9 w-9 object-contain" />
            <div className="text-xl font-bold tracking-tight bg-gradient-to-r from-ink to-leaf bg-clip-text text-transparent dark:from-white dark:to-teal-400">
              JSP Distributors
            </div>
          </div>
          
          {/* Navigation Links - Desktop */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium hover:text-clay transition">Features</a>
            <a href="#workflow" className="text-sm font-medium hover:text-clay transition">Workflows</a>
            <a href="#demo" className="text-sm font-medium hover:text-clay transition">POS Demo</a>
            <a href="#insights" className="text-sm font-medium hover:text-clay transition">Analytics</a>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-full border transition-all duration-300 ${
                darkMode
                  ? "bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700"
                  : "bg-amber-50 border-amber-200 text-amber-500 hover:bg-amber-100"
              }`}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="5" />
                  <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>

            <Link
              className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-sand hover:bg-clay dark:bg-white dark:text-ink dark:hover:bg-teal-400 dark:hover:text-ink shadow hover:-translate-y-0.5 transition"
              to="/login"
            >
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      {/* ─── Hero Section ─────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1">
        <section className="mx-auto grid max-w-[1440px] gap-12 px-4 pb-16 pt-10 sm:px-6 md:grid-cols-[1.2fr_0.8fr] md:px-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/90 dark:bg-slate-900 border border-ink/5 dark:border-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-clay animate-pulse" />
              Ruhunu Foods POS Suite
            </div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl lg:text-6xl text-ink dark:text-white">
              Run the full business cycle from <span className="bg-gradient-to-r from-clay to-amber-500 bg-clip-text text-transparent">billing</span> to <span className="bg-gradient-to-r from-leaf to-emerald-400 bg-clip-text text-transparent">batch stock</span>.
            </h1>
            <p className="text-base text-ink/70 dark:text-slate-300 sm:text-lg max-w-xl">
              Built for small distributors who need fast search, clean invoices, FIFO stock,
              and reliable daily closing reports in one place.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                className="rounded-full bg-clay hover:bg-orange-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg hover:shadow-orange-500/20 hover:-translate-y-0.5 transition duration-300"
                to="/login"
              >
                Start POS Login
              </Link>
              <a
                className="rounded-full border border-ink/20 dark:border-white/20 hover:bg-white/40 dark:hover:bg-slate-900 px-8 py-3.5 text-sm font-semibold text-ink dark:text-white hover:-translate-y-0.5 transition duration-300"
                href="#demo"
              >
                Try Interactive Demo
              </a>
            </div>

            {/* Quick Tech Highlights */}
            <div className="grid gap-4 grid-cols-3 pt-6 border-t border-ink/5 dark:border-white/5">
              {[
                { label: "Smart Search", value: "Item code + keywords" },
                { label: "FIFO Stock", value: "Batch price tracking" },
                { label: "Credit Control", value: "Old bill collections" }
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-ink/5 dark:border-white/5 p-4 hover:shadow-md transition">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink/40 dark:text-slate-400">
                    {stat.label}
                  </div>
                  <div className="mt-1.5 text-xs sm:text-sm font-bold text-ink dark:text-white">{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero Right: Live Analytics Mockup Card */}
          <div className="rounded-3xl bg-white/80 dark:bg-slate-900 border border-ink/5 dark:border-white/10 p-6 shadow-xl relative overflow-hidden group hover:shadow-2xl transition duration-300">
            {/* Soft decorative background shape */}
            <div className="absolute top-0 right-0 h-32 w-32 bg-leaf/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center justify-between border-b border-ink/5 dark:border-white/5 pb-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-ink/40 dark:text-slate-400">Today Summary</div>
                <div className="text-lg font-bold mt-0.5 text-ink dark:text-white">Active Session Details</div>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Sync
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {[
                { label: "Sales Today", value: "Rs. 124,500", trend: "+12.4% vs yesterday", isPositive: true },
                { label: "Cash Collected", value: "Rs. 98,200", trend: "78.8% of sales", isPositive: true },
                { label: "Outstanding Credit", value: "Rs. 42,300", trend: "Requires followup", isPositive: false }
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between bg-sand/40 dark:bg-slate-800/40 p-3 rounded-2xl border border-ink/5 dark:border-white/5 hover:-translate-y-0.5 transition duration-300">
                  <div className="min-w-0">
                    <span className="text-xs text-ink/50 dark:text-slate-400 block font-medium">{row.label}</span>
                    <span className="text-[10px] text-ink/40 dark:text-slate-500 truncate block mt-0.5">{row.trend}</span>
                  </div>
                  <span className="text-base font-bold text-ink dark:text-white">{row.value}</span>
                </div>
              ))}

              {/* Animated Mini SVG Graph */}
              <div className="pt-2">
                <div className="text-[10px] uppercase font-bold text-ink/40 dark:text-slate-400 mb-2">Hourly Revenue Trend</div>
                <div className="p-3 bg-sand/30 dark:bg-slate-950/40 rounded-2xl border border-ink/5 dark:border-white/5">
                  <svg viewBox="0 0 300 80" className="w-full h-16 stroke-current text-leaf dark:text-teal-400 fill-none">
                    <path d="M 0 65 Q 40 40 80 55 T 160 20 T 240 45 T 300 10" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M 0 65 Q 40 40 80 55 T 160 20 T 240 45 T 300 10 L 300 80 L 0 80 Z" fill="url(#chart-glow)" opacity="0.08" />
                    <defs>
                      <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="currentColor"/>
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              
              <div className="rounded-2xl bg-ink p-4 text-sand shadow-inner relative overflow-hidden">
                <div className="absolute right-0 bottom-0 h-16 w-16 bg-white/5 rounded-full translate-x-4 translate-y-4" />
                <div className="text-[10px] uppercase tracking-wider text-sand/60 font-bold">
                  Live Expiry Alerts
                </div>
                <div className="mt-1 text-sm font-semibold flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-clay animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  3 batches near reorder level
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Highlights / Features Section ───────────────────────────── */}
        <section id="features" className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 md:px-12 border-t border-ink/5 dark:border-white/5">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-3xl font-extrabold text-ink dark:text-white">Why JSP Distributors POS?</h2>
            <p className="mt-3 text-sm sm:text-base text-ink/60 dark:text-slate-400">
              A comprehensive system designed explicitly for distribution workflows, avoiding generic retail POS limitations.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {highlights.map((card) => (
              <div
                key={card.title}
                className="rounded-3xl bg-white/90 dark:bg-slate-900 border border-ink/5 dark:border-white/5 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className={`p-3.5 rounded-2xl w-fit ${
                    card.color === "orange" ? "bg-orange-500/10" : card.color === "teal" ? "bg-teal-500/10" : "bg-blue-500/10"
                  }`}>
                    {card.icon}
                  </div>
                  <h3 className="text-xl font-bold mt-5 text-ink dark:text-white">{card.title}</h3>
                  <p className="mt-3 text-sm text-ink/70 dark:text-slate-400 leading-relaxed">{card.description}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-ink/5 dark:border-white/5">
                  <Link to="/login" className="text-xs font-bold text-clay hover:text-orange-600 flex items-center gap-1.5 w-fit group">
                    Explore Feature 
                    <span className="group-hover:translate-x-1 duration-200">→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Workflow Process Section ────────────────────────────────── */}
        <section id="workflow" className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 md:px-12">
          <div className="rounded-3xl bg-ink px-6 py-12 text-sand md:px-10 shadow-xl relative overflow-hidden">
            {/* Glowing pattern details */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,#f973161a,transparent_40%)] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_80%,#0f766e20,transparent_40%)] pointer-events-none" />

            <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] items-center relative z-10">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
                  Designed for Ruhunu Foods workflows.
                </h2>
                <p className="mt-4 text-sm sm:text-base text-sand/70 leading-relaxed">
                  Keep item variants organized with smart search keywords. Allocate FIFO stock batches
                  automatically when billing. Print clean, lightweight receipts on-the-go without database bloat.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">✓ High-performance queries</span>
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">✓ Mobile optimized layout</span>
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">✓ Zero local state lag</span>
                </div>
              </div>
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step.title} className="rounded-2xl bg-white/5 border border-white/10 p-4 hover:bg-white/10 transition duration-300">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-clay text-xs font-bold text-white">
                        {index + 1}
                      </div>
                      <div className="text-lg font-bold text-white">{step.title}</div>
                    </div>
                    <div className="text-sm text-sand/65 mt-2 ml-10">{step.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── INTERACTIVE DEMO: POS SIMULATOR ──────────────────────────── */}
        <section id="demo" className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 md:px-12 border-t border-ink/5 dark:border-white/5">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="rounded-full bg-clay/10 px-3 py-1 text-xs font-bold text-clay">Interactive Playground</span>
            <h2 className="text-3xl font-extrabold text-ink dark:text-white mt-3">Try the POS Simulator</h2>
            <p className="mt-3 text-sm sm:text-base text-ink/60 dark:text-slate-400">
              Experience the fast-search billing directly below. Click products to add them to the mock cart, enter payment, and generate a receipt.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] bg-white/60 dark:bg-slate-900 border border-ink/5 dark:border-white/5 rounded-3xl p-4 sm:p-6 shadow-lg">
            
            {/* Simulator Left: Product Search and Catalog */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search input */}
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by code or name... (e.g. KS5K, Chili)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-ink/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-clay/40 bg-white/50 dark:bg-slate-950"
                  />
                </div>

                {/* Category Selector */}
                <div className="flex flex-wrap gap-1.5">
                  {["All", "Spices", "Rice", "Packaged", "Beverages"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                        selectedCategory === cat
                          ? "bg-clay text-white"
                          : "bg-sand hover:bg-ink/5 text-ink/70 dark:bg-slate-850 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Grid */}
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((p) => (
                    <div
                      key={p.code}
                      onClick={() => addToCart(p)}
                      className="group cursor-pointer rounded-2xl bg-sand/30 dark:bg-slate-950/50 border border-ink/5 dark:border-white/5 p-4 hover:border-clay/50 dark:hover:border-teal-400 hover:bg-white dark:hover:bg-slate-950 transition duration-200 flex justify-between items-center"
                    >
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-ink/40 dark:text-slate-400 uppercase tracking-wider block">{p.code} · {p.category}</span>
                        <span className="text-sm font-bold text-ink dark:text-white block mt-0.5 group-hover:text-clay dark:group-hover:text-teal-400 transition">{p.name}</span>
                        <span className="text-xs text-ink/50 dark:text-slate-400 block mt-1">Rs. {p.price.toLocaleString()}</span>
                      </div>
                      <button className="h-8 w-8 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-ink/5 dark:border-white/5 flex items-center justify-center text-ink hover:bg-clay hover:text-white dark:text-white dark:hover:bg-teal-400 dark:hover:text-ink transition shrink-0">
                        +
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-8 text-center text-sm text-ink/40 dark:text-slate-500">
                    No products found matching your search
                  </div>
                )}
              </div>
            </div>

            {/* Simulator Right: Cart Panel */}
            <div className="border-t lg:border-t-0 lg:border-l border-ink/5 dark:border-white/5 pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-between min-h-[350px]">
              <div>
                <div className="flex items-center justify-between border-b border-ink/5 dark:border-white/5 pb-3">
                  <span className="text-sm font-bold flex items-center gap-1.5">
                    <svg className="h-4 w-4 text-clay" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    Billing Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
                  </span>
                  {cart.length > 0 && (
                    <button onClick={clearCart} className="text-xs font-semibold text-red-500 hover:underline">
                      Clear Cart
                    </button>
                  )}
                </div>

                {/* Cart Items List */}
                <div className="mt-3 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {cart.length > 0 ? (
                    cart.map((item) => (
                      <div key={item.code} className="flex items-center justify-between text-xs bg-sand/20 dark:bg-slate-950/20 p-2.5 rounded-xl border border-ink/5 dark:border-white/5">
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-ink dark:text-white truncate">{item.name}</div>
                          <div className="text-ink/40 dark:text-slate-500 mt-0.5">Rs. {item.price} each</div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="flex items-center border border-ink/10 dark:border-white/10 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                            <button onClick={() => updateQuantity(item.code, -1)} className="px-2 py-0.5 text-xs hover:bg-ink/5 dark:hover:bg-slate-800 transition">-</button>
                            <span className="px-2 font-bold">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.code, 1)} className="px-2 py-0.5 text-xs hover:bg-ink/5 dark:hover:bg-slate-800 transition">+</button>
                          </div>
                          <span className="font-bold w-16 text-right">Rs. {(item.price * item.quantity).toLocaleString()}</span>
                          <button onClick={() => removeFromCart(item.code)} className="text-red-500 hover:text-red-600 transition pl-1">
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-xs text-ink/40 dark:text-slate-500">
                      Cart is empty. Select products on the left to start billing.
                    </div>
                  )}
                </div>
              </div>

              {/* Checkout Calculation and Form */}
              {cart.length > 0 && (
                <div className="mt-4 pt-3 border-t border-ink/5 dark:border-white/5 space-y-3">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span>Total Amount:</span>
                    <span className="text-base text-clay dark:text-teal-400">Rs. {cartTotal.toLocaleString()}</span>
                  </div>

                  <div className="grid gap-2 grid-cols-2 items-center">
                    <label className="text-xs font-semibold text-ink/60 dark:text-slate-400">Cash Received:</label>
                    <input
                      type="number"
                      placeholder="e.g. 5000"
                      value={cashGiven}
                      onChange={(e) => setCashGiven(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-ink/10 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-clay/40 text-right bg-white dark:bg-slate-950"
                    />
                  </div>

                  {parseFloat(cashGiven) >= cartTotal && (
                    <div className="flex justify-between items-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/5 p-2 rounded-lg">
                      <span>Change Due:</span>
                      <span>Rs. {changeDue.toLocaleString()}</span>
                    </div>
                  )}

                  <button
                    onClick={handleCheckout}
                    className="w-full py-2.5 bg-leaf hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow transition duration-200"
                  >
                    Simulate Payment & Print Invoice
                  </button>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* ─── Mock Receipt Modal (Receipt Simulator) ─────────────────── */}
        {showReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white text-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={() => setShowReceipt(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                aria-label="Close modal"
              >
                ✕
              </button>
              
              <div className="text-center font-mono text-xs">
                <div className="text-sm font-bold uppercase tracking-wider">JSP Distributors</div>
                <div>No. 12, Galle Road, Matara</div>
                <div>Tel: 041-2223344</div>
                <div className="border-b border-dashed border-slate-300 my-2" />
                <div className="flex justify-between text-left">
                  <span>Date: {new Date().toLocaleDateString()}</span>
                  <span>Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="text-left">Cashier: Mock Session</div>
                <div className="border-b border-dashed border-slate-300 my-2" />
                
                {/* Receipt Items */}
                <div className="space-y-1.5 text-left">
                  {cart.map((item) => (
                    <div key={item.code} className="flex justify-between">
                      <div>
                        <div>{item.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {item.quantity} x Rs. {item.price.toFixed(2)}
                        </div>
                      </div>
                      <span className="font-semibold">
                        Rs. {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                
                <div className="border-b border-dashed border-slate-300 my-2" />
                <div className="flex justify-between font-bold text-sm">
                  <span>TOTAL DUE</span>
                  <span>Rs. {cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mt-1 text-slate-700">
                  <span>Cash Paid</span>
                  <span>Rs. {parseFloat(cashGiven) ? parseFloat(cashGiven).toFixed(2) : cartTotal.toFixed(2)}</span>
                </div>
                {parseFloat(cashGiven) > cartTotal && (
                  <div className="flex justify-between text-slate-700">
                    <span>Balance Change</span>
                    <span>Rs. {changeDue.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="border-b border-dashed border-slate-300 my-2" />
                <div className="mt-4 flex flex-col items-center">
                  {/* Mock Barcode */}
                  <div className="bg-slate-900 h-8 w-48 flex items-center justify-between px-1 opacity-80 mb-1">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <span
                        key={i}
                        className="bg-white h-full"
                        style={{ width: `${(i % 3 === 0 ? 3 : i % 2 === 0 ? 1 : 2)}px` }}
                      />
                    ))}
                  </div>
                  <div className="text-[9px] tracking-widest text-slate-500">TX-SIM-984812</div>
                </div>
                
                <div className="mt-3 text-slate-500">Thank you! Come again.</div>
              </div>
              
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => {
                    alert("Mock invoice print requested!");
                    setShowReceipt(false);
                    clearCart();
                  }}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
                >
                  Print Receipt
                </button>
                <button
                  onClick={() => {
                    setShowReceipt(false);
                    clearCart();
                  }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Close & Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Extra Value Proposition: Advanced Product Lookup ───────── */}
        <section id="insights" className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 md:px-12 border-t border-ink/5 dark:border-white/5">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-3xl bg-white/80 dark:bg-slate-900 border border-ink/5 dark:border-white/5 p-6 sm:p-8 shadow-md flex flex-col justify-between">
              <div>
                <span className="rounded-full bg-teal-500/10 px-3 py-1 text-xs font-bold text-leaf dark:text-teal-400">Intelligent Search</span>
                <h3 className="text-2xl font-bold mt-4 text-ink dark:text-white">Sinhala & English Product Lookup</h3>
                <p className="mt-3 text-sm text-ink/70 dark:text-slate-400 leading-relaxed">
                  Search by item code, product name, variants, categories, or keywords in both English and phonetic Sinhala. Speed buttons let sales representatives tap fast-moving items instantly during billing rushes.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {["CP50 (Chili)", "KS5K (Samba)", "Miris 50", "Dhal 1K"].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-sand dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-ink/80 dark:text-slate-300 border border-ink/5 dark:border-white/5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-8 border-t border-ink/5 dark:border-white/5 pt-4">
                <Link to="/pos" className="text-xs font-bold text-leaf dark:text-teal-400 hover:underline">
                  Launch interactive POS panel →
                </Link>
              </div>
            </div>

            <div className="rounded-3xl bg-white/80 dark:bg-slate-900 border border-ink/5 dark:border-white/5 p-6 sm:p-8 shadow-md flex flex-col justify-between">
              <div>
                <span className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold text-clay">Reliable Closing</span>
                <h3 className="text-2xl font-bold mt-4 text-ink dark:text-white">Clean Cashier Daily closing</h3>
                <p className="mt-3 text-sm text-ink/70 dark:text-slate-400 leading-relaxed">
                  Separate cash drawer collections from credit billing notes. View opening balances, credit collections, invoice sales totals, and outstanding amounts in a single, simple report.
                </p>
                <div className="mt-5 space-y-2 bg-sand/30 dark:bg-slate-950/40 p-4 rounded-2xl border border-ink/5 dark:border-white/5">
                  {[
                    { label: "Gross Sales Today", value: "Rs. 68,000" },
                    { label: "Cash Collected", value: "Rs. 82,000" },
                    { label: "Closing Outstanding", value: "Rs. 31,500" }
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-ink/60 dark:text-slate-400 font-medium">{row.label}</span>
                      <span className="font-bold text-ink dark:text-white">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 border-t border-ink/5 dark:border-white/5 pt-4">
                <Link to="/login" className="text-xs font-bold text-clay hover:underline">
                  Sign in to view daily closing reports →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Ready To Go Live Call To Action ────────────────────────── */}
        <section className="mx-auto max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 md:px-12">
          <div className="rounded-3xl bg-gradient-to-r from-clay to-amber-500 px-6 py-12 text-white shadow-xl relative overflow-hidden text-center md:text-left">
            <div className="absolute right-0 bottom-0 h-48 w-48 bg-white/5 rounded-full translate-x-12 translate-y-12" />
            <div className="absolute left-1/3 top-0 h-24 w-24 bg-white/5 rounded-full -translate-y-8" />
            
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between relative z-10">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl text-white">Ready to streamline billing?</h2>
                <p className="mt-2 text-white/85 text-sm sm:text-base max-w-lg">
                  Access the JSP Distributors POS system and manage inventory, invoices, and payments in real-time.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 shrink-0">
                <Link
                  className="rounded-full bg-white px-8 py-3.5 text-sm font-bold text-ink hover:bg-slate-100 hover:shadow-lg transition duration-200"
                  to="/login"
                >
                  Sign in now
                </Link>
                <Link
                  className="rounded-full border border-white/60 px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition duration-200"
                  to="/pos"
                >
                  POS Checkout View
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ───────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-ink/5 dark:border-white/5 bg-white/20 dark:bg-slate-900/10 backdrop-blur-md px-4 py-8 text-xs sm:text-sm text-ink/50 dark:text-slate-500 mt-auto">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 md:flex-row md:items-center md:justify-between px-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="JSP logo" className="h-6 w-6 object-contain" />
            <span className="font-bold text-ink dark:text-white">JSP Distributors POS Suite</span>
          </div>
          <span>Designed for Ruhunu Foods daily operations. &copy; {new Date().getFullYear()} All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
