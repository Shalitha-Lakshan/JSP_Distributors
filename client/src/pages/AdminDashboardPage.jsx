const statCards = [
  { label: "Today Sales", value: "Rs. 128,450", trend: "+12%" },
  { label: "Cash Collected", value: "Rs. 96,800", trend: "+8%" },
  { label: "Outstanding", value: "Rs. 41,650", trend: "-5%" },
  { label: "Invoices", value: "214", trend: "+6%" }
];

const quickActions = [
  { title: "Add Stock Batch", desc: "Record new stock intake" },
  { title: "Create Product", desc: "Add new SKU with pricing" },
  { title: "Receive Payment", desc: "Allocate customer collections" },
  { title: "Run Daily Closing", desc: "Generate today summary" }
];

const activityFeed = [
  { title: "Invoice INV-1042", meta: "Cashier: Nimal", time: "10 mins ago" },
  { title: "Payment PAY-210", meta: "Customer: City Mart", time: "28 mins ago" },
  { title: "Stock Batch B-901", meta: "Kurakkan Flour 400g", time: "1 hour ago" }
];

const lowStock = [
  { item: "Chili Powder 50g", level: "18 units", status: "Reorder" },
  { item: "Turmeric 100g", level: "22 units", status: "Watch" },
  { item: "Kurakkan Flour 400g", level: "12 units", status: "Reorder" }
];

const AdminDashboardPage = () => (
  <section className="space-y-6">
    <div className="flex flex-col gap-4 rounded-2xl bg-white/80 p-6 shadow md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-ink/60">System-wide KPIs, collections, and stock health.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-sand">
          Updated 10:30 AM
        </span>
        <span className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold">
          Shift A
        </span>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {statCards.map((card) => (
        <div key={card.label} className="rounded-2xl bg-white/90 p-5 shadow">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/50">
            {card.label}
          </div>
          <div className="mt-3 text-2xl font-semibold">{card.value}</div>
          <div className="mt-2 text-sm text-ink/60">{card.trend} vs yesterday</div>
        </div>
      ))}
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <div className="rounded-2xl bg-white/90 p-6 shadow">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-ink/70">Sales Overview</div>
            <div className="text-xs text-ink/50">Today vs last 7 days</div>
          </div>
          <div className="rounded-full bg-slatewash px-3 py-1 text-xs font-semibold">
            Net Sales
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { label: "Gross Sales", value: "Rs. 142,900" },
            { label: "Returns", value: "Rs. 6,200" },
            { label: "Net Sales", value: "Rs. 136,700" }
          ].map((row) => (
            <div key={row.label} className="rounded-2xl bg-slatewash/70 p-4">
              <div className="text-xs text-ink/60">{row.label}</div>
              <div className="mt-2 text-lg font-semibold">{row.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 h-40 rounded-2xl bg-gradient-to-r from-clay/20 via-leaf/20 to-amber-200/30" />
      </div>

      <div className="rounded-2xl bg-white/90 p-6 shadow">
        <div className="text-sm font-semibold text-ink/70">Quick Actions</div>
        <div className="mt-4 grid gap-3">
          {quickActions.map((action) => (
            <div key={action.title} className="rounded-2xl border border-slatewash p-4">
              <div className="text-sm font-semibold">{action.title}</div>
              <div className="text-xs text-ink/60">{action.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-2xl bg-white/90 p-6 shadow">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-ink/70">Low Stock Watch</div>
          <span className="rounded-full bg-clay/10 px-3 py-1 text-xs font-semibold text-clay">
            3 alerts
          </span>
        </div>
        <div className="mt-4 grid gap-3">
          {lowStock.map((row) => (
            <div key={row.item} className="flex items-center justify-between rounded-2xl bg-slatewash/60 p-4">
              <div>
                <div className="text-sm font-semibold">{row.item}</div>
                <div className="text-xs text-ink/60">{row.level}</div>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white/90 p-6 shadow">
        <div className="text-sm font-semibold text-ink/70">Recent Activity</div>
        <div className="mt-4 space-y-3">
          {activityFeed.map((item) => (
            <div key={item.title} className="rounded-2xl border border-slatewash p-4">
              <div className="text-sm font-semibold">{item.title}</div>
              <div className="text-xs text-ink/60">{item.meta}</div>
              <div className="mt-2 text-xs text-ink/50">{item.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default AdminDashboardPage;
