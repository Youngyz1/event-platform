"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileSidebar from "@/components/profile/ProfileSidebar";
import ProfileMetrics, { type ProfileMetric } from "@/components/profile/ProfileMetrics";
import ProfileTabs, { type ProfileTab } from "@/components/profile/ProfileTabs";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import FollowButton from "@/components/profile/FollowButton";
import ShareButton from "@/components/profile/ShareButton";
import { Users, UserPlus, Pencil } from "lucide-react";

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
}

type TabId = "overview" | "followers" | "following";

type ListedProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
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

export default function ProfileClient({
  profile,
  followerCount: initialFollowerCount,
  followingCount,
  isFollowing: initialIsFollowing,
  isOwnProfile,
  isLoggedIn,
}: ProfileClientProps) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [pending, setPending] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const [followersList, setFollowersList] = useState<ListedProfile[] | null>(null);
  const [followingList, setFollowingList] = useState<ListedProfile[] | null>(null);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);

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
      setFollowingLoading(true);
      try {
        setFollowingList(await withTimeout(fetchFollowList("following", profile.id), FOLLOW_LIST_TIMEOUT_MS));
      } catch (error) {
        console.error("Failed to load following:", error);
        setFollowingList([]);
      } finally {
        setFollowingLoading(false);
      }
    }
  }

  const metrics: ProfileMetric[] = [
    { label: "Followers", value: followerCount.toLocaleString(), icon: Users },
    { label: "Following", value: followingCount.toLocaleString(), icon: UserPlus },
  ];

  const tabs: ProfileTab[] = [
    { id: "overview", label: "Overview" },
    { id: "followers", label: "Followers", count: followerCount },
    { id: "following", label: "Following", count: followingCount },
  ];

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-zinc-950 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <ProfileHeader
          avatarSrc={profile.avatar_url}
          name={name}
          badge={
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-600">
              Public profile
            </span>
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
              <div className="py-1">
                <p className="text-sm font-medium text-zinc-500">
                  {name} is a member of the Fund4Good community.
                </p>
              </div>
            )}

            {activeTab === "followers" && (
              <div className="py-1">
                {followersLoading || followersList === null ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
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
                {followingLoading || followingList === null ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
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
          </div>
        </div>
      </div>
    </main>
  );
}
