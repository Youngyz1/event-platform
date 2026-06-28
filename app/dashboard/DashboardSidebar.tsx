"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarLink = {
  label: string;
  href: string;
  exact?: boolean;
};

const links: SidebarLink[] = [
  { label: "Overview",    href: "/dashboard",            exact: true },
  { label: "Events",      href: "/dashboard/events" },
  { label: "Fundraisers", href: "/dashboard/fundraisers" },
  { label: "Organizers",  href: "/dashboard/organizers" },
  { label: "Donations",   href: "/dashboard/donations" },
  { label: "Attendees",   href: "/dashboard/attendees" },
  { label: "Reports",     href: "/dashboard/reports" },
  { label: "Settings",    href: "/dashboard/settings" },
];

export default function DashboardSidebar() {
  const pathname = usePathname();

  function isActive(link: SidebarLink) {
    if (link.exact) return pathname === link.href;
    return pathname.startsWith(link.href);
  }

  return (
    <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-60 shrink-0 rounded-2xl bg-slate-950 p-4 text-white shadow-xl shadow-slate-950/15 lg:flex lg:flex-col">
      {/* Brand */}
      <Link href="/" className="mb-6 flex items-center gap-3 px-2">
        <span className="text-lg font-black text-white">Fund4Good</span>
      </Link> 

      {/* Quick-create buttons */}
      <div className="mb-5 grid gap-2">
        <Link
          href="/create-event"
          className="rounded-xl bg-orange-600 px-3 py-2.5 text-center text-sm font-black text-white transition hover:bg-orange-700"
        >
          + New Event
        </Link>
        <Link
          href="/create-fundraiser"
          className="rounded-xl bg-emerald-600 px-3 py-2.5 text-center text-sm font-black text-white transition hover:bg-emerald-700"
        >
          + New Fundraiser
        </Link>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 space-y-1 text-sm font-bold text-slate-300">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
              isActive(link)
                ? "bg-orange-600/20 text-white ring-1 ring-orange-400/20"
                : "hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Help link at bottom */}
      <Link
        href="/about"
        className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/10 hover:text-white"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Help &amp; Support
      </Link>
    </aside>
  );
}