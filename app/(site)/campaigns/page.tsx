import Link from "next/link";
import type { Metadata } from "next";
import PublicPageHeader from "@/components/public/PublicPageHeader";
import PublicEmptyState from "@/components/public/PublicEmptyState";
import CampaignBrowseList from "@/components/fundraisers/CampaignBrowseList";
import ShowcaseControls from "@/components/fundraisers/ShowcaseControls";
import { getFundraiserList } from "@/lib/fundraiser-data";
import { getDonationCounts } from "@/lib/donation-counts";
import { resolveSmartFilter } from "@/lib/smart-filters";
import { CAMPAIGN_CATEGORIES, categoryFromSlug, categoryToSlug } from "@/lib/categories";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse Campaigns — Fund4Good",
  description: "Browse fundraising campaigns by status — trending, just launched, close to target, and more.",
};

// Pagination was removed platform-wide, so this is a single generous batch
// rather than a paged list.
const BROWSE_PAGE_SIZE = 100;

/**
 * Campaign browse page. The primary axis is campaign **status** (trending,
 * just launched, close to target…), not category — picking a browse option
 * immediately shows the matching campaigns as one flat list. Category is
 * per-campaign metadata (badge on each row) and an optional secondary filter
 * that narrows within the selected status; it never decides what the page
 * shows on its own.
 */
export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; category?: string }>;
}) {
  const { filter, category: categoryParam } = await searchParams;
  const browse = resolveSmartFilter(filter);
  const activeCategory = categoryParam ? categoryFromSlug(categoryParam) : null;

  // Fetched WITHOUT the category narrowing so the chips below can be derived
  // from real results. Querying with the category applied would collapse the
  // chip list to whichever one is selected. Narrowing then happens in JS —
  // same single query either way. (Categories are derived from this capped
  // batch; fine while the catalogue is far under BROWSE_PAGE_SIZE.)
  const { fundraisers: statusMatches } = await getFundraiserList({
    smartFilter: browse.value,
    page: 1,
    pageSize: BROWSE_PAGE_SIZE,
  });

  // Only categories that actually contain campaigns under the selected status.
  // Showing all 19 meant most chips were dead ends landing on "No campaigns
  // found". Canonical order is preserved rather than sorting by count, so the
  // row doesn't reshuffle as data changes.
  const categoriesWithCampaigns = CAMPAIGN_CATEGORIES.filter((category) =>
    statusMatches.some((f) => f.category === category)
  );

  const fundraisers = activeCategory
    ? statusMatches.filter((f) => f.category === activeCategory)
    : statusMatches;
  const total = fundraisers.length;

  const donationCounts = await getDonationCounts(fundraisers.map((f) => f.id));

  /** Preserves the selected browse option when switching the category filter. */
  function buildHref(nextCategory: string | null) {
    const params = new URLSearchParams();
    if (browse.value !== "all") params.set("filter", browse.value);
    if (nextCategory) params.set("category", nextCategory);
    const qs = params.toString();
    return qs ? `/campaigns?${qs}` : "/campaigns";
  }

  const chipClass = (isActive: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold transition ${
      isActive
        ? "border-brand-700 bg-brand-700 text-white"
        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
    }`;

  return (
    <main className="min-h-screen bg-zinc-50 pb-16 text-zinc-950">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <PublicPageHeader
          eyebrow="Browse"
          title={browse.heading}
          description={browse.description}
        />

        {/* Primary: campaign status */}
        <div className="mb-4 max-w-xs">
          <ShowcaseControls basePath="/campaigns" activeFilter={browse.value} />
        </div>

        {/* Secondary: optional category narrowing within the selected status.
            Hidden entirely when the status has campaigns in one category or
            fewer — a lone chip next to "All categories" filters nothing. */}
        {categoriesWithCampaigns.length > 1 && (
          <div className="scrollbar-hide -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Link href={buildHref(null)} className={chipClass(!activeCategory)}>
              All categories
            </Link>
            {categoriesWithCampaigns.map((category) => (
              <Link
                key={category}
                href={buildHref(categoryToSlug(category))}
                className={chipClass(activeCategory === category)}
              >
                {category}
              </Link>
            ))}
          </div>
        )}

        {fundraisers.length === 0 ? (
          <PublicEmptyState
            icon="💚"
            title="No campaigns found"
            description={
              activeCategory
                ? `No ${activeCategory.toLowerCase()} campaigns match this filter yet. Try another category or browse all.`
                : "Try a different filter to discover more campaigns to support."
            }
            action={{ label: "Start a fundraiser", href: "/create-fundraiser" }}
          />
        ) : (
          <>
            <p className="mb-2 text-sm font-bold text-zinc-500">
              {total} {total === 1 ? "campaign" : "campaigns"}
              {activeCategory ? ` in ${activeCategory}` : ""}
            </p>
            {/* Keyed on the active filters so the reveal count resets to the
                first page whenever the browse option or category changes —
                without it, React keeps the client component mounted across
                client-side navigations and carries the old count over. */}
            <CampaignBrowseList
              key={`${browse.value}:${activeCategory ?? "all"}`}
              items={fundraisers.map((f) => ({
                id: f.id,
                slug: f.slug,
                title: f.title,
                raised: f.raised,
                goal: f.goal,
                image: f.image,
                category: f.category,
                beneficiaryName: f.beneficiaryName,
                beneficiaryType: f.beneficiaryType,
                donationCount: donationCounts.get(f.id),
              }))}
            />
          </>
        )}
      </div>
    </main>
  );
}
