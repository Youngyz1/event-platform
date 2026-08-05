import { LayoutDashboard, Building2, BarChart2, Mail, Settings } from "lucide-react";
import type { NavGroup } from "@/components/nav/nav-active";

export const dashboardNavGroups: NavGroup[] = [
  {
    items: [
      { label: "Overview",      href: "/dashboard",               icon: LayoutDashboard, exact: true },
      { label: "Organizations", href: "/dashboard/organizations", icon: Building2 },
      { label: "Analytics",     href: "/dashboard/analytics",     icon: BarChart2 },
      { label: "Messages",      href: "/dashboard/messages",      icon: Mail },
      { label: "Settings",      href: "/dashboard/settings",      icon: Settings },
    ],
  },
];
