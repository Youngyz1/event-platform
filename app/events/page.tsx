import EventCard from "@/components/EventCard";
import EventsWhenToggle from "@/app/events/EventsWhenToggle";
import EventsHeroSearch from "@/app/events/EventsHeroSearch";
import TrendingCarousel from "@/app/events/TrendingCarousel";
import TopDestinations from "@/components/events/TopDestinations";
import ExternalEventsCarousel from "@/components/events/ExternalEventsCarousel";
import EventsFilterControls from "@/components/public/EventsFilterControls";
import PublicEmptyState from "@/components/public/PublicEmptyState";
import PublicPagination from "@/components/public/PublicPagination";
import PublicSearchBar from "@/components/public/PublicSearchBar";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { HOMEPAGE_SETTING_KEYS, getHomepageSettings } from "@/lib/homepage-hero";
import {
  getEventList,
  type EventListItem,
  type EventListSort,
} from "@/lib/event-data";
import { searchExternalEvents, type ExternalEvent } from "@/lib/external-events";
import { getVisitorCity } from "@/lib/request-geo";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import {
  ArrowRight,
  Briefcase,
  GraduationCap,
  HandHeart,
  HeartHandshake,
  Laptop,
  Mic,
  Stethoscope,
  Users,
  Tag,
  Music,
  Heart,
  Star,
  Globe,
  Zap,
  BookOpen,
  Coffee,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Mic, Briefcase, GraduationCap, HandHeart, HeartHandshake,
  Laptop, Stethoscope, Users, Tag, Music, Heart, Star, Globe,
  Zap, BookOpen, Coffee,
};

// ---------------------------------------------------------------------------
// Cached data fetchers for events listing page
// ---------------------------------------------------------------------------

const getEventsPageCmsAndStats = unstable_cache(
  async () => {
    const adminClient = createSupabaseAdmin();
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

    return { cms, totalEvents, ticketsSold, activeOrganizers };
  },
  ["events-page-cms-and-stats"],
  { revalidate: 300 }
);

const getCachedEventsCategories = unstable_cache(
  async () => {
    const adminClient = createSupabaseAdmin();
    const { data: dbCats } = await adminClient
      .from("homepage_categories")
      .select("name, icon")
      .eq("is_visible", true)
      .order("position", { ascending: true });
    return dbCats && dbCats.length > 0 ? dbCats : null;
  },
  ["events-page-categories"],
  { revalidate: 300 }
);

const getCachedTrendingRankedEventIds = unstable_cache(
  async () => {
    const adminClient = createSupabaseAdmin();
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

    // Event IDs ranked by all-time ticket sales (descending). Only the
    // (expensive) sales aggregation is cached — the event rows are fetched
    // per-request via getEventList so Trending can be filtered to upcoming-only
    // and de-duplicated against Featured/Browse.
    return Object.keys(salesMap).sort((a, b) => salesMap[b] - salesMap[a]);
  },
  ["events-page-trending-ranked-ids"],
  { revalidate: 600 }
);

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.fund4agoodcause.com"),
  title: "Events — Fund4Good",
  description: "Browse and buy tickets for events near you.",
  openGraph: {
    title: "Events — Fund4Good",
    description: "Browse and buy tickets for events near you.",
    url: "https://www.fund4agoodcause.com/events",
    siteName: "Fund4Good",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Fund4Good Events" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
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
    when?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const filters = await searchParams;
  const query = filters.q?.trim();
  const location = filters.location?.trim();
  const category = filters.category?.trim();
  const activeWhen = filters.when === "weekend" ? "weekend" : "all";
  const sort = filters.sort || "date_asc";
  const page = Math.max(1, parseInt(filters.page || "1", 10) || 1);
  const weekendRange = activeWhen === "weekend" ? getWeekendRange() : null;
  const hasFilters = Boolean(query || location || category || weekendRange);

  // 1. Fetch CMS settings (via cached helper; the hero stats row was removed).
  const { cms } = await getEventsPageCmsAndStats();

  // Recurring events are stored as many separate rows sharing one title (e.g.
  // "30-Day Financial Glow-Up" has 19 monthly occurrences). Collapse them to a
  // single card per title so the same event can't appear twice in a rail.
  const normalizeTitle = (title: string) => title.toLowerCase().replace(/\s+/g, " ").trim();

  // Promo banner event (reuses the homepage CMS `is_homepage_featured` flag) —
  // the single pinned event surfaced in the hero. Null when none is flagged.
  const promoAdmin = createSupabaseAdmin();
  const { data: promoRows } = await promoAdmin
    .from("events")
    .select("title, slug")
    .eq("is_homepage_featured", true)
    .eq("visibility", "public")
    .eq("status", "approved")
    .is("deleted_at", null)
    .order("homepage_position", { ascending: true })
    .limit(1);
  const promo = promoRows?.[0] ?? null;

  // Location-aware heading source (Vercel edge city; null → "Popular Events").
  const visitorCity = await getVisitorCity();

  // 2. Featured events (step 2) — upcoming featured picks, shown only when
  //    browsing without filters. `upcoming: true` keeps past events out of the
  //    most prominent slot. Over-fetch, then dedupe by title to 4.
  const featuredRaw: EventListItem[] = !hasFilters
    ? (await getEventList({ featuredOnly: true, upcoming: true, sort: "date_asc", pageSize: 16 })).events
    : [];
  const featured: EventListItem[] = [];
  const seenFeaturedTitles = new Set<string>();
  for (const event of featuredRaw) {
    const key = normalizeTitle(event.title);
    if (seenFeaturedTitles.has(key)) continue;
    seenFeaturedTitles.add(key);
    featured.push(event);
    if (featured.length >= 4) break;
  }

  // 3. Browse grid (step 3) — the shared list query, excluding the Featured
  //    picks so the same event never renders in both sections.
  const sortParam: EventListSort =
    sort === "date_desc" || sort === "newest" ? sort : "date_asc";
  const { events: browseEvents, total: totalCount } = await getEventList({
    category,
    searchQuery: query,
    location,
    dateFrom: weekendRange ? `${weekendRange.start}T00:00:00` : undefined,
    dateTo: weekendRange ? `${weekendRange.end}T23:59:59` : undefined,
    excludeIds: featured.map((e) => e.id),
    sort: sortParam,
    page,
    pageSize: PAGE_SIZE,
  });

  // 4. Fetch external events (Ticketmaster + SeatGeek, live). `ExternalEvent`
  //    is imported from lib/external-events — the shared multi-source module.
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

  // Call the multi-source lib directly (server-to-server) rather than
  // self-fetching /api/eventbrite — an SSR self-fetch returns empty in dev and
  // adds a needless HTTP hop. Caching + rate-limit handling live in the lib.
  let externalEvents: ExternalEvent[] = [];
  if (query || location || category || weekendRange) {
    const datesToFetch = weekendRange?.dates ?? [null];
    const responses = await Promise.all(
      datesToFetch.map((eventDate) =>
        searchExternalEvents({ query, location, category, date: eventDate })
      )
    );
    externalEvents = responses.flat();
  }

  const supabaseNormalized: LocalEvent[] = browseEvents.map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    event_date: e.eventDate,
    city: e.city ?? e.venue ?? null,
    banner: e.banner,
    category: e.category,
    latitude: e.latitude,
    longitude: e.longitude,
    url: null,
    source: "local",
  }));

  // External (Ticketmaster + SeatGeek) results render in their own section, not
  // merged into the paginated local grid. Drop any that duplicate a local result
  // on this page (or each other) by title+date, then cap the block at 8.
  const eventKey = (e: { title: string; event_date?: string | null }) =>
    `${e.title.toLowerCase().trim()}-${e.event_date || ""}`;
  const seenEventKeys = new Set<string>(supabaseNormalized.map(eventKey));
  const externalResults: ExternalEvent[] = [];
  for (const event of externalEvents) {
    const key = eventKey(event);
    if (seenEventKeys.has(key)) continue;
    seenEventKeys.add(key);
    externalResults.push(event);
    if (externalResults.length >= 8) break;
  }

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE));

  // When a search matches 0 local events but external results exist, the filter
  // sidebar (When / Category / Sort) has nothing to act on — those filters only
  // apply to Fund4Good events. Drop it so the "no local matches" note and the
  // external results section use the full width instead of sitting next to a
  // tall, irrelevant sidebar.
  const hideEventsSidebar =
    supabaseNormalized.length === 0 && externalResults.length > 0;

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

  // 5. Fetch categories (cached)
  let categories = categoryCards;
  const dbCats = await getCachedEventsCategories();
  if (dbCats) {
    categories = dbCats.map((c: any) => ({
      name: c.name,
      icon: ICON_MAP[c.icon] ?? Tag,
    }));
  }

  // 6. Trending events (step 5) — ranked by all-time ticket sales, topped up
  //    with the most recently added events, then paginated in the client
  //    carousel. Deduped by BOTH id and normalized title, and excluded (id +
  //    title) against Featured so the same event can't sit in both prominent
  //    rails. Browse is intentionally NOT excluded here: the distinct-title
  //    pool is small (recurring events collapse to one card), and excluding the
  //    whole Browse page by title starves the rail — mild overlap with the grid
  //    below is fine for a "trending" strip.
  const TRENDING_TARGET = 12;
  const rankedEventIds = await getCachedTrendingRankedEventIds();

  const excludeTrendingIds = new Set<string>(featured.map((e) => e.id));
  const excludeTrendingTitles = new Set<string>(
    featured.map((e) => normalizeTitle(e.title))
  );

  const trendingEvents: EventListItem[] = [];
  const seenTrendingTitles = new Set<string>();
  const addTrending = (candidates: EventListItem[]) => {
    for (const event of candidates) {
      if (trendingEvents.length >= TRENDING_TARGET) break;
      const titleKey = normalizeTitle(event.title);
      if (excludeTrendingIds.has(event.id)) continue;
      if (excludeTrendingTitles.has(titleKey) || seenTrendingTitles.has(titleKey)) continue;
      seenTrendingTitles.add(titleKey);
      trendingEvents.push(event);
    }
  };

  if (rankedEventIds.length > 0) {
    const { events: rankedEvents } = await getEventList({
      ids: rankedEventIds.slice(0, 60),
      pageSize: 60,
    });
    // `.in(...)` doesn't preserve order, so re-rank by ticket sales.
    const byId = new Map(rankedEvents.map((e) => [e.id, e]));
    addTrending(
      rankedEventIds
        .map((id) => byId.get(id))
        .filter((e): e is EventListItem => Boolean(e))
    );
  }
  if (trendingEvents.length < TRENDING_TARGET) {
    // Over-fetch (title-dedupe shrinks the set) to fill remaining slots with
    // the most recently added events.
    const { events: fallback } = await getEventList({
      excludeIds: [...excludeTrendingIds, ...trendingEvents.map((e) => e.id)],
      sort: "newest",
      pageSize: TRENDING_TARGET * 4,
    });
    addTrending(fallback);
  }

  const trendingItems = trendingEvents.map((event) => ({
    id: event.id,
    slug: event.slug,
    title: event.title,
    eventDate: event.eventDate,
    city: event.city,
    venue: event.venue,
    banner: event.banner,
    category: event.category,
  }));

  const locationHeading = visitorCity ? `Events near ${visitorCity}` : "Popular Events";

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 pb-16">
      {/* ── Hero: badge + headline + subtitle + search + promo banner ── */}
      <section className="relative overflow-hidden px-4 py-16 text-center sm:px-12 sm:py-20 lg:py-24">
        {/* Radial gradient glow — Fund4Good dark tones with a soft warm glow
            bleeding in from a corner (not a copy of SeatGeek's red gradient). */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(58% 75% at 82% 12%, rgba(249,115,22,0.30), transparent 60%)," +
              "radial-gradient(55% 70% at 8% 96%, rgba(22,163,74,0.16), transparent 62%)," +
              "#0a0a0b",
          }}
        />
        <div className="relative z-10 mx-auto w-full max-w-3xl text-white">
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

          {/* Search — the visual centerpiece (wired to the nav /search endpoint). */}
          <div className="mx-auto mt-8 max-w-2xl">
            <EventsHeroSearch />
          </div>

          {/* Promo banner — the pinned featured event (is_homepage_featured);
              hidden entirely when nothing is flagged. */}
          {promo && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 text-sm sm:text-base">
              <span className="text-zinc-300">
                <span className="font-black text-white">{promo.title}</span> is here
              </span>
              <Link
                href={`/events/${promo.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-orange-600 px-4 py-1.5 text-xs font-black text-white transition hover:bg-orange-700 sm:text-sm"
              >
                Reserve your seat
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* ── Location-aware heading + Trending Events (paginated in groups of
            4). Heading personalizes to the visitor's city, else "Popular
            Events". ── */}
        {trendingItems.length > 0 && (
          <div className="mb-14">
            <h2 className="mb-6 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
              {locationHeading}
            </h2>
            <TrendingCarousel items={trendingItems} />
          </div>
        )}

        {/* ── Featured Events Section (Step 2) ── */}
        {!hasFilters && featured.length > 0 && (
          <div className="mb-14">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-wider text-orange-600">Handpicked Recommendations</p>
              <h2 className="text-2xl font-black text-zinc-950 sm:text-3xl mt-1">Featured Experiences</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((event) => (
                <EventCard
                  key={event.id}
                  slug={event.slug}
                  title={event.title}
                  date={
                    event.eventDate
                      ? new Date(event.eventDate).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : "Date TBA"
                  }
                  location={event.city || event.venue || "Location TBA"}
                  image={event.banner || ""}
                  badge="Featured"
                  category={event.category}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Categories Section (moved directly under Featured, above Browse) ── */}
        <section className="mb-10 sm:mb-14">
          <div className="mb-6 text-center sm:mb-8">
            <p className="text-xs font-black uppercase tracking-wider text-orange-600 font-bold">Diverse Options</p>
            <h2 className="text-2xl font-black text-zinc-950 mt-1 sm:text-3xl">Search by Category</h2>
          </div>
          {/* Mobile: single swipeable horizontal row (shared overflow-x scroll
              pattern). sm+ keeps the multi-column grid. */}
          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:pb-0 lg:grid-cols-8">
            {categories.map(({ name, icon: Icon }) => (
              <Link
                key={name}
                href={`/events?category=${encodeURIComponent(name)}`}
                className="group flex w-[72px] shrink-0 flex-col items-center text-center transition sm:w-auto"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition group-hover:border-orange-200 group-hover:bg-orange-50 group-hover:text-orange-600 sm:h-20 sm:w-20">
                  <Icon className="h-6 w-6 sm:h-8 sm:w-8" strokeWidth={1.6} />
                </span>
                <span className="mt-3 text-xs font-bold leading-tight text-zinc-950 group-hover:text-orange-600">{name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Browse Events Section (Step 3) — one merged header: heading +
            subtext + search bar + When toggle ── */}
        <div className="mb-5 border-b border-zinc-200 pb-4 sm:mb-6 sm:pb-5">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">Browse Events</h2>
            {/* Subtext restates the heading + fields below it, so drop it on
                mobile to reclaim vertical space; keep it on sm+. */}
            <p className="mt-1 hidden text-sm font-medium text-zinc-500 sm:block">Find experiences near you by location, date, or category.</p>
          </div>

          {/* Search fields temporarily hidden (not deleted) — remove the
              `hidden` class to restore the keyword/location search on the
              Browse Events header. */}
          <div className="mt-4 hidden sm:mt-5">
            <PublicSearchBar
              action="/events"
              defaultQuery={query || ""}
              defaultLocation={location || ""}
              className="max-w-3xl"
              collapsibleOnMobile
            />
          </div>

          <div className="mt-4 sm:mt-5">
            <EventsWhenToggle activeWhen={activeWhen} />
          </div>
        </div>

        {hideEventsSidebar ? (
          // 0 local matches, external results exist: render nothing here (no
          // sidebar to filter, no message box) — flow straight into the
          // "More events elsewhere" carousel below.
          null
        ) : (
            <div>
              {/* Compact filter dropdowns in a header row replace the old sidebar
                  column, so the results grid runs full-width below. */}
              <div className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <p className="text-sm font-bold text-zinc-500">
                  {totalCount ?? 0} {(totalCount ?? 0) === 1 ? "event" : "events"}
                </p>
                <Suspense fallback={null}>
                  <EventsFilterControls activeCategory={category} activeSort={sort} />
                </Suspense>
              </div>

              {supabaseNormalized.length > 0 ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {supabaseNormalized.map((event) => (
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
                      eventDate={event.event_date}
                      location={event.city || "Location TBA"}
                      image={event.banner || ""}
                      category={event.category}
                    />
                  ))}
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
          )
        }

        {/* ── Live external results (Ticketmaster + SeatGeek) — page 1 only ── */}
        {page === 1 && externalResults.length > 0 && (
          // When there are no local results the carousel is the primary content,
          // so keep it tight under the header; when it follows a local grid, give
          // it more breathing room to read as a distinct section.
          <section className={hideEventsSidebar ? "mt-4" : "mt-14"}>
            <ExternalEventsCarousel events={externalResults} />
          </section>
        )}

        {/* ── Top Destinations (explore by city; below the results, above pagination) ── */}
        <TopDestinations />

        {/* ── Pagination Section (Step 6) ── */}
        {browseEvents.length > 0 && (
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
