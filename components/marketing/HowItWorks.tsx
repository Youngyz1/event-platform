"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HowItWorksStep {
  /** Short step title. */
  title: string;
  /** 1–2 sentence supporting description. */
  description: string;
  /** Tailwind background gradient classes for the preview panel when this step is active. */
  bgGradientClass?: string;
  /**
   * Media mockup shown in the synced left panel when this step is active.
   * Supplied by the caller so the layout stays product-agnostic and reusable
   * (Fundraisers, Events, etc.) — no domain language lives in this component.
   */
  media: React.ReactNode;
}

interface HowItWorksProps {
  eyebrow?: string;
  heading: string;
  subheading?: string;
  steps: HowItWorksStep[];
}

const MOBILE_AUTOPLAY_INTERVAL_MS = 4500;
const MOBILE_AUTOPLAY_RESUME_MS = 6000;

/** Tracks `prefers-reduced-motion`; starts `false` so SSR/hydration match, then syncs on mount. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Generic "how it works" section: a synced media mockup on the left and a set
 * of numbered, selectable steps on the right. Hovering or clicking a step makes
 * it active, cross-fading the media panel to that step's mockup.
 *
 * Interaction is click/hover-driven (simple `useState`, matching this codebase's
 * client-component idiom) rather than scroll-driven — accessible via real
 * buttons and reliable on touch, where hover/scroll cues fail.
 *
 * Below `lg` this renders `MobileStepWalkthrough` instead — the desktop grid
 * stacked to one column reads as one giant illustration on phones, so mobile
 * gets its own single-step-at-a-time carousel sharing the same `steps` data.
 */
export default function HowItWorks({ eyebrow, heading, subheading, steps }: HowItWorksProps) {
  const [active, setActive] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // Swiped left -> Next step
        setActive((prev) => (prev < steps.length - 1 ? prev + 1 : 0));
      } else {
        // Swiped right -> Prev step
        setActive((prev) => (prev > 0 ? prev - 1 : steps.length - 1));
      }
    }
    setTouchStartX(null);
  };

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        {/* ── Desktop (lg and up): existing approved layout, unchanged ── */}
        <div className="hidden lg:grid lg:items-center lg:gap-16 lg:grid-cols-2">
          {/* ── Left: synced media panel (supports swipe on touch) ── */}
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="relative min-h-[26rem] sm:min-h-[28rem] rounded-3xl p-6 ring-1 ring-zinc-200 sm:p-8 overflow-hidden bg-white"
          >
            {/* Synced background layers */}
            {steps.map((step, i) => (
              <div
                key={`bg-${i}`}
                className={cn(
                  "absolute inset-0 bg-gradient-to-b transition-opacity duration-500",
                  step.bgGradientClass || "from-emerald-50/60 to-white",
                  i === active ? "opacity-100 z-10" : "opacity-0 z-0"
                )}
              />
            ))}

            {steps.map((step, i) => (
              <div
                key={i}
                aria-hidden={i !== active}
                className={cn(
                  "absolute inset-0 p-6 sm:p-8 flex items-center justify-center transition-opacity duration-500",
                  i === active
                    ? "opacity-100 z-20"
                    : "opacity-0 z-0 pointer-events-none"
                )}
              >
                {step.media}
              </div>
            ))}
          </div>

          {/* ── Right: heading + numbered steps ── */}
          <div>
            {eyebrow && (
              <p className="text-xs font-black uppercase tracking-widest text-emerald-600">
                {eyebrow}
              </p>
            )}
            <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl">
              {heading}
            </h2>
            {subheading && (
              <p className="mt-3 max-w-lg text-base font-medium text-zinc-600">{subheading}</p>
            )}

            <ol className="mt-8 space-y-3">
              {steps.map((step, i) => {
                const isActive = i === active;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setActive(i)}
                      onMouseEnter={() => setActive(i)}
                      aria-current={isActive ? "step" : undefined}
                      className={cn(
                        "flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition sm:p-5",
                        isActive
                          ? "border-emerald-200 bg-emerald-50/60 ring-1 ring-emerald-200"
                          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-black transition",
                          isActive
                            ? "bg-emerald-600 text-white"
                            : "bg-zinc-100 text-zinc-500"
                        )}
                      >
                        {i + 1}
                      </span>
                      <span>
                        <span className="block text-base font-black text-zinc-950">
                          {step.title}
                        </span>
                        <span className="mt-1 block text-sm font-medium text-zinc-600">
                          {step.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {/* ── Mobile (below lg): single-step-at-a-time interactive walkthrough ── */}
        <div className="lg:hidden">
          <MobileStepWalkthrough eyebrow={eyebrow} heading={heading} subheading={subheading} steps={steps} />
        </div>
      </div>
    </section>
  );
}

/**
 * Mobile-only "how it works" experience: one step visible at a time, synced
 * illustration, autoplay (pausing on interaction and resuming after a period
 * of inactivity), swipe, prev/next controls, and tappable dots. Reuses the
 * same `HowItWorksStep` data as the desktop layout above — no separate
 * content or business logic, just a different presentation for narrow
 * viewports where the desktop grid reads as one huge illustration.
 */
function MobileStepWalkthrough({ eyebrow, heading, subheading, steps }: HowItWorksProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const pauseAutoplay = useCallback(() => {
    setIsPaused(true);
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => setIsPaused(false), MOBILE_AUTOPLAY_RESUME_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || isPaused) return;
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % steps.length);
    }, MOBILE_AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPaused, prefersReducedMotion, steps.length]);

  const goTo = useCallback(
    (index: number) => {
      setActive(((index % steps.length) + steps.length) % steps.length);
      pauseAutoplay();
    },
    [steps.length, pauseAutoplay]
  );

  const goNext = useCallback(() => goTo(active + 1), [active, goTo]);
  const goPrev = useCallback(() => goTo(active - 1), [active, goTo]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) goNext();
      else goPrev();
    }
    touchStartXRef.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    }
  };

  const step = steps[active];

  return (
    <div onKeyDown={handleKeyDown}>
      {eyebrow && (
        <p className="text-xs font-black uppercase tracking-widest text-emerald-600">{eyebrow}</p>
      )}
      <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">{heading}</h2>
      {subheading && <p className="mt-3 text-base font-medium text-zinc-600">{subheading}</p>}

      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={`${heading} — steps`}
        className="mt-6"
      >
        {/* Illustration, synced to the active step */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative min-h-[14rem] overflow-hidden rounded-3xl p-6 ring-1 ring-zinc-200 bg-white"
        >
          {steps.map((s, i) => (
            <div
              key={`mbg-${i}`}
              aria-hidden
              className={cn(
                "absolute inset-0 bg-gradient-to-b transition-opacity duration-500 motion-reduce:transition-none",
                s.bgGradientClass || "from-emerald-50/60 to-white",
                i === active ? "opacity-100 z-10" : "opacity-0 z-0"
              )}
            />
          ))}

          {steps.map((s, i) => (
            <div
              key={i}
              aria-hidden={i !== active}
              className={cn(
                "absolute inset-0 flex items-center justify-center p-4 transition-all duration-500 motion-reduce:transition-none",
                i === active
                  ? "z-20 scale-100 opacity-100"
                  : "pointer-events-none z-0 scale-[0.98] opacity-0"
              )}
            >
              <div className="origin-center scale-[0.62]">{s.media}</div>
            </div>
          ))}
        </div>

        {/* Active step copy — announced to screen readers as it changes */}
        <div className="mt-5 flex items-start gap-3" aria-live="polite" aria-atomic="true">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white">
            {active + 1}
          </span>
          <div>
            <p className="text-base font-black text-zinc-950">{step.title}</p>
            <p className="mt-1 text-sm font-medium text-zinc-600">{step.description}</p>
          </div>
        </div>

        {/* Prev / counter / Next */}
        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous step"
            className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-zinc-700 transition hover:bg-zinc-100"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <span className="text-sm font-bold tabular-nums text-zinc-500">
            {active + 1} / {steps.length}
          </span>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next step"
            className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-zinc-700 transition hover:bg-zinc-100"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to step ${i + 1}`}
              aria-current={i === active ? "true" : undefined}
              className={cn(
                "h-2 rounded-full transition-all duration-300 motion-reduce:transition-none",
                i === active ? "w-6 bg-emerald-600" : "w-2 bg-zinc-300"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
