const AdminDashboardPage = () => (
  <section className="space-y-6">
    <div className="bg-white/70 p-6 rounded-2xl shadow">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
      <p className="text-ink/60">Full system overview and management controls.</p>
    </div>
    <div className="grid md:grid-cols-3 gap-4">
      {[
        { label: "Today Sales", value: "Rs. 0" },
        { label: "Cash Collected", value: "Rs. 0" },
        { label: "Outstanding", value: "Rs. 0" }
      ].map((card) => (
        <div key={card.label} className="bg-white/80 rounded-2xl p-4 shadow">
          <div className="text-sm text-ink/60">{card.label}</div>
          <div className="text-xl font-semibold">{card.value}</div>
        </div>
      ))}
    </div>
  </section>
);

export default AdminDashboardPage;
