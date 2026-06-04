import Link from "next/link";
import EventCard from "@/components/EventCard";
import FundraiserCard from "@/components/FundraiserCard";
import Footer from "@/components/Footer";
import LocationSearch from "@/components/LocationSearch";
import NearbyEvents from "@/components/NearbyEvents";
import { supabase } from "@/lib/supabase";

const categories = [
  { label: "Music",                    icon: "ti-microphone" },
  { label: "Nightlife",                icon: "ti-moon-stars" },
  { label: "Performing & Visual Arts", icon: "ti-masks-theater" },
  { label: "Holidays",                 icon: "ti-calendar-event" },
  { label: "Dating",                   icon: "ti-heart" },
  { label: "Hobbies",                  icon: "ti-device-gamepad-2" },
  { label: "Business",                 icon: "ti-briefcase" },
  { label: "Food & Drink",             icon: "ti-tools-kitchen-2" },
];

const nearbyCities = [
  "Newark",
  "Jersey City",
  "Montclair",
  "Hoboken",
  "Atlantic City",
  "Princeton",
  "Trenton",
  "Asbury Park",
  "Morristown",
  "New Brunswick",
  "Philadelphia",
  "Wilmington",
];

export default async function HomePage() {
  const [{ data: events }, { data: fundraisers }] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("fundraisers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  return (
    <main className="min-h-screen bg-white text-black">

      {/* HERO */}
      <section id="about" className="relative h-[220px] w-full overflow-hidden sm:h-[420px] md:h-[520px]">
        <img
          src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=1600&auto=format&fit=crop"
          alt="concert"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 flex h-full max-w-7xl flex-col justify-center px-4 sm:mx-auto sm:px-6">
          <p className="mb-2 inline-block w-fit bg-orange-500 px-2.5 py-1 text-[11px] font-bold text-white sm:mb-4 sm:px-3 sm:text-sm">
            DISCOVER • BOOK • FUNDRAISE
          </p>
          <h1 className="max-w-xl text-2xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
            <span className="bg-orange-500/80 px-2">FROM POP BALLADS</span>
            <br />
            <span className="bg-white/20 px-2">TO TECH SUMMITS</span>
          </h1>
          <Link
            href="/events"
            className="mt-4 w-fit rounded-full bg-white px-5 py-2.5 text-sm font-black text-black transition hover:bg-orange-500 hover:text-white sm:mt-8 sm:px-8 sm:py-4 sm:text-lg"
          >
            Explore Events
          </Link>
        </div>
      </section>

      {/* SEARCH BAR */}
      <section className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-8">
        <form action="/events" className="rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-sm sm:p-4">
          <div className="grid gap-2 sm:gap-3 md:grid-cols-[1fr_1fr_180px_140px]">
            <label className="relative block">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-lg text-zinc-400" aria-hidden="true" />
              <input
                name="q"
                type="text"
                placeholder="Search events"
                className="w-full rounded-xl border border-zinc-200 px-10 py-2.5 text-sm font-semibold outline-none focus:border-orange-500 sm:py-3"
              />
            </label>
            <label className="relative block">
              <i className="ti ti-map-pin absolute left-3 top-1/2 -translate-y-1/2 text-lg text-zinc-400" aria-hidden="true" />
              <input
                name="location"
                type="text"
                placeholder="Location"
                className="w-full rounded-xl border border-zinc-200 px-10 py-2.5 text-sm font-semibold outline-none focus:border-orange-500 sm:py-3"
              />
            </label>
            <label className="relative hidden sm:block">
              <i className="ti ti-calendar-event absolute left-3 top-1/2 -translate-y-1/2 text-lg text-zinc-400" aria-hidden="true" />
              <input
                name="date"
                type="date"
                className="w-full rounded-xl border border-zinc-200 px-10 py-3 text-sm font-semibold outline-none focus:border-orange-500"
              />
            </label>
            <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-black text-white transition hover:bg-orange-600 sm:py-3">
              <i className="ti ti-search text-lg" aria-hidden="true" />
              Search
            </button>
          </div>
        </form>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-10">
        <div className="flex items-start gap-4 overflow-x-auto pb-3 scrollbar-hide sm:justify-between sm:gap-6">
          {categories.map(({ label, icon }) => (
            <Link
              href={`/events?category=${encodeURIComponent(label)}`}
              key={label}
              className="group flex min-w-[70px] flex-col items-center gap-2 sm:min-w-[100px] sm:gap-3"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-200 bg-white transition group-hover:border-orange-400 group-hover:bg-orange-50 sm:h-24 sm:w-24">
                <i className={`ti ${icon} text-2xl text-zinc-500 transition group-hover:text-orange-500 sm:text-3xl`} aria-hidden="true" />
              </div>
              <span className="max-w-[82px] text-center text-[11px] font-black leading-tight text-zinc-700 transition group-hover:text-orange-500 sm:text-sm">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* COMMUNITY EVENTS — your own Supabase events */}
      <section className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-12">
        <div className="mb-5 flex items-center justify-between sm:mb-10">
          <div>
            <p className="mb-1 text-xs font-black uppercase tracking-wide text-orange-600 sm:text-sm">Events</p>
            <h2 className="text-2xl font-black sm:text-4xl">Events Near You</h2>
            <p className="text-sm text-zinc-500 mt-1">Discover events happening near you</p>
          </div>
          <Link href="/events" className="shrink-0 text-sm font-black text-orange-500 hover:text-orange-600 sm:text-base">
            View all
          </Link>
        </div>

        {events && events.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {events.map((e) => (
              <EventCard
                key={e.id}
                slug={e.slug}
                title={e.title}
                date={e.event_date
                  ? new Date(e.event_date).toLocaleDateString("en-US", {
                      weekday: "short", month: "short", day: "numeric",
                    })
                  : "Date TBA"}
                location={e.city || e.venue || "Location TBA"}
                image={e.banner || "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200&auto=format&fit=crop"}
              />
            ))}
          </div>
        ) : (
          <p className="text-zinc-500">
            No events yet.{" "}
            <a href="/create-event" className="text-orange-500 font-semibold">Create one.</a>
          </p>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-3 py-2 sm:px-6 sm:py-8">
        <LocationSearch />
      </section>

      {/* NEARBY EVENTS — location-aware, client-side */}
      <NearbyEvents />

      {/* ACTIVE FUNDRAISERS */}
      <section className="mx-auto max-w-7xl px-3 py-10 sm:px-6 sm:py-20">
        <div className="mb-6 flex items-center justify-between sm:mb-10">
          <h2 className="text-2xl font-black sm:text-4xl">Active Fundraisers</h2>
          <Link href="/fundraisers" className="text-sm font-black text-green-600 hover:text-green-700 sm:text-base">
            View all
          </Link>
        </div>

        {fundraisers && fundraisers.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {fundraisers.map((f) => (
              <FundraiserCard
                key={f.id}
                slug={f.slug}
                title={f.title}
                raised={f.raised ?? 0}
                goal={f.goal ?? 0}
                image={f.banner || "https://images.unsplash.com/photo-1529390079861-591de354faf5?q=80&w=1200&auto=format&fit=crop"}
              />
            ))}
          </div>
        ) : (
          <p className="text-zinc-500">
            No fundraisers yet.{" "}
            <a href="/create-fundraiser" className="font-semibold text-green-600">Start one.</a>
          </p>
        )}
      </section>

      {/* THINGS TO DO */}
      <section className="bg-zinc-50 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-black text-blue-600 md:text-4xl">
            Things to do around New Jersey
          </h2>
          <div className="mt-10 overflow-x-auto pb-3">
            <div className="grid min-w-[760px] grid-flow-col grid-rows-2 auto-cols-max gap-4 md:min-w-[920px] md:gap-5">
              {nearbyCities.map((city) => (
                <Link
                  key={city}
                  href={`/things-to-do/${encodeURIComponent(city)}`}
                  className="inline-flex items-center gap-3 rounded-full bg-white px-6 py-4 text-base font-black text-zinc-950 shadow-sm ring-1 ring-zinc-100 transition hover:text-blue-600 hover:shadow-md"
                >
                  Things to do in {city}
                  <span className="text-xl text-zinc-500">↗</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
