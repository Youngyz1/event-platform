"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { supabase } from "@/lib/supabase";

type Event = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  event_date: string | null;
  city: string | null;
};

type Fundraiser = {
  id: string;
  title: string;
  slug: string;
  goal: number;
  raised: number;
};

type Organizer = {
  id: string;
  name: string;
  bio: string | null;
  photo: string | null;
};

type Donation = {
  id: string;
  fundraiser_id: string;
  donor_name: string | null;
  donor_email: string | null;
  amount: number;
  status: string;
  created_at: string;
  fundraisers?: { title?: string | null; slug?: string | null } | { title?: string | null; slug?: string | null }[] | null;
};

type TicketOrder = {
  id: string;
  event_id: string;
  buyer_email: string | null;
  buyer_name: string | null;
  quantity: number;
  total_amount: number;
  status: string;
  created_at: string;
  events?: { title?: string | null; slug?: string | null } | { title?: string | null; slug?: string | null }[] | null;
};

type DashboardData = {
  email: string;
  events: Event[];
  fundraisers: Fundraiser[];
  organizers: Organizer[];
  donations: Donation[];
  ticketOrders: TicketOrder[];
};

type DashboardError = {
  error?: string;
};

function isDashboardError(data: DashboardData | DashboardError): data is { error: string } {
  return "error" in data && typeof data.error === "string" && data.error.length > 0;
}

function isDashboardData(data: DashboardData | DashboardError): data is DashboardData {
  return "email" in data && "events" in data && "fundraisers" in data;
}

function money(value: number | null | undefined) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "Date TBA";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function StatCard({
  label,
  value,
  detail,
  tone = "orange",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "orange" | "green" | "zinc";
}) {
  const tones = {
    orange: "text-orange-600 bg-orange-50 border-orange-100",
    green: "text-green-700 bg-green-50 border-green-100",
    zinc: "text-zinc-900 bg-white border-zinc-200",
  };

  return (
    <div className={`rounded-2xl border p-6 shadow-sm ${tones[tone]}`}>
      <p className="text-sm font-black uppercase tracking-wide opacity-70">{label}</p>
      <h3 className="mt-3 text-3xl font-black">{value}</h3>
      <p className="mt-2 text-sm font-semibold opacity-70">{detail}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [ticketOrders, setTicketOrders] = useState<TicketOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/dashboard");

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = (await res.json()) as DashboardData | { error?: string };

      if (isDashboardError(data)) {
        setError(data.error);
        setLoading(false);
        return;
      }

      if (!isDashboardData(data)) {
        setError("Dashboard data could not be loaded.");
        setLoading(false);
        return;
      }

      setEmail(data.email);
      setEvents(data.events || []);
      setFundraisers(data.fundraisers || []);
      setOrganizers(data.organizers || []);
      setDonations(data.donations || []);
      setTicketOrders(data.ticketOrders || []);
      setLoading(false);
    }

    load();
  }, [router]);

  const analytics = useMemo(() => {
    const succeededDonations = donations.filter((donation) => donation.status === "succeeded");
    const validOrders = ticketOrders.filter((order) => order.status !== "cancelled" && order.status !== "refunded");
    const totalRaised = fundraisers.reduce((sum, fundraiser) => sum + Number(fundraiser.raised || 0), 0);
    const totalGoal = fundraisers.reduce((sum, fundraiser) => sum + Number(fundraiser.goal || 0), 0);
    const donationTotal = succeededDonations.reduce((sum, donation) => sum + Number(donation.amount || 0), 0);
    const ticketRevenue = validOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    const ticketCount = validOrders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);

    return {
      totalRaised,
      totalGoal,
      donationTotal,
      donationCount: succeededDonations.length,
      averageDonation: succeededDonations.length ? donationTotal / succeededDonations.length : 0,
      ticketRevenue,
      ticketCount,
      ticketOrderCount: validOrders.length,
      overallProgress: totalGoal ? Math.min(Math.round((totalRaised / totalGoal) * 100), 100) : 0,
    };
  }, [donations, fundraisers, ticketOrders]);

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    await supabase.from("events").delete().eq("id", id);
    setEvents(events.filter((event) => event.id !== id));
    setTicketOrders(ticketOrders.filter((order) => order.event_id !== id));
  }

  async function deleteFundraiser(id: string) {
    if (!confirm("Delete this fundraiser?")) return;
    await supabase.from("fundraisers").delete().eq("id", id);
    setFundraisers(fundraisers.filter((fundraiser) => fundraiser.id !== id));
    setDonations(donations.filter((donation) => donation.fundraiser_id !== id));
  }

  async function deleteOrganizer(id: string) {
    if (!confirm("Delete this organizer profile? Events will remain in your account but will no longer show on this organizer page.")) return;
    await supabase.from("organizers").delete().eq("id", id);
    setOrganizers(organizers.filter((organizer) => organizer.id !== id));
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-lg text-zinc-400">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-orange-600">Command center</p>
            <h1 className="mt-2 text-4xl font-black sm:text-5xl">Dashboard</h1>
            <p className="mt-3 text-zinc-500">{email}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/create-event" className="rounded-xl bg-orange-600 px-5 py-3 text-sm font-black text-white hover:bg-orange-700">
              New Event
            </Link>
            <Link href="/create-fundraiser" className="rounded-xl bg-green-600 px-5 py-3 text-sm font-black text-white hover:bg-green-700">
              New Fundraiser
            </Link>
            <Link href="/create-organizer" className="rounded-xl bg-zinc-950 px-5 py-3 text-sm font-black text-white hover:bg-black">
              New Organizer
            </Link>
            <Link href="/import" className="rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-900 hover:bg-zinc-50">
              Import
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Fundraiser raised" value={money(analytics.totalRaised)} detail={`${analytics.overallProgress}% of ${money(analytics.totalGoal)} goal`} tone="green" />
          <StatCard label="Donations" value={String(analytics.donationCount)} detail={`${money(analytics.averageDonation)} average gift`} tone="green" />
          <StatCard label="Tickets sold" value={String(analytics.ticketCount)} detail={`${money(analytics.ticketRevenue)} ticket revenue`} tone="orange" />
          <StatCard label="Live assets" value={String(events.length + fundraisers.length)} detail={`${events.length} events, ${fundraisers.length} fundraisers`} tone="zinc" />
        </div>

        <div className="mt-10 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Campaign Progress</h2>
                <p className="mt-1 text-sm text-zinc-500">Track fundraiser momentum and manage campaigns.</p>
              </div>
              <Link href="/create-fundraiser" className="text-sm font-black text-green-700 hover:text-green-800">
                Add campaign
              </Link>
            </div>

            {fundraisers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center">
                <p className="text-zinc-500">No fundraisers yet.</p>
                <Link href="/create-fundraiser" className="mt-2 inline-block font-black text-green-700">
                  Start your first fundraiser
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {fundraisers.map((fundraiser) => {
                  const progress = fundraiser.goal ? Math.min(Math.round((fundraiser.raised / fundraiser.goal) * 100), 100) : 0;
                  const campaignDonations = donations.filter((donation) => donation.fundraiser_id === fundraiser.id && donation.status === "succeeded");
                  const latestDonation = campaignDonations[0];

                  return (
                    <div key={fundraiser.id} className="rounded-2xl border border-zinc-200 p-5">
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-xl font-black">{fundraiser.title}</h3>
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">
                              {progress}% funded
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-zinc-500">
                            {money(fundraiser.raised)} raised of {money(fundraiser.goal)} · {campaignDonations.length} donor{campaignDonations.length !== 1 ? "s" : ""}
                          </p>
                          <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-100">
                            <div className="h-full rounded-full bg-green-500" style={{ width: `${progress}%` }} />
                          </div>
                          <p className="mt-3 text-sm text-zinc-500">
                            {latestDonation
                              ? `Latest gift: ${money(latestDonation.amount)} from ${latestDonation.donor_name || "Anonymous"}`
                              : "No recorded donations yet."}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/fundraisers/${fundraiser.slug}`} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-black text-zinc-700 hover:bg-zinc-50">
                            View
                          </Link>
                          <Link href={`/fundraisers/edit/${fundraiser.id}`} className="rounded-xl border border-green-200 px-4 py-2 text-sm font-black text-green-700 hover:bg-green-50">
                            Edit
                          </Link>
                          <button onClick={() => deleteFundraiser(fundraiser.id)} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-600 hover:bg-red-50">
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black">Recent Donor History</h2>
            <p className="mt-1 text-sm text-zinc-500">A quick supporter ledger for your campaigns.</p>

            {donations.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500">
                Donations will appear here after successful Stripe payments.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {donations.slice(0, 8).map((donation) => {
                  const fundraiser = firstRelation(donation.fundraisers);

                  return (
                    <div key={donation.id} className="flex items-start justify-between gap-4 rounded-2xl bg-zinc-50 p-4">
                      <div className="min-w-0">
                        <p className="font-black">{donation.donor_name || "Anonymous"}</p>
                        <p className="mt-1 truncate text-sm text-zinc-500">
                          {fundraiser?.title || "Fundraiser"} · {dateLabel(donation.created_at)}
                        </p>
                        {donation.donor_email && (
                          <p className="mt-1 truncate text-xs font-semibold text-zinc-400">{donation.donor_email}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-black text-green-700">{money(donation.amount)}</p>
                        <p className="mt-1 text-xs font-black uppercase text-zinc-400">{donation.status}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="mt-10 grid gap-8 xl:grid-cols-2">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Events</h2>
                <p className="mt-1 text-sm text-zinc-500">Admin controls for your event listings.</p>
              </div>
              <Link href="/create-event" className="text-sm font-black text-orange-600 hover:text-orange-700">
                Add event
              </Link>
            </div>

            {events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center">
                <p className="text-zinc-500">No events yet.</p>
                <Link href="/create-event" className="mt-2 inline-block font-black text-orange-600">
                  Create your first event
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => {
                  const orders = ticketOrders.filter((order) => order.event_id === event.id);
                  const ticketsSold = orders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
                  const revenue = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

                  return (
                    <div key={event.id} className="rounded-2xl border border-zinc-200 p-5">
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                        <div>
                          <h3 className="text-lg font-black">{event.title}</h3>
                          <p className="mt-1 text-sm text-zinc-500">
                            {event.category || "Event"} · {dateLabel(event.event_date)} {event.city ? `· ${event.city}` : ""}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-zinc-600">
                            {ticketsSold} ticket{ticketsSold !== 1 ? "s" : ""} · {money(revenue)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/events/${event.slug}`} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-black text-zinc-700 hover:bg-zinc-50">
                            View
                          </Link>
                          <Link href={`/events/edit/${event.id}`} className="rounded-xl border border-orange-200 px-4 py-2 text-sm font-black text-orange-700 hover:bg-orange-50">
                            Edit
                          </Link>
                          <button onClick={() => deleteEvent(event.id)} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-600 hover:bg-red-50">
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Organizer Profiles</h2>
                <p className="mt-1 text-sm text-zinc-500">Manage the public profiles behind your campaigns and events.</p>
              </div>
              <Link href="/create-organizer" className="text-sm font-black text-zinc-900 hover:text-orange-600">
                Add organizer
              </Link>
            </div>

            {organizers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center">
                <p className="text-zinc-500">No organizer profiles yet.</p>
                <Link href="/create-organizer" className="mt-2 inline-block font-black text-orange-600">
                  Create your first organizer profile
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {organizers.map((organizer) => (
                  <div key={organizer.id} className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 p-5">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200">
                        {organizer.photo ? (
                          <img src={organizer.photo} alt={organizer.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="font-black text-zinc-500">{organizer.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-black">{organizer.name}</h3>
                        <p className="truncate text-sm text-zinc-500">{organizer.bio || "Business page"}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link href={`/organizers/${organizer.id}`} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-black text-zinc-700 hover:bg-zinc-50">
                        View
                      </Link>
                      <Link href={`/organizers/${organizer.id}/edit`} className="rounded-xl border border-orange-200 px-4 py-2 text-sm font-black text-orange-700 hover:bg-orange-50">
                        Edit
                      </Link>
                      <button onClick={() => deleteOrganizer(organizer.id)} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-600 hover:bg-red-50">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {ticketOrders.length > 0 && (
          <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black">Recent Ticket Orders</h2>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs font-black uppercase tracking-wide text-zinc-400">
                  <tr>
                    <th className="py-3 pr-4">Buyer</th>
                    <th className="py-3 pr-4">Event</th>
                    <th className="py-3 pr-4">Qty</th>
                    <th className="py-3 pr-4">Amount</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {ticketOrders.slice(0, 10).map((order) => {
                    const event = firstRelation(order.events);

                    return (
                      <tr key={order.id}>
                        <td className="py-4 pr-4 font-semibold">{order.buyer_name || order.buyer_email || "Guest"}</td>
                        <td className="py-4 pr-4 text-zinc-600">{event?.title || "Event"}</td>
                        <td className="py-4 pr-4 text-zinc-600">{order.quantity}</td>
                        <td className="py-4 pr-4 font-black">{money(order.total_amount)}</td>
                        <td className="py-4 pr-4">
                          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black uppercase text-zinc-600">
                            {order.status}
                          </span>
                        </td>
                        <td className="py-4 text-zinc-500">{dateLabel(order.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
