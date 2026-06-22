import DashboardView from './DashboardView';
import { redirect } from 'next/navigation';
import { getDashboardContext, supabaseAdmin } from '@/lib/dashboard-context';

function buildDateRange(days = 14): string[] {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

function shortDate(iso: string) {
  const [, m, day] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}`;
}

export default async function Page() {
  const ctx = await getDashboardContext();
  if (!ctx) redirect('/login');

  const { user, organizers, organizerIds } = ctx;
  const displayName = (user.user_metadata?.display_name as string | undefined)?.trim() || 'Account';

  if (organizerIds.length === 0) {
    return (
      <DashboardView
        displayName={displayName}
        analytics={{
          events: 0,
          fundraisers: 0,
          ticketsSold: 0,
          revenue: 0,
          donations: 0,
          organizerProfiles: 0,
          totalRaised: 0,
        }}
        events={[]}
        donations={[]}
        ticketOrders={[]}
        chartTickets={[]}
        chartRevenue={[]}
        chartDonations={[]}
      />
    );
  }

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const sinceISO = since.toISOString();
  const dateRange = buildDateRange(14);

  const [eventsResult, fundraisersResult, allEventsResult] = await Promise.all([
    supabaseAdmin
      .from('events')
      .select('id, title, slug, event_date, city')
      .in('organizer_id', organizerIds)
      .order('created_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('fundraisers')
      .select('id, title, raised, goal')
      .in('organizer_id', organizerIds),
    supabaseAdmin.from('events').select('id').in('organizer_id', organizerIds),
  ]);

  const safeEvents = eventsResult.data ?? [];
  const safeFundraisers = fundraisersResult.data ?? [];
  const allEventIds = (allEventsResult.data ?? []).map((e) => e.id);
  const fundraiserIds = safeFundraisers.map((f) => f.id);

  const [donationsResult, ordersResult, chartOrdersResult, chartDonationsResult, allOrdersResult] =
    await Promise.all([
      fundraiserIds.length > 0
        ? supabaseAdmin
            .from('donations')
            .select('id, donor_name, amount, created_at')
            .in('fundraiser_id', fundraiserIds)
            .in('status', ['succeeded', 'completed'])
            .order('created_at', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] }),
      allEventIds.length > 0
        ? supabaseAdmin
            .from('ticket_orders')
            .select('id, buyer_name, buyer_email, quantity, total_amount, created_at, events(title)')
            .in('event_id', allEventIds)
            .order('created_at', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] }),
      allEventIds.length > 0
        ? supabaseAdmin
            .from('ticket_orders')
            .select('quantity, total_amount, created_at')
            .eq('status', 'valid')
            .in('event_id', allEventIds)
            .gte('created_at', sinceISO)
        : Promise.resolve({ data: [] }),
      fundraiserIds.length > 0
        ? supabaseAdmin
            .from('donations')
            .select('amount, created_at')
            .in('fundraiser_id', fundraiserIds)
            .in('status', ['succeeded', 'completed'])
            .gte('created_at', sinceISO)
        : Promise.resolve({ data: [] }),
      allEventIds.length > 0
        ? supabaseAdmin
            .from('ticket_orders')
            .select('quantity, total_amount')
            .eq('status', 'valid')
            .in('event_id', allEventIds)
        : Promise.resolve({ data: [] }),
    ]);

  const safeDonations = donationsResult.data ?? [];
  const safeOrders = ordersResult.data ?? [];
  const allOrders = allOrdersResult.data ?? [];

  const totalRaised = safeFundraisers.reduce((s, f) => s + (f.raised ?? 0), 0);
  const ticketCount = allOrders.reduce((s, o) => s + (o.quantity ?? 0), 0);
  const ticketRevenue = allOrders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

  const ticketsByDay: Record<string, number> = {};
  const revenueByDay: Record<string, number> = {};
  for (const o of chartOrdersResult.data ?? []) {
    const day = (o.created_at as string).slice(0, 10);
    ticketsByDay[day] = (ticketsByDay[day] ?? 0) + Number(o.quantity ?? 1);
    revenueByDay[day] = (revenueByDay[day] ?? 0) + Number(o.total_amount ?? 0);
  }
  const donationsByDay: Record<string, number> = {};
  for (const d of chartDonationsResult.data ?? []) {
    const day = (d.created_at as string).slice(0, 10);
    donationsByDay[day] = (donationsByDay[day] ?? 0) + Number(d.amount ?? 0);
  }

  return (
    <DashboardView
      displayName={displayName}
      analytics={{
        events: allEventIds.length,
        fundraisers: safeFundraisers.length,
        ticketsSold: ticketCount,
        revenue: ticketRevenue,
        donations: safeDonations.length,
        organizerProfiles: organizers.length,
        totalRaised,
      }}
      events={safeEvents}
      donations={safeDonations}
      ticketOrders={safeOrders}
      chartTickets={dateRange.map((d) => ({ date: shortDate(d), value: ticketsByDay[d] ?? 0 }))}
      chartRevenue={dateRange.map((d) => ({ date: shortDate(d), value: +(revenueByDay[d] ?? 0).toFixed(2) }))}
      chartDonations={dateRange.map((d) => ({ date: shortDate(d), value: +(donationsByDay[d] ?? 0).toFixed(2) }))}
    />
  );
}
