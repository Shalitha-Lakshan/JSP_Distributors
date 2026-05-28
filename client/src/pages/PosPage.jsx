const PosPage = () => (
  <section className="grid xl:grid-cols-[1.4fr_1fr] gap-6">
    <div className="space-y-4">
      <div className="bg-white/80 rounded-2xl p-4 shadow">
        <div className="flex flex-wrap gap-3">
          <input
            className="flex-1 min-w-[220px] rounded-lg px-3 py-2 border border-slatewash"
            placeholder="Search by item code, name, size or keyword"
          />
          <select className="rounded-lg px-3 py-2 border border-slatewash">
            <option>All categories</option>
          </select>
          <select className="rounded-lg px-3 py-2 border border-slatewash">
            <option>All sizes</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Fast Moving", "Spices", "Flour", "Snacks"].map((item) => (
            <button
              key={item}
              className="px-3 py-1 rounded-full bg-slatewash text-ink text-sm"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white/80 rounded-2xl p-4 shadow">
        <div className="text-sm text-ink/60 mb-3">Search results</div>
        <div className="space-y-3">
          {[
            "Chillie Powder 50g",
            "Chillie Pieces 50g",
            "Kurakkan Flour 400g"
          ].map((item) => (
            <div key={item} className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{item}</div>
                <div className="text-sm text-ink/60">Item code: CP50</div>
              </div>
              <button className="px-3 py-1 rounded-lg bg-ink text-sand">Add</button>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="bg-white/80 rounded-2xl p-4 shadow space-y-4">
      <div className="text-lg font-semibold">New Order Items</div>
      <div className="space-y-3">
        <div className="flex justify-between">
          <div>
            <div className="font-semibold">Chillie Powder 50g</div>
            <div className="text-sm text-ink/60">Qty 2 x Rs. 180</div>
          </div>
          <div className="font-semibold">Rs. 360</div>
        </div>
      </div>

      <div className="border-t border-slatewash pt-4 space-y-3">
        <div className="text-lg font-semibold">Return Items</div>
        <div className="rounded-2xl border border-slatewash p-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="rounded-lg px-3 py-2 border border-slatewash"
              placeholder="Item code or name"
            />
            <input
              className="rounded-lg px-3 py-2 border border-slatewash"
              placeholder="Original invoice (optional)"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="rounded-lg px-3 py-2 border border-slatewash"
              placeholder="Qty"
            />
            <input
              className="rounded-lg px-3 py-2 border border-slatewash"
              placeholder="Return price"
            />
            <select className="rounded-lg px-3 py-2 border border-slatewash">
              <option>Resellable</option>
              <option>Damaged</option>
              <option>Expired</option>
            </select>
          </div>
          <input
            className="rounded-lg px-3 py-2 border border-slatewash"
            placeholder="Reason (optional)"
          />
          <button className="w-full rounded-lg bg-ink text-sand py-2">Add return</button>
        </div>
      </div>

      <div className="border-t border-slatewash pt-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span>Order Total</span>
          <span className="font-semibold">Rs. 360</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Less Return Total</span>
          <span className="font-semibold">Rs. 0</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Net Payable</span>
          <span className="font-semibold">Rs. 360</span>
        </div>
        <div className="flex gap-2">
          <input className="flex-1 rounded-lg px-3 py-2 border border-slatewash" placeholder="Paid amount" />
          <select className="rounded-lg px-3 py-2 border border-slatewash">
            <option>Cash</option>
            <option>Card</option>
            <option>Bank</option>
          </select>
        </div>
        <button className="w-full rounded-lg bg-clay text-white py-2">Complete sale</button>
      </div>
    </div>
  </section>
);

export default PosPage;
