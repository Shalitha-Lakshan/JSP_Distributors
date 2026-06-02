import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-LK") : "-");

const CustomerLedgerPage = () => {
  const { id } = useParams();
  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get(`/api/customers/${id}/ledger`, {
          headers: authHeader
        });
        setLedgerData(data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load ledger");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      load();
    }
  }, [id]);

  const filteredLedger = useMemo(() => {
    if (!ledgerData?.ledger) {
      return [];
    }
    const query = search.trim().toLowerCase();
    if (!query) {
      return ledgerData.ledger;
    }
    return ledgerData.ledger.filter((row) =>
      `${row.ref} ${row.description}`.toLowerCase().includes(query)
    );
  }, [ledgerData, search]);

  if (loading) {
    return (
      <section className="rounded-2xl bg-white/80 p-6 shadow text-sm text-ink/60">
        Loading ledger...
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-clay/30 bg-clay/10 p-6 text-sm text-clay">
        {error}
      </section>
    );
  }

  if (!ledgerData) {
    return null;
  }

  const { customer, totals } = ledgerData;

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white/80 p-6 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Customer Ledger</h1>
            <p className="text-ink/60">Debits, credits, and running balance for the account.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white/90 p-5 shadow">
          <div className="text-xs uppercase text-ink/60">Customer</div>
          <div className="mt-2 text-lg font-semibold">{customer.name}</div>
          <div className="mt-1 text-xs text-ink/60">
            {customer.phone || "No phone"}
          </div>
        </div>
        <div className="rounded-2xl bg-white/90 p-5 shadow">
          <div className="text-xs uppercase text-ink/60">Total Debits</div>
          <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.totalDebit)}</div>
        </div>
        <div className="rounded-2xl bg-white/90 p-5 shadow">
          <div className="text-xs uppercase text-ink/60">Total Credits</div>
          <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.totalCredit)}</div>
        </div>
        <div className="rounded-2xl bg-white/90 p-5 shadow">
          <div className="text-xs uppercase text-ink/60">Closing Balance</div>
          <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.closingBalance)}</div>
          <div className="mt-1 text-xs text-ink/60">
            Outstanding: {formatCurrency(customer.outstandingBalance || 0)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white/80 p-6 shadow space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            className="min-w-[220px] rounded-lg border border-slatewash px-3 py-2"
            placeholder="Search ledger"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="text-xs text-ink/60">{filteredLedger.length} records</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink/50">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Credit</th>
                <th className="px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.map((row, index) => (
                <tr key={`${row.ref}-${index}`} className="border-b border-slatewash/70">
                  <td className="px-3 py-2 text-xs text-ink/60">{formatDate(row.date)}</td>
                  <td className="px-3 py-2 font-semibold">{row.ref}</td>
                  <td className="px-3 py-2 text-ink/70">{row.description}</td>
                  <td className="px-3 py-2 text-right">
                    {row.debit ? formatCurrency(row.debit) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.credit ? formatCurrency(row.credit) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatCurrency(row.balance)}
                  </td>
                </tr>
              ))}
              {filteredLedger.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-sm text-ink/60" colSpan="6">
                    No ledger records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default CustomerLedgerPage;
