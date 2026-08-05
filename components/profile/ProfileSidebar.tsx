import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import ProfileMetrics, { type ProfileMetric } from "./ProfileMetrics";

interface ProfileSidebarProps {
  metrics: ProfileMetric[];
  children?: ReactNode;
  className?: string;
}

/**
 * Desktop-only sticky left column — a light, premium CRM-style summary
 * (metrics + info sections). Not modeled on OrgDashboardSidebar (that's a
 * dark, authenticated-owner management nav — wrong context for a public
 * profile page).
 */
export default function ProfileSidebar({ metrics, children, className }: ProfileSidebarProps) {
  return (
    <aside className={cn("hidden space-y-5 lg:sticky lg:top-24 lg:block lg:self-start", className)}>
      <ProfileMetrics metrics={metrics} layout="sidebar" />
      {children}
    </aside>
  );
}
