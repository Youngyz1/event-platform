import Link from "next/link";
import EventCard from "@/components/EventCard";
import FundraiserCard from "@/components/FundraiserCard";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";

const categories = [
  "Music",
  "Business",
  "Education",
  "Charity",
  "Medical",
  "Church",
  "Community",
  "Technology",
];

const platformRoles = [
  {
    title: "Attendees",
    description: "Find events, buy tickets, support causes, and keep every QR ticket in one place.",
    items: ["Buy tickets", "Donate to campaigns", "Follow organizers", "Save events"],
    accent: "orange",
  },
  {
    title: "Organizers",
    description: "Launch events and fundraisers with ticketing, campaign pages, and analytics built in.",
    items: ["Create events", "Sell tickets", "Run fundraisers", "View analytics"],
    accent: "green",
  },
  {
    title: "Sponsors",
    description: "Discover campaigns and events worth backing, then manage sponsorship opportunities.",
    items: ["Browse campaigns", "Browse events", "Offer sponsorships", "Manage requests"],
    accent: "blue",
  },
  {
    title: "Admins",
    description: "Operate the marketplace with oversight tools for trust, approvals, and platform metrics.",
    items: ["Verify organizers", "Manage disputes", "Approve withdrawals", "View metrics"],
    accent: "zinc",
  },
];

function money(value: number | null | undefined) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-3xl font-black tracking-tight text-zinc-950">{value}</p>
      <p className="mt-2 text-sm font-bold text-zinc-500">{label}</p>
    </div>
  );
}

function RoleCard({
  title,
  description,
  items,
  accent,
}: {
  title: string;
  description: string;
  items: string[];
  accent: string;
}) {
  const accents: Record<string, string> = {
    orange: "bg-orange-50 text-orange-700",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    zinc: "bg-zinc-100 text-zinc-700",
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${accents[accent]}`}>
        {title}
      </span>
      <p className="mt-4 text-lg font-black text-zinc-950">{description}</p>
      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-3 text-sm font-bold text-zinc-600">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function HomePage() {
  const [{ data: events }, { data: fundraisers }, { data: donations }, { data: ticketOrders }, { data: organizers }] = await Promise.all([
    supabase.from("events").select("*").order("created_at", { ascending: false }).limit(6),
    supabase.from("fundraisers").select("*").order("created_at", { ascending: false }).limit(3),
    supabase.from("donations").select("amount, status"),
    supabase.from("ticket_orders").select("quantity, status"),
    supabase.from("organizers").select("id"),
  ]);

  const totalFundsRaised = [
    ...(fundraisers || []).map((fundraiser) => Number(fundraiser.raised || 0)),
    ...(donations || []).filter((donation) => donation.status === "succeeded").map((donation) => Number(donation.amount || 0)),
  ].reduce((sum, amount) => sum + amount, 0);
  const totalTicketsSold = (ticketOrders || [])
    .filter((order) => order.status !== "cancelled" && order.status !== "refunded")
    .reduce((sum, order) => sum + Number(order.quantity || 0), 0);
  const activeCampaigns = fundraisers?.length || 0;
  const activeOrganizers = organizers?.length || 0;

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <section className="relative overflow-hidden bg-zinc-950">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1800&auto=format&fit=crop)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-zinc-950/35" />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
          <div className="flex flex-col justify-center">
            <p className="w-fit rounded-full bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-wide text-white">
              Events • Fundraising • Sponsorships
            </p>
            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
              Sell Tickets. Raise Funds. Find Sponsors.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-200">
              EventBrithe helps organizers launch events, run crowdfunding campaigns, validate QR tickets, and connect with sponsors while attendees discover experiences and support causes.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create-event" className="rounded-xl bg-orange-600 px-5 py-3 text-sm font-black text-white transition hover:bg-orange-700">
                Create Event
              </Link>
              <Link href="/create-fundraiser" className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700">
                Start Fundraiser
              </Link>
              <Link href="/events" className="rounded-xl bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-100">
                Browse Events
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/95 p-4 shadow-2xl shadow-black/20 backdrop-blur">
            <form action="/events" className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-sm font-black uppercase tracking-wide text-orange-600">Search events</p>
              <div className="mt-4 grid gap-3">
                <input
                  name="q"
                  type="search"
                  placeholder="Search events, concerts, workshops"
                  className="rounded-xl border border-zinc-200 px-4 py-3 font-semibold outline-none focus:border-orange-500"
                />
                <input
                  name="location"
                  type="search"
                  placeholder="City or venue"
                  className="rounded-xl border border-zinc-200 px-4 py-3 font-semibold outline-none focus:border-orange-500"
                />
                <button className="rounded-xl bg-zinc-950 px-4 py-3 font-black text-white transition hover:bg-black">
                  Find Events
                </button>
              </div>
            </form>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {categories.slice(0, 6).map((category) => (
                <Link
                  key={category}
                  href={`/events?category=${encodeURIComponent(category)}`}
                  className="rounded-xl bg-zinc-50 px-4 py-3 text-sm font-black text-zinc-700 ring-1 ring-zinc-200 transition hover:text-orange-600"
                >
                  {category}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatBlock label="Total funds raised" value={money(totalFundsRaised)} />
          <StatBlock label="Total tickets sold" value={String(totalTicketsSold)} />
          <StatBlock label="Active organizers" value={String(activeOrganizers)} />
          <StatBlock label="Successful campaigns" value={String(activeCampaigns)} />
        </div>
      </section>

      <section className="bg-zinc-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-wide text-orange-600">One platform</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Built for everyone in the event economy.</h2>
            <p className="mt-4 text-lg leading-8 text-zinc-600">
              Attendees, organizers, sponsors, and admins each get a focused workflow instead of a pile of disconnected tools.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {platformRoles.map((role) => (
              <RoleCard key={role.title} {...role} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-orange-600">Events</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight">Discover events</h2>
            <p className="mt-2 text-zinc-600">Buy tickets, save events, and explore local organizers.</p>
          </div>
          <Link href="/events" className="text-sm font-black text-orange-600 hover:text-orange-700">
            View all events
          </Link>
        </div>

        {events && events.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard
                key={event.id}
                slug={event.slug}
                title={event.title}
                date={
                  event.event_date
                    ? new Date(event.event_date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })
                    : "Date TBA"
                }
                location={event.city || event.venue || "Location TBA"}
                image={event.banner || "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200&auto=format&fit=crop"}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center">
            <h3 className="text-2xl font-black">No events yet.</h3>
            <Link href="/create-event" className="mt-4 inline-block rounded-xl bg-orange-600 px-5 py-3 font-black text-white">
              Create the first event
            </Link>
          </div>
        )}
      </section>

      <section className="bg-zinc-950 px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-emerald-400">Fundraising</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight">Crowdfunding for causes, communities, and events.</h2>
            <p className="mt-4 text-zinc-300">
              Campaigns can tell a story, show progress, collect donations, and keep supporters engaged.
            </p>
            <Link href="/fundraisers" className="mt-6 inline-block rounded-xl bg-white px-5 py-3 text-sm font-black text-zinc-950">
              Browse campaigns
            </Link>
          </div>

          {fundraisers && fundraisers.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-3">
              {fundraisers.map((fundraiser) => (
                <FundraiserCard
                  key={fundraiser.id}
                  slug={fundraiser.slug}
                  title={fundraiser.title}
                  raised={fundraiser.raised ?? 0}
                  goal={fundraiser.goal ?? 0}
                  image={fundraiser.banner || "https://images.unsplash.com/photo-1529390079861-591de354faf5?q=80&w=1200&auto=format&fit=crop"}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-10">
              <h3 className="text-2xl font-black">No fundraisers yet.</h3>
              <Link href="/create-fundraiser" className="mt-4 inline-block rounded-xl bg-emerald-600 px-5 py-3 font-black text-white">
                Start one
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-3 lg:px-8">
        {[
          ["Event Creation Wizard", "Details, venue, date, ticket types, and publish flow for organizers."],
          ["Sponsor Marketplace", "Gold and Silver sponsorship packages businesses can browse and apply to."],
          ["QR Ticket Validation", "Mobile-friendly QR codes, staff check-in, and entry statistics."],
        ].map(([title, description]) => (
          <div key={title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-black">{title}</h3>
            <p className="mt-3 leading-7 text-zinc-600">{description}</p>
            {title === "Sponsor Marketplace" && (
              <Link href="/sponsors" className="mt-5 inline-block text-sm font-black text-orange-600 hover:text-orange-700">
                Explore sponsors
              </Link>
            )}
          </div>
        ))}
      </section>

      <Footer />
    </main>
  );
}
