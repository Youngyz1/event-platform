"use client";

import { cn } from "@/lib/utils";

export interface ProfileTab {
  id: string;
  label: string;
  count?: number;
}

interface ProfileTabsProps {
  tabs: ProfileTab[];
  activeId: string;
  onChange: (id: string) => void;
}

/**
 * Shared tab bar — filled-pill active state / muted-hover inactive, styled
 * after the existing HomepageCmsTabs convention but in the public-facing
 * orange accent instead of the admin violet accent. Hand-rolled (no Radix
 * Tabs) to match this codebase's existing tabbed-UI pattern.
 */
export default function ProfileTabs({ tabs, activeId, onChange }: ProfileTabsProps) {
  return (
    <div
      role="tablist"
      className="flex gap-1 overflow-x-auto rounded-full bg-zinc-100 p-1.5"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition",
              active
                ? "bg-orange-600 text-white"
                : "text-zinc-500 hover:text-zinc-800"
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-black",
                  active ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
