"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Event = {
  id: string;
  title: string;
  slug: string;
  category: string;
  event_date: string;
  city: string;
};

type Fundraiser = {
  id: string;
  title: string;
  slug: string;
  goal: number;
  raised: number;
};

type Organizer = {
  id: string;
  name: string;
  bio: string | null;
  photo: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      setEmail(session.user.email ?? "");

      const { data: userEvents } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      const { data: userFundraisers } = await supabase
        .from("fundraisers")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      const { data: userOrganizers } = await supabase
        .from("organizers")
        .select("id, name, bio, photo")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      setEvents(userEvents || []);
      setFundraisers(userFundraisers || []);
      setOrganizers(userOrganizers || []);
      setLoading(false);
    }

    load();
  }, [router]);

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    await supabase.from("events").delete().eq("id", id);
    setEvents(events.filter((e) => e.id !== id));
  }

  async function deleteFundraiser(id: string) {
    if (!confirm("Delete this fundraiser?")) return;
    await supabase.from("fundraisers").delete().eq("id", id);
    setFundraisers(fundraisers.filter((f) => f.id !== id));
  }

  async function deleteOrganizer(id: string) {
    if (!confirm("Delete this organizer profile? Events will remain in your account but will no longer show on this organizer page.")) return;
    await supabase.from("organizers").delete().eq("id", id);
    setOrganizers(organizers.filter((o) => o.id !== id));
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <p className="text-zinc-400 text-lg">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <section className="max-w-6xl mx-auto px-6 py-20">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <p className="text-orange-500 font-semibold mb-2">My Dashboard</p>
            <h1 className="text-5xl font-black">Welcome back</h1>
            <p className="text-zinc-500 mt-2">{email}</p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/create-organizer"
              className="bg-zinc-900 hover:bg-black text-white px-6 py-3 rounded-2xl font-semibold transition"
            >
              + New Organizer
            </Link>
            <Link
              href="/import"
              className="bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 px-6 py-3 rounded-2xl font-semibold transition"
            >
              Import CSV
            </Link>
            <Link
              href="/eventbrite-sync"
              className="bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 px-6 py-3 rounded-2xl font-semibold transition"
            >
              Eventbrite Sync
            </Link>
            <Link
              href="/gofundme-sync"
              className="bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 px-6 py-3 rounded-2xl font-semibold transition"
            >
              GoFundMe Sync
            </Link>
            <Link
              href="/create-event"
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-semibold transition"
            >
              + New Event
            </Link>
            <Link
              href="/create-fundraiser"
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-2xl font-semibold transition"
            >
              + New Fundraiser
            </Link>
          </div>
        </div>

        {/* ORGANIZERS */}
        <div className="mb-16">
          <h2 className="text-3xl font-black mb-8">My Organizer Profiles</h2>

          {organizers.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-3xl p-10 text-center">
              <p className="text-zinc-500 text-lg">No organizer profiles yet.</p>
              <Link href="/create-organizer" className="text-orange-500 font-semibold mt-2 inline-block">
                Create your first organizer profile →
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {organizers.map((organizer) => (
                <div
                  key={organizer.id}
                  className="bg-white border border-zinc-200 rounded-2xl p-6 flex items-center justify-between gap-5"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-14 h-14 rounded-full bg-zinc-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {organizer.photo ? (
                        <img src={organizer.photo} alt={organizer.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-black text-zinc-500">
                          {organizer.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold truncate">{organizer.name}</h3>
                      <p className="text-zinc-500 mt-1 line-clamp-1">
                        {organizer.bio || "Business page"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Link
                      href={`/organizers/${organizer.id}`}
                      className="text-sm font-semibold text-zinc-600 hover:text-black border border-zinc-200 px-4 py-2 rounded-xl transition"
                    >
                      View
                    </Link>
                    <Link
                      href={`/organizers/${organizer.id}/edit`}
                      className="text-sm font-semibold text-orange-600 hover:text-orange-700 border border-orange-200 px-4 py-2 rounded-xl transition"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => deleteOrganizer(organizer.id)}
                      className="text-sm font-semibold text-red-500 hover:text-red-600 border border-red-200 px-4 py-2 rounded-xl transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* EVENTS */}
        <div className="mb-16">
          <h2 className="text-3xl font-black mb-8">My Events</h2>

          {events.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-3xl p-10 text-center">
              <p className="text-zinc-500 text-lg">No events yet.</p>
              <Link href="/create-event" className="text-orange-500 font-semibold mt-2 inline-block">
                Create your first event →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="bg-white border border-zinc-200 rounded-2xl p-6 flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-xl font-bold">{event.title}</h3>
                    <p className="text-zinc-500 mt-1">
                      {event.category} •{" "}
                      {event.event_date
                        ? new Date(event.event_date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })
                        : "Date TBA"}{" "}
                      {event.city ? `• ${event.city}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/events/${event.slug}`}
                      className="text-sm font-semibold text-zinc-600 hover:text-black border border-zinc-200 px-4 py-2 rounded-xl transition"
                    >
                      View
                    </Link>
                    <Link
                      href={`/events/edit/${event.id}`}
                      className="text-sm font-semibold text-orange-600 hover:text-orange-700 border border-orange-200 px-4 py-2 rounded-xl transition"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => deleteEvent(event.id)}
                      className="text-sm font-semibold text-red-500 hover:text-red-600 border border-red-200 px-4 py-2 rounded-xl transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FUNDRAISERS */}
        <div>
          <h2 className="text-3xl font-black mb-8">My Fundraisers</h2>

          {fundraisers.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-3xl p-10 text-center">
              <p className="text-zinc-500 text-lg">No fundraisers yet.</p>
              <Link href="/create-fundraiser" className="text-green-600 font-semibold mt-2 inline-block">
                Start your first fundraiser →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {fundraisers.map((f) => {
                const progress = f.goal
                  ? Math.min(Math.round((f.raised / f.goal) * 100), 100)
                  : 0;
                return (
                  <div
                    key={f.id}
                    className="bg-white border border-zinc-200 rounded-2xl p-6 flex items-center justify-between"
                  >
                    <div className="flex-1 mr-8">
                      <h3 className="text-xl font-bold">{f.title}</h3>
                      <p className="text-zinc-500 mt-1">
                        ${f.raised?.toLocaleString() ?? 0} raised of ${f.goal?.toLocaleString()}
                      </p>
                      <div className="w-full h-2 bg-zinc-200 rounded-full mt-3 overflow-hidden">
                        <div
                          className="bg-green-500 h-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/fundraisers/${f.slug}`}
                        className="text-sm font-semibold text-zinc-600 hover:text-black border border-zinc-200 px-4 py-2 rounded-xl transition"
                      >
                        View
                      </Link>
                      <Link
                        href={`/fundraisers/edit/${f.id}`}
                        className="text-sm font-semibold text-green-600 hover:text-green-700 border border-green-200 px-4 py-2 rounded-xl transition"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => deleteFundraiser(f.id)}
                        className="text-sm font-semibold text-red-500 hover:text-red-600 border border-red-200 px-4 py-2 rounded-xl transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </section>
    </main>
  );
}
