export const dynamic = "force-dynamic";

import type { Metadata } from "next";

import DonationProtectedBadge from "@/components/DonationProtectedBadge";
import SupportMessages from "@/components/SupportMessages";
import FundraiserMediaSlider, {
  type FundraiserMediaSlide,
} from "@/components/FundraiserMediaSlider";
import FundraiserShare from "@/components/FundraiserShare";
import FundraiserStory from "@/components/FundraiserStory";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { recordDonationFromStripeSessionId } from "@/lib/donations";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Flag } from "lucide-react";
import FundraiserFloatingActions, { ShareFundraiserButton } from "./FundraiserActions";
import StarRating from "@/components/StarRating";
import { normalizeImageUrl } from "@/lib/image-url";
import { jsonLdScriptValue } from "@/lib/structured-data";
import { money } from "@/lib/format";
import DonorList from "@/components/DonorList";
import {
  FUNDRAISER_FALLBACK_IMAGE,
  getFundraiserBySlug,
  getOptionalFundraiserFields,
} from "@/lib/fundraiser-data";
import { getSiteUrl } from "@/lib/site-url";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const fundraiser = await getFundraiserBySlug(slug);

  const title = fundraiser?.title
    ? `${fundraiser.title} — Fund4Good`
    : "Fundraiser — Fund4Good";
  const raised = `$${Number(fundraiser?.raised ?? 0).toLocaleString()}`;
  const goal = `$${Number(fundraiser?.goal ?? 0).toLocaleString()}`;
  const description =
    fundraiser?.story ||
    `${raised} raised of ${goal} goal. Support this fundraiser on Fund4Good.`;
  const image = normalizeImageUrl(fundraiser?.banner, "/og-image.png");

  return {
    metadataBase: new URL("https://www.fund4agoodcause.com"),
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://www.fund4agoodcause.com/fundraisers/${slug}`,
      siteName: "Fund4Good",
      images: [{ url: image, width: 1200, height: 630, alt: fundraiser?.title || "Fundraiser" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

const FALLBACK_IMAGE = FUNDRAISER_FALLBACK_IMAGE;

type DonationRow = {
  id: string;
  donor_name: string | null;
  amount: number | string | null;
  created_at: string;
  user_id: string | null;
};

type UpdateRow = {
  id: string;
  organizer_id: string | null;
  title: string | null;
  content: string;
  created_at: string;
};

type MediaRow = {
  id: string | null;
  url: string;
  type: string | null;
};

type OrganizerRow = {
  id: string;
  name: string | null;
};

type PublicProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

function initial(value: string) {
  return (value.trim() || "A").charAt(0).toUpperCase();
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(value: string) {
  const days = Math.floor(
    (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function createdAgo(value: string) {
  const secs = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? "s" : ""} ago`;
}

async function getPublicProfileMap(
  userIds: string[],
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>
): Promise<Map<string, PublicProfileRow>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return new Map();

  const { data } = await supabaseAdmin
    .from("public_profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids);

  return new Map(
    ((data ?? []) as PublicProfileRow[]).map((profile) => [profile.id, profile])
  );
}

function OrganizerAvatar({ name }: { name: string }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center text-sm font-black text-zinc-700">
      {initial(name)}
    </div>
  );
}

function ProgressRing({ percentage }: { percentage: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28">
      <circle
        cx="50"
        cy="50"
        r="40"
        stroke="#e5e7eb"
        strokeWidth="8"
        fill="none"
      />
      <circle
        cx="50"
        cy="50"
        r="40"
        stroke="#10b981"
        strokeWidth="8"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="16"
        fontWeight="bold"
        fill="#18181b"
      >
        {percentage}%
      </text>
    </svg>
  );
}

export default async function FundraiserPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ success?: string; session_id?: string }>;
}) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};

  if (query.success === "true" && query.session_id) {
    try {
      await recordDonationFromStripeSessionId(query.session_id);
    } catch (error) {
      console.error("Failed to record Stripe donation session:", error);
    }
  }

  const fundraiser = await getFundraiserBySlug(slug);

  if (!fundraiser) return notFound();
  const optionalFundraiser = await getOptionalFundraiserFields(fundraiser.id);
  const supabaseAdmin = createSupabaseAdmin();

  const [
    mediaResult,
    updatesResult,
    donationsResult,
    organizerResult,
    commentsResult,
  ] = await Promise.all([
    supabase
      .from("fundraiser_media")
      .select("id, url, type, position")
      .eq("fundraiser_id", fundraiser.id)
      .order("position", { ascending: true }),
    supabase
      .from("fundraiser_updates")
      .select("id, organizer_id, title, content, created_at")
      .eq("fundraiser_id", fundraiser.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("donations")
      .select("id, donor_name, amount, created_at, user_id", {
        count: "exact",
      })
      .eq("fundraiser_id", fundraiser.id)
      .in("status", ["succeeded", "completed"])
      .order("created_at", { ascending: false })
      .limit(5),
    fundraiser.organizer_id
      ? supabase
          .from("organizers")
          .select("id, name")
          .eq("id", fundraiser.organizer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("target_type", "fundraiser")
      .eq("target_id", fundraiser.id)
      .eq("status", "approved"),
  ]);

  const organizer = organizerResult.data as OrganizerRow | null;
  const organizerName =
    organizer?.name || fundraiser.organizer || "Campaign organizer";

  // If no organizer_id was stored, try to resolve the organizer profile by
  // matching the organizer name — same fallback pattern used for the beneficiary.
  const { data: organizerByName } =
    !organizer && organizerName && organizerName !== "Campaign organizer"
      ? await supabase
          .from("organizers")
          .select("id")
          .eq("name", organizerName)
          .eq("visibility", "public")
          .not("status", "in", "(rejected,suspended)")
          .maybeSingle()
      : { data: null };

  // Single source-of-truth for the organizer profile link
  const organizerProfileId: string | null =
    organizer?.id ?? organizerByName?.id ?? null;

  const coverImage = normalizeImageUrl(
    fundraiser.image_url || fundraiser.banner,
    FALLBACK_IMAGE
  );
  const mediaRows = (mediaResult.data ?? []) as MediaRow[];
  const media: FundraiserMediaSlide[] =
    mediaRows.length > 0
      ? mediaRows.map((item) => ({
          id: item.id,
          url: item.url,
          type: item.type,
        }))
      : [{ url: coverImage, type: "image" }];
  // Shareable social-graphic slide: the auto-generated OG card, appended as a
  // regular image slide. Must be an absolute URL — the slider's safeUrl()
  // falls back to a stock placeholder for anything not starting with "http".
  media.push({
    id: "share-card",
    url: `${getSiteUrl()}/fundraisers/${fundraiser.slug}/opengraph-image`,
    type: "image",
  });
  const updates = (updatesResult.data ?? []) as UpdateRow[];
  const recentDonors = (donationsResult.data ?? []) as DonationRow[];
  const publicProfileById = await getPublicProfileMap(
    recentDonors
      .map((donation) => donation.user_id)
      .filter((id): id is string => Boolean(id)),
    supabaseAdmin
  );
  const donationCount = donationsResult.count ?? recentDonors.length;
  const raised = Number(fundraiser.raised_amount ?? fundraiser.raised ?? 0);
  const goal = Number(optionalFundraiser.goal_amount ?? fundraiser.goal ?? 0);
  const percentage =
    goal > 0 ? Math.min(Math.round((raised / goal) * 100), 100) : 0;
  const description =
    optionalFundraiser.description ||
    fundraiser.story ||
    optionalFundraiser.short_description ||
    "";
  void commentsResult.count;
  const beneficiaryName: string =
    optionalFundraiser.beneficiary ||
    optionalFundraiser.beneficiary_name ||
    fundraiser.title ||
    "This Cause";

  const { data: beneficiaryOrganizer } = beneficiaryName
    ? await supabase
        .from("organizers")
        .select("id")
        .eq("name", beneficiaryName)
        .eq("visibility", "public")
        .not("status", "in", "(rejected,suspended)")
        .maybeSingle()
    : { data: null };

  const fundraiserCategory: string = fundraiser.category || "";
  const fundraiserCreatedAt: string =
    fundraiser.created_at || new Date().toISOString();

  // ── JSON-LD structured data (Fundraiser / DonateAction) ────
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DonateAction",
    name: fundraiser.title,
    description: description || undefined,
    image: coverImage !== FALLBACK_IMAGE ? coverImage : undefined,
    url: `https://www.fund4agoodcause.com/fundraisers/${slug}`,
    recipient: {
      "@type": "Organization",
      name: organizerName,
      ...(organizerProfileId
        ? { url: `https://www.fund4agoodcause.com/organizers/${organizerProfileId}` }
        : {}),
    },
    object: {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: goal,
    },
    actionStatus: percentage >= 100
      ? "https://schema.org/CompletedActionStatus"
      : "https://schema.org/ActiveActionStatus",
  };

  return (
    <main className="min-h-screen bg-white pb-24 text-zinc-950 lg:pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScriptValue(jsonLd) }}
      />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:py-10">
        {/* Main content column */}
        <div className="min-w-0 space-y-8 lg:col-span-2">
          <header>
            {fundraiserCategory && (
              <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700 mb-3">
                {fundraiserCategory}
              </span>
            )}
            <h1 className="text-3xl font-bold leading-tight text-zinc-950 sm:text-4xl break-words">
              {fundraiser.title}
            </h1>
            {fundraiser.review_count > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-zinc-600">
                <StarRating value={fundraiser.average_rating} size={16} />
                <span className="font-bold text-zinc-800">
                  {Number(fundraiser.average_rating).toFixed(1)}
                </span>
                <span>
                  ({fundraiser.review_count} {fundraiser.review_count === 1 ? "review" : "reviews"})
                </span>
              </div>
            )}
          </header>

          <section className="border-b border-zinc-200 pb-8">
            <FundraiserMediaSlider media={media} title={fundraiser.title} />
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <OrganizerAvatar name={organizerName} />
                <p className="text-sm text-zinc-600 break-words">
                  Organised by{" "}
                  {organizerProfileId ? (
                    <Link
                      href={`/organizers/${organizerProfileId}`}
                      className="font-bold text-zinc-950 hover:text-emerald-600 hover:underline transition"
                    >
                      {organizerName}
                    </Link>
                  ) : (
                    <span className="font-bold text-zinc-950">
                      {organizerName}
                    </span>
                  )}
                </p>
              </div>
              <DonationProtectedBadge />
            </div>
          </section>

          <FundraiserStory description={description} />

          {updates.length > 0 && (
            <section className="border-b border-zinc-200 pb-8">
              <h2 className="text-2xl font-bold text-zinc-950 break-words">
                Updates {updates.length}
              </h2>
              <div className="mt-5 space-y-5">
                {updates.map((update) => (
                  <article
                    key={update.id}
                    className="rounded-lg border border-zinc-200 p-5"
                  >
                    <div className="flex gap-3">
                      <OrganizerAvatar name={organizerName} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="font-bold text-zinc-950">
                            {organizerName}
                          </span>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-600">
                            Organiser
                          </span>
                          <span className="text-zinc-500">
                            {dateLabel(update.created_at)}
                          </span>
                        </div>
                        {update.title && (
                          <h3 className="mt-3 text-lg font-bold text-zinc-950 break-words">
                            {update.title}
                          </h3>
                        )}
                        <p className="mt-2 whitespace-pre-wrap break-words leading-7 text-zinc-700">
                          {update.content}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <FundraiserShare
            title={fundraiser.title}
            imageUrl={`${getSiteUrl()}/fundraisers/${fundraiser.slug}/opengraph-image`}
          />

          {/* ── Organiser & Beneficiary ─────────────────────────── */}
          <section className="border-t border-zinc-200 pt-8">
            <h2 className="text-lg font-black text-zinc-950 break-words">
              Organiser and beneficiary
            </h2>
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center text-sm font-black text-zinc-700">
                  {initial(organizerName)}
                </div>
                <div className="min-w-0">
                  {organizerProfileId ? (
                    <Link
                      href={`/organizers/${organizerProfileId}`}
                      className="block truncate text-sm font-black text-zinc-950 hover:text-emerald-600 hover:underline transition"
                    >
                      {organizerName}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm font-black text-zinc-950">
                      {organizerName}
                    </span>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-600">
                      Organiser
                    </span>
                    {organizerProfileId && (
                      <a
                        href={"mailto:support@fund4agoodcause.com?subject=Message%20for%20" + encodeURIComponent(organizerName)}
                        className="rounded-full border border-zinc-300 px-3 py-0.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50"
                      >
                        Message
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 shrink-0 text-zinc-400 rotate-90 sm:rotate-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>

              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center text-sm font-black text-emerald-700">
                  {initial(beneficiaryName)}
                </div>
                <div className="min-w-0">
                  {beneficiaryOrganizer?.id ? (
                    <Link
                      href={`/organizers/${beneficiaryOrganizer.id}`}
                      className="block truncate text-sm font-black text-zinc-950 hover:text-emerald-600 hover:underline transition"
                    >
                      {beneficiaryName}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm font-black text-zinc-950">
                      {beneficiaryName}
                    </span>
                  )}
                  <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                    Beneficiary
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-zinc-400">
              Created {createdAgo(fundraiserCreatedAt)}
              {fundraiserCategory ? ` · ${fundraiserCategory}` : ""}
            </p>

            <a
              href={`mailto:support@fund4agoodcause.com?subject=Report%20fundraiser%3A%20${encodeURIComponent(fundraiser.title)}`}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition hover:text-red-500"
            >
              <Flag className="h-3.5 w-3.5" />
              Report fundraiser
            </a>
          </section>

          {/* ── Words of Support — always visible ───────────────── */}
          <div className="border-t border-zinc-200 pt-8">
            <SupportMessages fundraiserId={fundraiser.id} />
          </div>

        </div>

        {/* Aside */}
        <aside className="min-w-0 lg:col-span-1">
          <div className="space-y-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
            <section className="text-center">
              <div className="flex justify-center">
                <ProgressRing percentage={percentage} />
              </div>
              <p className="mt-4 text-3xl font-black text-zinc-950">
                {money(raised)} raised
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-500">
                of {money(goal)} goal
              </p>
              <p className="mt-3 text-sm font-bold text-zinc-700">
                {donationCount.toLocaleString()} donation
                {donationCount === 1 ? "" : "s"}
              </p>
            </section>

            <section className="space-y-3">
              <a
                href={`/fundraisers/${fundraiser.slug}/donate`}
                className="flex w-full items-center justify-center rounded-lg bg-emerald-600 px-5 py-3.5 text-base font-black text-white transition hover:bg-emerald-700"
              >
                Donate now
              </a>
              <ShareFundraiserButton
                title={fundraiser.title}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-5 py-3.5 text-base font-black text-white transition hover:bg-slate-900"
              />
            </section>

            <section className="border-t border-zinc-200 pt-5">
  <h2 className="text-base font-bold text-zinc-950">
    Recent donors
  </h2>
  <DonorList
    fundraiserId={fundraiser.id}
    initialDonations={recentDonors.map((d) => ({
      ...d,
      profile: d.user_id ? publicProfileById.get(d.user_id) ?? null : null,
    }))}
    initialHasMore={donationCount > recentDonors.length}
  />
</section>
          </div>
        </aside>
      </div>

      {/* Sticky bottom actions bar on mobile */}
      <FundraiserFloatingActions title={fundraiser.title} slug={fundraiser.slug} />
    </main>
  );
}
