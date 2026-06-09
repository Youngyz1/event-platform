/**
 * app/dashboard/events/page.tsx
 * Uses getDashboardContext (cached) — no duplicate auth/organizer round-trip.
 * After organizer ID is known, events + ticket_orders run in parallel.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDashboardContext, supabaseAdmin } from '@/lib/dashboard-context';

function money(n: number) {
  return `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function dateStr(d: string | null) {
  if (!d) return 'TBA';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const statusBadge: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
};
const visibilityBadge: Record<string, string> = {
  public:  'bg-blue-100 text-blue-700',
  private: 'bg-zinc-100 text-zinc-600',
};

export default async function DashboardEventsPage() {
  const ctx = await getDashboardContext();
  if (!ctx) redirect('/login');
  const { organizerId } = ctx;

  if (!organizerId) {
    return <EmptyState />;
  }

  // ── Both queries run in parallel ─────────────────────────────────────────────
  const [eventsResult, ordersResult] = await Promise.all([
    supabaseAdmin
      .from('events')
      .select('id, title, slug, event_date, status, visibility, is_featured')
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false }),

    // Filter ticket_orders by the organizer's events via a join
    supabaseAdmin
      .from('ticket_orders')
      .select('event_id, quantity, total_amount')
      .eq('status', 'valid')
      // Supabase lets us filter via a foreign-key relation column
      .filter('events.organizer_id', 'eq', organizerId),
  ]);

  const rows = eventsResult.data ?? [];

  // Build ticket map from flat orders list
  const ticketMap: Record<string, { count: number; revenue: number }> = {};
  for (const o of ordersResult.data ?? []) {
    const prev = ticketMap[o.event_id] ?? { count: 0, revenue: 0 };
    ticketMap[o.event_id] = {
      count:   prev.count   + (o.quantity    ?? 1),
      revenue: prev.revenue + Number(o.total_amount ?? 0),
    };
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:px-6">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-orange-600">Dashboard</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Events</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">All your events, tickets sold, and revenue.</p>
        </div>
        <Link href="/dashboard/events/new" className="shrink-0 rounded-xl bg-orange-600 px-5 py-3 text-sm font-black text-white hover:bg-orange-700">
          + Create Event
        </Link>
      </header>

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm sm:p-6">
        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs font-black uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="py-3 pr-4">Event</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Visibility</th>
                  <th className="py-3 pr-4">Tickets</th>
                  <th className="py-3 pr-4">Revenue</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((ev) => {
                  const tickets = ticketMap[ev.id] ?? { count: 0, revenue: 0 };
                  const status  = ev.status     ?? 'approved';
                  const vis     = ev.visibility ?? 'public';
                  return (
                    <tr key={ev.id} className="hover:bg-zinc-50/60">
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 text-xs font-black text-white">
                            {ev.title.charAt(0)}
                          </div>
                          <p className="max-w-[160px] truncate font-bold text-zinc-900">{ev.title}</p>
                        </div>
                      </td>
                      <td className="py-3.5 pr-4 text-zinc-500">{dateStr(ev.event_date)}</td>
                      <td className="py-3.5 pr-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${statusBadge[status] ?? statusBadge.pending}`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${visibilityBadge[vis] ?? visibilityBadge.public}`}>
                          {vis}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 font-bold">{tickets.count}</td>
                      <td className="py-3.5 pr-4 font-black text-emerald-700">{money(tickets.revenue)}</td>
                      <td className="py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {ev.slug && (
                            <Link href={`/events/${ev.slug}`} className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-black text-zinc-700 hover:bg-zinc-50">
                              View
                            </Link>
                          )}
                          <Link href={`/events/edit/${ev.id}`} className="rounded-lg border border-orange-200 bg-white px-2.5 py-1.5 text-xs font-black text-orange-700 hover:bg-orange-50">
                            Edit
                          </Link>
                        </div>
                      </td>
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 px-8 py-20 text-center">
      <p className="text-2xl font-black text-zinc-950">No events yet</p>
      <p className="text-sm font-medium text-zinc-500">Create your first event to start selling tickets.</p>
      <Link href="/dashboard/events/new" className="rounded-xl bg-orange-600 px-6 py-3 text-sm font-black text-white hover:bg-orange-700">
        Create Event
      </Link>
    </div>
  );
}
