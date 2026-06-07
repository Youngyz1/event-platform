"use client";

/**
 * app/admin/users/page.tsx
 * User management table with client-side search and suspend/reactivate actions.
 */

import { useEffect, useState } from 'react';

type UserRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

function statusBadge(status: string) {
  return status === 'active'
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-red-100 text-red-600';
}

function roleBadge(role: string) {
  const classes: Record<string, string> = {
    admin:     'bg-violet-100 text-violet-700',
    organizer: 'bg-orange-100 text-orange-700',
    user:      'bg-zinc-100 text-zinc-600',
  };
  return classes[role] ?? classes.user;
}

export default function AdminUsersPage() {
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [working, setWorking]   = useState<string | null>(null);
  const [error, setError]       = useState('');

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => { setUsers(d.users ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load users.'); setLoading(false); });
  }, []);

  async function updateUser(id: string, status: string) {
    setWorking(id);
    setError('');
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
    } else {
      const d = await res.json();
      setError(d.error ?? 'Failed to update user.');
    }
    setWorking(null);
  }

  const filtered = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm sm:px-6">
        <p className="text-xs font-black uppercase tracking-wide text-violet-600">Admin</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Users</h1>
        <p className="mt-2 text-sm font-medium text-zinc-500">Manage platform user accounts.</p>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm sm:p-6">
        <input
          type="search"
          placeholder="Search by email or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-violet-500"
        />

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs font-black uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Role</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Joined</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 pr-4 font-semibold text-zinc-800">{u.email}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${roleBadge(u.role)}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${statusBadge(u.status)}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-zinc-500">
                      {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-3">
                      {u.status === 'active' ? (
                        <button
                          disabled={working === u.id}
                          onClick={() => updateUser(u.id, 'suspended')}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {working === u.id ? '…' : 'Suspend'}
                        </button>
                      ) : (
                        <button
                          disabled={working === u.id}
                          onClick={() => updateUser(u.id, 'active')}
                          className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-black text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          {working === u.id ? '…' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-zinc-400">No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
