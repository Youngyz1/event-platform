export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicPageHeader from "@/components/public/PublicPageHeader";
import PublicEmptyState from "@/components/public/PublicEmptyState";
import FundraiserCard from "@/components/FundraiserCard";
import ShowcaseControls from "@/components/fundraisers/ShowcaseControls";
import { getFundraiserList, type FundraiserSmartFilter } from "@/lib/fundraiser-data";
import { categoryFromSlug, categoryToSlug } from "@/lib/categories";

const SMART_FILTERS = ["close-to-target", "just-launched", "needs-momentum", "trending"] as const;

// Pagination was removed platform-wide; a category page is itself a "view all"
// destination, so this is a generous single batch rather than a paged list.
const CATEGORY_PAGE_SIZE = 100;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) return {};

  return {
    title: `${category} Campaigns — Fund4Good`,
    description: `Explore ${category.toLowerCase()} fundraising campaigns on Fund4Good.`,
  };
}

export default async function CampaignCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { category: slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) notFound();

  const { filter } = await searchParams;
  const smartFilter: FundraiserSmartFilter = (SMART_FILTERS as readonly string[]).includes(
    filter ?? ""
  )
    ? (filter as FundraiserSmartFilter)
    : "all";

  const { fundraisers, total } = await getFundraiserList({
    categories: [category],
    smartFilter,
    page: 1,
    pageSize: CATEGORY_PAGE_SIZE,
  });

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 pb-16">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Link
          href="/campaigns"
          className="mb-6 inline-flex items-center text-sm font-bold text-zinc-500 hover:text-zinc-800"
        >
          ← All campaigns
        </Link>

        <PublicPageHeader
          eyebrow="Category"
          title={`${category} Campaigns`}
          description={`${total} ${total === 1 ? "campaign" : "campaigns"} in ${category}.`}
        />

        <div className="mb-10 max-w-xs">
          <ShowcaseControls basePath={`/campaigns/${categoryToSlug(category)}`} activeFilter={smartFilter} />
        </div>

        {fundraisers.length === 0 ? (
          <PublicEmptyState
            icon="💚"
            title="No campaigns found"
            description="Try a different filter to discover more campaigns to support."
            action={{ label: "Start a fundraiser", href: "/create-fundraiser" }}
          />
        ) : (
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
        )}
      </div>
    </main>
  );
}
