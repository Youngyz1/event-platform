import type { ReactNode } from 'react';
import Link from 'next/link';

type Tone = 'green' | 'orange' | 'purple' | 'zinc';

type Analytics = {
  totalRaised: number;
  overallProgress: number;
  totalGoal: number;
  donationCount: number;
  averageDonation: number;
  ticketCount: number;
  ticketRevenue: number;
};

type Fundraiser = {
  id: string | number;
  title: string;
  raised: number;
  goal: number;
};

type Donation = {
  id: string | number;
  donor_name?: string | null;
  donor_email?: string | null;
  created_at: string;
  amount: number;
  status?: string | null;
};

type EventItem = {
  id: string | number;
  title: string;
  slug?: string | null;
  category?: string | null;
  event_date?: string | null;
  city?: string | null;
};

type Organizer = {
  id: string | number;
  name: string;
  bio?: string | null;
  photo?: string | null;
};

type TicketOrderEvent = {
  id: string | number;
  title?: string | null;
};

type TicketOrder = {
  id: string | number;
  buyer_name?: string | null;
  buyer_email?: string | null;
  events?: TicketOrderEvent | TicketOrderEvent[] | null;
  quantity: number;
  total_amount: number;
  status: string;
  created_at?: string | null;
};

function money(value: number | null | undefined) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function dateLabel(date?: string | null) {
  if (!date) return 'Date TBA';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function firstRelation<T>(value?: T | T[] | null) {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function StatCard({
  label,
  value,
  detail,
  tone,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
  icon: string;
}) {
  const iconClasses = {
    green:  'bg-emerald-50 text-emerald-700',
    orange: 'bg-orange-50 text-orange-700',
    purple: 'bg-violet-50 text-violet-700',
    zinc:   'bg-zinc-100 text-zinc-700',
  };

  return (
    <div className="flex min-h-32 flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-200/60">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${iconClasses[tone]}`}>
          {icon}
        </span>
      </div>
      <div>
        <p className="text-3xl font-black tracking-tight text-zinc-950">{value}</p>
        <p className="mt-1 text-xs font-semibold text-zinc-500">{detail}</p>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <h2 className="text-base font-black tracking-tight text-zinc-950">{title}</h2>
        <p className="mt-1 text-sm font-medium text-zinc-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function TextAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="shrink-0 text-sm font-black text-zinc-900 transition hover:text-orange-600">
      {children}
    </Link>
  );
}

const panelClass = 'rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-200/60 sm:p-6';
const rowClass   = 'rounded-2xl bg-zinc-50/80 p-4 ring-1 ring-zinc-200/70';

export default function DashboardView({
  email,
  error,
  analytics,
  events,
  fundraisers,
  donations,
  organizers,
  ticketOrders,
}: {
  email?: string;
  error?: string;
  analytics: Analytics;
  events: EventItem[];
  fundraisers: Fundraiser[];
  donations: Donation[];
  organizers: Organizer[];
  ticketOrders: TicketOrder[];
}) {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <header className="rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm shadow-zinc-200/60 sm:px-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-orange-600">Dashboard</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Overview</h1>
            <p className="mt-2 text-sm font-medium text-zinc-500">
              Welcome back{email ? `, ${email}` : ''}
            </p>
          </div>
          <div className="flex h-10 items-center gap-2 rounded-xl bg-zinc-50 px-3 text-sm font-black text-zinc-700 ring-1 ring-zinc-200">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-xs text-white">
              {(email || 'U').charAt(0).toUpperCase()}
            </span>
            <span className="max-w-28 truncate">{email || 'User'}</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Fundraiser Raised"
          value={money(analytics.totalRaised)}
          detail={`${analytics.overallProgress}% of ${money(analytics.totalGoal)} goal`}
          tone="green"
          icon="$"
        />
        <StatCard
          label="Donations"
          value={String(analytics.donationCount)}
          detail={`${money(analytics.averageDonation)} average gift`}
          tone="green"
          icon="&"
        />
        <StatCard
          label="Tickets Sold"
          value={String(analytics.ticketCount)}
          detail={`${money(analytics.ticketRevenue)} revenue`}
          tone="orange"
          icon="#"
        />
        <StatCard
          label="Live Assets"
          value={String(events.length + fundraisers.length)}
          detail={`${events.length} events, ${fundraisers.length} fundraisers`}
          tone="purple"
          icon="!"
        />
      </section>

      {/* Fundraiser performance + Donation summary */}
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className={panelClass}>
          <SectionHeader
            title="Fundraiser Performance"
            description="Campaign progress and funding momentum."
            action={<TextAction href="/create-fundraiser">Start a Fundraiser</TextAction>}
          />

          {fundraisers.length === 0 ? (
            <div className="mt-6 grid gap-6 rounded-2xl bg-zinc-50/80 p-6 text-center ring-1 ring-zinc-200/70 md:grid-cols-[180px_1fr] md:text-left">
              <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full bg-emerald-50 ring-[14px] ring-emerald-100">
                <div>
                  <p className="text-3xl font-black">0%</p>
                  <p className="text-xs font-bold text-zinc-500">of goal</p>
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <p className="font-black">No fundraisers yet.</p>
                <p className="mt-2 text-sm font-medium text-zinc-500">Create your first fundraiser to see performance here.</p>
                <Link href="/create-fundraiser" className="mt-4 inline-flex w-fit rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700">
                  Start a Fundraiser
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {fundraisers.map((fundraiser) => {
                const progress = fundraiser.goal
                  ? Math.min(Math.round((fundraiser.raised / fundraiser.goal) * 100), 100)
                  : 0;
                return (
                  <div key={fundraiser.id} className={rowClass}>
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <h3 className="truncate font-black">{fundraiser.title}</h3>
                        <p className="mt-1 text-sm font-medium text-zinc-500">
                          {money(fundraiser.raised)} of {money(fundraiser.goal)} raised
                        </p>
                      </div>
                      <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                        {progress}% funded
                      </span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={panelClass}>
          <SectionHeader title="Donation Summary" description="Recent supporter activity." />
          {donations.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-zinc-50/80 p-8 text-center ring-1 ring-zinc-200/70">
              <p className="text-3xl font-black">{money(0)}</p>
              <p className="mt-1 text-sm font-bold text-zinc-500">Total Donations</p>
              <p className="mt-4 text-sm text-zinc-500">Connect Stripe to start receiving donations.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {donations.slice(0, 8).map((donation) => (
                <div key={donation.id} className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate font-black">{donation.donor_name || 'Anonymous'}</p>
                    <p className="mt-1 truncate text-sm font-medium text-zinc-500">
                      {donation.donor_email || dateLabel(donation.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-emerald-700">{money(donation.amount)}</p>
                    {donation.status && (
                      <p className="mt-1 text-xs font-black uppercase text-zinc-400">{donation.status}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Events */}
      <section className={panelClass}>
        <SectionHeader
          title="Events"
          description="Your events — latest 5."
          action={<TextAction href="/dashboard/events">View all events →</TextAction>}
        />
        <div className="mt-6 space-y-3">
          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-8 text-center text-zinc-500">
              No events yet.{' '}
              <Link href="/create-event" className="font-black text-orange-600 hover:text-orange-700">
                Create your first event →
              </Link>
            </div>
          ) : (
            events.slice(0, 5).map((event) => (
              <div key={event.id} className="flex flex-col gap-4 rounded-2xl bg-zinc-50/80 p-4 ring-1 ring-zinc-200/70 sm:flex-row sm:items-center">
                <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-300 text-sm font-black text-white">
                  Event
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-black">{event.title}</h3>
                  <p className="mt-1 text-sm font-medium text-zinc-500">
                    {dateLabel(event.event_date)} · {event.city || 'Location TBA'} · {event.category || 'General'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {event.slug && (
                    <Link href={`/events/${event.slug}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-black text-zinc-700 hover:bg-zinc-50">
                      View
                    </Link>
                  )}
                  <Link href={`/events/edit/${event.id}`} className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs font-black text-orange-700 hover:bg-orange-50">
                    Edit
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Organizer Profiles + Recent Ticket Orders */}
      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className={panelClass}>
          <SectionHeader
            title="Organizer Profiles"
            description="Public profiles behind your events."
            action={<TextAction href="/create-organizer">Add organizer</TextAction>}
          />
          <div className="mt-6 space-y-3">
            {organizers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-8 text-center text-zinc-500">
                No organizers yet.
              </div>
            ) : (
              organizers.slice(0, 5).map((organizer) => (
                <div key={organizer.id} className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200">
                      {organizer.photo ? (
                        <div
                          aria-label={organizer.name}
                          className="h-full w-full bg-cover bg-center"
                          role="img"
                          style={{ backgroundImage: `url(${organizer.photo})` }}
                        />
                      ) : (
                        <span className="font-black text-zinc-500">{organizer.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-black">{organizer.name}</p>
                      <p className="truncate text-sm font-medium text-zinc-500">{organizer.bio || 'Business page'}</p>
                    </div>
                  </div>
                  <Link href={`/organizers/${organizer.id}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-black text-zinc-700 hover:bg-zinc-50">
                    View
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {ticketOrders.length > 0 && (
          <div className={panelClass}>
            <SectionHeader title="Recent Ticket Orders" description="Latest ticket activity across your events." />
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs font-black uppercase tracking-wide text-zinc-400">
                  <tr>
                    <th className="py-3 pr-4">Buyer</th>
                    <th className="py-3 pr-4">Event</th>
                    <th className="py-3 pr-4">Qty</th>
                    <th className="py-3 pr-4">Amount</th>
                    <th className="py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {ticketOrders.slice(0, 10).map((order) => {
                    const event = firstRelation<TicketOrderEvent>(order.events);
                    return (
                      <tr key={order.id}>
                        <td className="py-4 pr-4 font-semibold">{order.buyer_name || order.buyer_email || 'Guest'}</td>
                        <td className="py-4 pr-4 text-zinc-600">{event?.title || 'Event'}</td>
                        <td className="py-4 pr-4 text-zinc-600">{order.quantity}</td>
                        <td className="py-4 pr-4 font-black">{money(order.total_amount)}</td>
                        <td className="py-4">
                          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black uppercase text-zinc-600">
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
