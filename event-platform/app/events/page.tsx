
import EventCard from "@/components/EventCard";
import MapSection from "@/components/MapSection";
import EventsHeaderControls from "@/app/events/EventsHeaderControls";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Events | EventBrithe",
  description: "Find local events near you. Buy tickets instantly.",
};

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekendRange() {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSaturday = day === 0 ? -1 : (6 - day + 7) % 7;
  const saturday = new Date(now);
  saturday.setHours(0, 0, 0, 0);
  saturday.setDate(now.getDate() + daysUntilSaturday);

  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  sunday.setHours(23, 59, 59, 999);

  return {
    start: formatDateKey(saturday),
    end: formatDateKey(sunday),
    dates: [formatDateKey(saturday), formatDateKey(sunday)],
  };
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; location?: string; category?: string; view?: string; when?: string }>;
}) {
  const filters = await searchParams;
  const query = filters.q?.trim();
  const location = filters.location?.trim();
  const category = filters.category?.trim();
  const view = filters.view || "list";
  const activeWhen = filters.when === "weekend" ? "weekend" : "all";
  const weekendRange = activeWhen === "weekend" ? getWeekendRange() : null;

  // FIXED: only show public, approved events on the public listing page
  let eventsQuery = supabase
    .from("events")
    .select("*")
    .eq("visibility", "public")
    .eq("status", "approved")
    .order("event_date", { ascending: true });

  if (query) eventsQuery = eventsQuery.ilike("title", `%${query}%`);
  if (category) eventsQuery = eventsQuery.ilike("category", `%${category}%`);
  if (location)
    eventsQuery = eventsQuery.or(
      `city.ilike.%${location}%,venue.ilike.%${location}%`
    );
  if (weekendRange) {
    eventsQuery = eventsQuery
      .gte("event_date", `${weekendRange.start}T00:00:00`)
      .lte("event_date", `${weekendRange.end}T23:59:59`);
  }

  const { data: supabaseEvents } = await eventsQuery;

  // ── 2. External events from Ticketmaster when any search filter is provided ─
  type ExternalEvent = {
    id: string;
    title: string;
    event_date?: string | null;
    city?: string | null;
    banner?: string | null;
    url: string;
    source: "ticketmaster";
  };

  type LocalEvent = {
    id: string;
    slug: string;
    title: string;
    event_date: string | null;
    city: string | null;
    banner: string | null;
    category: string | null;
    latitude: number | null;
    longitude: number | null;
    url: null;
    source: "local";
  };

  let externalEvents: ExternalEvent[] = [];

  if (query || location || category || weekendRange) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const datesToFetch = weekendRange?.dates ?? [null];
      const responses = await Promise.all(
        datesToFetch.map(async (eventDate) => {
          const ebParams = new URLSearchParams();
          if (query) ebParams.set("q", query);
          if (location) ebParams.set("location", location);
          if (category) ebParams.set("category", category);
          if (eventDate) ebParams.set("date", eventDate);

          const res = await fetch(
            `${baseUrl}/api/eventbrite?${ebParams.toString()}`,
            { next: { revalidate: 300 } }
          );
          const data = (await res.json()) as { events?: ExternalEvent[] };
          return data.events || [];
        })
      );
      externalEvents = responses.flat();
    } catch (e) {
      console.error("Failed to fetch external events:", e);
    }
  }

  // ── 3. Merge & deduplicate by title ─────────────────────────────────
  const supabaseNormalized: LocalEvent[] = (supabaseEvents || []).map((e) => ({
    id: e.id,
    slug: e.slug || e.id,
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

  const seenEventKeys = new Set<string>();
  const allEvents: Array<LocalEvent | ExternalEvent> = [...supabaseNormalized, ...externalEvents]
    .filter((event) => {
      const key = `${event.title.toLowerCase().trim()}-${event.event_date || ""}`;
      if (seenEventKeys.has(key)) return false;
      seenEventKeys.add(key);
      return true;
    });

  const buildQuery = (extra: Record<string, string>) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (location) params.set("location", location);
    if (category) params.set("category", category);
    if (activeWhen === "weekend") params.set("when", "weekend");
    Object.entries(extra).forEach(([k, v]) => params.set(k, v));
    return `/events?${params.toString()}`;
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
       

      <section className="mx-auto max-w-7xl px-6 py-14">
        <EventsHeaderControls location={location || ""} activeWhen={activeWhen} />

        {/* View Toggle */}
        <div className="mb-6 flex items-center justify-end">
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
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {allEvents.map((event) =>
                  event.source === "ticketmaster" ? (
                    <Link
                      key={event.id}
                      href={`/external-events/ticketmaster/${encodeURIComponent(event.id.replace(/^tm_/, ""))}`}
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
                      />
                    </Link>
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
                  Try another keyword, category, date, or city.
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

    </main>
  );
}
