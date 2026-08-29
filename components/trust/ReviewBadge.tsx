"use client";

import { cn } from "@/lib/utils";

export interface ReviewBadgeProps {
  status?: string | null;
  className?: string;
}

/** Owner-facing moderation badge — shown when a campaign/entity is not published. */
export default function ReviewBadge({ status, className }: ReviewBadgeProps) {
  if (!status || status === "published") return null;
  const label = status === "rejected" ? "Rejected" : "Pending review";
  const style =
    status === "rejected"
      ? "border border-red-200 bg-red-100 text-red-800"
      : "border border-amber-200 bg-amber-100 text-amber-800";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide",
        style,
        className
      )}
    >
      {label}
    </span>
  );
}
