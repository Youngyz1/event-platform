"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type OrganizersDirectoryControlsProps = {
  defaultQuery?: string;
  activeStatus?: "all" | "verified";
};

export default function OrganizersDirectoryControls({
  defaultQuery = "",
  activeStatus = "all",
}: OrganizersDirectoryControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pushUpdates(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="mb-8 space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          pushUpdates({ q: (fd.get("q") as string)?.trim() || null });
        }}
        className="relative max-w-xl"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          name="q"
          type="search"
          defaultValue={defaultQuery}
          placeholder="Search organizers by name…"
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-sm font-semibold outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
        />
      </form>

      <div className="flex flex-wrap gap-2">
        {(["all", "verified"] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => pushUpdates({ status: status === "verified" ? "verified" : null })}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-black transition",
              activeStatus === status
                ? "bg-brand-700 text-white"
                : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-brand-700"
            )}
          >
            {status === "all" ? "All organizers" : "Verified only"}
          </button>
        ))}
      </div>
    </div>
  );
}
