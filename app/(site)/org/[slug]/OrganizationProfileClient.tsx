"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { safeImageSrc } from "@/lib/image-url";
import { stripEmojis } from "@/lib/text";
import StarRating from "@/components/StarRating";
import ReviewSection from "@/components/ReviewSection";
import LocalBrandedPlaceholder from "@/components/ui/LocalBrandedPlaceholder";
import ProgressBar from "@/components/ui/ProgressBar";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileSidebar from "@/components/profile/ProfileSidebar";
import ProfileTabs, { type ProfileTab } from "@/components/profile/ProfileTabs";
import ProfileSection from "@/components/profile/ProfileSection";
import FollowButton from "@/components/profile/FollowButton";
import type { ProfileMetric } from "@/components/profile/ProfileMetrics";
import OrganizationStatusBadge from "@/components/trust/OrganizationStatusBadge";
import type { VerificationFacts } from "@/lib/verification-facts";
import {
  Globe, Mail, ExternalLink, ArrowUpRight,
  Rocket, Users, Star, DollarSign, Pencil, Link2,
} from "lucide-react";
import {
  FaFacebookF, FaXTwitter, FaInstagram, FaLinkedinIn,
  FaYoutube, FaTiktok
} from "react-icons/fa6";

// ── Types ─────────────────────────────────────────────────────────────────────

type Organization = {
  id: string;
  slug: string | null;
  name: string;
  bio: string | null;
  photo: string | null;
  banner: string | null;
  org_type: string | null;
  contact_email: string | null;
  facebook: string | null;
  twitter: string | null;
  instagram: string | null;
  linkedin: string | null;
  youtube: string | null;
  tiktok: string | null;
  website: string | null;
  user_id: string;
  status: string | null;
  average_rating?: number | null;
  review_count?: number | null;
  follower_offset?: number;
};

type FundraiserItem = {
  id: string;
  title: string;
  slug: string;
  banner: string | null;
  image_url: string | null;
  goal: number | string | null;
  raised: number | string | null;
  category: string | null;
};

type TabId = "overview" | "campaigns" | "about" | "reviews";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORG_TYPE_LABELS: Record<string, string> = {
  nonprofit: "Nonprofit",
  business: "Business",
  church: "Church",
  school: "School",
  creator: "Creator",
  community: "Community",
  government: "Government",
  restaurant: "Restaurant",
  sports_club: "Sports Club",
  other: "Organization",
};

const ORG_TYPE_COLORS: Record<string, string> = {
  nonprofit: "bg-brand-100 text-brand-900",
  business: "bg-blue-100 text-blue-800",
  church: "bg-purple-100 text-purple-800",
  school: "bg-yellow-100 text-yellow-800",
  creator: "bg-pink-100 text-pink-800",
  community: "bg-brand-100 text-brand-900",
  government: "bg-slate-100 text-slate-800",
  restaurant: "bg-red-100 text-red-800",
  sports_club: "bg-cyan-100 text-cyan-800",
  other: "bg-zinc-100 text-zinc-700",
};

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatMoney(val: number | string | null) {
  const n = Number(val ?? 0);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

// ── Social Link ───────────────────────────────────────────────────────────────

function SocialLink({
  href,
  icon: Icon,
  label,
}: {
  href: string | null | undefined;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  if (!href) return null;
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition hover:bg-zinc-950 hover:text-white"
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

function CampaignRow({ f }: { f: FundraiserItem }) {
  const [imgError, setImgError] = useState(false);
  const goal = Number(f.goal ?? 0);
  const raised = Number(f.raised ?? 0);
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  const imageSrc = !imgError ? safeImageSrc(f.image_url || f.banner) : null;
  const title = stripEmojis(f.title) || "Untitled Campaign";

  return (
    <Link
      href={`/fundraisers/${f.slug}`}
      className="group flex gap-4 rounded-xl border border-zinc-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/40"
    >
      <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={f.title}
            fill
            className="object-cover"
            sizes="80px"
            onError={() => setImgError(true)}
          />
        ) : (
          <LocalBrandedPlaceholder variant="fundraiser" title={f.title} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black text-zinc-900 line-clamp-1 group-hover:text-brand-800">
          {title}
        </p>
        <div className="mt-1.5">
          <ProgressBar percentage={pct} height={6} />
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          <span className="font-bold text-zinc-700">{formatMoney(raised)}</span>{" "}
          raised of {formatMoney(goal)} goal
        </p>
      </div>
      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-zinc-300 group-hover:text-brand-600" />
    </Link>
  );
}

function ConnectSection({ org }: { org: Organization }) {
  const hasConnect = org.website || org.contact_email;
  if (!hasConnect) return null;

  return (
    <ProfileSection title="Connect" icon={Link2}>
      <div className="space-y-3">
        {org.website && (
          <a
            href={org.website.startsWith("http") ? org.website : `https://${org.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 text-sm font-medium text-zinc-700 hover:text-brand-700"
          >
            <Globe className="h-4 w-4 shrink-0 text-zinc-400" />
            <span className="truncate">{org.website.replace(/^https?:\/\//, "")}</span>
            <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-zinc-300" />
          </a>
        )}
        {org.contact_email && (
          <a
            href={`mailto:${org.contact_email}`}
            className="flex items-center gap-2.5 text-sm font-medium text-zinc-700 hover:text-brand-700"
          >
            <Mail className="h-4 w-4 shrink-0 text-zinc-400" />
            <span className="truncate">{org.contact_email}</span>
          </a>
        )}
      </div>
    </ProfileSection>
  );
}

/** Social icon row — renders nothing (and takes no space) when the
 *  organizer has no social links. Alignment adapts to its container. */
function SocialIconRow({ org, align = "center" }: { org: Organization; align?: "center" | "start" }) {
  const links = [
    { href: org.facebook, icon: FaFacebookF, label: "Facebook" },
    { href: org.twitter, icon: FaXTwitter, label: "X (Twitter)" },
    { href: org.instagram, icon: FaInstagram, label: "Instagram" },
    { href: org.linkedin, icon: FaLinkedinIn, label: "LinkedIn" },
    { href: org.youtube, icon: FaYoutube, label: "YouTube" },
    { href: org.tiktok, icon: FaTiktok, label: "TikTok" },
  ].filter((l) => l.href);
  if (links.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${align === "center" ? "justify-center" : "justify-start"}`}>
      {links.map(({ href, icon: Icon, label }) => (
        <SocialLink key={label} href={href} icon={Icon} label={label} />
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OrganizationProfileClient({
  initialData,
  verificationFacts,
  initialFundraisers,
}: {
  initialData: Organization;
  verificationFacts: VerificationFacts;
  /** Campaigns loaded server-side in page.tsx so tab visibility is
   *  determined from real data at render — no client-fetch flash. */
  initialFundraisers: FundraiserItem[];
}) {
  const router = useRouter();
  const [org] = useState<Organization>(initialData);
  const [fundraisers] = useState<FundraiserItem[]>(initialFundraisers);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(org.follower_offset ?? 0);
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadViewerState() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setCurrentUserId(session.user.id);
          setIsOwner(session.user.id === org.user_id);
        }

        // Aggregate view rather than a head-count over organizer_follows:
        // migration_53 restricted that table to the follower and the
        // organizer, so an anonymous visitor counting rows directly would
        // now always see 0.
        const { data: followRow } = await supabase
          .from("organizer_follower_counts")
          .select("follower_count")
          .eq("organizer_id", org.id)
          .maybeSingle();
        setFollowerCount(
          Number(followRow?.follower_count ?? 0) + (org.follower_offset ?? 0)
        );

        if (session?.user) {
          const { data: follow } = await supabase
            .from("organizer_follows")
            .select("id")
            .eq("organizer_id", org.id)
            .eq("user_id", session.user.id)
            .maybeSingle();
          setIsFollowing(!!follow);
        }
      } catch (error) {
        console.error("Failed to load organizer profile data:", error);
      }
    }
    loadViewerState();
  }, [org.id, org.user_id, org.follower_offset]);

  async function toggleFollow() {
    if (!currentUserId) { router.push("/login"); return; }
    if (isFollowing) {
      const { error } = await supabase
        .from("organizer_follows")
        .delete()
        .eq("organizer_id", org.id)
        .eq("user_id", currentUserId);
      if (!error) { setIsFollowing(false); setFollowerCount((c) => Math.max(0, c - 1)); }
    } else {
      const { error } = await supabase
        .from("organizer_follows")
        .insert({ organizer_id: org.id, user_id: currentUserId });
      if (!error) { setIsFollowing(true); setFollowerCount((c) => c + 1); }
    }
  }

  const orgTypeLabel = ORG_TYPE_LABELS[org.org_type ?? "other"] ?? "Organization";
  const orgTypeColor = ORG_TYPE_COLORS[org.org_type ?? "other"] ?? "bg-zinc-100 text-zinc-700";
  const totalRaised = fundraisers.reduce((sum, f) => sum + Number(f.raised ?? 0), 0);

  const hasBio = Boolean(org.bio?.trim());
  const hasContact = Boolean(org.website || org.contact_email);
  const hasSocials = Boolean(
    org.facebook || org.twitter || org.instagram ||
    org.linkedin || org.youtube || org.tiktok
  );
  const hasCampaigns = fundraisers.length > 0;
  const hasReviews = (org.review_count ?? 0) > 0;

  // ── Data-driven sections: a tab renders only when it has real content.
  // About shows unless the bio is literally the profile's only content (in
  // which case Overview carries it). Overview renders when at least two
  // sections would otherwise show — or as the bio's home when it is the
  // only content available.
  const showCampaigns = hasCampaigns;
  const showReviews = hasReviews;
  const showAbout = (hasBio || hasContact || hasSocials) && (hasCampaigns || hasReviews || hasContact || hasSocials);
  const multiSection = [showCampaigns, showAbout, showReviews].filter(Boolean).length >= 2;
  const showOverview = multiSection || ((hasBio || hasCampaigns) && !showCampaigns && !showAbout && !showReviews);

  const visibleTabs: ProfileTab[] = [
    ...(showOverview ? [{ id: "overview", label: "Overview" }] : []),
    ...(showCampaigns ? [{ id: "campaigns", label: "Campaigns", count: fundraisers.length }] : []),
    ...(showAbout ? [{ id: "about", label: "About" }] : []),
    ...(showReviews ? [{ id: "reviews", label: "Reviews", count: org.review_count ?? undefined }] : []),
  ];
  const [activeTab, setActiveTab] = useState<TabId>(
    (visibleTabs[0]?.id as TabId | undefined) ?? "overview"
  );

  const metrics: ProfileMetric[] = [
    { label: "Campaigns", value: formatCount(fundraisers.length), icon: Rocket },
    { label: "Followers", value: formatCount(followerCount), icon: Users },
    { label: "Raised", value: formatMoney(totalRaised), icon: DollarSign },
  ];
  if (org.average_rating && org.review_count) {
    metrics.push({ label: "Rating", value: Number(org.average_rating).toFixed(1), icon: Star });
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-zinc-950 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <ProfileHeader
          avatarSrc={org.photo}
          name={stripEmojis(org.name) || "Organization"}
          badge={
            <>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${orgTypeColor}`}>
                {orgTypeLabel}
              </span>
              <OrganizationStatusBadge
                verified={verificationFacts.organizationVerified}
                applicable={verificationFacts.organizationApplicable}
              />
            </>
          }
          subline={`${formatCount(followerCount)} followers`}
          ratingSlot={
            org.average_rating && org.review_count ? (
              <span className="flex items-center gap-1">
                <StarRating value={Number(org.average_rating)} size={16} />
                <span className="text-xs text-zinc-500">({org.review_count})</span>
              </span>
            ) : undefined
          }
          actions={
            isOwner ? (
              <Link
                href={`/dashboard/org/${org.id}/settings`}
                className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            ) : (
              <FollowButton isFollowing={isFollowing} onToggle={toggleFollow} />
            )
          }
          socialRow={<SocialIconRow org={org} align="center" />}
        />

        <div className="mt-8 grid gap-8 border-t border-zinc-200 pt-8 lg:grid-cols-[288px_1fr]">
          <ProfileSidebar metrics={metrics} className="lg:border-r lg:border-zinc-200 lg:pr-8">
            <ConnectSection org={org} />
          </ProfileSidebar>

          <div className="min-w-0 space-y-6">
            {visibleTabs.length > 0 ? (
              <>
                <ProfileTabs tabs={visibleTabs} activeId={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

                {activeTab === "overview" && showOverview && (
                  <div className="space-y-5">
                    {hasBio && (
                      <ProfileSection title="About">
                        <p className="text-sm leading-relaxed text-zinc-700">{org.bio}</p>
                      </ProfileSection>
                    )}
                    {hasCampaigns && (
                      <ProfileSection title="Top Campaigns">
                        <div className="space-y-3">
                          {fundraisers.slice(0, 3).map((f) => (
                            <CampaignRow key={f.id} f={f} />
                          ))}
                          {fundraisers.length > 3 && (
                            <button
                              type="button"
                              onClick={() => setActiveTab("campaigns")}
                              className="text-sm font-bold text-brand-700 hover:text-brand-800"
                            >
                              View all {fundraisers.length} campaigns →
                            </button>
                          )}
                        </div>
                      </ProfileSection>
                    )}
                  </div>
                )}

                {activeTab === "campaigns" && showCampaigns && (
                  <ProfileSection title="Campaigns">
                    <div className="space-y-3">
                      {fundraisers.map((f) => (
                        <CampaignRow key={f.id} f={f} />
                      ))}
                    </div>
                  </ProfileSection>
                )}

                {activeTab === "about" && showAbout && (
                  <div className="space-y-5">
                    {hasBio && (
                      <ProfileSection title="About">
                        <p className="text-sm leading-relaxed text-zinc-700">{org.bio}</p>
                      </ProfileSection>
                    )}
                    <ConnectSection org={org} />
                    {hasSocials &&
                      (hasBio || hasContact ? (
                        <div className="pt-1">
                          <SocialIconRow org={org} align="start" />
                        </div>
                      ) : (
                        <ProfileSection title="Connect">
                          <SocialIconRow org={org} align="start" />
                        </ProfileSection>
                      ))}
                  </div>
                )}

                {activeTab === "reviews" && showReviews && (
                  <ProfileSection title="Reviews">
                    <ReviewSection
                      targetType="organizer"
                      targetId={org.id}
                      accentColor="orange"
                      initialAverage={org.average_rating ?? undefined}
                      initialCount={org.review_count ?? undefined}
                    />
                  </ProfileSection>
                )}
              </>
            ) : (
              <p className="py-8 text-center text-sm font-medium text-zinc-500">
                This organizer hasn&apos;t added any public content yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
