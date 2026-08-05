"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import AppSidebar from "@/components/nav/AppSidebar";
import { dashboardNavGroups } from "./nav-items";

export default function DashboardSidebar() {
  return (
    <AppSidebar
      navAriaLabel="Dashboard navigation"
      groups={dashboardNavGroups}
      header={
        <div className="px-4 pt-4">
          <Link href="/" className="mb-6 flex items-center gap-3 px-2">
            <span className="text-lg font-black text-white">Fund4Good</span>
          </Link>
          <Link
            href="/create-organizer"
            className="block rounded-xl bg-orange-600 px-3 py-2.5 text-center text-sm font-black text-white transition hover:bg-orange-700"
          >
            + New Organization
          </Link>
        </div>
      }
      footer={
        <div className="px-3 pb-4">
          <Link
            href="/about"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            Help &amp; Support
          </Link>
        </div>
      }
    />
  );
}