/**
 * app/admin/homepage/page.tsx
 * Admin tool for toggling which events & fundraisers appear in
 * the homepage sliders (is_homepage_featured = true/false).
 *
 * DB migrations required (run once in Supabase SQL editor):
 *   ALTER TABLE events      ADD COLUMN IF NOT EXISTS is_homepage_featured boolean DEFAULT false;
 *   ALTER TABLE fundraisers ADD COLUMN IF NOT EXISTS is_homepage_featured BOOLEAN DEFAULT false;
 */

import { createSupabaseServer } from "@/lib/supabase-server";
import HomepageFeaturedClient from "./HomepageFeaturedClient";

export const metadata = {
  title: "Homepage Featured | Admin",
};

export default async function AdminHomepagePage() {
  const supabase = await createSupabaseServer();

  const [{ data: events }, { data: fundraisers }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, slug, status, is_homepage_featured")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("fundraisers")
      .select("id, title, slug, is_homepage_featured")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <HomepageFeaturedClient
      initialEvents={events ?? []}
      initialFundraisers={fundraisers ?? []}
    />
  );
}
