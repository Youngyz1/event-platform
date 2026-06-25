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
    { url: `${BASE_URL}/events`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/fundraisers`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/organizers`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/create-event`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/create-fundraiser`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/create-organizer`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/find-tickets`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/platform`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/sponsors`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/reviews`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
  ];

  // ── Dynamic: public events ───────────────────────────────────────
  const { data: events } = await supabase
    .from("events")
    .select("slug, updated_at")
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(5000);

  const eventUrls: MetadataRoute.Sitemap = (events ?? []).map((e) => ({
    url: `${BASE_URL}/events/${e.slug}`,
    lastModified: e.updated_at ? new Date(e.updated_at) : now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // ── Dynamic: public fundraisers ──────────────────────────────────
  const { data: fundraisers } = await supabase
    .from("fundraisers")
    .select("slug, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5000);

  const fundraiserUrls: MetadataRoute.Sitemap = (fundraisers ?? []).map((f) => ({
    url: `${BASE_URL}/fundraisers/${f.slug}`,
    lastModified: f.updated_at ? new Date(f.updated_at) : now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // ── Dynamic: public organizers ────────────────────────────────────
  const { data: organizers } = await supabase
    .from("organizers")
    .select("id, updated_at")
    .eq("visibility", "public")
    .not("status", "in", "(rejected,suspended)")
    .order("updated_at", { ascending: false })
    .limit(5000);

  const organizerUrls: MetadataRoute.Sitemap = (organizers ?? []).map((o) => ({
    url: `${BASE_URL}/organizers/${o.id}`,
    lastModified: o.updated_at ? new Date(o.updated_at) : now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // ── Dynamic: things-to-do cities ─────────────────────────────────
  const knownCities = [
    "Newark", "Jersey City", "Montclair", "Hoboken", "Atlantic City",
    "Princeton", "Trenton", "Asbury Park", "Morristown", "New Brunswick",
    "Philadelphia", "Wilmington", "New York", "Los Angeles", "Chicago",
    "Miami", "Boston", "Atlanta", "San Francisco",
  ];

  const cityUrls: MetadataRoute.Sitemap = knownCities.map((city) => ({
    url: `${BASE_URL}/things-to-do/${encodeURIComponent(city)}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...eventUrls, ...fundraiserUrls, ...organizerUrls, ...cityUrls];
}
