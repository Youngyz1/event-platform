import * as React from "react";
import { cn } from "@/lib/utils";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** "compact" = dashboard/admin scale, "large" = public marketing scale */
  size?: "compact" | "large";
  className?: string;
}

/**
 * Shared, unboxed page header — lives directly in page flow, never inside a
 * bordered card. Dashboard and public surfaces differ only in scale/spacing,
 * not in structure or type treatment.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  action,
  size = "compact",
  className,
}: PageHeaderProps) {
  const isLarge = size === "large";
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        isLarge ? "sm:flex-row sm:items-end sm:justify-between" : "sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <Heading as="p" variant="eyebrow">
            {eyebrow}
          </Heading>
        )}
        <Heading as="h1" variant="page-title" size={size === "large" ? "large" : "compact"} className="mt-1">
          {title}
        </Heading>
        {description && (
          <Text variant="muted" className={cn("mt-2", isLarge && "max-w-2xl sm:text-lg")}>
            {description}
          </Text>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
