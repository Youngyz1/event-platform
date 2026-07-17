import PublicPagination from "@/components/public/PublicPagination";
import CampaignShowcase, {
  type CampaignShowcaseItem,
} from "@/components/fundraisers/CampaignShowcase";
import LandingHero from "@/components/fundraisers/LandingHero";
import HowFundraisingWorks from "@/components/fundraisers/HowFundraisingWorks";
import WhyFund4Good from "@/components/fundraisers/WhyFund4Good";
import FundraiserFeaturedTopics from "@/components/fundraisers/FundraiserFeaturedTopics";
import TrustSection from "@/components/fundraisers/TrustSection";
import { supabase } from "@/lib/supabase";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { HOMEPAGE_SETTING_KEYS, getHomepageSettings } from "@/lib/homepage-hero";
import {
  getFundraiserList,
  getCuratedFundraiserImages,
  type FundraiserSmartFilter,
} from "@/lib/fundraiser-data";
import { CURATED_HERO_FUNDRAISER_SLUGS } from "@/lib/fundraiser-hero-curation";
import { normalizeImageUrl } from "@/lib/image-url";
import { money } from "@/lib/format";
import type { Metadata } from "next";

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
  searchParams: Promise<{ q?: string; sort?: string; page?: string; categories?: string; filter?: string }>;
}) {
  const filters = await searchParams;
  const query = filters.q?.trim();
  const sort = filters.sort || "newest";
  const page = Math.max(1, parseInt(filters.page || "1", 10) || 1);
  const selectedCategories = filters.categories
    ? filters.categories.split(",").map((c) => c.trim()).filter(Boolean)
    : [];

  const SMART_FILTERS = ["close-to-target", "just-launched", "needs-momentum", "trending"] as const;
  const smartFilter: FundraiserSmartFilter =
    (SMART_FILTERS as readonly string[]).includes(filters.filter ?? "")
      ? (filters.filter as FundraiserSmartFilter)
      : "all";

  const adminClient = createSupabaseAdmin();

  // 1. Fetch CMS Settings & the live total-raised figure for the hero stat
  const [{ data: cmsRows }, { data: raisedData }] = await Promise.all([
    adminClient.from("platform_settings").select("key, value").in("key", HOMEPAGE_SETTING_KEYS),
    adminClient.from("fundraisers").select("raised"),
  ]);

  const cms = getHomepageSettings(cmsRows);
  const totalRaisedAmount = raisedData?.reduce((sum, f) => sum + Number(f.raised || 0), 0) || 0;

  // 2. Pick a single featured campaign (by highest amount raised) when browsing
  // the default view without a search query — excluded from the grid below so
  // the same campaign never renders twice. Behavioural smart filters skip the
  // featured pin so the ranked results stand on their own.
  const sortParam = sort === "raised" || sort === "goal" ? sort : "newest";

  const featuredItem =
    !query && smartFilter === "all"
      ? (await getFundraiserList({ featuredOnly: true, sort: "raised", pageSize: 1 }))
          .fundraisers[0] ?? null
      : null;

  // 3. Fetch the browse grid (Step 3), excluding the featured pick so it
  // can't appear twice on the same page load.
  const { fundraisers, total: totalCount } = await getFundraiserList({
    categories: selectedCategories,
    excludeIds: featuredItem ? [featuredItem.id] : undefined,
    searchQuery: query,
    sort: sortParam,
    smartFilter,
    page,
    pageSize: PAGE_SIZE,
  });

  // Fetch donor counts for each fundraiser (including the featured pick)
  const fundraiserIds = [
    ...(featuredItem ? [featuredItem.id] : []),
    ...fundraisers.map((f) => f.id),
  ];
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

  const showcaseFeatured: CampaignShowcaseItem | null = featuredItem
    ? {
        id: featuredItem.id,
        slug: featuredItem.slug,
        title: featuredItem.title,
        raised: featuredItem.raised,
        goal: featuredItem.goal,
        image: featuredItem.image,
        category: featuredItem.category,
        organizer: featuredItem.organizer,
        donorCount: donorCounts.get(featuredItem.id),
      }
    : null;

  const showcaseItems: CampaignShowcaseItem[] = fundraisers.map((f) => ({
    id: f.id,
    slug: f.slug,
    title: f.title,
    raised: f.raised,
    goal: f.goal,
    image: f.image,
    category: f.category,
    organizer: f.organizer,
    donorCount: donorCounts.get(f.id),
  }));

  // Hero imagery: admin-managed via /admin/homepage → Fundraisers Landing →
  // Hero Photo Fan (stored in the `fundraisers_hero_images` platform setting).
  // When unset, fall back to the editorially-curated default set so the fan is
  // never empty pre-configuration. Order is preserved; failed URLs drop/reflow
  // client-side in LandingHeroImagery.
  const adminHeroImages = cms.fundraisersHeroImages
    .map((url) => normalizeImageUrl(url, ""))
    .filter((url): url is string => url.length > 0);
  const heroImages =
    adminHeroImages.length > 0
      ? adminHeroImages
      : await getCuratedFundraiserImages(CURATED_HERO_FUNDRAISER_SLUGS);

  function buildHref(updates: Record<string, string>) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sort !== "newest") params.set("sort", sort);
    if (selectedCategories.length > 0) params.set("categories", selectedCategories.join(","));
    if (smartFilter !== "all") params.set("filter", smartFilter);
    Object.entries(updates).forEach(([k, v]) => params.set(k, v));
    return `/fundraisers?${params.toString()}`;
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 pb-16">
      {/* ── Hero (CMS text preserved; layout redesigned) ── */}
      <LandingHero
        eyebrow={cms.fundraisersHeroEyebrow}
        headline={cms.fundraisersHeroHeadlineLine1}
        headlineAccent={cms.fundraisersHeroHeadlineLine2 || undefined}
        primaryCta={{ label: "Start a Fundraiser", href: "/create-fundraiser" }}
        images={heroImages}
        benefitBadge="No platform fee to start"
        impactStatValue={money(totalRaisedAmount)}
        impactStatCaption="raised so far by people rallying behind the causes they care about."
        impactDescription="Get started in just a few minutes - with helpful new tools, it’s easier than ever to pick the perfect title, write a compelling story, and share it with the world."
      />

      {/* ── How fundraising works (organizer-focused, between Hero and Browse) ── */}
      <HowFundraisingWorks />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {/* ── Browse Campaigns Section ── */}
        <div id="browse-campaigns" className="mb-8 scroll-mt-24">
          <h2 className="text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">Browse Campaigns</h2>
          <p className="text-sm font-medium text-zinc-500 mt-1">Explore all community fundraisers and find causes to support.</p>
        </div>

        <CampaignShowcase
          basePath="/fundraisers"
          activeFilter={smartFilter}
          featured={showcaseFeatured}
          items={showcaseItems}
          emptyState={{
            icon: "💚",
            title: "No fundraisers found",
            description: "Try a different filter to discover more campaigns to support.",
            action: { label: "Start a fundraiser", href: "/create-fundraiser" },
          }}
        />

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

      {/* ── Why Fund4Good (coral reassurance band; TrustSection follows later) ── */}
      <WhyFund4Good />

      {/* ── Featured topics (on page background, below the coral band) ── */}
      <FundraiserFeaturedTopics />

      {/* ── Trust band (teal; FAQ + final CTA follow later, before the footer) ── */}
      <TrustSection />
    </main>
  );
}
