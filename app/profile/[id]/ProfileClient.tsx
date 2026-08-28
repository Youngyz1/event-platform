"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { safeImageSrc } from "@/lib/image-url";
import LocalBrandedPlaceholder from "@/components/ui/LocalBrandedPlaceholder";
import ProgressBar from "@/components/ui/ProgressBar";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileSidebar from "@/components/profile/ProfileSidebar";
import ProfileMetrics, { type ProfileMetric } from "@/components/profile/ProfileMetrics";
import ProfileTabs, { type ProfileTab } from "@/components/profile/ProfileTabs";
import ProfileSection from "@/components/profile/ProfileSection";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import FollowButton from "@/components/profile/FollowButton";
import ShareButton from "@/components/profile/ShareButton";
import IdentityStatusBadge from "@/components/trust/IdentityStatusBadge";
import { Users, UserPlus, Pencil, Heart, Rocket, ArrowUpRight, Lock } from "lucide-react";
import type { DonorStats } from "@/lib/donor-stats";

interface ProfileClientProps {
  profile: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isOwnProfile: boolean;
  isLoggedIn: boolean;
  /** From identity_verification, via a service-role read in page.tsx — this
   *  page is public, and that table's RLS is owner-or-admin only. */
  identityVerified: boolean;
  personalCampaigns: FundraiserItem[];
}

type TabId = "overview" | "campaigns" | "followers" | "following" | "giving";

type ListedProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
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

const FOLLOW_LIST_TIMEOUT_MS = 15000;

/** Caps a stalled (never resolving/rejecting) request so loading state can't hang forever. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    ),
  ]);
}

/** Two-step fetch — `follows` only FKs to auth.users, not public_profiles, so no embedded join is possible. */
async function fetchFollowList(
  direction: "followers" | "following",
  profileId: string
): Promise<ListedProfile[]> {
  const targetColumn = direction === "followers" ? "following_id" : "follower_id";
  const idColumn = direction === "followers" ? "follower_id" : "following_id";

  const { data: rows } = await supabase
    .from("follows")
    .select(idColumn)
    .eq(targetColumn, profileId)
    .order("created_at", { ascending: false })
    .limit(50);

  const ids = (rows ?? [])
    .map((r: Record<string, string>) => r[idColumn])
    .filter(Boolean);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("public_profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids);

  return (profiles ?? []) as ListedProfile[];
}

function formatMoney(val: number | string | null) {
  const n = Number(val ?? 0);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

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

function ProfileListRow({ profile }: { profile: ListedProfile }) {
  const name = profile.display_name || "Fund4Good Member";
  return (
    <Link
      href={`/profile/${profile.id}`}
      className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-zinc-50"
    >
      <ProfileAvatar src={profile.avatar_url} name={name} size="sm" />
      <span className="truncate text-sm font-bold text-zinc-800">{name}</span>
    </Link>
  );
}

function EmptyListState({ label }: { label: string }) {
  return <p className="py-8 text-center text-sm font-medium text-zinc-500">{label}</p>;
}

function PrivateListNotice({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-zinc-400">
      <Lock className="h-8 w-8" />
      <p className="text-sm font-medium">
        Only <span className="font-bold text-zinc-600">{name}</span> can see this list.
      </p>
    </div>
  );
}

export default function ProfileClient({
  profile,
  followerCount: initialFollowerCount,
  followingCount,
  isFollowing: initialIsFollowing,
  isOwnProfile,
  isLoggedIn,
  identityVerified,
  personalCampaigns,
}: ProfileClientProps) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [pending, setPending] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const [campaignsList] = useState<FundraiserItem[]>(personalCampaigns);

  const [followersList, setFollowersList] = useState<ListedProfile[] | null>(null);
  const [followingList, setFollowingList] = useState<ListedProfile[] | null>(null);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);

  // Donor giving history state (for profile owner)
  const [donorStats, setDonorStats] = useState<DonorStats | null>(null);
  const [givingLoading, setGivingLoading] = useState(false);

  const name = profile.display_name || "Fund4Good Member";

  async function handleFollow() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setIsFollowing(data.following);
        setFollowerCount(data.followerCount);
      }
    } finally {
      setPending(false);
    }
  }

  async function handleTabChange(id: string) {
    const tabId = id as TabId;
    setActiveTab(tabId);

    if (tabId === "followers" && followersList === null) {
      // Non-owners are gated at the RLS layer (migration_71) and shown a lock
      // message by the render block below — no need to attempt a fetch that
      // would return zero rows anyway.
      if (!isOwnProfile) return;
      setFollowersLoading(true);
      try {
        setFollowersList(await withTimeout(fetchFollowList("followers", profile.id), FOLLOW_LIST_TIMEOUT_MS));
      } catch (error) {
        console.error("Failed to load followers:", error);
        setFollowersList([]);
      } finally {
        setFollowersLoading(false);
      }
    } else if (tabId === "following" && followingList === null) {
      if (!isOwnProfile) return;
      setFollowingLoading(true);
      try {
        setFollowingList(await withTimeout(fetchFollowList("following", profile.id), FOLLOW_LIST_TIMEOUT_MS));
      } catch (error) {
        console.error("Failed to load following:", error);
        setFollowingList([]);
      } finally {
        setFollowingLoading(false);
      }
    } else if (tabId === "giving" && donorStats === null) {
      setGivingLoading(true);
      try {
        const res = await fetch("/api/donor/history");
        if (res.ok) {
          const json = await res.json();
          setDonorStats(json.stats ?? null);
        }
      } catch (error) {
        console.error("Failed to load donor giving history:", error);
      } finally {
        setGivingLoading(false);
      }
    }
  }

  const metrics: ProfileMetric[] = [
    { label: "Campaigns", value: campaignsList.length.toString(), icon: Rocket },
    { label: "Followers", value: followerCount.toLocaleString(), icon: Users },
    { label: "Following", value: followingCount.toLocaleString(), icon: UserPlus },
  ];

  if (isOwnProfile && donorStats) {
    metrics.push({
      label: "Total Donated",
      value: `$${donorStats.totalDonated.toFixed(2)}`,
      icon: Heart,
    });
  }

  const tabs: ProfileTab[] = [
    { id: "overview", label: "Overview" },
    { id: "campaigns", label: "Campaigns", count: campaignsList.length },
    { id: "followers", label: "Followers", count: followerCount },
    { id: "following", label: "Following", count: followingCount },
  ];

  if (isOwnProfile) {
    tabs.push({
      id: "giving",
      label: "My Giving",
      count: donorStats?.perFundraiser.length,
    });
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-zinc-950 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <ProfileHeader
          avatarSrc={profile.avatar_url}
          name={name}
          badge={
            <>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-600">
                Public profile
              </span>
              <IdentityStatusBadge verified={identityVerified} />
            </>
          }
          actions={
            isOwnProfile ? (
              <Link
                href="/dashboard/settings/profile"
                className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800"
              >
                <Pencil className="h-4 w-4" />
                Edit Profile
              </Link>
            ) : (
              <>
                <FollowButton isFollowing={isFollowing} isLoading={pending} onToggle={handleFollow} />
                <ShareButton getUrl={() => `${window.location.origin}/profile/${profile.id}`} />
              </>
            )
          }
        />

        <div className="mt-8 grid gap-8 border-t border-zinc-200 pt-8 lg:grid-cols-[288px_1fr]">
          <ProfileSidebar metrics={metrics} className="lg:border-r lg:border-zinc-200 lg:pr-8" />

          <div className="min-w-0 space-y-5">
            <div className="lg:hidden">
              <ProfileMetrics metrics={metrics} layout="strip" />
            </div>

            <ProfileTabs tabs={tabs} activeId={activeTab} onChange={handleTabChange} />

            {activeTab === "overview" && (
              <div className="space-y-5">
                <div className="py-1">
                  <p className="text-sm font-medium text-zinc-500">
                    {name} is a member of the Fund4Good community.
                  </p>
                </div>
                {campaignsList.length > 0 && (
                  <ProfileSection title="Campaigns">
                    <div className="space-y-3">
                      {campaignsList.slice(0, 3).map((f) => (
                        <CampaignRow key={f.id} f={f} />
                      ))}
                    </div>
                  </ProfileSection>
                )}
              </div>
            )}

            {activeTab === "campaigns" && (
              <ProfileSection title="Campaigns">
                {campaignsList.length === 0 ? (
                  <EmptyListState label="No campaigns created yet." />
                ) : (
                  <div className="space-y-3">
                    {campaignsList.map((f) => (
                      <CampaignRow key={f.id} f={f} />
                    ))}
                  </div>
                )}
              </ProfileSection>
            )}

            {activeTab === "followers" && (
              <div className="py-1">
                {!isOwnProfile ? (
                  <PrivateListNotice name={name} />
                ) : followersLoading || followersList === null ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
                  </div>
                ) : followersList.length === 0 ? (
                  <EmptyListState label="No followers yet." />
                ) : (
                  <div className="space-y-1">
                    {followersList.map((p) => (
                      <ProfileListRow key={p.id} profile={p} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "following" && (
              <div className="py-1">
                {!isOwnProfile ? (
                  <PrivateListNotice name={name} />
                ) : followingLoading || followingList === null ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
                  </div>
                ) : followingList.length === 0 ? (
                  <EmptyListState label="Not following anyone yet." />
                ) : (
                  <div className="space-y-1">
                    {followingList.map((p) => (
                      <ProfileListRow key={p.id} profile={p} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "giving" && isOwnProfile && (
              <div className="py-1 space-y-6">
                {givingLoading || donorStats === null ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
                  </div>
                ) : donorStats.perFundraiser.length === 0 ? (
                  <EmptyListState label="You haven't made any donations yet." />
                ) : (
                  <>
                    {/* Summary stats */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                        <p className="text-xs font-black uppercase tracking-wider text-zinc-400">Total Donated</p>
                        <p className="mt-1 text-2xl font-black text-brand-800">
                          ${donorStats.totalDonated.toFixed(2)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                        <p className="text-xs font-black uppercase tracking-wider text-zinc-400">Total Gifts</p>
                        <p className="mt-1 text-2xl font-black text-zinc-950">
                          {donorStats.donationCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                        <p className="text-xs font-black uppercase tracking-wider text-zinc-400">Causes Supported</p>
                        <p className="mt-1 text-2xl font-black text-zinc-950">
                          {donorStats.perFundraiser.length}
                        </p>
                      </div>
                    </div>

                    {/* Per-campaign table */}
                    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                      <div className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-400">
                        Supported Campaigns
                      </div>
                      <div className="divide-y divide-zinc-100">
                        {donorStats.perFundraiser.map((pf) => (
                          <div
                            key={pf.fundraiser_id}
                            className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-zinc-50/60 transition"
                          >
                            <div>
                              <Link
                                href={pf.slug ? `/fundraisers/${pf.slug}` : `/fundraisers/${pf.fundraiser_id}`}
                                className="font-bold text-zinc-900 hover:text-brand-700 hover:underline"
                              >
                                {pf.title}
                              </Link>
                              <p className="mt-0.5 text-xs text-zinc-500">
                                {pf.donationCount} {pf.donationCount === 1 ? "donation" : "donations"}
                              </p>
                            </div>
                            <span className="font-black text-brand-800 text-sm sm:text-base">
                              ${pf.subtotal.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
