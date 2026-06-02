import Navbar from "@/components/Navbar";
import EventCard from "@/components/EventCard";
import Footer from "@/components/Footer";
import MapSection from "@/components/MapSection";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; location?: string; category?: string; date?: string; view?: string }>;
}) {
  const filters = await searchParams;
  const query = filters.q?.trim();
  const location = filters.location?.trim();
  const category = filters.category?.trim();
  const date = filters.date?.trim();
  const view = filters.view || "list";

  // ── 1. Supabase events ──────────────────────────────────────────────
  let eventsQuery = supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });

  if (query) eventsQuery = eventsQuery.ilike("title", `%${query}%`);
  if (category) eventsQuery = eventsQuery.ilike("category", `%${category}%`);
  if (location)
    eventsQuery = eventsQuery.or(
      `city.ilike.%${location}%,venue.ilike.%${location}%`
    );
  if (date) {
    eventsQuery = eventsQuery
      .gte("event_date", `${date}T00:00:00`)
      .lte("event_date", `${date}T23:59:59`);
  }

  const { data: supabaseEvents } = await eventsQuery;

  // ── 2. Eventbrite events (only when location is provided) ───────────
  type EventbriteEvent = {
    id: string;
    title: string;
    event_date?: string | null;
    city?: string | null;
    banner?: string | null;
    url: string;
    source: "eventbrite";
  };

  let eventbriteEvents: EventbriteEvent[] = [];

  if (location) {
    try {
      const ebParams = new URLSearchParams({ location });
      if (query) ebParams.set("q", query);
      if (date) ebParams.set("date", date);

      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const res = await fetch(
        `${baseUrl}/api/eventbrite?${ebParams.toString()}`,
        { next: { revalidate: 300 } }
      );
      const data = (await res.json()) as { events?: EventbriteEvent[] };
      eventbriteEvents = data.events || [];
    } catch (e) {
      console.error("Failed to fetch Eventbrite events:", e);
    }
  }

  // ── 3. Merge & deduplicate by title ─────────────────────────────────
  const supabaseNormalized = (supabaseEvents || []).map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    event_date: e.event_date ?? null,
    city: e.city ?? e.venue ?? null,
    banner: e.banner ?? null,
    category: e.category ?? null,
    latitude: e.latitude ?? null,
    longitude: e.longitude ?? null,
    url: null,
    source: "local",
  }));

  const allEvents = [...supabaseNormalized, ...eventbriteEvents];

  const hasFilters = !!(query || location || category || date);
  const buildQuery = (extra: Record<string, string>) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (location) params.set("location", location);
    if (category) params.set("category", category);
    if (date) params.set("date", date);
    Object.entries(extra).forEach(([k, v]) => params.set(k, v));
    return `/events?${params.toString()}`;
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <Navbar />

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-8">
          <p className="text-sm font-black uppercase tracking-wide text-orange-600">Events</p>
          <h1 className="mt-2 text-5xl font-black">Browse Events</h1>
          <p className="mt-4 max-w-2xl text-lg text-zinc-600">
            Find local events, imported Eventbrite listings, and community gatherings.
          </p>
        </div>

        {/* Search Form */}
        <form
          action="/events"
          className="mb-8 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-4">
            <input
              name="q"
              defaultValue={query}
              type="text"
              placeholder="Search events"
              className="rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-orange-500"
            />
            <input
              name="location"
              defaultValue={location}
              type="text"
              placeholder="City (e.g. Riverside, CA)"
              className="rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-orange-500"
            />
            <input
              name="date"
              defaultValue={date}
              type="date"
              className="rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-orange-500"
            />
            <button className="rounded-xl bg-orange-500 font-bold text-white transition hover:bg-orange-600">
              Search
            </button>
          </div>
          <input type="hidden" name="view" value={view} />
        </form>

        {/* View Toggle */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-zinc-500 font-semibold">
            {allEvents.length} event{allEvents.length !== 1 ? "s" : ""} found
            {hasFilters && " for your search"}
            {location && eventbriteEvents.length > 0 && (
              <span className="ml-2 text-orange-500">
                (includes {eventbriteEvents.length} from Eventbrite)
              </span>
            )}
          </p>
          <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl p-1 shadow-sm">
            <Link
              href={buildQuery({ view: "list" })}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition ${
                view === "list" ? "bg-orange-500 text-white" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              List
            </Link>
            <Link
              href={buildQuery({ view: "map" })}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition ${
                view === "map" ? "bg-orange-500 text-white" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Map
            </Link>
          </div>
        </div>

        {/* List View */}
        {view === "list" && (
          <>
            {allEvents.length > 0 ? (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {allEvents.map((event) =>
                  event.source === "eventbrite" ? (
                    // Eventbrite events open in a new tab
                    <a
                      key={event.id}
                      href={event.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <EventCard
                        slug={null}
                        title={event.title}
                        date={
                          event.event_date
                            ? new Date(event.event_date).toLocaleDateString("en-US", {
                                weekday: "short", month: "short", day: "numeric",
                              })
                            : "Date TBA"
                        }
                        location={event.city || "Location TBA"}
                        image={
                          event.banner ||
                          "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200&auto=format&fit=crop"
                        }
                        badge="Eventbrite"
                      />
                    </a>
                  ) : (
                    <EventCard
                      key={event.id}
                      slug={event.slug ?? null}
                      title={event.title}
                      date={
                        event.event_date
                          ? new Date(event.event_date).toLocaleDateString("en-US", {
                              weekday: "short", month: "short", day: "numeric",
                            })
                          : "Date TBA"
                      }
                      location={event.city || "Location TBA"}
                      image={
                        event.banner ||
                        "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200&auto=format&fit=crop"
                      }
                    />
                  )
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-8 py-16 text-center">
                <p className="text-4xl mb-4">🎭</p>
                <h2 className="text-2xl font-black">No events found.</h2>
                <p className="mt-2 text-zinc-500">
                  Try searching with a city name to pull Eventbrite listings.
                </p>
                <Link
                  href="/create-event"
                  className="mt-6 inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold transition"
                >
                  Create Event
                </Link>
              </div>
            )}
          </>
        )}

        {/* Map View — only local events have coordinates */}
        {view === "map" && (
          <div className="rounded-2xl overflow-hidden">
            <MapSection
              events={supabaseNormalized.map((e) => ({
                id: e.id,
                slug: e.slug,
                title: e.title,
                latitude: e.latitude ?? null,
                longitude: e.longitude ?? null,
                event_date: e.event_date ?? null,
                city: e.city ?? null,
                banner: e.banner ?? null,
                category: e.category ?? null,
              }))}
              height="580px"
            />
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}