import Link from "next/link";
import EventCard from "@/components/EventCard";
import FundraiserCard from "@/components/FundraiserCard";
import Footer from "@/components/Footer";
import LocationSearch from "@/components/LocationSearch";
import NearbyEvents from "@/components/NearbyEvents";
import { supabase } from "@/lib/supabase";

const categories = [
  { label: "Music",                    icon: "ti-microphone" },
  { label: "Nightlife",                icon: "ti-disco-ball" },
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
      <section id="about" className="relative h-[460px] w-full overflow-hidden md:h-[520px]">
        <img
          src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=1600&auto=format&fit=crop"
          alt="concert"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 flex flex-col justify-center h-full max-w-7xl mx-auto px-6">
          <p className="inline-block bg-orange-500 text-white text-sm font-bold px-3 py-1 mb-4 w-fit">
            DISCOVER • BOOK • FUNDRAISE
          </p>
          <h1 className="max-w-2xl text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
            <span className="bg-orange-500/80 px-2">FROM POP BALLADS</span>
            <br />
            <span className="bg-white/20 px-2">TO TECH SUMMITS</span>
          </h1>
          <Link
            href="/events"
            className="mt-8 bg-white text-black px-8 py-4 rounded-full font-bold text-lg w-fit hover:bg-orange-500 hover:text-white transition"
          >
            Explore Events
          </Link>
        </div>
      </section>

      {/* SEARCH BAR */}
      <section className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <form action="/events" className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <input name="q" type="text" placeholder="Search events"
              className="border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-orange-500" />
            <input name="location" type="text" placeholder="Location"
              className="border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-orange-500" />
            <input name="date" type="date"
              className="border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-orange-500" />
            <button className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition">
              Search
            </button>
          </div>
        </form>

        <div className="mt-4">
          <LocationSearch />
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="max-w-7xl mx-auto px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex items-start justify-between gap-6 overflow-x-auto pb-4 scrollbar-hide">
          {categories.map(({ label, icon }) => (
            <Link
              href={`/events?category=${encodeURIComponent(label)}`}
              key={label}
              className="flex flex-col items-center gap-3 min-w-[100px] group"
            >
              <div className="w-24 h-24 rounded-full border border-zinc-200 bg-white flex items-center justify-center group-hover:border-orange-400 group-hover:bg-orange-50 transition">
                <i className={`ti ${icon} text-3xl text-zinc-500 group-hover:text-orange-500 transition`} aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold text-center text-zinc-700 group-hover:text-orange-500 transition leading-tight">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* NEARBY EVENTS — location-aware, client-side */}
      <NearbyEvents />

      {/* ACTIVE FUNDRAISERS */}
      <section className="max-w-7xl mx-auto px-4 py-14 sm:px-6 sm:py-20">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-3xl font-black sm:text-4xl">Active Fundraisers</h2>
          <Link href="/fundraisers" className="text-green-600 font-semibold hover:text-green-700">
            View all
          </Link>
        </div>

        {fundraisers && fundraisers.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
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
            <a href="/create-fundraiser" className="text-green-600 font-semibold">Start one.</a>
          </p>
        )}
      </section>

      {/* COMMUNITY EVENTS — your own Supabase events */}
      <section className="max-w-7xl mx-auto px-4 py-12 sm:px-6">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-black sm:text-4xl">Events</h2>
            <p className="text-sm text-zinc-500 mt-1">Discover events happening near you</p>
          </div>
          <Link href="/events" className="text-orange-500 font-semibold hover:text-orange-600">
            View all
          </Link>
        </div>

        {events && events.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
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