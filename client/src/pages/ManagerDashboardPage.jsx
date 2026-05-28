const kpis = [
  { label: "Today Sales", value: "Rs. 96,400", trend: "+9%" },
  { label: "Collections", value: "Rs. 82,300", trend: "+6%" },
  { label: "Credit Sales", value: "Rs. 14,600", trend: "-3%" },
  { label: "Outstanding", value: "Rs. 39,100", trend: "-2%" }
];

const inventorySignals = [
  { title: "Low Stock Items", value: "7", desc: "Reorder within 3 days" },
  { title: "Near Expiry", value: "3 batches", desc: "Next 14 days" },
  { title: "Stock Added", value: "12 batches", desc: "Today intake" }
];

const payments = [
  { title: "Cash", value: "Rs. 48,900" },
  { title: "Card", value: "Rs. 21,700" },
  { title: "Bank", value: "Rs. 11,700" }
];

const recentCredits = [
  { name: "City Mart", amount: "Rs. 6,500", time: "45 mins ago" },
  { name: "Sampath Stores", amount: "Rs. 4,100", time: "1 hour ago" },
  { name: "Jaya Traders", amount: "Rs. 2,700", time: "2 hours ago" }
];

const ManagerDashboardPage = () => (
  <section className="space-y-6">
    <div className="flex flex-col gap-4 rounded-2xl bg-white/80 p-6 shadow md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Manager Dashboard</h1>
        <p className="text-ink/60">Inventory health, collections, and credit watch.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-sand">
          Store: Ruhunu Foods
        </span>
        <span className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold">
          Shift B
        </span>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((card) => (
        <div key={card.label} className="rounded-2xl bg-white/90 p-5 shadow">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/50">{card.label}</div>
          <div className="mt-3 text-2xl font-semibold">{card.value}</div>
          <div className="mt-2 text-sm text-ink/60">{card.trend} vs yesterday</div>
        </div>
      ))}
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl bg-white/90 p-6 shadow">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-ink/70">Inventory Signals</div>
            <div className="text-xs text-ink/50">Critical items and intake status</div>
          </div>
          <span className="rounded-full bg-slatewash px-3 py-1 text-xs font-semibold">
            FIFO Watch
          </span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {inventorySignals.map((item) => (
            <div key={item.title} className="rounded-2xl bg-slatewash/70 p-4">
              <div className="text-xs text-ink/60">{item.title}</div>
              <div className="mt-2 text-lg font-semibold">{item.value}</div>
              <div className="mt-1 text-xs text-ink/50">{item.desc}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 h-36 rounded-2xl bg-gradient-to-r from-amber-200/40 via-clay/20 to-leaf/20" />
      </div>

      <div className="rounded-2xl bg-white/90 p-6 shadow">
        <div className="text-sm font-semibold text-ink/70">Payment Mix</div>
        <div className="mt-4 space-y-3">
          {payments.map((item) => (
            <div key={item.title} className="flex items-center justify-between rounded-2xl border border-slatewash p-4">
              <span className="text-sm font-semibold">{item.title}</span>
              <span className="text-sm text-ink/70">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-2xl bg-white/90 p-6 shadow">
        <div className="text-sm font-semibold text-ink/70">Top Selling Items</div>
        <div className="mt-4 space-y-3">
          {[
            { name: "Chili Powder 50g", qty: "148 packs" },
            { name: "Kurakkan Flour 400g", qty: "102 packs" },
            { name: "Turmeric 100g", qty: "96 packs" }
          ].map((item) => (
            <div key={item.name} className="flex items-center justify-between rounded-2xl bg-slatewash/60 p-4">
              <span className="text-sm font-semibold">{item.name}</span>
              <span className="text-xs text-ink/60">{item.qty}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white/90 p-6 shadow">
        <div className="text-sm font-semibold text-ink/70">Recent Credit Bills</div>
        <div className="mt-4 space-y-3">
          {recentCredits.map((item) => (
            <div key={item.name} className="rounded-2xl border border-slatewash p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{item.name}</span>
                <span className="text-sm text-ink/70">{item.amount}</span>
              </div>
              <div className="mt-2 text-xs text-ink/50">{item.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default ManagerDashboardPage;
