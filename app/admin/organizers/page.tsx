"use client";

/**
 * app/admin/organizers/page.tsx
 * Organizer moderation — approve, reject, suspend organizer profiles.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

type OrgRow = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  status: string;
  created_at: string;
};

const statusBadge: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700',
  verified:  'bg-emerald-100 text-emerald-700',
  rejected:  'bg-red-100 text-red-600',
  suspended: 'bg-zinc-200 text-zinc-600',
};

export default function AdminOrganizersPage() {
  const [orgs, setOrgs]         = useState<OrgRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [working, setWorking]   = useState<string | null>(null);
  const [error, setError]       = useState('');

  useEffect(() => {
    fetch('/api/admin/organizers')
      .then((r) => r.json())
      .then((d) => { setOrgs(d.organizers ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load organizers.'); setLoading(false); });
  }, []);

  async function updateOrg(id: string, status: string) {
    setWorking(id);
    setError('');
    const res = await fetch(`/api/admin/organizers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setOrgs((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    } else {
      const d = await res.json();
      setError(d.error ?? 'Update failed.');
    }
    setWorking(null);
  }

  const groups = [
    { title: 'Pending Organizers', status: 'pending', description: 'Profiles waiting for admin review.' },
    { title: 'Verified Organizers', status: 'verified', description: 'Approved organizer profiles visible as trusted organizers.' },
    { title: 'Suspended Organizers', status: 'suspended', description: 'Organizer profiles blocked from healthy public visibility.' },
    { title: 'Rejected Organizers', status: 'rejected', description: 'Profiles rejected during moderation.' },
  ];

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm sm:px-6">
        <p className="text-xs font-black uppercase tracking-wide text-violet-600">Admin</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Organizers</h1>
        <p className="mt-2 text-sm font-medium text-zinc-500">Verify, reject, or suspend organizer profiles.</p>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const rows = orgs.filter((org) => (org.status || 'pending') === group.status);
            return (
              <section key={group.status} className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-zinc-950">{group.title}</h2>
                    <p className="mt-1 text-sm font-medium text-zinc-500">{group.description}</p>
                  </div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-black uppercase ${statusBadge[group.status] ?? statusBadge.pending}`}>
                    {rows.length} {rows.length === 1 ? 'profile' : 'profiles'}
                  </span>
                </div>
                {rows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center text-sm font-semibold text-zinc-500">
                    No {group.status} organizers.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-left text-sm">
                      <thead className="border-b border-zinc-200 text-xs font-black uppercase tracking-wide text-zinc-400">
                        <tr>
                          <th className="py-3 pr-4">Name</th>
                          <th className="py-3 pr-4">Owner</th>
                          <th className="py-3 pr-4">Status</th>
                          <th className="py-3 pr-4">Created</th>
                          <th className="py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {rows.map((o) => (
                          <tr key={o.id}>
                            <td className="py-3 pr-4">
                              <Link href={`/organizers/${o.id}`} className="font-black text-zinc-900 hover:text-violet-700 hover:underline">
                                {o.name}
                              </Link>
                            </td>
                            <td className="py-3 pr-4">
                              <Link href={`/admin/users/${o.user_id}`} className="font-semibold text-zinc-600 hover:text-violet-700 hover:underline">
                                {o.email || 'Unknown owner'}
                              </Link>
                            </td>
                            <td className="py-3 pr-4">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${statusBadge[o.status] ?? statusBadge.pending}`}>
                                {o.status}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-zinc-500">
                              {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="py-3">
                              <div className="flex flex-wrap gap-2">
                                <Link href={`/organizers/${o.id}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-black text-zinc-700 hover:bg-zinc-50">
                                  View
                                </Link>
                                {o.status !== 'verified' && (
                                  <button disabled={working === o.id} onClick={() => updateOrg(o.id, 'verified')}
                                    className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-black text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                                    {working === o.id ? '…' : 'Approve'}
                                  </button>
                                )}
                                {o.status !== 'rejected' && (
                                  <button disabled={working === o.id} onClick={() => updateOrg(o.id, 'rejected')}
                                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50">
                                    {working === o.id ? '…' : 'Reject'}
                                  </button>
                                )}
                                {o.status !== 'suspended' && (
                                  <button disabled={working === o.id} onClick={() => updateOrg(o.id, 'suspended')}
                                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-black text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">
                                    {working === o.id ? '…' : 'Suspend'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
