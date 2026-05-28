import { Link } from "react-router-dom";

const highlights = [
  {
    title: "Fast POS Billing",
    description: "Search by item code, size, or keyword and bill in seconds with FIFO accuracy."
  },
  {
    title: "Smart Stock Batches",
    description: "Track batch prices, expiry dates, and stock inflow with barcode-assisted entries."
  },
  {
    title: "Customer Credit",
    description: "Handle credit sales, old bill payments, and clean customer ledgers."
  }
];

const steps = [
  {
    title: "Receive Stock",
    description: "Scan barcode, enter price, and create FIFO batches in seconds."
  },
  {
    title: "Sell & Collect",
    description: "Use smart search, add to cart, accept payment or credit."
  },
  {
    title: "Close the Day",
    description: "Separate sales vs collections and review outstanding balances."
  }
];

const HomePage = () => (
  <div className="relative min-h-screen w-full overflow-x-hidden bg-sand text-ink flex flex-col">
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-clay/30 blur-3xl float-slow" />
      <div className="absolute top-32 -right-20 h-80 w-80 rounded-full bg-leaf/30 blur-3xl float-medium" />
      <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-amber-200/40 blur-2xl float-fast" />
    </div>

    <header className="relative z-10 px-4 py-5 sm:px-6 md:px-12">
      <nav className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="JSP logo" className="h-10 w-10" />
          <div className="text-xl font-semibold tracking-wide">JSP Distributors</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-sand shadow"
            to="/login"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </header>

    <main className="relative z-10 flex-1">
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-12 pt-4 sm:px-6 md:grid-cols-[1.2fr_0.8fr] md:px-12">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] sm:text-xs">
            Ruhunu Foods POS Suite
          </div>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl">
            Run the full business cycle from billing to batch stock.
          </h1>
          <p className="text-base text-ink/70 sm:text-lg">
            Built for small distributors who need fast search, clean invoices, FIFO stock,
            and reliable daily closing reports in one place.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="rounded-full bg-clay px-6 py-3 text-sm font-semibold text-white shadow"
              to="/login"
            >
              Start POS Login
            </Link>
            <Link
              className="rounded-full border border-ink/20 px-6 py-3 text-sm font-semibold text-ink"
              to="/pos"
            >
              Preview POS Screen
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Smart Search", value: "Item code + keywords" },
              { label: "FIFO Stock", value: "Batch price tracking" },
              { label: "Credit", value: "Old bill collections" }
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-white/80 p-4 shadow">
                <div className="text-xs uppercase tracking-[0.2em] text-ink/50">
                  {stat.label}
                </div>
                <div className="mt-2 text-sm font-semibold">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl bg-white/80 p-6 shadow-lg">
          <div className="text-sm font-semibold text-ink/60">Today Summary</div>
          <div className="mt-4 space-y-4">
            {[
              { label: "Sales Today", value: "Rs. 124,500" },
              { label: "Cash Collected", value: "Rs. 98,200" },
              { label: "Outstanding", value: "Rs. 42,300" }
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-sm text-ink/60">{row.label}</span>
                <span className="text-lg font-semibold">{row.value}</span>
              </div>
            ))}
            <div className="rounded-2xl bg-ink px-4 py-3 text-sand">
              <div className="text-xs uppercase tracking-[0.2em] text-sand/70">
                Live Batch Alerts
              </div>
              <div className="mt-1 text-sm">3 items near reorder level</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 md:px-12">
        <div className="grid gap-6 md:grid-cols-3">
          {highlights.map((card) => (
            <div key={card.title} className="rounded-3xl bg-white/90 p-6 shadow">
              <h3 className="text-lg font-semibold">{card.title}</h3>
              <p className="mt-3 text-sm text-ink/70">{card.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 md:px-12">
        <div className="rounded-3xl bg-ink px-6 py-10 text-sand md:px-10">
          <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h2 className="text-3xl font-semibold">Designed for Ruhunu Foods workflows.</h2>
              <p className="mt-3 text-sand/70">
                Keep item variants organized with smart search keywords. Allocate FIFO batches
                automatically. Print invoices without storing PDFs in the database.
              </p>
            </div>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={step.title} className="rounded-2xl bg-white/10 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-sand/60">
                    Step {index + 1}
                  </div>
                  <div className="text-lg font-semibold">{step.title}</div>
                  <div className="text-sm text-sand/70">{step.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 md:px-12">
        <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
          <div className="rounded-3xl bg-white/80 p-6 shadow">
            <h3 className="text-xl font-semibold">Smart product lookup</h3>
            <p className="mt-2 text-sm text-ink/70">
              Search by item code, product name, size, category, and Sinhala/English keywords.
              Fast-moving buttons speed up common items during peak hours.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["CP50", "KF400", "Miris 50", "Fast Items"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slatewash px-3 py-1 text-xs font-semibold"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-white/80 p-6 shadow">
            <h3 className="text-xl font-semibold">Cleaner daily closing</h3>
            <p className="mt-2 text-sm text-ink/70">
              Separate sales totals from collections. Track opening vs closing outstanding
              and keep credit sales under control.
            </p>
            <div className="mt-4 grid gap-3">
              {[
                { label: "Sales Today", value: "Rs. 68,000" },
                { label: "Collections", value: "Rs. 82,000" },
                { label: "Closing Outstanding", value: "Rs. 31,500" }
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-ink/60">{row.label}</span>
                  <span className="font-semibold">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 md:px-12">
        <div className="rounded-3xl bg-clay/90 px-6 py-10 text-white shadow-lg">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-semibold">Ready to go live?</h2>
              <p className="mt-2 text-white/80">
                Access the POS system and start billing with admin controls.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink"
                to="/login"
              >
                Sign in now
              </Link>
              <Link
                className="rounded-full border border-white/60 px-6 py-3 text-sm font-semibold"
                to="/dashboard"
              >
                View dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer className="relative z-10 border-t border-ink/10 px-4 py-6 text-sm text-ink/60 sm:px-6 md:px-12 mt-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <span>JSP Distributors POS</span>
        <span>Designed for Ruhunu Foods daily operations.</span>
      </div>
    </footer>
  </div>
);

export default HomePage;
