import type { Metadata } from "next";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { notFound } from "next/navigation";
import { getVisitorCountry } from "@/lib/request-geo";
import { getSiteUrl } from "@/lib/site-url";
import { safeImageSrc } from "@/lib/image-url";
import { truncateWords, stripHtml, cleanTitle } from "@/lib/text";
import DonatePage from "./DonatePage";

// The parent `/fundraisers/[slug]` page owns the campaign's share tags. This
// checkout sub-view intentionally re-emits them (canonical + og:url point at
// the parent) so a shared /donate URL still unfurls as the campaign instead
// of falling back to the site-wide homepage tags from the root layout.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  let fundraiser: {
    title: string;
    slug: string;
    story: string | null;
    banner: string | null;
    image_url: string | null;
  } | null = null;
  try {
    const adminSupabase = createSupabaseAdmin();
    const { data } = await adminSupabase
      .from("fundraisers")
      .select("title, slug, story, banner, image_url")
      .eq("slug", slug)
      .maybeSingle();
    fundraiser = data;
  } catch {
    fundraiser = null;
  }

  const siteUrl = getSiteUrl().replace(/\/$/, "");
  const parentUrl = `${siteUrl}/fundraisers/${slug}`;
  const cleanName = fundraiser?.title
    ? cleanTitle(fundraiser.title)
    : "Fundraiser";
  const title = `Donate to ${cleanName} — Fund4Good`;
  const rawStory = fundraiser?.story ? stripHtml(fundraiser.story) : "";
  const description = rawStory
    ? truncateWords(rawStory, 160)
    : `Support ${cleanName} on Fund4Good.`;
  const coverImage = safeImageSrc(
    fundraiser?.image_url || fundraiser?.banner
  );
  const image = coverImage ?? `${siteUrl}/og-image.jpg`;

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: {
      canonical: parentUrl,
    },
    openGraph: {
      title,
      description,
      url: parentUrl,
      siteName: "Fund4Good",
      images: [{ url: image, alt: cleanName }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function FundraiserDonatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const adminSupabase = createSupabaseAdmin();

  let fundraiser = null;
  let defaultCountry = "US";

  try {
    const [fundraiserRes, countryRes] = await Promise.all([
      adminSupabase
        .from("fundraisers")
        .select("id, title, slug, organizer, organizer_id, user_id, banner, raised, goal")
        .eq("slug", slug)
        .maybeSingle(),
      getVisitorCountry().catch(() => "US"),
    ]);
    fundraiser = fundraiserRes.data;
    defaultCountry = countryRes || "US";
  } catch (err) {
    console.error("[FundraiserDonatePage] Error loading page data:", err);
  }

  if (!fundraiser) return notFound();

  // organizerName and organizerHref are resolved in one conditional block:
  //
  // - Org-mode (organizer_id set): name comes from fundraiser.organizer (already
  //   the org name, written at creation/edit time). Link goes to /organizers/[id].
  //   No extra query needed for the name; we do fetch the org to get its id for
  //   the link (the detail page already has organizerProfileId from Batch 2).
  //
  // - Personal (organizer_id null): query public_profiles (the visibility-gated
  //   view). If the row exists the profile is public + active — use display_name
  //   and link to /profile/[user_id]. If absent (private/deleted account), fall
  //   back to the fundraisers.organizer snapshot and omit the link so no broken
  //   link is ever rendered.
  let organizerName = fundraiser.organizer || "Campaign organizer";
  let organizerHref: string | null = null;

  if (fundraiser.organizer_id) {
    // Org-mode: fetch the org record to confirm it exists and get its id for
    // the /organizers/[id] link (legacy route → redirects to /org/[slug]).
    try {
      const { data: org } = await adminSupabase
        .from("organizers")
        .select("id, name")
        .eq("id", fundraiser.organizer_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (org) {
        if (org.name) organizerName = org.name;
        organizerHref = `/organizers/${org.id}`;
      }
    } catch (err) {
      console.error("[FundraiserDonatePage] Org lookup failed:", err);
    }
  } else if (fundraiser.user_id) {
    // Personal: query the visibility-gated view — the link is only set when
    // the profile is genuinely reachable at /profile/[id].
    try {
      const { data: publicProfile } = await adminSupabase
        .from("public_profiles")
        .select("display_name")
        .eq("id", fundraiser.user_id)
        .maybeSingle();
      if (publicProfile) {
        if (publicProfile.display_name) organizerName = publicProfile.display_name;
        organizerHref = `/profile/${fundraiser.user_id}`;
      }
    } catch (err) {
      console.error("[FundraiserDonatePage] Public profile lookup failed:", err);
    }
  }

  const goal = Number(fundraiser.goal ?? 0);

  return (
    <DonatePage
      fundraiserTitle={fundraiser.title}
      fundraiserSlug={fundraiser.slug}
      organizerName={organizerName}
      organizerHref={organizerHref}
      banner={
        fundraiser.banner ||
        "https://images.unsplash.com/photo-1529390079861-591de354faf5?q=80&w=800&auto=format&fit=crop"
      }
      raised={fundraiser.raised ?? 0}
      goal={goal}
      defaultCountry={defaultCountry}
    />
  );
}
