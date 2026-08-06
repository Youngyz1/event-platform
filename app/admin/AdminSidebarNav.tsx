"use client";

import Link from "next/link";
import {
  ArrowLeft,
  LayoutDashboard,
  Users,
  Building2,
  HandHeart,
  Home,
  Grid3x3,
  MessageSquareQuote,
  Handshake,
  CreditCard,
  Settings,
  Star,
} from "lucide-react";
import AppSidebar from "@/components/nav/AppSidebar";
import MobilePillNav from "@/components/nav/MobilePillNav";
import type { NavGroup } from "@/components/nav/nav-active";

export const navGroups: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { label: "Overview",     href: "/admin",             icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Users",
    items: [
      { label: "Users",        href: "/admin/users",       icon: Users },
      { label: "Organizers",   href: "/admin/organizers",  icon: Building2 },
    ],
  },
  {
    label: "Fundraisers",
    items: [
      { label: "Fundraisers",  href: "/admin/fundraisers", icon: HandHeart },
      { label: "Reviews",      href: "/admin/reviews",     icon: Star },
    ],
  },
  {
    label: "CMS",
    items: [
      { label: "Homepage",     href: "/admin/homepage",    icon: Home },
      { label: "Categories",   href: "/admin/homepage?tab=categories",   icon: Grid3x3 },
      { label: "Testimonials", href: "/admin/homepage?tab=testimonials", icon: MessageSquareQuote },
      { label: "Sponsors",     href: "/admin/homepage?tab=sponsors",     icon: Handshake },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Payments",     href: "/admin/payments",    icon: CreditCard },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings",     href: "/admin/settings",    icon: Settings },
    ],
  },
];

/** Full desktop admin sidebar — brand, grouped nav, and back-to-dashboard footer. */
export function AdminSidebarNav() {
  return (
    <AppSidebar
      navAriaLabel="Admin navigation"
      groups={navGroups}
      header={
        <div className="px-4 pt-4">
          <Link href="/admin" className="mb-6 flex items-center gap-3 px-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-sm font-black">
              A
            </span>
            <span className="text-sm font-black tracking-tight">Admin Panel</span>
          </Link>
        </div>
      }
      footer={
        <div className="px-3 pb-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Dashboard
          </Link>
        </div>
      }
    />
  );
}

/** Mobile horizontal pill nav — shares MobilePillNav with the org workspace and create-fundraiser navs. */
export function AdminMobileNav() {
  const items = navGroups.flatMap((g) => g.items);
  return <MobilePillNav items={items} ariaLabel="Admin navigation" />;
}
