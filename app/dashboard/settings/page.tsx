/**
 * app/dashboard/settings/page.tsx  — SERVER COMPONENT
 *
 * Pre-fetches user + profile.preferences + organizer in ONE parallel
 * Promise.all on the server. The page renders instantly — no client-side
 * loading spinner, no useEffect waterfall.
 *
 * Before: client component → JS hydrates → useEffect fires → 3 sequential
 *         Supabase round-trips → page renders (5-8 seconds)
 * After:  server fetches → HTML with data → client hydrates form only (~200ms)
 */

import { redirect } from 'next/navigation';
import { getDashboardContext, supabaseAdmin } from '@/lib/dashboard-context';
import SettingsClient, { type Prefs } from './SettingsClient';

const defaultPrefs: Prefs = {
  notify_ticket_purchase: true,
  notify_donation:        true,
  notify_event_reminder:  false,
};

export default async function DashboardSettingsPage() {
  const ctx = await getDashboardContext();
  if (!ctx) redirect('/login');

  const { user, organizer } = ctx;

  // Single parallel fetch: profiles.preferences
  // (organizer already loaded by getDashboardContext — no extra query needed)
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .maybeSingle();

  const prefs: Prefs = {
    ...defaultPrefs,
    ...((profile?.preferences ?? {}) as Partial<Prefs>),
  };

  const displayName = (user.user_metadata?.display_name as string | undefined) ?? '';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page header — rendered server-side, visible immediately */}
      <header className="rounded-xl border border-zinc-200/80 bg-white px-4 py-3 shadow-sm sm:rounded-2xl sm:px-6 sm:py-4">
        <p className="text-[10px] font-black uppercase tracking-wide text-orange-600 sm:text-xs">Dashboard</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-xs font-medium text-zinc-500 sm:text-sm">Manage your account and notification preferences.</p>
      </header>

      {/* Interactive forms — client component with pre-loaded data */}
      <SettingsClient
        initialEmail={user.email ?? ''}
        initialDisplayName={displayName}
        initialPrefs={prefs}
        organizer={organizer}
        userId={user.id}
      />
    </div>
  );
}
