import type { NavGroup } from "@/components/nav/nav-active";

export const dashboardNavGroups: NavGroup[] = [
  {
    items: [
      { label: "Overview",      href: "/dashboard",               exact: true },
      { label: "Organizations", href: "/dashboard/organizations" },
      // Verification is not a standalone item: it lives inside Settings
      // (settings nav links to /dashboard/identity-verification).
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
      { label: "Analytics",     href: "/dashboard/analytics" },
      { label: "Messages",      href: "/dashboard/messages" },
      { label: "Settings",      href: "/dashboard/settings" },
    ],
  },
];
