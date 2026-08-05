import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://www.fund4agoodcause.com";

/** Build a supabase admin client that works in a server context (no browser cookies). */
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = getSupabase();
  const now = new Date();

  // ── Static pages ────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/organizers`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/create-fundraiser`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/create-organizer`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/platform`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/sponsors`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/reviews`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
  ];

  // ── Dynamic: public fundraisers ──────────────────────────────────
  const { data: fundraisers } = await supabase
    .from("fundraisers")
    .select("slug, created_at")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5000);

  const fundraiserUrls: MetadataRoute.Sitemap = (fundraisers ?? []).map((f) => ({
    url: `${BASE_URL}/fundraisers/${f.slug}`,
    lastModified: f.created_at ? new Date(f.created_at) : now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // ── Dynamic: public organizations (slug-based) ──────────────────
  const { data: organizers } = await supabase
    .from("organizers")
    .select("slug, updated_at, created_at")
    .eq("visibility", "public")
    .not("status", "in", "(rejected,suspended)")
    .not("slug", "is", null)
    .order("created_at", { ascending: false })
    .limit(5000);

  const organizerUrls: MetadataRoute.Sitemap = (organizers ?? [])
    .filter((o) => o.slug)
    .map((o) => ({
      url: `${BASE_URL}/org/${o.slug}`,
      lastModified: o.updated_at ? new Date(o.updated_at) : o.created_at ? new Date(o.created_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  return [...staticPages, ...fundraiserUrls, ...organizerUrls];
}
