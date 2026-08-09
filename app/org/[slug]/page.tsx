import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeImageUrl } from "@/lib/image-url";
import { fetchVerificationFacts } from "@/lib/verification-facts";
import OrganizationProfileClient from "./OrganizationProfileClient";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createSupabaseAdmin();

  // Resolve UUID → slug for metadata too
  const isUUID = UUID_RE.test(slug);
  const query = supabase
    .from("organizers")
    .select("name, bio, photo, banner, slug")
    .is("deleted_at", null);

  const { data: org } = isUUID
    ? await query.eq("id", slug).maybeSingle()
    : await query.eq("slug", slug).maybeSingle();

  const resolvedSlug = org?.slug ?? slug;
  const title = org?.name ? `${org.name} — Fund4Good` : "Organization — Fund4Good";
  const description =
    org?.bio || "View this organization's events and fundraisers on Fund4Good.";
  const image = normalizeImageUrl(org?.photo || org?.banner, "/og-image.png");

  return {
    metadataBase: new URL("https://www.fund4agoodcause.com"),
    title,
    description,
    alternates: {
      canonical: `https://www.fund4agoodcause.com/org/${resolvedSlug}`,
    },
    openGraph: {
      title,
      description,
      url: `https://www.fund4agoodcause.com/org/${resolvedSlug}`,
      siteName: "Fund4Good",
      ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: org?.name || "Organization" }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function OrganizationProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createSupabaseAdmin();
  const isUUID = UUID_RE.test(slug);

  // If a raw UUID is used, look up the slug and redirect to canonical
  if (isUUID) {
    const { data } = await supabase
      .from("organizers")
      .select("slug")
      .eq("id", slug)
      .is("deleted_at", null)
      .maybeSingle();

    if (data?.slug) {
      redirect(`/org/${data.slug}`);
    }
    return notFound();
  }

  // Explicit column list, not `*`.
  //
  // This fetch uses the service-role client, which bypasses the column grants
  // added in migration_53 — so `*` pulled tax_id and nonprofit_registration_number
  // and handed them to a client component, serialising both into the RSC payload
  // of every public organizer profile. Blocking them at PostgREST did nothing
  // about this path.
  const { data: org } = await supabase
    .from("organizers")
    .select(
      "id, user_id, name, bio, photo, banner, slug, org_type, visibility, status, verified_at, website, facebook, twitter, instagram, linkedin, youtube, tiktok, contact_email, average_rating, review_count, follower_offset, events_offset, organization_name, created_at, updated_at, deleted_at"
    )
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (!org) return notFound();

  // organizer_verification has no public SELECT policy; read with the
  // service-role client already in scope for this page's org fetch.
  const verificationFacts = await fetchVerificationFacts(supabase, org.id);

  return (
    <OrganizationProfileClient initialData={org} verificationFacts={verificationFacts} />
  );
}
