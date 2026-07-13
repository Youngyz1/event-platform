"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

export type FundraiserMediaSlide = {
  id?: string | null;
  url: string | null;
  type?: "image" | "video" | string | null;
  /**
   * When present, renders a solid brand-color slide with a story-excerpt
   * overlay card instead of a photo — `url` is ignored for this slide.
   */
  story?: {
    excerpt: string;
    donorCount: number;
    /** Display names for the stacked avatar cluster (initials only, no fetching here). */
    donorNames: string[];
    /** Element id to smooth-scroll to when "Read story" is clicked. */
    scrollTargetId: string;
  };
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1529390079861-591de354faf5?q=80&w=1600&auto=format&fit=crop";

function safeUrl(value: string | null | undefined) {
  return value && value.trim().startsWith("http") ? value.trim() : FALLBACK_IMAGE;
}

function initial(value: string) {
  return (value.trim() || "A").charAt(0).toUpperCase();
}

export default function FundraiserMediaSlider({
  media,
  title,
}: {
  media: FundraiserMediaSlide[];
  title: string;
}) {
  const slides = useMemo(
    () =>
      (media.length > 0 ? media : [{ url: FALLBACK_IMAGE, type: "image" }]).map(
        (item, index) => ({
          ...item,
          id: item.id || `${item.url}-${index}`,
          url: safeUrl(item.url),
          type: item.type || "image",
        })
      ),
    [media]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const active = slides[activeIndex] || slides[0];
  const hasMultiple = slides.length > 1;

  function go(nextIndex: number) {
    setActiveIndex((nextIndex + slides.length) % slides.length);
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
      {active.type === "video" ? (
        <video
          src={active.url}
          controls
          className="aspect-[16/9] w-full bg-black object-cover"
        />
      ) : active.story ? (
        <div className="relative aspect-[16/9] w-full bg-emerald-600">
          <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white p-4 shadow-lg sm:inset-x-6 sm:bottom-6 sm:p-5">
            <p className="line-clamp-2 text-sm leading-6 text-zinc-700 sm:text-base">
              {active.story.excerpt}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex -space-x-2">
                  {active.story.donorNames.slice(0, 3).map((name, index) => (
                    <div
                      key={index}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white bg-zinc-100 text-xs font-black text-zinc-700"
                    >
                      {initial(name)}
                    </div>
                  ))}
                </div>
                <span className="truncate text-sm font-bold text-zinc-700">
                  {active.story.donorCount.toLocaleString()}{" "}
                  {active.story.donorCount === 1 ? "donor" : "donors"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  document
                    .getElementById(active.story!.scrollTargetId)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="shrink-0 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                Read story
              </button>
            </div>
          </div>
        </div>
      ) : (
        <img
          src={active.url}
          alt={title}
          fetchPriority="high"
          decoding="async"
          className="aspect-[16/9] w-full object-cover"
          onError={(event) => {
            event.currentTarget.src = FALLBACK_IMAGE;
          }}
        />
      )}

      {hasMultiple && (
        <>
          {/* On the story-overlay slide the bottom card owns that space, so
              nav controls pin to the top instead of vertically centering —
              otherwise they'd overlap the card's text and its dots would be
              invisible white-on-white against the card background. */}
          <button
            type="button"
            onClick={() => go(activeIndex - 1)}
            className={`absolute left-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-sm transition hover:bg-white ${
              active.story ? "top-3" : "top-1/2 -translate-y-1/2"
            }`}
            aria-label="Previous fundraiser media"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(activeIndex + 1)}
            className={`absolute right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-sm transition hover:bg-white ${
              active.story ? "top-3" : "top-1/2 -translate-y-1/2"
            }`}
            aria-label="Next fundraiser media"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div
            className={`absolute left-1/2 flex -translate-x-1/2 gap-1.5 ${
              active.story ? "top-3" : "bottom-3"
            }`}
          >
            {slides.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-2 rounded-full transition-all ${
                  index === activeIndex ? "w-6 bg-white" : "w-2 bg-white/60"
                }`}
                aria-label={`Show fundraiser media ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
