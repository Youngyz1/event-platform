import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import SearchPageClient from "./SearchPageClient";

export const metadata: Metadata = {
  title: "Search | Fund4Good",
  description: "Search events, fundraisers, and organizers on Fund4Good.",
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
      <SearchPageClient query="" events={[]} fundraisers={[]} organizers={[]} />
    );
  }

  const pattern = `%${query}%`;

  const [eventsResult, fundraisersResult, organizersResult] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, slug, event_date, city, venue, banner, category")
      .eq("visibility", "public")
      .eq("status", "approved")
      .ilike("title", pattern)
      .order("event_date", { ascending: true })
      .limit(8),
    supabase
      .from("fundraisers")
      .select("id, title, slug, goal, raised, banner")
      .ilike("title", pattern)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("organizers")
      .select("id, name, bio, photo, banner, status")
      .eq("visibility", "public")
      .in("status", ["pending", "verified"])
      .ilike("name", pattern)
      .order("name", { ascending: true })
      .limit(6),
  ]);

  return (
    <SearchPageClient
      query={query}
      events={eventsResult.data ?? []}
      fundraisers={fundraisersResult.data ?? []}
      organizers={organizersResult.data ?? []}
    />
  );
}
