import DashboardView from './DashboardView';
import { redirect } from 'next/navigation';
import { getDashboardContext, supabaseAdmin } from '@/lib/dashboard-context';

export default async function Page() {
  // getDashboardContext is cached — shared with layout, zero extra round-trips
  const ctx = await getDashboardContext();
  if (!ctx) redirect('/login');

  const { user, organizer, organizerId } = ctx;
  const email = user.email ?? '';

  // Organizer data for the sidebar card on the overview page
  const safeOrganizers = organizer ? [organizer] : [];

  if (!organizerId) {
    // No organizer yet — render empty state without any DB queries
    return (
      <DashboardView
        email={email}
        analytics={{ totalRaised: 0, totalGoal: 0, overallProgress: 0, donationCount: 0, averageDonation: 0, ticketCount: 0, ticketRevenue: 0 }}
        events={[]}
        fundraisers={[]}
        donations={[]}
        organizers={safeOrganizers}
        ticketOrders={[]}
      />
    );
  }

  // ── Round-trip 1: events + fundraisers in parallel ───────────────────────────
  const [eventsResult, fundraisersResult] = await Promise.all([
    supabaseAdmin
      .from('events')
      .select('id, title, slug, event_date, category, city')
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false })
      .limit(5),

    supabaseAdmin
      .from('fundraisers')
      .select('id, title, raised, goal')
      .eq('organizer_id', organizerId),
  ]);

  const safeEvents      = eventsResult.data      ?? [];
  const safeFundraisers = fundraisersResult.data  ?? [];
  const eventIds        = safeEvents.map((e) => e.id);
  const fundraiserIds   = safeFundraisers.map((f) => f.id);

  // ── Round-trip 2: donations + ticket orders in parallel ─────────────────────
  const [donationsResult, ordersResult] = await Promise.all([
    fundraiserIds.length > 0
      ? supabaseAdmin
          .from('donations')
          .select('id, donor_name, donor_email, amount, status, created_at')
          .in('fundraiser_id', fundraiserIds)
          .eq('status', 'succeeded')
          .order('created_at', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),

    eventIds.length > 0
      ? supabaseAdmin
          .from('ticket_orders')
          .select('id, buyer_name, buyer_email, quantity, total_amount, status, created_at, events(id, title)')
          .in('event_id', eventIds)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  const safeDonations = donationsResult.data ?? [];
  const safeOrders    = ordersResult.data    ?? [];

  // ── Analytics (no extra queries — computed from already-fetched rows) ────────
  const totalRaised     = safeFundraisers.reduce((s, f) => s + (f.raised ?? 0), 0);
  const totalGoal       = safeFundraisers.reduce((s, f) => s + (f.goal   ?? 0), 0);
  const donationCount   = safeDonations.length;
  const averageDonation = donationCount ? totalRaised / donationCount : 0;
  const ticketCount     = safeOrders.reduce((s, o) => s + ((o as { quantity?: number }).quantity ?? 0), 0);
  const ticketRevenue   = safeOrders.reduce((s, o) => s + ((o as { total_amount?: number }).total_amount ?? 0), 0);
  const overallProgress = totalGoal ? Math.round((totalRaised / totalGoal) * 100) : 0;

  return (
    <DashboardView
      email={email}
      analytics={{ totalRaised, totalGoal, overallProgress, donationCount, averageDonation, ticketCount, ticketRevenue }}
      events={safeEvents}
      fundraisers={safeFundraisers}
      donations={safeDonations}
      organizers={safeOrganizers}
      ticketOrders={safeOrders}
    />
  );
}
