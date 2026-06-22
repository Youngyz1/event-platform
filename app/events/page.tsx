import EventCard from "@/components/EventCard";
import MapSection from "@/components/MapSection";
import EventsHeaderControls from "@/app/events/EventsHeaderControls";
import EventsFilterSidebar from "@/components/public/EventsFilterSidebar";
import PublicEmptyState from "@/components/public/PublicEmptyState";
import PublicPagination from "@/components/public/PublicPagination";
import PublicSearchBar from "@/components/public/PublicSearchBar";
import { supabase } from "@/lib/supabase";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { HOMEPAGE_SETTING_KEYS, getHomepageSettings } from "@/lib/homepage-hero";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import * as LucideIcons from "lucide-react";
import {
  Briefcase,
  GraduationCap,
  HandHeart,
  HeartHandshake,
  Laptop,
  Mic,
  Stethoscope,
  Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events Marketplace | Fund4Good",
  description: "Find local events near you. Buy tickets instantly.",
};

const PAGE_SIZE = 12;

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

const categoryCards = [
  { name: "Music", icon: Mic },
  { name: "Business", icon: Briefcase },
  { name: "Education", icon: GraduationCap },
  { name: "Charity", icon: HandHeart },
  { name: "Medical", icon: Stethoscope },
  { name: "Church", icon: HeartHandshake },
  { name: "Community", icon: Users },
  { name: "Technology", icon: Laptop },
];

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    location?: string;
    category?: string;
    view?: string;
    when?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const filters = await searchParams;
  const query = filters.q?.trim();
  const location = filters.location?.trim();
  const category = filters.category?.trim();
  const view = filters.view || "list";
  const activeWhen = filters.when === "weekend" ? "weekend" : "all";
  const sort = filters.sort || "date_asc";
  const page = Math.max(1, parseInt(filters.page || "1", 10) || 1);
  const weekendRange = activeWhen === "weekend" ? getWeekendRange() : null;
  const hasFilters = Boolean(query || location || category || weekendRange);

  const adminClient = createSupabaseAdmin();

  // 1. Fetch CMS settings and statistics
  const [
    { data: cmsRows },
    { count: totalEventsCount },
    { data: ticketSalesData },
    { count: activeOrganizersCount }
  ] = await Promise.all([
    adminClient.from("platform_settings").select("key, value").in("key", HOMEPAGE_SETTING_KEYS),
    adminClient.from("events").select("id", { count: "exact", head: true }).eq("visibility", "public").eq("status", "approved"),
    adminClient.from("ticket_orders").select("quantity").in("status", ["valid", "used"]),
    adminClient.from("organizers").select("id", { count: "exact", head: true }).eq("visibility", "public")
  ]);

  const cms = getHomepageSettings(cmsRows);
  const totalEvents = totalEventsCount ?? 0;
  const ticketsSold = ticketSalesData?.reduce((sum, order) => sum + (order.quantity || 0), 0) || 0;
  const activeOrganizers = activeOrganizersCount ?? 0;

  // 2. Fetch featured events (step 2) when browsing without filters
  const { data: featuredEvents } = !hasFilters
    ? await supabase
        .from("events")
        .select("id, title, slug, event_date, city, venue, banner, category, is_featured")
        .eq("visibility", "public")
        .eq("status", "approved")
        .eq("is_featured", true)
        .order("event_date", { ascending: true })
        .limit(4)
    : { data: null };

  // 3. Fetch main query events (step 3)
  let eventsQuery = supabase
    .from("events")
    .select("*", { count: "exact" })
    .eq("visibility", "public")
    .eq("status", "approved");

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

  if (sort === "date_desc") {
    eventsQuery = eventsQuery.order("event_date", { ascending: false });
  } else if (sort === "newest") {
    eventsQuery = eventsQuery.order("created_at", { ascending: false });
  } else {
    eventsQuery = eventsQuery.order("event_date", { ascending: true });
  }

  const from = (page - 1) * PAGE_SIZE;
  eventsQuery = eventsQuery.range(from, from + PAGE_SIZE - 1);

  const { data: supabaseEvents, count: totalCount } = await eventsQuery;

  // 4. Fetch external events (Ticketmaster API)
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

  const totalPages = Math.max(1, Math.ceil((totalCount ?? allEvents.length) / PAGE_SIZE));

  const buildQuery = (extra: Record<string, string>) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (location) params.set("location", location);
    if (category) params.set("category", category);
    if (activeWhen === "weekend") params.set("when", "weekend");
    if (sort !== "date_asc") params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    Object.entries(extra).forEach(([k, v]) => params.set(k, v));
    return `/events?${params.toString()}`;
  };

  // 5. Fetch categories
  let categories = categoryCards;
  try {
    const { data: dbCats } = await adminClient
      .from("homepage_categories")
      .select("name, icon")
      .eq("is_visible", true)
      .order("position", { ascending: true });
    
    if (dbCats && dbCats.length > 0) {
      categories = dbCats.map((c: any) => ({
        name: c.name,
        icon: (LucideIcons as any)[c.icon] || LucideIcons.Tag,
      }));
    }
  } catch (err) {
    console.error("Failed to query homepage_categories", err);
  }

  // 6. Fetch trending events (step 5)
  const { data: ticketSalesForTrending } = await adminClient
    .from("ticket_orders")
    .select("event_id, quantity")
    .in("status", ["valid", "used"]);

  const salesMap: Record<string, number> = {};
  for (const sale of ticketSalesForTrending ?? []) {
    if (sale.event_id) {
      salesMap[sale.event_id] = (salesMap[sale.event_id] || 0) + (sale.quantity || 0);
    }
  }

  const trendingEventIds = Object.keys(salesMap)
    .sort((a, b) => salesMap[b] - salesMap[a])
    .slice(0, 4);

  let trendingEvents: any[] = [];
  if (trendingEventIds.length > 0) {
    const { data: dbTrending } = await adminClient
      .from("events")
      .select("id, title, slug, event_date, city, venue, banner, category")
      .in("id", trendingEventIds)
      .eq("visibility", "public")
      .eq("status", "approved");
    trendingEvents = dbTrending ?? [];
  }

  if (trendingEvents.length < 4) {
    const skipIds = trendingEvents.map(e => e.id);
    let fallbackQuery = adminClient
      .from("events")
      .select("id, title, slug, event_date, city, venue, banner, category")
      .eq("visibility", "public")
      .eq("status", "approved");
    
    if (skipIds.length > 0) {
      fallbackQuery = fallbackQuery.not("id", "in", `(${skipIds.join(",")})`);
    }
    const { data: dbFallback } = await fallbackQuery
      .order("event_date", { ascending: true })
      .limit(4 - trendingEvents.length);
    if (dbFallback) {
      trendingEvents = [...trendingEvents, ...dbFallback];
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 pb-16">
      {/* ── CMS Hero Banner (Step 1) ── */}
      <section
        className="relative flex min-h-[360px] items-center justify-center bg-cover bg-center px-4 py-16 text-center sm:min-h-[420px] sm:px-12 sm:py-20 lg:min-h-[460px]"
        style={{
          backgroundImage: `url("${cms.eventsHeroImageUrl || cms.imageUrl}")`,
        }}
      >
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative w-full max-w-4xl text-white">
          <span className="inline-block rounded-full bg-orange-600/30 border border-orange-500/40 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-orange-300 backdrop-blur-sm">
            {cms.eventsHeroEyebrow}
          </span>
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {cms.eventsHeroHeadlineLine1}
            {cms.eventsHeroHeadlineLine2 && (
              <>
                <br />
                <span className="text-orange-400">{cms.eventsHeroHeadlineLine2}</span>
              </>
            )}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-300 sm:text-lg">
            {cms.eventsHeroDescription}
          </p>

          {/* Dynamic statistics */}
          <div className="mx-auto mt-8 flex max-w-md flex-wrap justify-center gap-x-6 gap-y-2 border-t border-white/10 pt-6 text-xs font-bold text-zinc-400 sm:text-sm">
            <span>{totalEvents.toLocaleString()} Events</span>
            <span>•</span>
            <span>{ticketsSold.toLocaleString()} Tickets Sold</span>
            <span>•</span>
            <span>{activeOrganizers.toLocaleString()} Organizers</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {/* ── Featured Events Section (Step 2) ── */}
        {!hasFilters && featuredEvents && featuredEvents.length > 0 && (
          <div className="mb-14">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-wider text-orange-600">Handpicked Recommendations</p>
              <h2 className="text-2xl font-black text-zinc-950 sm:text-3xl mt-1">Featured Experiences</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featuredEvents.map((event) => (
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
                  image={
                    event.banner ||
                    "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200&auto=format&fit=crop"
                  }
                  badge="Featured"
                  category={event.category}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Browse Events Section (Step 3) ── */}
        <div className="mb-8 border-b border-zinc-200 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">Browse Events</h2>
              <p className="text-sm font-medium text-zinc-500 mt-1">Find experiences near you by location, date, or category.</p>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm shrink-0">
              <Link
                href={buildQuery({ view: "list" })}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-black transition ${
                  view === "list" ? "bg-orange-600 text-white" : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                List
              </Link>
              <Link
                href={buildQuery({ view: "map" })}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-black transition ${
                  view === "map" ? "bg-orange-600 text-white" : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Map
              </Link>
            </div>
          </div>

          <div className="mt-6">
            <PublicSearchBar
              action="/events"
              defaultQuery={query || ""}
              defaultLocation={location || ""}
              className="max-w-3xl"
            />
          </div>
        </div>

        <EventsHeaderControls location={location || ""} activeWhen={activeWhen} />

        {view === "list" ? (
          <div className="grid gap-8 lg:grid-cols-[220px_1fr] xl:grid-cols-[240px_1fr]">
            <Suspense fallback={null}>
              <EventsFilterSidebar
                activeCategory={category}
                activeSort={sort}
                activeWhen={activeWhen}
                resultCount={totalCount ?? allEvents.length}
              />
            </Suspense>

            <div>
              {allEvents.length > 0 ? (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
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
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })
                            : "Date TBA"
                        }
                        location={event.city || "Location TBA"}
                        image={
                          event.banner ||
                          "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200&auto=format&fit=crop"
                        }
                        category={"category" in event ? event.category : null}
                      />
                    )
                  )}
                </div>
              ) : (
                <PublicEmptyState
                  icon="🎭"
                  title="No events found"
                  description="Try another keyword, category, date, or city."
                  action={{ label: "Create event", href: "/create-event" }}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200">
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

        {/* ── Categories Section (Step 4) ── */}
        <section className="mt-20 border-t border-zinc-200 pt-16">
          <div className="mb-8 text-center">
            <p className="text-xs font-black uppercase tracking-wider text-orange-600 font-bold">Diverse Options</p>
            <h2 className="text-3xl font-black text-zinc-950 mt-1">Search by Category</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
            {categories.map(({ name, icon: Icon }) => (
              <Link
                key={name}
                href={`/events?category=${encodeURIComponent(name)}`}
                className="group flex flex-col items-center text-center transition"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition group-hover:border-orange-200 group-hover:bg-orange-50 group-hover:text-orange-600 sm:h-20 sm:w-20">
                  <Icon className="h-6 w-6 sm:h-8 sm:w-8" strokeWidth={1.6} />
                </span>
                <span className="mt-3 text-xs font-bold leading-tight text-zinc-950 group-hover:text-orange-600">{name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Trending Events Section (Step 5) ── */}
        {trendingEvents.length > 0 && (
          <section className="mt-20 border-t border-zinc-200 pt-16">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-orange-600">Highly Anticipated</p>
                <h2 className="text-3xl font-black text-zinc-950 mt-1">Trending Events</h2>
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {trendingEvents.map((event) => (
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
                  image={
                    event.banner ||
                    "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200&auto=format&fit=crop"
                  }
                  category={event.category}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Pagination Section (Step 6) ── */}
        {view === "list" && allEvents.length > 0 && (
          <div className="mt-12 flex justify-center border-t border-zinc-150 pt-8">
            <PublicPagination
              currentPage={page}
              totalPages={totalPages}
              buildHref={(p) => buildQuery({ page: String(p) })}
            />
          </div>
        )}
      </div>
    </main>
  );
}
