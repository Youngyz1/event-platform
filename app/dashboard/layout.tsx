/**
 * app/dashboard/layout.tsx
 * Uses getDashboardContext() — a per-request cached helper — so the
 * auth + organizer lookup is shared with child pages, not duplicated.
 */

import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getDashboardContext } from '@/lib/dashboard-context';
import DashboardSidebar from './DashboardSidebar';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const ctx = await getDashboardContext();
  if (!ctx) redirect('/login');

  const organizerHref  = ctx.organizer ? `/organizers/${ctx.organizer.id}` : '/create-organizer';
  const organizerLabel = ctx.organizer ? 'Organizer Profile' : 'Create Profile';

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <DashboardSidebar
          organizerHref={organizerHref}
          organizerLabel={organizerLabel}
        />

        {/* Mobile top bar */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <nav className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white px-4 py-3 text-xs font-black text-slate-700 shadow-sm lg:hidden">
            {[
              ['Overview',    '/dashboard'],
              ['Events',      '/dashboard/events'],
              ['Fundraisers', '/dashboard/fundraisers'],
              ['Donations',   '/dashboard/donations'],
              ['Attendees',   '/dashboard/attendees'],
              ['Reports',     '/dashboard/reports'],
              ['Settings',    '/dashboard/settings'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="shrink-0 rounded-lg px-3 py-2 transition hover:bg-zinc-100"
              >
                {label}
              </a>
            ))}
          </nav>

          {children}
        </div>
      </div>
    </div>
  );
}
