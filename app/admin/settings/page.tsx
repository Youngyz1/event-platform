"use client";

/**
 * app/admin/settings/page.tsx
 * Platform settings editor — fetches platform_settings rows and saves them.
 * Shows a success toast on save.
 */

import { useEffect, useState } from 'react';

type Setting = {
  key: string;
  value: string;
};

const labels: Record<string, string> = {
  platform_fee_percent:        'Platform Fee % (tickets)',
  donation_fee_percent:        'Donation Fee %',
  featured_event_price:        'Featured Event Price ($)',
  featured_fundraiser_price:   'Featured Fundraiser Price ($)',
  support_email:               'Support Email',
  require_event_approval:      'Require Event Approval (true/false)',
  require_fundraiser_approval: 'Require Fundraiser Approval (true/false)',
  organizer_auto_approval:     'Auto-Approve Organizers (true/false)',
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState('');
  const [error, setError]       = useState('');

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => { setSettings(d.settings ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load settings.'); setLoading(false); });
  }, []);

  function onChange(key: string, value: string) {
    setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value } : s)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setToast('');

    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });

    setSaving(false);

    if (res.ok) {
      setToast('Settings saved successfully.');
      setTimeout(() => setToast(''), 3500);
    } else {
      const d = await res.json();
      setError(d.error ?? 'Save failed.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm sm:px-6">
        <p className="text-xs font-black uppercase tracking-wide text-violet-600">Admin</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Platform Settings</h1>
        <p className="mt-2 text-sm font-medium text-zinc-500">Configure global platform behaviour.</p>
      </header>

      {toast && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700">
          ✓ {toast}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {settings.map((s) => (
              <div key={s.key}>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-zinc-500">
                  {labels[s.key] ?? s.key}
                </label>
                <input
                  type="text"
                  value={s.value}
                  onChange={(e) => onChange(s.key, e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold outline-none focus:border-violet-500"
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
