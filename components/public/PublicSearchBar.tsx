"use client";

import { FormEvent, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type PublicSearchBarProps = {
  action?: string;
  defaultQuery?: string;
  defaultLocation?: string;
  placeholder?: string;
  showLocation?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
};

export default function PublicSearchBar({
  action = "/events",
  defaultQuery = "",
  defaultLocation = "",
  placeholder = "Search events, fundraisers, organizers…",
  showLocation = true,
  className,
  size = "md",
}: PublicSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);
  const [location, setLocation] = useState(defaultLocation);

  const heightClass = size === "sm" ? "h-9" : size === "lg" ? "h-12" : "h-10";
  const textClass = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (showLocation && location.trim()) params.set("location", location.trim());
    const qs = params.toString();
    router.push(`${action}${qs ? `?${qs}` : ""}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "flex w-full flex-col gap-2 sm:flex-row sm:items-center",
        className
      )}
    >
      <label className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-3 font-semibold outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20",
            heightClass,
            textClass
          )}
        />
      </label>
      {showLocation && (
        <label className="relative min-w-0 sm:max-w-[200px] sm:flex-1 lg:max-w-[240px]">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City or location"
            className={cn(
              "w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-3 font-semibold outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20",
              heightClass,
              textClass
            )}
          />
        </label>
      )}
      <button
        type="submit"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-xl bg-orange-600 px-5 font-black text-white transition hover:bg-orange-700",
          heightClass,
          textClass
        )}
      >
        Search
      </button>
    </form>
  );
}
