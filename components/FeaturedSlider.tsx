"use client";

import Link from "next/link";
import { Heart, Ticket } from "lucide-react";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=800";

type EventItem = {
  type: "event";
  id: string;
  title: string;
  slug: string;
  date?: string | null;
  location?: string | null;
  image_url?: string | null;
  category?: string | null;
};

type FundraiserItem = {
  type: "fundraiser";
  id: string;
  title: string;
  slug: string;
  goal_amount?: number | null;
  raised_amount?: number | null;
  image_url?: string | null;
};

export type FeaturedSliderItem = EventItem | FundraiserItem;

function validImageUrl(src: string | null | undefined) {
  return src?.startsWith("http") ? src : FALLBACK_IMAGE;
}

function formatDate(date: string | null | undefined) {
  if (!date) return "Date TBA";

  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "Date TBA";

  return value.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function money(value: number | null | undefined) {
  return `$${Number(value ?? 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function progress(raised: number | null | undefined, goal: number | null | undefined) {
  const raisedAmount = Number(raised ?? 0);
  const goalAmount = Number(goal ?? 0);

  if (goalAmount <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((raisedAmount / goalAmount) * 100)));
}

export default function FeaturedSlider({ items }: { items: FeaturedSliderItem[] }) {
  if (!items || items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        No featured items to display
      </p>
    );
  }

  const looped = [...items, ...items];

  return (
    <div className="relative w-full overflow-hidden group/featured-slider">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-white to-transparent" />

      <div
        className="flex w-max gap-5 group-hover/featured-slider:[animation-play-state:paused]"
        style={{ animation: "featured-slider-scroll 38s linear infinite" }}
      >
        {looped.map((item, index) => {
          const imageUrl = validImageUrl(item.image_url);

          if (item.type === "event") {
            return (
              <Link
                key={`${item.type}-${item.id}-${index}`}
                href={`/events/${item.slug}`}
                className="relative h-52 w-72 flex-shrink-0 overflow-hidden rounded-2xl shadow-md transition-shadow hover:shadow-xl"
              >
                <img
                  src={imageUrl}
                  alt={item.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = FALLBACK_IMAGE;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/45 to-zinc-950/10" />
                <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                  <Ticket className="h-3 w-3" />
                  Event
                </span>
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="mb-1 text-xs font-black uppercase tracking-wide text-orange-400">
                    {formatDate(item.date)}
                  </p>
                  <h3 className="line-clamp-2 text-sm font-black leading-tight text-white">
                    {item.title}
                  </h3>
                  {item.location && (
                    <p className="mt-1 truncate text-xs text-zinc-300">{item.location}</p>
                  )}
                </div>
              </Link>
            );
          }

          const pct = progress(item.raised_amount, item.goal_amount);

          return (
            <Link
              key={`${item.type}-${item.id}-${index}`}
              href={`/fundraisers/${item.slug}`}
              className="relative h-52 w-72 flex-shrink-0 overflow-hidden rounded-2xl shadow-md transition-shadow hover:shadow-xl"
            >
              <img
                src={imageUrl}
                alt={item.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_IMAGE;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/50 to-zinc-950/10" />
              <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                <Heart className="h-3 w-3" />
                Fundraise
              </span>
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="mb-3 line-clamp-2 text-sm font-black leading-tight text-white">
                  {item.title}
                </h3>
                <div className="mb-2 h-1.5 w-full rounded-full bg-white/20">
                  <div
                    className="h-1.5 rounded-full bg-emerald-400"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs font-bold text-white/85">
                  {money(item.raised_amount)} raised of {money(item.goal_amount)} goal
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <style>{`
        @keyframes featured-slider-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
