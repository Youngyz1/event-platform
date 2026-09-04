import type { NavItem } from "@/components/nav/nav-active";

export function getOrgNavItems(orgId: string): NavItem[] {
  const base = `/dashboard/org/${orgId}`;
  return [
    { label: "Overview",    href: `${base}/overview` },
    { label: "Campaigns",   href: `${base}/fundraisers` },
    { label: "Verification", href: `/dashboard/verification?organizerId=${orgId}` },
    { label: "Services",    href: `${base}/services`,    comingSoon: true },
    { label: "Volunteers",  href: `${base}/volunteers`,  comingSoon: true },
    { label: "Reviews",     href: `${base}/reviews` },
    { label: "Gallery",     href: `${base}/gallery`,     comingSoon: true },
    { label: "Analytics",   href: `${base}/analytics` },
    { label: "Settings",    href: `${base}/settings` },
  ];
}
