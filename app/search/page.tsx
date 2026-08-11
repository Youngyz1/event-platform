import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { buildFundraiserSearchFilter } from "@/lib/fundraiser-data";
import SearchPageClient from "./SearchPageClient";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.fund4agoodcause.com"),
  title: "Search — Fund4Good",
  description: "Search fundraisers and organizers on Fund4Good.",
  openGraph: {
    title: "Search — Fund4Good",
    description: "Search fundraisers and organizers on Fund4Good.",
    url: "https://www.fund4agoodcause.com/search",
    siteName: "Fund4Good",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Search Fund4Good" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.jpg"] },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  if (!query) {
    return (
      <SearchPageClient
        query=""
        fundraisers={[]}
        organizers={[]}
      />
    );
  }

  const pattern = `%${query}%`;

  // Searching beneficiary_name needs migration_50; retry without it if the
  // column isn't there yet, so search degrades to title/category instead of
  // silently returning nothing.
  const searchFundraisers = async () => {
    const run = (withBeneficiary: boolean) =>
      supabase
        .from("fundraisers")
        .select("id, title, slug, goal, raised, banner, category")
        .is("deleted_at", null)
        .or(buildFundraiserSearchFilter(query, withBeneficiary))
        .order("created_at", { ascending: false })
        .limit(8);

    const first = await run(true);
    return first.error ? run(false) : first;
  };

  const [fundraisersResult, organizersResult] =
    await Promise.all([
      searchFundraisers(),
      supabase
        .from("organizers")
        .select("id, name, bio, photo, banner, status")
        .eq("visibility", "public")
        .in("status", ["pending", "verified"])
        .is("deleted_at", null)
        .ilike("name", pattern)
        .order("name", { ascending: true })
        .limit(6),
    ]);

  return (
    <SearchPageClient
      query={query}
      fundraisers={fundraisersResult.data ?? []}
      organizers={organizersResult.data ?? []}
    />
  );
}
