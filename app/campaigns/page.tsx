import Link from "next/link";
import type { Metadata } from "next";
import PublicPageHeader from "@/components/public/PublicPageHeader";
import PublicEmptyState from "@/components/public/PublicEmptyState";
import FundraiserCard from "@/components/FundraiserCard";
import ShowcaseControls from "@/components/fundraisers/ShowcaseControls";
import { getFundraiserList, type FundraiserSmartFilter } from "@/lib/fundraiser-data";
import { CAMPAIGN_CATEGORIES, categoryToSlug } from "@/lib/categories";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse Campaigns — Fund4Good",
  description: "Explore fundraising campaigns by category on Fund4Good.",
};

const SMART_FILTERS = ["close-to-target", "just-launched", "needs-momentum", "trending"] as const;

// Cards shown per category before linking out to that category's own page.
const CATEGORY_SECTION_SIZE = 4;

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const smartFilter: FundraiserSmartFilter = (SMART_FILTERS as readonly string[]).includes(
    filter ?? ""
  )
    ? (filter as FundraiserSmartFilter)
    : "all";

  const sections = await Promise.all(
    CAMPAIGN_CATEGORIES.map(async (category) => {
      const { fundraisers, total } = await getFundraiserList({
        categories: [category],
        smartFilter,
        page: 1,
        pageSize: CATEGORY_SECTION_SIZE,
      });
      return { category, fundraisers, total };
    })
  );

  const visibleSections = sections.filter((section) => section.total > 0);
  const filterQuery = smartFilter !== "all" ? `?filter=${smartFilter}` : "";

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 pb-16">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <PublicPageHeader
          eyebrow="Browse"
          title="All Campaigns"
          description="Explore fundraisers by category and find causes to support."
        />

        <div className="mb-10 max-w-xs">
          <ShowcaseControls basePath="/campaigns" activeFilter={smartFilter} />
        </div>

        {visibleSections.length === 0 ? (
          <PublicEmptyState
            icon="💚"
            title="No campaigns found"
            description="Try a different filter to discover more campaigns to support."
            action={{ label: "Start a fundraiser", href: "/create-fundraiser" }}
          />
        ) : (
          <div className="space-y-14">
            {visibleSections.map(({ category, fundraisers, total }) => (
              <section key={category}>
                <div className="mb-5 flex items-end justify-between gap-3">
                  <h2 className="text-xl font-black text-zinc-950 sm:text-2xl">
                    {category} <span className="font-bold text-zinc-400">({total})</span>
                  </h2>
                  <Link
                    href={`/campaigns/${categoryToSlug(category)}${filterQuery}`}
                    className="shrink-0 text-sm font-bold text-brand-700 hover:text-brand-800"
                  >
                    View all in {category} →
                  </Link>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {fundraisers.map((f) => (
                    <FundraiserCard
                      key={f.id}
                      slug={f.slug}
                      title={f.title}
                      raised={f.raised}
                      goal={f.goal}
                      image={f.image}
                      category={f.category}
                      organizer={f.organizer}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
