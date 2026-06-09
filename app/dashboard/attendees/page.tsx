/**
 * app/dashboard/attendees/page.tsx
 * Lists all ticket buyers across the organizer's events.
 * Uses cached context — no duplicate auth/organizer round-trip.
 */

import { redirect } from "next/navigation";
import { getDashboardContext, supabaseAdmin } from "@/lib/dashboard-context";

function dateStr(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function money(n: number) {
  return `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const statusBadge: Record<string, string> = {
  valid:     "bg-emerald-100 text-emerald-700",
  used:      "bg-zinc-100 text-zinc-500",
  cancelled: "bg-red-100 text-red-600",
  refunded:  "bg-orange-100 text-orange-600",
};

export default async function DashboardAttendeesPage() {
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/login");
  const { organizerId } = ctx;

  // events + orders fetched in parallel after single organizer lookup
  const [eventsResult, ordersResult] = await Promise.all([
    organizerId
      ? supabaseAdmin
          .from("events")
          .select("id, title")
          .eq("organizer_id", organizerId)
      : Promise.resolve({ data: [] }),

    organizerId
      ? supabaseAdmin
          .from("ticket_orders")
          .select("id, event_id, buyer_name, buyer_email, quantity, total_amount, status, created_at")
          .filter("events.organizer_id", "eq", organizerId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const events   = eventsResult.data  ?? [];
  const eventMap = Object.fromEntries(events.map((e) => [e.id, e.title as string]));
  const rows     = ordersResult.data  ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="rounded-xl border border-zinc-200/80 bg-white px-4 py-3 shadow-sm sm:rounded-2xl sm:px-6 sm:py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-orange-600 sm:text-xs">Dashboard</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Attendees</h1>
          <p className="mt-1 text-xs font-medium text-zinc-500 sm:text-sm">
            All ticket buyers across your events — {rows.length} total.
          </p>
        </div>
      </header>

      <div className="rounded-xl border border-zinc-200/80 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-6">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 px-6 py-14 text-center sm:rounded-2xl sm:px-8 sm:py-20">
            <p className="text-xl font-black text-zinc-950 sm:text-2xl">No attendees yet</p>
            <p className="text-xs font-medium text-zinc-500 sm:text-sm">
              Attendees appear here once tickets are sold for your events.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs font-black uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="py-3 pr-4">Buyer</th>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Event</th>
                  <th className="py-3 pr-4">Qty</th>
                  <th className="py-3 pr-4">Paid</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((o) => {
                  const status = o.status ?? "valid";
                  return (
                    <tr key={o.id} className="hover:bg-zinc-50/40">
                      <td className="py-3.5 pr-4 font-semibold text-zinc-900">
                        {o.buyer_name || "Guest"}
                      </td>
                      <td className="py-3.5 pr-4 text-zinc-500">{o.buyer_email || "—"}</td>
                      <td className="py-3.5 pr-4 max-w-[160px] truncate text-zinc-700">
                        {eventMap[o.event_id] ?? "—"}
                      </td>
                      <td className="py-3.5 pr-4 font-bold">{o.quantity}</td>
                      <td className="py-3.5 pr-4 font-black text-emerald-700">{money(Number(o.total_amount ?? 0))}</td>
                      <td className="py-3.5 pr-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${statusBadge[status] ?? statusBadge.valid}`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-3.5 text-zinc-500">{dateStr(o.created_at)}</td>
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
