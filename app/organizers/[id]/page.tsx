"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

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
  const [followerCount, setFollowerCount] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

      setOrganizer(org);
      setIsOwner(session?.user?.id === org.user_id);

      const { data: evts } = await supabase
        .from("events")
        .select("id, title, slug, event_date, venue, city, banner, category, user_id")
        .eq("organizer_id", organizerId)
        .order("event_date", { ascending: true });

      setEvents(evts ?? []);

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
    if (!currentUserId || !organizer) {
      router.push("/login");
      return;
    }

    if (isFollowing) {
      const { error } = await supabase
        .from("organizer_follows")
        .delete()
        .eq("organizer_id", organizer.id)
        .eq("user_id", currentUserId);

      if (!error) {
        setIsFollowing(false);
        setFollowerCount((count) => Math.max(0, count - 1));
      }
    } else {
      const { error } = await supabase
        .from("organizer_follows")
        .insert({ organizer_id: organizer.id, user_id: currentUserId });

      if (!error) {
        setIsFollowing(true);
        setFollowerCount((count) => count + 1);
      }
    }
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

  if (!organizer) return null;

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <Navbar />

      <section className="border-b border-zinc-200 bg-white">
        <div className="relative h-[300px] w-full overflow-hidden bg-zinc-900 md:h-[360px]">
          {organizer.banner ? (
            <img src={organizer.banner} alt="" fetchPriority="high" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[linear-gradient(135deg,#27272a_0%,#52525b_100%)]" />
          )}
          <div className="absolute inset-0 bg-black/5" />

          {isOwner && (
            <Link
              href={`/organizers/${organizer.id}/edit`}
              className="absolute bottom-5 right-6 rounded-xl bg-black/70 px-5 py-3 text-base font-bold text-white backdrop-blur transition hover:bg-black"
            >
              Edit profile
            </Link>
          )}
        </div>

        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            <div className="flex flex-col gap-7 md:flex-row md:items-start">
              <div className="-mt-28 h-44 w-44 flex-shrink-0 overflow-hidden rounded-xl border-4 border-white bg-zinc-900 shadow-xl md:h-48 md:w-48">
                {organizer.photo ? (
                  <img src={organizer.photo} alt={organizer.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-6xl font-black text-white">
                    {organizer.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="mb-3 text-sm font-black uppercase tracking-wide text-orange-600">
                  Organizer
                </p>
                <h1 className="text-4xl font-black leading-tight text-zinc-950 md:text-5xl">
                  {organizer.name}
                </h1>

                <div className="mt-8 grid max-w-2xl grid-cols-2 gap-y-6 sm:grid-cols-4">
                  {[
                    { label: "followers", value: formatCount(followerCount) },
                    { label: "hosting", value: events.length > 0 ? "active" : "new" },
                    { label: "total events", value: formatCount(events.length) },
                    { label: "upcoming", value: formatCount(upcomingEvents.length) },
                  ].map((stat) => (
                    <div key={stat.label} className="pr-5">
                      <p className="text-sm font-semibold text-zinc-500">{stat.label}</p>
                      <p className="mt-2 text-2xl font-black text-zinc-950">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <p className="mt-8 max-w-3xl text-lg leading-8 text-zinc-700">
                  {organizer.bio || "Follow this organizer to stay in the loop for future events and announcements."}
                </p>

                <button className="mt-5 text-base font-black text-orange-700 hover:text-orange-800">
                  Read more
                </button>

                <div className="mt-8 flex flex-wrap gap-3">
                  {organizer.website && (
                    <a
                      href={organizer.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Website"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
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
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-300 bg-white text-lg font-black text-zinc-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
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
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-300 bg-white text-base font-black text-zinc-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
                    >
                      X
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <button
                onClick={toggleFollow}
                className={`w-full rounded-lg px-6 py-4 text-lg font-black transition ${
                  isFollowing
                    ? "border-2 border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50"
                    : "bg-orange-500 text-white hover:bg-orange-600"
                }`}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-zinc-950">Contact the organizer</h2>
              <div className="mt-5 space-y-3 text-base text-zinc-700">
                <p className="font-bold text-zinc-950">Frequently asked questions</p>
                <p>Can I get a refund?</p>
                <p>How do I update my ticket information?</p>
                <p>Where are my tickets?</p>
              </div>
              <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-zinc-200 bg-white px-5 py-4 text-base font-black text-zinc-950 transition hover:bg-zinc-50">
                <MailIcon />
                Contact
              </button>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-zinc-950">Share</h2>
              <button
                onClick={shareProfile}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-zinc-200 bg-white px-5 py-4 text-base font-black text-zinc-950 transition hover:bg-zinc-50"
              >
                <LinkIcon />
                Copy URL
              </button>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 border-b-2 border-zinc-200">
          <div className="flex gap-5">
            {(["upcoming", "past"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`-mb-0.5 border-b-2 px-7 py-4 text-xl font-black capitalize transition ${
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
          <div className="rounded-2xl border border-zinc-200 bg-white px-8 py-20 text-center">
            <h2 className="text-3xl font-black text-zinc-950">No {activeTab} events yet.</h2>
            <p className="mt-3 text-lg text-zinc-500">
              Events from this organizer will show here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayedEvents.map((event) => (
              <div
                key={event.id}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <Link href={`/events/${event.slug}`} className="group block">
                  <div className="h-48 overflow-hidden bg-zinc-200">
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
                  <div className="p-5">
                    <p className="text-sm font-black uppercase tracking-wide text-orange-600">
                      {formatEventDate(event.event_date)}
                    </p>
                    <h3 className="mt-3 text-2xl font-black leading-tight text-zinc-950">
                      {event.title}
                    </h3>
                    <p className="mt-3 text-lg text-zinc-600">
                      {event.city || event.venue || "Location TBA"}
                    </p>
                    <p className="mt-4 text-base font-bold text-zinc-900">
                      {event.category || "Event"}
                    </p>
                  </div>
                </Link>
                {isOwner && (
                  <div className="border-t border-zinc-100 px-5 py-4">
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
