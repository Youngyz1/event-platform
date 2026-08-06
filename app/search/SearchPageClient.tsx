"use client";

import { Suspense } from "react";
import PublicSearchBar from "@/components/public/PublicSearchBar";
import PublicPageHeader from "@/components/public/PublicPageHeader";
import PublicEmptyState from "@/components/public/PublicEmptyState";
import FundraiserCard from "@/components/FundraiserCard";
import OrganizerCard from "@/components/public/OrganizerCard";
import Link from "next/link";

type SearchResultsProps = {
  query: string;
  fundraisers: Array<{
    id: string;
    title: string;
    slug: string;
    goal: number | null;
    raised: number | null;
    banner: string | null;
    category: string | null;
  }>;
  organizers: Array<{
    id: string;
    name: string;
    bio: string | null;
    photo: string | null;
    banner: string | null;
    status: string | null;
  }>;
};

function SearchResultsContent({ query, fundraisers, organizers }: SearchResultsProps) {
  const total = fundraisers.length + organizers.length;
  const hasAnyResults = total > 0;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <PublicPageHeader
          eyebrow="Search"
          title={query ? `Results for “${query}”` : "Search the platform"}
          description={
            query
              ? `${total} result${total === 1 ? "" : "s"} across fundraisers and organizers.`
              : "Support causes and discover organizers."
          }
        />

        <PublicSearchBar
          action="/search"
          defaultQuery={query}
          placeholder="Search fundraisers, organizers…"
          showLocation={false}
          className="mb-10 max-w-2xl"
        />

        {!hasAnyResults ? (
          <PublicEmptyState
            icon="🔍"
            title={query ? "No results found" : "Start searching"}
            description={
              query
                ? "Try different keywords or browse categories below."
                : "Enter a keyword to search across the platform."
            }
            action={{ label: "Browse fundraisers", href: "/fundraisers" }}
          />
        ) : (
          <div className="space-y-12">
            {fundraisers.length > 0 && (
              <section>
                <div className="mb-5 flex items-end justify-between">
                  <h2 className="text-xl font-black text-zinc-950">Fundraisers</h2>
                  <Link href="/fundraisers" className="text-sm font-bold text-brand-700 hover:text-brand-800">
                    View all →
                  </Link>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {fundraisers.map((f) => (
                    <FundraiserCard
                      key={f.id}
                      slug={f.slug}
                      title={f.title}
                      raised={f.raised ?? 0}
                      goal={f.goal ?? 0}
                      image={f.banner || null}
                      category={f.category}
                    />
                  ))}
                </div>
              </section>
            )}

            {organizers.length > 0 && (
              <section>
                <div className="mb-5 flex items-end justify-between">
                  <h2 className="text-xl font-black text-zinc-950">Organizers</h2>
                  <Link href={`/organizers?q=${encodeURIComponent(query)}`} className="text-sm font-bold text-brand-700 hover:text-brand-800">
                    View all →
                  </Link>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {organizers.map((org) => (
                    <OrganizerCard
                      key={org.id}
                      organizer={{
                        id: org.id,
                        name: org.name,
                        bio: org.bio,
                        photo: org.photo,
                        banner: org.banner,
                        status: org.status,
                      }}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default function SearchPageClient(props: SearchResultsProps) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-zinc-50" />}>
      <SearchResultsContent {...props} />
    </Suspense>
  );
}
