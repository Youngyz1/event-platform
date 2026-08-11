import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { getSiteUrl } from "@/lib/site-url";

/** Build a supabase admin client that works in a server context (no browser cookies). */
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const supabase = getSupabase();
  const now = new Date();

  // ── Static pages (public, canonical, indexable only) ──────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/campaigns`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/organizers`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/platform`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/reviews`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${baseUrl}/sponsors`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/cookies`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
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
    url: `${baseUrl}/fundraisers/${f.slug}`,
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
      url: `${baseUrl}/org/${o.slug}`,
      lastModified: o.updated_at ? new Date(o.updated_at) : o.created_at ? new Date(o.created_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  return [...staticPages, ...fundraiserUrls, ...organizerUrls];
}
