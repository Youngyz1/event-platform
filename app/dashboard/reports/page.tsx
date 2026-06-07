/**
 * app/dashboard/reports/page.tsx
 * Server page — fetches last-30-day ticket, revenue, and donation data.
 * Uses cached context + parallel Promise.all for all independent queries.
 */

import { redirect } from "next/navigation";
import { getDashboardContext, supabaseAdmin } from "@/lib/dashboard-context";
import { ChartsGrid, type DailyPoint, type TopEvent } from "./DashboardCharts";

// Build a full 30-day date array so the chart always shows the complete window
function buildDateRange(days = 30): string[] {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

function shortDate(iso: string) {
  // "2024-06-01" → "Jun 1"
  const [, m, day] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m) - 1]} ${parseInt(day)}`;
}

export default async function DashboardReportsPage() {
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/login");

  const { organizerId } = ctx;

  // Dates
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceISO  = since.toISOString();
  const dateRange = buildDateRange(30);

  if (!organizerId) {
    return <EmptyReports />;
  }

  // ── All four data sources fetched in parallel ────────────────────────────────
  const [eventsResult, fundraisersResult, ordersResult, donationRowsResult] =
    await Promise.all([
      supabaseAdmin
        .from("events")
        .select("id, title")
        .eq("organizer_id", organizerId),

      supabaseAdmin
        .from("fundraisers")
        .select("id")
        .eq("organizer_id", organizerId),

      // ticket_orders filtered via foreign-key join — no event IDs needed first
      supabaseAdmin
        .from("ticket_orders")
        .select("event_id, quantity, total_amount, created_at")
        .eq("status", "valid")
        .filter("events.organizer_id", "eq", organizerId)
        .gte("created_at", sinceISO),

      // donations filtered via foreign-key join — no fundraiser IDs needed first
      supabaseAdmin
        .from("donations")
        .select("amount, created_at")
        .eq("status", "succeeded")
        .filter("fundraisers.organizer_id", "eq", organizerId)
        .gte("created_at", sinceISO),
    ]);

  const events       = eventsResult.data       ?? [];
  const orders       = ordersResult.data        ?? [];
  const donationRows = donationRowsResult.data  ?? [];
  const eventMap     = Object.fromEntries(events.map((e) => [e.id, e.title as string]));

  // ── Aggregate by day (JS, no extra round-trips) ───────────────────────────────
  const ticketsByDay:  Record<string, number> = {};
  const revenueByDay:  Record<string, number> = {};
  const topEventsAgg:  Record<string, number> = {};

  for (const o of orders) {
    const day = (o.created_at as string).slice(0, 10);
    ticketsByDay[day]         = (ticketsByDay[day]         ?? 0) + Number(o.quantity      ?? 1);
    revenueByDay[day]         = (revenueByDay[day]         ?? 0) + Number(o.total_amount  ?? 0);
    topEventsAgg[o.event_id]  = (topEventsAgg[o.event_id]  ?? 0) + Number(o.total_amount  ?? 0);
  }

  const donationsByDay: Record<string, number> = {};
  for (const d of donationRows) {
    const day = (d.created_at as string).slice(0, 10);
    donationsByDay[day] = (donationsByDay[day] ?? 0) + Number(d.amount ?? 0);
  }

  const tickets: DailyPoint[] = dateRange.map((d) => ({ date: shortDate(d), value: ticketsByDay[d]  ?? 0 }));
  const revenue: DailyPoint[] = dateRange.map((d) => ({ date: shortDate(d), value: +(revenueByDay[d]  ?? 0).toFixed(2) }));
  const donations: DailyPoint[] = dateRange.map((d) => ({ date: shortDate(d), value: +(donationsByDay[d] ?? 0).toFixed(2) }));

  const topEvents: TopEvent[] = Object.entries(topEventsAgg)
    .map(([id, rev]) => ({ title: eventMap[id] ?? "Unknown", revenue: rev }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Summary totals
  const totalTickets = orders.reduce((s, o) => s + Number(o.quantity      ?? 1), 0);
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_amount  ?? 0), 0);
  const totalDonated = donationRows.reduce((s, d) => s + Number(d.amount  ?? 0), 0);

  function money(n: number) {
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm sm:px-6">
        <p className="text-xs font-black uppercase tracking-wide text-orange-600">Dashboard</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Reports</h1>
        <p className="mt-1 text-sm font-medium text-zinc-500">Last 30 days — all data scoped to your organizer account.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Tickets Sold",   value: String(totalTickets), tone: "orange"  },
          { label: "Ticket Revenue", value: money(totalRevenue),  tone: "orange"  },
          { label: "Donations",      value: money(totalDonated),  tone: "emerald" },
        ].map(({ label, value, tone }) => (
          <div key={label} className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <p className={`text-xs font-black uppercase tracking-wide text-${tone}-600`}>{label}</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-zinc-950">{value}</p>
            <p className="mt-1 text-xs font-semibold text-zinc-500">Last 30 days</p>
          </div>
        ))}
      </div>

      <ChartsGrid tickets={tickets} revenue={revenue} donations={donations} topEvents={topEvents} />
    </div>
  );
}

function EmptyReports() {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm sm:px-6">
        <p className="text-xs font-black uppercase tracking-wide text-orange-600">Dashboard</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Reports</h1>
        <p className="mt-1 text-sm font-medium text-zinc-500">Create an organizer profile first to see your reports.</p>
      </header>
    </div>
  );
}

