const managerWidgets = [
  "Today Sales",
  "Today Collection",
  "Credit Sales Today",
  "Old Credit Collection",
  "Total Outstanding Balance",
  "Low Stock Items",
  "Near Expiry Stock Batches",
  "Stock Added Today",
  "Top Selling Items",
  "Payment Method Summary",
  "Recent Payments",
  "Recent Credit Bills"
];

const ManagerDashboardPage = () => (
  <section className="space-y-6">
    <div className="bg-white/70 p-6 rounded-2xl shadow">
      <h1 className="text-2xl font-semibold">Manager Dashboard</h1>
      <p className="text-ink/60">Stock and finance-focused overview.</p>
    </div>
    <div className="grid md:grid-cols-3 gap-4">
      {managerWidgets.map((item) => (
        <div key={item} className="bg-white/80 rounded-2xl p-4 shadow">
          <div className="text-sm text-ink/60">{item}</div>
          <div className="text-lg font-semibold">--</div>
        </div>
      ))}
    </div>
  </section>
);

export default ManagerDashboardPage;
