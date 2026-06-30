import FundraiserCard from "@/components/FundraiserCard";
import PublicEmptyState from "@/components/public/PublicEmptyState";
import PublicSearchBar from "@/components/public/PublicSearchBar";
import PublicPagination from "@/components/public/PublicPagination";
import FundraisersFilterSidebar from "@/components/public/FundraisersFilterSidebar";
import { supabase } from "@/lib/supabase";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { HOMEPAGE_SETTING_KEYS, getHomepageSettings } from "@/lib/homepage-hero";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.fund4agoodcause.com"),
  title: "Fundraisers — Fund4Good",
  description: "Support causes and fundraising campaigns near you.",
  openGraph: {
    title: "Fundraisers — Fund4Good",
    description: "Support causes and fundraising campaigns near you.",
    url: "https://www.fund4agoodcause.com/fundraisers",
    siteName: "Fund4Good",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Fund4Good Fundraisers" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
};

const PAGE_SIZE = 12;

export default async function FundraisersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string; categories?: string }>;
}) {
  const filters = await searchParams;
  const query = filters.q?.trim();
  const sort = filters.sort || "newest";
  const page = Math.max(1, parseInt(filters.page || "1", 10) || 1);
  const selectedCategories = filters.categories
    ? filters.categories.split(",").map((c) => c.trim()).filter(Boolean)
    : [];

  const adminClient = createSupabaseAdmin();

  // 1. Fetch CMS Settings & statistics
  const [
    { data: cmsRows },
    { count: activeCampaignsCount },
    { data: raisedData },
    { count: totalDonorsCount }
  ] = await Promise.all([
    adminClient.from("platform_settings").select("key, value").in("key", HOMEPAGE_SETTING_KEYS),
    adminClient.from("fundraisers").select("id", { count: "exact", head: true }),
    adminClient.from("fundraisers").select("raised"),
    adminClient.from("donations").select("id", { count: "exact", head: true }).in("status", ["succeeded", "completed"])
  ]);

  const cms = getHomepageSettings(cmsRows);
  const activeCampaigns = activeCampaignsCount ?? 0;
  const totalRaisedAmount = raisedData?.reduce((sum, f) => sum + Number(f.raised || 0), 0) || 0;
  const totalDonors = totalDonorsCount ?? 0;

  // 2. Fetch Featured Campaigns (Step 2) when browsing without filters
  const { data: featuredFundraisers } = !query
    ? await supabase
        .from("fundraisers")
        .select("id, title, slug, goal, raised, banner, is_featured")
        .eq("is_featured", true)
        .order("raised", { ascending: false })
        .limit(3)
    : { data: null };

  // 3. Fetch main query campaigns (Step 3)
  let fundraisersQuery = supabase
    .from("fundraisers")
    .select("id, title, slug, goal, raised, banner, category, created_at, is_featured", {
      count: "exact",
    });

  if (query) {
    fundraisersQuery = fundraisersQuery.or(`title.ilike.%${query}%,category.ilike.%${query}%`);
  }

  if (selectedCategories.length > 0) {
    fundraisersQuery = fundraisersQuery.in("category", selectedCategories);
  }

  if (sort === "raised") {
    fundraisersQuery = fundraisersQuery.order("raised", { ascending: false });
  } else if (sort === "goal") {
    fundraisersQuery = fundraisersQuery.order("goal", { ascending: false });
  } else {
    fundraisersQuery = fundraisersQuery.order("created_at", { ascending: false });
  }

  const from = (page - 1) * PAGE_SIZE;
  fundraisersQuery = fundraisersQuery.range(from, from + PAGE_SIZE - 1);

  const { data: fundraisers, count: totalCount } = await fundraisersQuery;

  // Fetch donor counts for each fundraiser
  const fundraiserIds = (fundraisers ?? []).map((f) => f.id);
  const donorCounts = new Map<string, number>();

  if (fundraiserIds.length > 0) {
    const { data: donationRows } = await supabase
      .from("donations")
      .select("fundraiser_id")
      .in("fundraiser_id", fundraiserIds)
      .in("status", ["succeeded", "completed"]);

    for (const row of donationRows ?? []) {
      if (row.fundraiser_id) {
        donorCounts.set(row.fundraiser_id, (donorCounts.get(row.fundraiser_id) ?? 0) + 1);
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE));

  function buildHref(updates: Record<string, string>) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sort !== "newest") params.set("sort", sort);
    if (selectedCategories.length > 0) params.set("categories", selectedCategories.join(","));
    Object.entries(updates).forEach(([k, v]) => params.set(k, v));
    return `/fundraisers?${params.toString()}`;
  }

  const FALLBACK =
    "https://images.unsplash.com/photo-1529390079861-591de354faf5?q=80&w=1200&auto=format&fit=crop";

  function money(value: number) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }

  // 4. Fetch Success Stories (Step 4)
  const { data: allCampaigns } = await adminClient
    .from("fundraisers")
    .select("id, title, slug, goal, raised, banner");
  
  const successStories = (allCampaigns ?? [])
    .filter((f) => Number(f.raised || 0) >= Number(f.goal || 1))
    .slice(0, 4);

  if (successStories.length < 4) {
    const successIds = new Set(successStories.map(s => s.id));
    const fallbacks = (allCampaigns ?? [])
      .filter(f => !successIds.has(f.id))
      .sort((a, b) => {
        const percentA = Number(a.raised || 0) / Number(a.goal || 1);
        const percentB = Number(b.raised || 0) / Number(b.goal || 1);
        return percentB - percentA;
      })
      .slice(0, 4 - successStories.length);
    successStories.push(...fallbacks);
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 pb-16">
      {/* ── CMS Hero Banner (Step 1) ── */}
      <section
        className="relative flex min-h-[360px] items-center justify-center bg-cover bg-center px-4 py-16 text-center sm:min-h-[420px] sm:px-12 sm:py-20 lg:min-h-[460px]"
        style={{
          backgroundImage: `url("${cms.fundraisersHeroImageUrl || cms.imageUrl}")`,
        }}
      >
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative w-full max-w-4xl text-white">
          <span className="inline-block rounded-full bg-emerald-600/30 border border-emerald-500/40 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-emerald-300 backdrop-blur-sm">
            {cms.fundraisersHeroEyebrow}
          </span>
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {cms.fundraisersHeroHeadlineLine1}
            {cms.fundraisersHeroHeadlineLine2 && (
              <>
                <br />
                <span className="text-emerald-400">{cms.fundraisersHeroHeadlineLine2}</span>
              </>
            )}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-300 sm:text-lg">
            {cms.fundraisersHeroDescription}
          </p>

          {/* Dynamic statistics */}
          <div className="mx-auto mt-8 flex max-w-md flex-wrap justify-center gap-x-6 gap-y-2 border-t border-white/10 pt-6 text-xs font-bold text-zinc-400 sm:text-sm">
            <span>{activeCampaigns.toLocaleString()} Campaigns</span>
            <span>•</span>
            <span>{money(totalRaisedAmount)} Raised</span>
            <span>•</span>
            <span>{totalDonors.toLocaleString()} Donors</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {/* ── Featured Campaigns Section (Step 2) ── */}
        {!query && featuredFundraisers && featuredFundraisers.length > 0 && (
          <div className="mb-14">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-wider text-emerald-600">Featured Projects</p>
              <h2 className="text-2xl font-black text-zinc-950 sm:text-3xl mt-1">Featured Campaigns</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {featuredFundraisers.map((f) => (
                <FundraiserCard
                  key={f.id}
                  slug={f.slug}
                  title={f.title}
                  raised={f.raised ?? 0}
                  goal={f.goal ?? 0}
                  image={f.banner || FALLBACK}
                  featured
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Browse Campaigns Section (Step 3) ── */}
        <div className="mb-8 border-b border-zinc-200 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">Browse Campaigns</h2>
              <p className="text-sm font-medium text-zinc-500 mt-1">Explore all community fundraisers and find causes to support.</p>
            </div>
          </div>

          <div className="mt-6">
            <PublicSearchBar
              action="/fundraisers"
              defaultQuery={query || ""}
              placeholder="Search fundraisers…"
              showLocation={false}
              className="max-w-xl"
            />
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar */}
          <div className="hidden lg:block w-56 flex-shrink-0">
            <Suspense>
              <FundraisersFilterSidebar
                activeCategories={selectedCategories}
                activeSort={sort}
                resultCount={totalCount ?? 0}
              />
            </Suspense>
          </div>

          {/* Card Grid */}
          <div className="flex-1 min-w-0">
            {/* Mobile: inline category chips */}
            <div className="mb-5 flex flex-wrap gap-2 lg:hidden">
              {["All", ...selectedCategories].map((cat, i) =>
                i === 0 ? (
                  <Link
                    key="all"
                    href="/fundraisers"
                    className={`rounded-full px-4 py-1.5 text-xs font-black ring-1 transition ${
                      selectedCategories.length === 0
                        ? "bg-emerald-600 text-white ring-emerald-600"
                        : "bg-white text-zinc-600 ring-zinc-200"
                    }`}
                  >
                    All
                  </Link>
                ) : (
                  <Link
                    key={cat}
                    href={`/fundraisers?categories=${selectedCategories.filter((c) => c !== cat).join(",")}`}
                    className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-black text-white"
                  >
                    {cat} ×
                  </Link>
                )
              )}
            </div>

            {fundraisers && fundraisers.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {fundraisers.map((fundraiser) => (
                  <FundraiserCard
                    key={fundraiser.id}
                    slug={fundraiser.slug}
                    title={fundraiser.title}
                    raised={fundraiser.raised ?? 0}
                    goal={fundraiser.goal ?? 0}
                    image={fundraiser.banner || FALLBACK}
                    donorCount={donorCounts.get(fundraiser.id)}
                    featured={fundraiser.is_featured === true}
                    category={fundraiser.category ?? undefined}
                  />
                ))}
              </div>
            ) : (
              <PublicEmptyState
                icon="💚"
                title="No fundraisers found"
                description="Try adjusting your keywords or selecting a different category."
                action={{ label: "Start a fundraiser", href: "/create-fundraiser" }}
              />
            )}
          </div>
        </div>

        {/* ── Success Stories Section (Step 4) ── */}
        {successStories.length > 0 && (
          <section className="mt-20 border-t border-zinc-200 pt-16">
            <div className="mb-8">
              <p className="text-xs font-black uppercase tracking-wider text-emerald-600">Making a Difference</p>
              <h2 className="text-3xl font-black text-zinc-950 mt-1">Success Stories</h2>
              <p className="text-sm font-medium text-zinc-500 mt-1">Campaigns that successfully reached or exceeded their goals.</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {successStories.map((f) => (
                <FundraiserCard
                  key={f.id}
                  slug={f.slug}
                  title={f.title}
                  raised={f.raised ?? 0}
                  goal={f.goal ?? 0}
                  image={f.banner || FALLBACK}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Pagination Section (Step 5) ── */}
        {fundraisers && fundraisers.length > 0 && (
          <div className="mt-12 flex justify-center border-t border-zinc-150 pt-8">
            <PublicPagination
              currentPage={page}
              totalPages={totalPages}
              buildHref={(p) => buildHref({ page: String(p) })}
            />
          </div>
        )}
      </div>
    </main>
  );
}
