"use client";

/**
 * app/admin/homepage/HomepageFeaturedClient.tsx
 * Interactive toggle list for marking events/fundraisers as homepage featured.
 */

import { useState, useTransition } from "react";
import { supabase } from "@/lib/supabase";
import { Star, StarOff } from "lucide-react";

interface AdminEvent {
  id:                  string;
  title:               string;
  slug:                string;
  status?:             string | null;
  is_homepage_featured?: boolean | null;
}

interface AdminFundraiser {
  id:                  string;
  title:               string;
  slug:                string;
  is_homepage_featured?: boolean | null;
}

interface Props {
  initialEvents:      AdminEvent[];
  initialFundraisers: AdminFundraiser[];
}

function ToggleRow({
  id, title, featured, table, onToggle,
}: {
  id: string;
  title: string;
  featured: boolean;
  table: "events" | "fundraisers";
  onToggle: (id: string, next: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();

  async function handleToggle() {
    const next = !featured;
    onToggle(id, next);
    startTransition(async () => {
      await supabase
        .from(table)
        .update({ is_homepage_featured: next })
        .eq("id", id);
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-zinc-100 last:border-0">
      <p className="text-sm font-semibold text-zinc-800 truncate flex-1">{title}</p>
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-black transition-colors ${
          featured
            ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
            : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
        }`}
      >
        {featured ? (
          <><Star className="w-3.5 h-3.5 fill-orange-500 text-orange-500" /> Featured</>
        ) : (
          <><StarOff className="w-3.5 h-3.5" /> Not Featured</>
        )}
      </button>
    </div>
  );
}

export default function HomepageFeaturedClient({ initialEvents, initialFundraisers }: Props) {
  const [events,      setEvents]      = useState(initialEvents);
  const [fundraisers, setFundraisers] = useState(initialFundraisers);

  function toggleEvent(id: string, next: boolean) {
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, is_homepage_featured: next } : e));
  }
  function toggleFundraiser(id: string, next: boolean) {
    setFundraisers((prev) => prev.map((f) => f.id === id ? { ...f, is_homepage_featured: next } : f));
  }

  const featuredEventCount      = events.filter((e) => e.is_homepage_featured).length;
  const featuredFundraiserCount = fundraisers.filter((f) => f.is_homepage_featured).length;

  return (
    <div className="space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-zinc-950">Homepage Featured</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Toggle which events and fundraisers appear in the homepage sliders. If fewer than 4 are featured, the slider falls back to the most recent approved items.
        </p>
      </div>

      {/* Events section */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-black text-zinc-950">Featured Events</h2>
          <span className="rounded-full bg-orange-100 text-orange-700 text-xs font-black px-2.5 py-1">
            {featuredEventCount} featured
          </span>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-zinc-400">No events found.</p>
        ) : (
          <div>
            {events.map((ev) => (
              <ToggleRow
                key={ev.id}
                id={ev.id}
                title={ev.title}
                featured={!!ev.is_homepage_featured}
                table="events"
                onToggle={toggleEvent}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fundraisers section */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-black text-zinc-950">Featured Fundraisers</h2>
          <span className="rounded-full bg-emerald-100 text-emerald-700 text-xs font-black px-2.5 py-1">
            {featuredFundraiserCount} featured
          </span>
        </div>
        {fundraisers.length === 0 ? (
          <p className="text-sm text-zinc-400">No fundraisers found.</p>
        ) : (
          <div>
            {fundraisers.map((f) => (
              <ToggleRow
                key={f.id}
                id={f.id}
                title={f.title}
                featured={!!f.is_homepage_featured}
                table="fundraisers"
                onToggle={toggleFundraiser}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
