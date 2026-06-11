"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import VerifiedBadge from "@/components/ui/VerifiedBadge";


type Organizer = {
  id: string;
  name: string;
  bio: string | null;
  photo: string | null;
  banner: string | null;
  facebook: string | null;
  twitter: string | null;
  website: string | null;
  user_id: string;
  status: string | null;
  visibility?: "public" | "private" | null;
};

type Event = {
  id: string;
  title: string;
  slug: string;
  event_date: string | null;
  venue: string | null;
  city: string | null;
  banner: string | null;
  category: string | null;
  user_id?: string | null;
};

function formatCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatEventDate(dateStr: string | null) {
  if (!dateStr) return "Date TBA";
  const date = new Date(dateStr);

  return (
    date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) +
    " · " +
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
  );
}

function WebsiteIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.6 9h16.8M3.6 15h16.8M12 3c-2.5 3-4 6-4 9s1.5 6 4 9M12 3c2.5 3 4 6 4 9s-1.5 6-4 9" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16v16H4z" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" />
    </svg>
  );
}

export default function OrganizerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [organizer, setOrganizer] = useState<Organizer | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState("");
  const [followerCount, setFollowerCount] = useState(0);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    const organizerId = params?.id as string;
    if (!organizerId) return;

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) setCurrentUserId(session.user.id);

      const { data: org, error } = await supabase
        .from("organizers")
        .select("*")
        .eq("id", organizerId)
        .single();

      if (error || !org) {
        router.push("/404");
        return;
      }

      const owner = session?.user?.id === org.user_id;
      if ((org.visibility ?? "public") === "private" && !owner) {
        setIsPrivate(true);
        setLoading(false);
        return;
      }

      if (["rejected", "suspended"].includes(org.status ?? "") && !owner) {
        router.push("/404");
        return;
      }

      setOrganizer(org);
      setIsOwner(owner);

      const { data: evts } = await supabase
        .from("events")
        .select("id, title, slug, event_date, venue, city, banner, category, user_id")
        .eq("organizer_id", organizerId)
        .order("event_date", { ascending: true });

      setEvents(evts ?? []);

      if (evts && evts.length > 0) {
        const eventIds = evts.map((event) => event.id);
        const { data: orders } = await supabase
          .from("ticket_orders")
          .select("quantity")
          .in("event_id", eventIds)
          .in("status", ["valid", "used"]);

        setAttendeeCount(
          (orders ?? []).reduce((sum, order) => sum + Number(order.quantity ?? 1), 0)
        );
      }

      const { count } = await supabase
        .from("organizer_follows")
        .select("*", { count: "exact", head: true })
        .eq("organizer_id", organizerId);

      setFollowerCount(count ?? 0);

      if (session?.user) {
        const { data: follow } = await supabase
          .from("organizer_follows")
          .select("id")
          .eq("organizer_id", organizerId)
          .eq("user_id", session.user.id)
          .maybeSingle();

        setIsFollowing(!!follow);
      }

      setLoading(false);
    }

    load();
  }, [params?.id, router]);

  async function toggleFollow() {
    if (!organizer || followLoading) return;

    setFollowLoading(true);
    setFollowError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setFollowLoading(false);
      router.push("/login");
      return;
    }

    setCurrentUserId(user.id);

    if (isFollowing) {
      const { error } = await supabase
        .from("organizer_follows")
        .delete()
        .eq("organizer_id", organizer.id)
        .eq("user_id", user.id);

      if (!error) {
        setIsFollowing(false);
        setFollowerCount((count) => Math.max(0, count - 1));
      } else {
        setFollowError(error.message);
      }
    } else {
      const { error } = await supabase
        .from("organizer_follows")
        .upsert(
          { organizer_id: organizer.id, user_id: user.id },
          { onConflict: "organizer_id,user_id", ignoreDuplicates: true }
        );

      if (!error) {
        setIsFollowing(true);
        setFollowerCount((count) => count + 1);
      } else {
        setFollowError(error.message);
      }
    }

    setFollowLoading(false);
  }

  async function shareProfile() {
    if (typeof window === "undefined") return;
    await navigator.clipboard.writeText(window.location.href);
  }

  const now = new Date();
  const upcomingEvents = events.filter((event) => !event.event_date || new Date(event.event_date) >= now);
  const pastEvents = events.filter((event) => event.event_date && new Date(event.event_date) < now);
  const displayedEvents = activeTab === "upcoming" ? upcomingEvents : pastEvents;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-xl font-semibold text-zinc-400">Loading...</p>
      </main>
    );
  }

  if (isPrivate) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-center">
        <div className="max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-black uppercase tracking-wide text-orange-600">Private organizer</p>
          <h1 className="mt-3 text-3xl font-black text-zinc-950">This organizer profile is private.</h1>
          <p className="mt-3 text-zinc-600">
            The organizer has chosen not to show this profile publicly.
          </p>
          <Link href="/organizers" className="mt-6 inline-flex rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white hover:bg-orange-600">
            Browse organizers
          </Link>
        </div>
      </main>
    );
  }

  if (!organizer) return null;

  return (
    <main className="min-h-screen bg-white text-zinc-950">
       

      <section className="border-b border-zinc-200 bg-white">
        <div className="relative h-[150px] w-full overflow-hidden bg-zinc-900 sm:h-[220px] md:h-[260px]">
          {organizer.banner ? (
            <img src={organizer.banner} alt="" fetchPriority="high" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[linear-gradient(135deg,#27272a_0%,#52525b_100%)]" />
          )}
          <div className="absolute inset-0 bg-black/5" />

          {isOwner && (
            <Link
              href={`/organizers/${organizer.id}/edit`}
              className="absolute bottom-3 right-3 rounded-lg bg-black/75 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-black sm:bottom-5 sm:right-6 sm:px-4 sm:text-sm"
            >
              Edit profile
            </Link>
          )}
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_260px] lg:gap-12 lg:py-8">
          <div className="min-w-0">
            <div className="flex flex-col gap-5 sm:flex-row sm:gap-8 sm:items-start">
              <div className="relative z-20 -mt-20 h-32 w-32 flex-shrink-0 overflow-hidden rounded-full border-4 border-white bg-zinc-900 shadow-xl sm:-mt-24 sm:h-44 sm:w-44">
                {organizer.photo ? (
                  <img src={organizer.photo} alt={organizer.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl font-black text-white sm:text-6xl">
                    {organizer.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-orange-600 sm:text-xs">
                  Organizer
                </p>
                <h1 className="inline-flex flex-wrap items-center gap-2 text-3xl font-black leading-tight text-zinc-950 sm:gap-3 sm:text-4xl">
                  {organizer.name}
                  <VerifiedBadge verified={organizer.status === 'verified'} />
                </h1>

                <div className="mt-5 grid max-w-2xl grid-cols-4 divide-x divide-zinc-200 text-left">
                  {[
                    { label: "followers", value: formatCount(followerCount) },
                    { label: "hosting", value: events.length > 0 ? "active" : "new" },
                    { label: "total events", value: formatCount(events.length) },
                    { label: "total attendees", value: formatCount(attendeeCount) },
                  ].map((stat) => (
                    <div key={stat.label} className="min-w-0 px-2 first:pl-0 sm:px-5">
                      <p className="truncate text-[9px] font-semibold lowercase text-zinc-500 sm:text-sm">{stat.label}</p>
                      <p className="mt-1 text-base font-black text-zinc-950 sm:text-lg">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <p className="mt-6 max-w-3xl text-sm leading-6 text-zinc-600 sm:text-lg sm:leading-8">
                  {organizer.bio || "Follow this organizer to stay in the loop for future events and announcements."}
                </p>

                <button className="mt-4 text-sm font-black text-orange-700 hover:text-orange-800 sm:mt-5 sm:text-base">
                  Read more
                </button>

                <div className="mt-6 flex flex-wrap gap-2 sm:gap-3">
                  {organizer.website && (
                    <a
                      href={organizer.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Website"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 sm:h-11 sm:w-11"
                    >
                      <WebsiteIcon />
                    </a>
                  )}
                  {organizer.facebook && (
                    <a
                      href={organizer.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Facebook"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-lg font-black text-zinc-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 sm:h-11 sm:w-11"
                    >
                      f
                    </a>
                  )}
                  {organizer.twitter && (
                    <a
                      href={organizer.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Twitter / X"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-base font-black text-zinc-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 sm:h-11 sm:w-11"
                    >
                      X
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-3 sm:space-y-4 lg:pt-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <button
                onClick={toggleFollow}
                disabled={followLoading}
                className={`w-full rounded-lg px-5 py-3 text-base font-black transition ${
                  isFollowing
                    ? "border-2 border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50"
                    : "bg-orange-500 text-white hover:bg-orange-600"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {followLoading ? "Saving..." : isFollowing ? "Following" : "Follow"}
              </button>
              {followError && (
                <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700">
                  {followError}
                </p>
              )}
              <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-50">
                <MailIcon />
                Contact
              </button>
              <button
                onClick={shareProfile}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-black text-blue-600 transition hover:bg-blue-50"
              >
                <LinkIcon />
                Share
              </button>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 border-b border-zinc-200 sm:mb-8">
          <div className="flex gap-5 overflow-x-auto">
            {(["upcoming", "past", "collections"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => tab !== "collections" && setActiveTab(tab)}
                className={`-mb-0.5 border-b-2 px-4 py-3 text-base font-black capitalize transition sm:px-7 sm:py-4 sm:text-xl ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {displayedEvents.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white px-6 py-14 text-center sm:rounded-2xl sm:px-8 sm:py-20">
            <h2 className="text-2xl font-black text-zinc-950 sm:text-3xl">No {activeTab} events yet.</h2>
            <p className="mt-3 text-base text-zinc-500 sm:text-lg">
              Events from this organizer will show here.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {displayedEvents.map((event) => (
              <div
                key={event.id}
                className="overflow-hidden bg-white transition hover:-translate-y-1"
              >
                <Link href={`/events/${event.slug}`} className="group block">
                  <div className="h-36 overflow-hidden rounded-lg bg-zinc-200 sm:h-40">
                    {event.banner ? (
                      <img
                        src={event.banner}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#f97316,#ea580c)] text-4xl font-black text-white">
                        {event.title.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="py-3">
                    <p className="text-xs font-bold text-zinc-700">
                      {formatEventDate(event.event_date)}
                    </p>
                    <h3 className="mt-2 text-lg font-black leading-tight text-zinc-900">
                      {event.title}
                    </h3>
                    <p className="mt-2 text-sm font-semibold text-zinc-600">
                      {event.city || event.venue || "Location TBA"}
                    </p>
                    <p className="mt-3 text-sm font-bold text-zinc-900">
                      {event.category || "Event"}
                    </p>
                  </div>
                </Link>
                {isOwner && (
                  <div className="border-t border-zinc-100 px-4 py-3 sm:px-5 sm:py-4">
                    <Link
                      href={`/events/edit/${event.id}`}
                      className="inline-flex rounded-xl border border-orange-200 px-4 py-2 text-sm font-black text-orange-600 transition hover:bg-orange-50"
                    >
                      Edit post
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
