"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppSidebar from "@/components/nav/AppSidebar";
import { dashboardNavGroups } from "./nav-items";

// Module-level cache — getUser() resolves from the in-memory Supabase session
// after the first call, so this avoids even that tiny overhead on re-renders.
let _userIdCache: string | null = null;

export default function DashboardSidebar() {
  const [userId, setUserId] = useState<string | null>(_userIdCache);

  useEffect(() => {
    if (_userIdCache) { setUserId(_userIdCache); return; }
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => {
        const id = data.user?.id ?? null;
        _userIdCache = id;
        setUserId(id);
      });
    });
  }, []);

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
            className="block rounded-xl bg-brand-700 px-3 py-2.5 text-center text-sm font-black text-white transition hover:bg-brand-800"
          >
            + New Organization
          </Link>
        </div>
      }
      footer={
        <div className="px-3 pb-4 space-y-1">
          {userId && (
            <Link
              href={`/profile/${userId}`}
              className="block rounded-xl px-3 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              View my profile
            </Link>
          )}
          <Link
            href="/about"
            className="block rounded-xl px-3 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Help &amp; Support
          </Link>
        </div>
      }
    />
  );
}