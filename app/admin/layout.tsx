/**
 * app/admin/layout.tsx
 * Admin section layout — grouped sidebar navigation for the Fund4Good fundraising platform.
 * Calls requireAdmin() to block non-admins.
 */

import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ReactNode } from "react";
import { AdminSidebarNav, AdminMobileNav } from "./AdminSidebarNav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // H6: admin authorization is always verified server-side here via
  // requireAdmin() (session + database role). A previous optimization trusted
  // a proxy-set request header to skip this check; any client-influenced
  // header must never grant privileges, so the dependency was removed
  // entirely. proxy.ts still gates /admin/* as defense-in-depth.
  await requireAdmin();

  return (
    <div className="flex min-h-screen bg-zinc-100 text-zinc-950 lg:pl-64">
      <AdminSidebarNav />

      {/* ── Content column — the mobile top nav shows below lg; `children`
          render ONCE here (shared across breakpoints) so admin pages don't
          mount their client components twice. ── */}
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Mobile top nav */}
          <div className="mb-6 flex flex-col gap-4 lg:hidden">
            <div className="flex items-center justify-between bg-slate-950 px-4 py-3 text-white">
              <Link href="/admin" className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-700 text-xs font-black">A</span>
                <span className="text-sm font-black text-white">Admin</span>
              </Link>
              <Link href="/dashboard" className="text-xs font-bold text-slate-400 hover:text-white">
                ← Dashboard
              </Link>
            </div>
            <AdminMobileNav />
          </div>

          {/* Shared page content */}
          <section className="min-w-0 flex-1">{children}</section>
        </div>
      </main>
    </div>
  );
}
