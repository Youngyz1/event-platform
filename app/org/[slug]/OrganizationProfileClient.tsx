"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import StarRating from "@/components/StarRating";
import ReviewSection from "@/components/ReviewSection";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileSidebar from "@/components/profile/ProfileSidebar";
import ProfileMetrics, { type ProfileMetric } from "@/components/profile/ProfileMetrics";
import ProfileTabs, { type ProfileTab } from "@/components/profile/ProfileTabs";
import ProfileSection from "@/components/profile/ProfileSection";
import FollowButton from "@/components/profile/FollowButton";
import ShareButton from "@/components/profile/ShareButton";
import {
  Globe, Mail, Calendar, ExternalLink, ArrowUpRight,
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

function EmptyTabState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100">
        <Calendar className="h-6 w-6 text-zinc-400" />
      </div>
      <p className="text-sm font-medium text-zinc-500">{label}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
    </div>
  );
}

import { safeImageSrc } from "@/lib/image-url";
import LocalBrandedPlaceholder from "@/components/ui/LocalBrandedPlaceholder";
import ProgressBar from "@/components/ui/ProgressBar";

function CampaignRow({ f }: { f: FundraiserItem }) {
  const [imgError, setImgError] = useState(false);
  const goal = Number(f.goal ?? 0);
  const raised = Number(f.raised ?? 0);
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  const imageSrc = !imgError ? safeImageSrc(f.image_url || f.banner) : null;

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
          {f.title}
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
  const hasConnect =
    org.website || org.contact_email || org.facebook || org.twitter ||
    org.instagram || org.linkedin || org.youtube || org.tiktok;
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
      <div className="mt-4 flex flex-wrap gap-2">
        <SocialLink href={org.facebook} icon={FaFacebookF} label="Facebook" />
        <SocialLink href={org.twitter} icon={FaXTwitter} label="X (Twitter)" />
        <SocialLink href={org.instagram} icon={FaInstagram} label="Instagram" />
        <SocialLink href={org.linkedin} icon={FaLinkedinIn} label="LinkedIn" />
        <SocialLink href={org.youtube} icon={FaYoutube} label="YouTube" />
        <SocialLink href={org.tiktok} icon={FaTiktok} label="TikTok" />
      </div>
    </ProfileSection>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OrganizationProfileClient({
  initialData,
}: {
  initialData: Organization;
}) {
  const router = useRouter();
  const [org] = useState<Organization>(initialData);
  const [fundraisers, setFundraisers] = useState<FundraiserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(org.follower_offset ?? 0);
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  useEffect(() => {
    let settled = false;

    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setCurrentUserId(session.user.id);
          setIsOwner(session.user.id === org.user_id);
        }

        const [{ data: raisers }, { count }] = await Promise.all([
          supabase
            .from("fundraisers")
            .select("id, title, slug, banner, image_url, goal, raised, category")
            .eq("organizer_id", org.id)
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
          supabase
            .from("organizer_follows")
            .select("*", { count: "exact", head: true })
            .eq("organizer_id", org.id),
        ]);

        setFundraisers(raisers ?? []);
        setFollowerCount((count ?? 0) + (org.follower_offset ?? 0));

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
      } finally {
        settled = true;
        setLoading(false);
      }
    }
    load();

    // Safety net: a stalled (never resolving/rejecting) request would otherwise
    // leave the page spinning forever — try/catch alone can't help since nothing
    // throws in that case. Cap the wait so the UI always recovers to an
    // (possibly incomplete) loaded state.
    const timeout = setTimeout(() => {
      if (!settled) {
        console.error("Organizer profile data load timed out");
        setLoading(false);
      }
    }, 15000);

    return () => clearTimeout(timeout);
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
  const verified = org.status === "verified";
  const totalRaised = fundraisers.reduce((sum, f) => sum + Number(f.raised ?? 0), 0);

  const metrics: ProfileMetric[] = [
    { label: "Campaigns", value: formatCount(fundraisers.length), icon: Rocket },
    { label: "Followers", value: formatCount(followerCount), icon: Users },
    { label: "Raised", value: formatMoney(totalRaised), icon: DollarSign },
  ];
  if (org.average_rating && org.review_count) {
    metrics.push({ label: "Rating", value: Number(org.average_rating).toFixed(1), icon: Star });
  }

  const tabs: ProfileTab[] = [
    { id: "overview", label: "Overview" },
    { id: "campaigns", label: "Campaigns", count: fundraisers.length },
    { id: "about", label: "About" },
    { id: "reviews", label: "Reviews", count: org.review_count ?? undefined },
  ];

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-zinc-950 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <ProfileHeader
          avatarSrc={org.photo}
          name={org.name}
          badge={
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${orgTypeColor}`}>
              {orgTypeLabel}
            </span>
          }
          verified={verified}
          oneLiner={org.bio}
          ratingSlot={
            org.average_rating && org.review_count ? (
              <span className="flex items-center gap-1">
                <StarRating value={Number(org.average_rating)} size={16} />
                <span className="text-xs text-zinc-500">({org.review_count})</span>
              </span>
            ) : undefined
          }
          actions={
            <>
              <FollowButton isFollowing={isFollowing} onToggle={toggleFollow} />
              <ShareButton
                getUrl={() => `${window.location.origin}/org/${org.slug ?? org.id}`}
              />
              {org.contact_email && (
                <a
                  href={`mailto:${org.contact_email}`}
                  className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50"
                >
                  <Mail className="h-4 w-4" />
                  Contact
                </a>
              )}
              {isOwner && (
                <Link
                  href={`/dashboard/org/${org.id}/settings`}
                  className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              )}
            </>
          }
        />

        <div className="mt-8 grid gap-8 border-t border-zinc-200 pt-8 lg:grid-cols-[288px_1fr]">
          <ProfileSidebar metrics={metrics} className="lg:border-r lg:border-zinc-200 lg:pr-8">
            <ConnectSection org={org} />
          </ProfileSidebar>

          <div className="min-w-0 space-y-6">
            <div className="lg:hidden">
              <ProfileMetrics metrics={metrics} layout="strip" />
            </div>

            <ProfileTabs tabs={tabs} activeId={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

            {activeTab === "overview" && (
              <div className="space-y-5">
                {org.bio && (
                  <ProfileSection title="About">
                    <p className="text-sm leading-relaxed text-zinc-700">{org.bio}</p>
                  </ProfileSection>
                )}
                <ProfileSection title="Top Campaigns">
                  {loading ? (
                    <LoadingSpinner />
                  ) : fundraisers.length === 0 ? (
                    <EmptyTabState label="No active campaigns yet." />
                  ) : (
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
                  )}
                </ProfileSection>
              </div>
            )}

            {activeTab === "campaigns" && (
              <ProfileSection title="Campaigns">
                {loading ? (
                  <LoadingSpinner />
                ) : fundraisers.length === 0 ? (
                  <EmptyTabState label="No active campaigns yet." />
                ) : (
                  <div className="space-y-3">
                    {fundraisers.map((f) => (
                      <CampaignRow key={f.id} f={f} />
                    ))}
                  </div>
                )}
              </ProfileSection>
            )}

            {activeTab === "about" && (
              <div className="space-y-5">
                <ConnectSection org={org} />
              </div>
            )}

            {activeTab === "reviews" && (
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
          </div>
        </div>
      </div>
    </main>
  );
}
