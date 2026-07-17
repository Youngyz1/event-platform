"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface HowItWorksStep {
  /** Short step title. */
  title: string;
  /** 1–2 sentence supporting description. */
  description: string;
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

/**
 * Generic "how it works" section: a synced media mockup on the left and a set
 * of numbered, selectable steps on the right. Hovering or clicking a step makes
 * it active, cross-fading the media panel to that step's mockup.
 *
 * Interaction is click/hover-driven (simple `useState`, matching this codebase's
 * client-component idiom) rather than scroll-driven — accessible via real
 * buttons and reliable on touch, where hover/scroll cues fail.
 */
export default function HowItWorks({ eyebrow, heading, subheading, steps }: HowItWorksProps) {
  const [active, setActive] = useState(0);

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* ── Left: synced media panel ── */}
          <div className="relative min-h-[22rem] rounded-3xl bg-gradient-to-b from-emerald-50/60 to-white p-6 ring-1 ring-zinc-200 sm:min-h-[24rem] sm:p-8">
            {steps.map((step, i) => (
              <div
                key={i}
                aria-hidden={i !== active}
                className={cn(
                  "transition-opacity duration-500",
                  i === active
                    ? "opacity-100"
                    : "pointer-events-none absolute inset-0 p-6 opacity-0 sm:p-8"
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
      </div>
    </section>
  );
}
