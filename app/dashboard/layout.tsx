"use client";

import { ReactNode, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import { dashboardNavGroups } from "./nav-items";
import { computeSharedBases, isNavItemActive } from "@/components/nav/nav-active";

const navLinks = dashboardNavGroups[0].items;

// Module-level cache so auth check doesn't re-run on every client navigation
let _authedCache: boolean | null = null;

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const currentTab = useSearchParams().get("tab");
  const sharedBases = useMemo(() => computeSharedBases(dashboardNavGroups), []);
  const router = useRouter();
  const [authed, setAuthed] = useState(_authedCache ?? false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer on Escape, matching the modal convention used elsewhere.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  useEffect(() => {
    if (_authedCache === true) { setAuthed(true); return; }
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => {
        if (!data.user) {
          _authedCache = null;
          router.push("/login");
        } else {
          _authedCache = true;
          setAuthed(true);
        }
      });
    });
  }, [router]);

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      {/* Drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Slide-over drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        inert={!drawerOpen}
        className={`fixed right-0 top-0 z-50 flex h-full w-72 flex-col bg-white shadow-2xl transition-transform duration-300 lg:hidden ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <span className="text-lg font-black">Navigation</span>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Mobile menu" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navLinks.map((item) => {
            const { label, href, icon: Icon } = item;
            const active = isNavItemActive(pathname, currentTab, item, sharedBases);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
                  active
                    ? "bg-orange-50 text-orange-600"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main layout */}
      <div className="flex">
        <DashboardSidebar />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl px-3 py-4 pb-28 sm:px-6 sm:py-6 lg:px-8 lg:pb-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-40 flex min-h-16 items-stretch justify-around border-t border-zinc-200 bg-white shadow-lg lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {navLinks.map((item) => {
          const { label, href, icon: Icon } = item;
          const active = isNavItemActive(pathname, currentTab, item, sharedBases);
          return (
            <Link
              key={href}
              href={href}
              className={`flex h-full flex-1 flex-col items-center justify-center gap-0.5 transition focus-visible:outline-none focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-orange-500 ${
                active ? "text-orange-600" : "text-zinc-400"
              }`}
            >
              <Icon className="h-[22px] w-[22px] shrink-0" />
              <span className="text-[10px] font-bold">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}