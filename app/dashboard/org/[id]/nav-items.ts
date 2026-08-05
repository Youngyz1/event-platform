import {
  LayoutDashboard, Heart, Briefcase,
  Users, Star, ImageIcon, BarChart2, Settings,
} from "lucide-react";
import type { NavItem } from "@/components/nav/nav-active";

export function getOrgNavItems(orgId: string): NavItem[] {
  const base = `/dashboard/org/${orgId}`;
  return [
    { label: "Overview",    href: `${base}/overview`,    icon: LayoutDashboard },
    { label: "Campaigns",   href: `${base}/fundraisers`, icon: Heart },
    { label: "Services",    href: `${base}/services`,    icon: Briefcase,  comingSoon: true },
    { label: "Volunteers",  href: `${base}/volunteers`,  icon: Users,      comingSoon: true },
    { label: "Reviews",     href: `${base}/reviews`,     icon: Star },
    { label: "Gallery",     href: `${base}/gallery`,     icon: ImageIcon,  comingSoon: true },
    { label: "Analytics",   href: `${base}/analytics`,   icon: BarChart2 },
    { label: "Settings",    href: `${base}/settings`,    icon: Settings },
  ];
}
