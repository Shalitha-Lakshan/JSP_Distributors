const InvoicePage = () => (
  <section className="space-y-6">
    <div className="bg-white/80 rounded-2xl p-6 shadow">
      <h1 className="text-2xl font-semibold">Invoice</h1>
      <p className="text-ink/60">New order items and returns are shown separately.</p>
    </div>
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="bg-white/80 rounded-2xl p-6 shadow space-y-4">
        <div>
          <h2 className="text-lg font-semibold">New Order Items</h2>
          <div className="text-sm text-ink/60">List of billed items.</div>
        </div>
        <div className="border-t border-slatewash pt-4">
          <h2 className="text-lg font-semibold">Return Items</h2>
          <div className="text-sm text-ink/60">Returned items with condition.</div>
        </div>
      </div>
      <div className="bg-white/80 rounded-2xl p-6 shadow space-y-3">
        <div className="flex justify-between text-sm">
          <span>Order Total</span>
          <span className="font-semibold">Rs. 0</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Less Return Total</span>
          <span className="font-semibold">Rs. 0</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Net Payable</span>
          <span className="font-semibold">Rs. 0</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Paid Amount</span>
          <span className="font-semibold">Rs. 0</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Due Amount</span>
          <span className="font-semibold">Rs. 0</span>
        </div>
      </div>
    </div>
  </section>
);

export default InvoicePage;
