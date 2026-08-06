/**
 * app/admin/page.tsx
 * Admin overview — real platform-wide stats in stat cards.
 */

import { createClient } from '@supabase/supabase-js';
import DashboardPageHeader from '@/components/dashboard/DashboardPageHeader';

// Service role: bypasses RLS — admin operations only
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function money(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone: 'indigo' | 'orange' | 'green' | 'zinc' | 'blue' | 'rose';
}) {
  const iconClasses: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700',
    orange: 'bg-brand-50 text-brand-800',
    green:  'bg-brand-50 text-brand-800',
    zinc:   'bg-zinc-100 text-zinc-700',
    blue:   'bg-blue-50 text-blue-700',
    rose:   'bg-rose-50 text-rose-700',
  };

  return (
    <div className="flex min-h-32 flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5">
      <p className={`w-fit rounded-full px-2 py-1 text-xs font-black uppercase tracking-wide ${iconClasses[tone]}`}>
        {label}
      </p>
      <div>
        <p className="text-3xl font-black tracking-tight text-zinc-950">{value}</p>
        {detail && <p className="mt-1 text-xs font-semibold text-zinc-500">{detail}</p>}
      </div>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const [
    { count: userCount },
    { count: organizerCount },
    { count: eventCount },
    { count: fundraiserCount },
    { count: activeFundraiserCount },
    { count: pendingFundraiserCount },
    { count: ticketCount },
    { data: donationTotal },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('organizers').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('events').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('fundraisers').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('fundraisers').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabaseAdmin.from('fundraisers').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
    supabaseAdmin.from('ticket_orders').select('*', { count: 'exact', head: true }).eq('status', 'valid'),
    supabaseAdmin.from('donations').select('amount').in('status', ['succeeded', 'completed']),
  ]);

  const totalDonations = (donationTotal ?? []).reduce(
    (sum: number, d: { amount: number }) => sum + Number(d.amount || 0),
    0
  );

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        eyebrow="Admin"
        title="Platform Overview"
        description="Live platform-wide metrics."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Users"        value={String(userCount ?? 0)}      tone="indigo" />
        <StatCard label="Organizers"         value={String(organizerCount ?? 0)} tone="blue"   />
        <StatCard label="Total Events"       value={String(eventCount ?? 0)}     tone="orange" />
        <StatCard label="Total Fundraisers"  value={String(fundraiserCount ?? 0)} tone="green" />
        <StatCard label="Active Fundraisers" value={String(activeFundraiserCount ?? 0)} tone="green" />
        <StatCard label="Pending Fundraisers" value={String(pendingFundraiserCount ?? 0)} tone="orange" />
        <StatCard label="Tickets Sold"       value={String(ticketCount ?? 0)}    tone="zinc"   />
        <StatCard label="Total Donations"    value={money(totalDonations)}       tone="rose"   />
      </div>
    </div>
  );
}
