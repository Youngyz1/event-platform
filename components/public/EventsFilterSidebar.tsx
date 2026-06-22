"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Music",
  "Business",
  "Education",
  "Charity",
  "Medical",
  "Church",
  "Community",
  "Technology",
];

const SORT_OPTIONS = [
  { value: "date_asc", label: "Date (soonest)" },
  { value: "date_desc", label: "Date (latest)" },
  { value: "newest", label: "Recently added" },
] as const;

type EventsFilterSidebarProps = {
  activeCategory?: string;
  activeSort?: string;
  activeWhen?: "all" | "weekend";
  resultCount?: number;
};

export default function EventsFilterSidebar({
  activeCategory,
  activeSort = "date_asc",
  activeWhen = "all",
  resultCount,
}: EventsFilterSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <aside className="space-y-6">
      {resultCount !== undefined && (
        <p className="text-sm font-bold text-zinc-500">
          {resultCount} {resultCount === 1 ? "event" : "events"}
        </p>
      )}

      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">When</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["all", "weekend"] as const).map((when) => (
            <Link
              key={when}
              href={buildHref({ when: when === "weekend" ? "weekend" : null })}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-black transition",
                activeWhen === when
                  ? "bg-orange-600 text-white"
                  : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-orange-600"
              )}
            >
              {when === "all" ? "Any time" : "This weekend"}
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">Category</h2>
        <div className="mt-3 space-y-1">
          <Link
            href={buildHref({ category: null })}
            className={cn(
              "block rounded-lg px-3 py-2 text-sm font-bold transition",
              !activeCategory ? "bg-orange-50 text-orange-700" : "text-zinc-700 hover:bg-zinc-50"
            )}
          >
            All categories
          </Link>
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={buildHref({ category: cat })}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm font-bold transition",
                activeCategory?.toLowerCase() === cat.toLowerCase()
                  ? "bg-orange-50 text-orange-700"
                  : "text-zinc-700 hover:bg-zinc-50"
              )}
            >
              {cat}
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">Sort by</h2>
        <div className="mt-3 space-y-1">
          {SORT_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={buildHref({ sort: opt.value === "date_asc" ? null : opt.value })}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm font-bold transition",
                activeSort === opt.value
                  ? "bg-orange-50 text-orange-700"
                  : "text-zinc-700 hover:bg-zinc-50"
              )}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
