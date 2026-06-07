/**
 * app/admin/layout.tsx
 * Admin section layout — calls requireAdmin() to block non-admins,
 * then renders a dark sidebar matching the existing dashboard style.
 */

import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { ReactNode } from 'react';

const adminLinks = [
  ['Overview',     '/admin'],
  ['Users',        '/admin/users'],
  ['Organizers',   '/admin/organizers'],
  ['Events',       '/admin/events'],
  ['Fundraisers',  '/admin/fundraisers'],
  ['Payments',     '/admin/payments'],
  ['Settings',     '/admin/settings'],
] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Redirects to '/' if the current user is not an admin.
  await requireAdmin();

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">

        {/* Sidebar — matches existing dashboard sidebar style */}
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-60 shrink-0 rounded-2xl bg-slate-950 p-4 text-white shadow-xl shadow-slate-950/15 lg:flex lg:flex-col">
          <Link href="/admin" className="mb-8 flex items-center gap-3 px-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-lg font-black">A</span>
            <span className="text-sm font-black">Admin Panel</span>
          </Link>

          <nav className="space-y-1 text-sm font-bold text-slate-300">
            {adminLinks.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/10 hover:text-white"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {label}
              </Link>
            ))}
          </nav>

          <Link
            href="/dashboard"
            className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Back to Dashboard
          </Link>
        </aside>

        {/* Main content area */}
        <section className="min-w-0 flex-1">
          {children}
        </section>
      </div>
    </div>
  );
}
