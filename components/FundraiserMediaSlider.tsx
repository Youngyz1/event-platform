"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

export type FundraiserMediaSlide = {
  id?: string | null;
  url: string | null;
  type?: "image" | "video" | string | null;
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1529390079861-591de354faf5?q=80&w=1600&auto=format&fit=crop";

function safeUrl(value: string | null | undefined) {
  return value && value.trim().startsWith("http") ? value.trim() : FALLBACK_IMAGE;
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
          <button
            type="button"
            onClick={() => go(activeIndex - 1)}
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-sm transition hover:bg-white"
            aria-label="Previous fundraiser media"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(activeIndex + 1)}
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-sm transition hover:bg-white"
            aria-label="Next fundraiser media"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
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
