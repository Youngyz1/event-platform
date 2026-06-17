"use client";

/**
 * app/admin/fundraisers/page.tsx
 * Fundraiser moderation — approve, reject, feature/unfeature fundraisers.
 * Same pattern as the admin events page.
 */

import { useEffect, useState } from 'react';

type FundraiserRow = {
  id: string;
  title: string;
  organizer: string;
  raised: number;
  goal: number;
  is_featured: boolean;
  created_at: string;
};

function money(n: number) {
  return `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function AdminFundraisersPage() {
  const [items, setItems]     = useState<FundraiserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError]     = useState('');

  useEffect(() => {
    fetch('/api/admin/fundraisers')
      .then((r) => r.json())
      .then((d) => { setItems(d.fundraisers ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load fundraisers.'); setLoading(false); });
  }, []);

  async function update(id: string, payload: Record<string, unknown>) {
    setWorking(id);
    setError('');
    const res = await fetch(`/api/admin/fundraisers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const d = await res.json();
      setItems((prev) => prev.map((f) => (f.id === id ? { ...f, ...d.fundraiser } : f)));
    } else {
      const d = await res.json();
      setError(d.error ?? 'Update failed.');
    }
    setWorking(null);
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm sm:px-6">
        <p className="text-xs font-black uppercase tracking-wide text-violet-600">Admin</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Fundraisers</h1>
        <p className="mt-2 text-sm font-medium text-zinc-500">Moderate and feature fundraising campaigns.</p>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">{error}</div>
      )}

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs font-black uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="py-3 pr-4">Title</th>
                  <th className="py-3 pr-4">Organizer</th>
                  <th className="py-3 pr-4">Raised</th>
                  <th className="py-3 pr-4">Goal</th>
                  <th className="py-3 pr-4">Featured</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {items.map((f) => (
                  <tr key={f.id}>
                    <td className="py-3 pr-4 font-semibold max-w-[180px] truncate">{f.title}</td>
                    <td className="py-3 pr-4 text-zinc-500 max-w-[120px] truncate">{f.organizer}</td>
                    <td className="py-3 pr-4 font-black text-emerald-700">{money(f.raised)}</td>
                    <td className="py-3 pr-4 text-zinc-500">{money(f.goal)}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${f.is_featured ? 'bg-orange-100 text-orange-700' : 'bg-zinc-100 text-zinc-500'}`}>
                        {f.is_featured ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="py-3">
                      <button
                        disabled={working === f.id}
                        onClick={() => update(f.id, { is_featured: !f.is_featured })}
                        className="rounded-lg border border-orange-200 bg-white px-3 py-1.5 text-xs font-black text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                      >
                        {working === f.id ? '…' : f.is_featured ? 'Unfeature' : 'Feature'}
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-sm text-zinc-400">No fundraisers found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
