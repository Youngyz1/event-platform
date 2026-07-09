"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  const name = profile.display_name || "Fund4Good Member";
  const avatarInitial = name.trim().charAt(0).toUpperCase() || "M";

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

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-12 text-zinc-950">
      <section className="mx-auto max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        {/* Avatar + name */}
        <div className="flex items-center gap-5">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-20 w-20 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-3xl font-black text-emerald-700">
              {avatarInitial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
              Public profile
            </p>
            <h1 className="mt-1 truncate text-3xl font-black">{name}</h1>
          </div>
        </div>

        {/* Follower / Following counts */}
        <div className="mt-6 flex gap-6 border-t border-zinc-100 pt-6">
          <div className="text-center">
            <p className="text-2xl font-black text-zinc-950">
              {followerCount.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-zinc-400">
              Followers
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-zinc-950">
              {followingCount.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-zinc-400">
              Following
            </p>
          </div>
        </div>

        {/* Follow / Unfollow button — hidden on own profile */}
        {!isOwnProfile && (
          <div className="mt-6">
            <button
              type="button"
              onClick={handleFollow}
              disabled={pending}
              className={`w-full rounded-full py-2.5 text-sm font-bold transition disabled:opacity-60 ${
                isFollowing
                  ? "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              {pending ? "…" : isFollowing ? "Following" : "Follow"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
