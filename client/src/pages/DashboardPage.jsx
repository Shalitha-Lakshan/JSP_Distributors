const glanceCards = [
  { label: "Bills Processed", value: "58" },
  { label: "Cash Collected", value: "Rs. 42,800" },
  { label: "Returns", value: "Rs. 2,100" }
];

const queue = [
  { title: "Walk-in sale", meta: "2 items", time: "Now" },
  { title: "Credit invoice", meta: "City Mart", time: "10 mins" },
  { title: "Return handling", meta: "INV-1041", time: "15 mins" }
];

const DashboardPage = () => (
  <section className="space-y-6">
    <div className="flex flex-col gap-4 rounded-2xl bg-white/80 p-6 shadow md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Operations Dashboard</h1>
        <p className="text-ink/60">Track live counters, pending tasks, and shift progress.</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-sand">
          Shift in progress
        </span>
        <span className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold">
          10:45 AM
        </span>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-3">
      {glanceCards.map((card) => (
        <div key={card.label} className="rounded-2xl bg-white/90 p-5 shadow">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/50">{card.label}</div>
          <div className="mt-3 text-2xl font-semibold">{card.value}</div>
          <div className="mt-2 text-sm text-ink/60">Since shift open</div>
        </div>
      ))}
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <div className="rounded-2xl bg-white/90 p-6 shadow">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-ink/70">Hourly Sales</div>
            <div className="text-xs text-ink/50">Latest 6 hours</div>
          </div>
          <span className="rounded-full bg-slatewash px-3 py-1 text-xs font-semibold">
            POS Counter 1
          </span>
        </div>
        <div className="mt-6 h-40 rounded-2xl bg-gradient-to-r from-amber-200/40 via-clay/20 to-leaf/20" />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            { label: "Avg Bill", value: "Rs. 1,140" },
            { label: "Avg Items", value: "4.2" },
            { label: "Cash Share", value: "68%" }
          ].map((row) => (
            <div key={row.label} className="rounded-2xl bg-slatewash/70 p-4">
              <div className="text-xs text-ink/60">{row.label}</div>
              <div className="mt-2 text-lg font-semibold">{row.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white/90 p-6 shadow">
        <div className="text-sm font-semibold text-ink/70">Next in Queue</div>
        <div className="mt-4 space-y-3">
          {queue.map((item) => (
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

export default DashboardPage;
