"use client";

/**
 * app/dashboard/settings/SettingsClient.tsx
 * Handles only the interactive form state and submissions.
 * All data is pre-fetched server-side and passed as props — no
 * useEffect, no client-side Supabase queries on mount.
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ModalPricing } from '@/components/ui/modal-pricing';

export type Prefs = {
  notify_ticket_purchase: boolean;
  notify_donation:        boolean;
  notify_event_reminder:  boolean;
};

type OrganizerInfo = { id: string; name: string } | null;

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-zinc-100 py-4 last:border-0">
      <div className="min-w-0">
        <p className="font-bold text-zinc-900">{label}</p>
        <p className="mt-0.5 text-sm text-zinc-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
          checked ? 'bg-orange-600' : 'bg-zinc-300'
        }`}
      >
        <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </button>
    </div>
  );
}

export default function SettingsClient({
  initialEmail,
  initialDisplayName,
  initialPrefs,
  organizer,
  userId,
}: {
  initialEmail: string;
  initialDisplayName: string;
  initialPrefs: Prefs;
  organizer: OrganizerInfo;
  userId: string;
}) {
  const [displayName,   setDisplayName]   = useState(initialDisplayName);
  const [prefs,         setPrefs]         = useState<Prefs>(initialPrefs);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPrefs,   setSavingPrefs]   = useState(false);
  const [toast,         setToast]         = useState('');
  const [error,         setError]         = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    setSavingAccount(true);
    setError('');
    const { error: authError } = await supabase.auth.updateUser({ data: { display_name: displayName } });
    setSavingAccount(false);
    if (authError) setError(authError.message);
    else showToast('Account settings saved.');
  }

  async function savePrefs(e: React.FormEvent) {
    e.preventDefault();
    setSavingPrefs(true);
    setError('');
    const { error: dbError } = await supabase
      .from('profiles')
      .update({ preferences: prefs })
      .eq('id', userId);
    setSavingPrefs(false);
    if (dbError) setError(dbError.message);
    else showToast('Notification preferences saved.');
  }

  async function sendPasswordReset() {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(initialEmail);
    if (resetError) setError(resetError.message);
    else showToast('Password reset email sent — check your inbox.');
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700">
          ✓ {toast}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* Section 1 — Account Settings */}
      <form onSubmit={saveAccount} className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-5 text-base font-black tracking-tight text-zinc-950">Account Settings</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-zinc-500">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-zinc-500">Email (read-only)</label>
            <input
              type="email"
              value={initialEmail}
              readOnly
              className="w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-500 outline-none"
            />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={savingAccount}
            className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-black text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {savingAccount ? 'Saving…' : 'Save Account'}
          </button>
          <button
            type="button"
            onClick={sendPasswordReset}
            className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-black text-zinc-700 hover:bg-zinc-50"
          >
            Send Password Reset Email
          </button>
        </div>
      </form>

      {/* Section 2 — Notification Preferences */}
      <form onSubmit={savePrefs} className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-5 text-base font-black tracking-tight text-zinc-950">Notification Preferences</h2>
        <Toggle
          checked={prefs.notify_ticket_purchase}
          onChange={(v) => setPrefs((p) => ({ ...p, notify_ticket_purchase: v }))}
          label="Ticket Purchase Emails"
          description="Get an email whenever someone buys a ticket to one of your events."
        />
        <Toggle
          checked={prefs.notify_donation}
          onChange={(v) => setPrefs((p) => ({ ...p, notify_donation: v }))}
          label="Donation Emails"
          description="Get an email whenever someone donates to one of your fundraisers."
        />
        <Toggle
          checked={prefs.notify_event_reminder}
          onChange={(v) => setPrefs((p) => ({ ...p, notify_event_reminder: v }))}
          label="Event Reminder Emails"
          description="Receive reminder emails before your upcoming events."
        />
        <div className="mt-5">
          <button
            type="submit"
            disabled={savingPrefs}
            className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-black text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {savingPrefs ? 'Saving…' : 'Save Preferences'}
          </button>
        </div>
      </form>

      {/* Section 2.5 — Plan */}
      <div className="rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-50 to-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-black tracking-tight text-zinc-950">Your Plan</h2>
            <p className="mt-1 text-sm text-zinc-500">Upgrade to unlock unlimited events, fundraisers, and advanced analytics.</p>
          </div>
          <ModalPricing triggerLabel="Upgrade Plan" onConfirm={(id) => console.log('Plan selected:', id)} />
        </div>
      </div>

      {/* Section 3 — Organizer Profile Quick Link */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-3 text-base font-black tracking-tight text-zinc-950">Organizer Profile</h2>
        {organizer ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-zinc-900">{organizer.name}</p>
              <p className="mt-0.5 text-sm text-zinc-500">Your public organizer profile.</p>
            </div>
            <div className="flex gap-2">
              <a href={`/organizers/${organizer.id}`} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-black text-zinc-700 hover:bg-zinc-50">
                View Profile
              </a>
              <a href="/create-organizer" className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-black text-white hover:bg-orange-700">
                Edit Profile
              </a>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-500">You don&apos;t have an organizer profile yet.</p>
            <a href="/create-organizer" className="shrink-0 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-black text-white hover:bg-orange-700">
              Create Organizer Profile
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
