/**
 * app/dashboard/layout.tsx
 * Uses getDashboardContext() — a per-request cached helper — so the
 * auth + organizer lookup is shared with child pages, not duplicated.
 */

import { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDashboardContext } from '@/lib/dashboard-context';
import DashboardSidebar from './DashboardSidebar';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const ctx = await getDashboardContext();
  if (!ctx) redirect('/login');

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="mx-auto flex max-w-7xl gap-6 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <DashboardSidebar />

        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:gap-6">
          <nav className="grid grid-cols-8 items-center rounded-xl border border-zinc-200/80 bg-white px-1.5 py-2 text-center text-[7px] font-black text-slate-700 shadow-sm sm:flex sm:gap-2 sm:overflow-x-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-xs lg:hidden">
            {[
              ['Home',        '/'],
              ['Overview',    '/dashboard'],
              ['Events',      '/dashboard/events'],
              ['Fundraisers', '/dashboard/fundraisers'],
              ['Donations',   '/dashboard/donations'],
              ['Attendees',   '/dashboard/attendees'],
              ['Reports',     '/dashboard/reports'],
              ['Settings',    '/dashboard/settings'],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="min-w-0 rounded-lg px-0.5 py-2 transition hover:bg-zinc-100 sm:shrink-0 sm:px-3"
              >
                {label}
              </Link>
            ))}
          </nav>

          {children}
        </div>
      </div>
    </div>
  );
}
