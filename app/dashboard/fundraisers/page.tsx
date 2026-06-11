/**
 * app/dashboard/fundraisers/page.tsx
 * Cached context + fundraisers and donations run in parallel.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDashboardContext, supabaseAdmin } from '@/lib/dashboard-context';

function money(n: number) {
  return `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function DashboardFundraisersPage() {
  const ctx = await getDashboardContext();
  if (!ctx) redirect('/login');
  const { organizerIds } = ctx;

  if (organizerIds.length === 0) {
    return <EmptyState />;
  }

  const fundraisersResult = await supabaseAdmin
    .from('fundraisers')
    .select('id, title, slug, goal, raised, is_featured')
    .in('organizer_id', organizerIds)
    .order('created_at', { ascending: false });

  const rows = fundraisersResult.data ?? [];
  const fundraiserIds = rows.map((fundraiser) => fundraiser.id);
  const donationsResult = fundraiserIds.length > 0
    ? await supabaseAdmin
        .from('donations')
        .select('fundraiser_id, amount')
        .eq('status', 'succeeded')
        .in('fundraiser_id', fundraiserIds)
    : { data: [] };

  // Build donor stats map
  const donorMap: Record<string, { total: number; count: number }> = {};
  for (const d of donationsResult.data ?? []) {
    const prev = donorMap[d.fundraiser_id] ?? { total: 0, count: 0 };
    donorMap[d.fundraiser_id] = {
      total: prev.total + Number(d.amount ?? 0),
      count: prev.count + 1,
    };
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-white px-4 py-3 shadow-sm sm:rounded-2xl sm:px-6 sm:py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-orange-600 sm:text-xs">Dashboard</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Fundraisers</h1>
          <p className="mt-1 text-xs font-medium text-zinc-500 sm:text-sm">Your campaigns, donations, and progress.</p>
        </div>
        <Link href="/dashboard/fundraisers/new" className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 sm:rounded-xl sm:px-5 sm:py-3 sm:text-sm">
          + Start Fundraiser
        </Link>
      </header>

      <div className="rounded-xl border border-zinc-200/80 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-6">
        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {rows.map((fr) => {
              const stats  = donorMap[fr.id] ?? { total: 0, count: 0 };
              const raised = Math.max(fr.raised ?? 0, stats.total);
              const goal   = fr.goal ?? 0;
              const pct    = goal > 0 ? Math.min(Math.round((raised / goal) * 100), 100) : 0;

              return (
                <div key={fr.id} className="rounded-xl border border-zinc-200/60 bg-zinc-50/60 p-4 sm:rounded-2xl sm:p-5">
                  <div className="flex justify-between gap-3 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="truncate font-black text-zinc-950">{fr.title}</h3>
                        {fr.is_featured && (
                          <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-black text-orange-700">Featured</span>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-3 text-xs sm:flex sm:flex-wrap sm:gap-6 sm:text-sm">
                        {[
                          { label: 'Raised',    val: money(raised),     color: 'text-emerald-700' },
                          { label: 'Goal',      val: money(goal),       color: 'text-zinc-950' },
                          { label: 'Donors',    val: String(stats.count), color: 'text-zinc-950' },
                          { label: 'Progress',  val: `${pct}%`,         color: 'text-violet-700' },
                        ].map(({ label, val, color }) => (
                          <div key={label}>
                            <p className="text-xs font-black uppercase tracking-wide text-zinc-400">{label}</p>
                            <p className={`mt-0.5 font-black ${color}`}>{val}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-zinc-200">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {fr.slug && (
                        <Link href={`/fundraisers/${fr.slug}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-black text-zinc-700 hover:bg-zinc-50">
                          View
                        </Link>
                      )}
                      <Link href={`/fundraisers/edit/${fr.id}`} className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-black text-emerald-700 hover:bg-emerald-50">
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 px-6 py-14 text-center sm:rounded-2xl sm:px-8 sm:py-20">
      <p className="text-xl font-black text-zinc-950 sm:text-2xl">No fundraisers yet</p>
      <p className="text-xs font-medium text-zinc-500 sm:text-sm">Start a campaign to begin collecting donations.</p>
      <Link href="/dashboard/fundraisers/new" className="rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700 sm:rounded-xl sm:px-6 sm:py-3 sm:text-sm">
        Start Fundraiser
      </Link>
    </div>
  );
}
