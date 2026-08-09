import { LayoutDashboard, Building2, BarChart2, Mail, Settings, BadgeCheck } from "lucide-react";
import type { NavGroup } from "@/components/nav/nav-active";

export const dashboardNavGroups: NavGroup[] = [
  {
    items: [
      { label: "Overview",      href: "/dashboard",               icon: LayoutDashboard, exact: true },
      { label: "Organizations", href: "/dashboard/organizations", icon: Building2 },
      // Identity is a per-user fact, not per-organizer, so this lives in the
      // top-level dashboard nav rather than app/dashboard/org/[id]/nav-items.ts.
      // No live status pill here (yet): this file is a static, module-level
      // constant imported directly by a client-component layout across three
      // separate render sites (desktop sidebar, mobile drawer, mobile bottom
      // nav) with no per-request data-fetching of any kind today — adding a
      // dynamic per-user badge would mean restructuring all of that, not a
      // small addition. See app/dashboard/org/[id]/OrgDashboardSidebar.tsx
      // for the pattern this WOULD follow if the top-level layout ever moves
      // server-side: that one already receives its org as a server-fetched
      // prop, which is exactly what a status pill needs.
      { label: "Verification",  href: "/dashboard/identity-verification", icon: BadgeCheck },
      { label: "Analytics",     href: "/dashboard/analytics",     icon: BarChart2 },
      { label: "Messages",      href: "/dashboard/messages",      icon: Mail },
      { label: "Settings",      href: "/dashboard/settings",      icon: Settings },
    ],
  },
];
