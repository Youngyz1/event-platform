/**
 * app/dashboard/donations/page.tsx
 * Cached context + fundraisers and donations fetched in parallel.
 * Stats computed in JS from already-fetched rows — no extra queries.
 */

import { redirect } from 'next/navigation';
import { getDashboardContext, supabaseAdmin } from '@/lib/dashboard-context';

function money(n: number) {
  return `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function dateStr(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const statusBadge: Record<string, string> = {
  succeeded: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-700',
  failed:    'bg-red-100 text-red-600',
};

export default async function DashboardDonationsPage() {
  const ctx = await getDashboardContext();
  if (!ctx) redirect('/login');
  const { organizerId } = ctx;

  // ── fundraisers and donations fetched in parallel ────────────────────────────
  // donations uses a join filter so we don't need fundraiser IDs first
  const [fundraisersResult, donationsResult] = await Promise.all([
    organizerId
      ? supabaseAdmin
          .from('fundraisers')
          .select('id, title, slug')
          .eq('organizer_id', organizerId)
      : Promise.resolve({ data: [] }),

    organizerId
      ? supabaseAdmin
          .from('donations')
          .select('id, fundraiser_id, donor_name, donor_email, amount, status, created_at')
          .filter('fundraisers.organizer_id', 'eq', organizerId)
          .order('created_at', { ascending: false })
          .limit(200)                       // reasonable cap — avoids fetching entire table
      : Promise.resolve({ data: [] }),
  ]);

  const fundraisers = fundraisersResult.data ?? [];
  const rows        = donationsResult.data   ?? [];
  const frMap       = Object.fromEntries(fundraisers.map((f) => [f.id, f]));
  const frIds       = fundraisers.map((f) => f.id);

  // ── Stats computed from fetched rows ─────────────────────────────────────────
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const succeededAmount = rows
    .filter((d) => d.status === 'succeeded' || d.status === 'completed')
    .reduce((s, d) => s + Number(d.amount ?? 0), 0);
  const thisMonth = rows
    .filter((d) => d.created_at >= monthStart)
    .reduce((s, d) => s + Number(d.amount ?? 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="rounded-xl border border-zinc-200/80 bg-white px-4 py-3 shadow-sm sm:rounded-2xl sm:px-6 sm:py-4">
        <p className="text-[10px] font-black uppercase tracking-wide text-orange-600 sm:text-xs">Dashboard</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Donations</h1>
        <p className="mt-1 text-xs font-medium text-zinc-500 sm:text-sm">All donations received across your fundraising campaigns.</p>
      </header>

      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: 'Total Donations', value: String(rows.length),    sub: 'across all campaigns', color: 'text-violet-600' },
          { label: 'Total Raised',    value: money(succeededAmount), sub: 'completed payments',   color: 'text-emerald-600' },
          { label: 'This Month',      value: money(thisMonth),       sub: `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`, color: 'text-orange-600' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="rounded-xl border border-zinc-200/80 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
            <p className={`text-[8px] font-black uppercase tracking-wide ${color} sm:text-xs`}>{label}</p>
            <p className="mt-1 text-xl font-black tracking-tight text-zinc-950 sm:mt-2 sm:text-3xl">{value}</p>
            <p className="mt-1 text-[9px] font-semibold leading-tight text-zinc-500 sm:text-xs">{sub}</p>
          </div>
        ))}
      </div>

      {/* Donations table */}
      <div className="rounded-xl border border-zinc-200/80 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-6">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 px-6 py-14 text-center sm:rounded-2xl sm:px-8 sm:py-20">
            <p className="text-xl font-black text-zinc-950 sm:text-2xl">No donations yet</p>
            <p className="text-xs font-medium text-zinc-500 sm:text-sm">
              {frIds.length === 0
                ? 'Create a fundraiser first, then donations will appear here.'
                : 'Share your fundraiser links to start collecting donations.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs font-black uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="py-3 pr-4">Donor</th>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Campaign</th>
                  <th className="py-3 pr-4">Amount</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((d) => {
                  const fr     = frMap[d.fundraiser_id];
                  const status = d.status ?? 'succeeded';
                  return (
                    <tr key={d.id} className="hover:bg-zinc-50/60">
                      <td className="py-3.5 pr-4 font-semibold text-zinc-900">{d.donor_name || 'Anonymous'}</td>
                      <td className="py-3.5 pr-4 text-zinc-500">{d.donor_email || '—'}</td>
                      <td className="py-3.5 pr-4 text-zinc-600">
                        {fr ? (
                          <a href={fr.slug ? `/fundraisers/${fr.slug}` : '#'} className="hover:text-orange-600 hover:underline">
                            {fr.title}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="py-3.5 pr-4 font-black text-emerald-700">{money(Number(d.amount ?? 0))}</td>
                      <td className="py-3.5 pr-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${statusBadge[status] ?? statusBadge.pending}`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-3.5 text-zinc-500">{dateStr(d.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
