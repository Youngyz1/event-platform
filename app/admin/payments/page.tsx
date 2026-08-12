/**
 * app/admin/payments/page.tsx
 * Read-only view of all ticket orders and donations across the platform.
 */

import { createClient } from '@supabase/supabase-js';
import DashboardPageHeader from '@/components/dashboard/DashboardPageHeader';

// Service role: bypasses RLS — admin operations only
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function money(n: number | null) {
  return `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function dateLabel(d: string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const statusClasses: Record<string, string> = {
  valid:     'bg-brand-100 text-brand-800',
  used:      'bg-zinc-100 text-zinc-500',
  cancelled: 'bg-red-100 text-red-600',
  refunded:  'bg-brand-100 text-brand-700',
  succeeded: 'bg-brand-100 text-brand-800',
  pending:   'bg-amber-100 text-amber-700',
  failed:    'bg-red-100 text-red-600',
};

export default async function AdminPaymentsPage() {
  const { data: donations } = await supabaseAdmin
    .from('donations')
    .select('id, donor_name, donor_email, amount, status, created_at, fundraisers(title)')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        eyebrow="Admin"
        title="Payments"
        description="Most recent 50 donations across the platform. Read only."
      />

      {/* Donations */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-base font-black tracking-tight text-zinc-950">Donations</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs font-black uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="py-3 pr-4">Donor</th>
                <th className="py-3 pr-4">Fundraiser</th>
                <th className="py-3 pr-4">Amount</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(donations ?? []).map((d) => {
                const fr = Array.isArray(d.fundraisers) ? d.fundraisers[0] : d.fundraisers;
                return (
                  <tr key={d.id}>
                    <td className="py-3 pr-4 font-semibold">{d.donor_name || d.donor_email || 'Anonymous'}</td>
                    <td className="py-3 pr-4 text-zinc-500 max-w-[160px] truncate">
                      {(fr as { title?: string } | null)?.title ?? '—'}
                    </td>
                    <td className="py-3 pr-4 font-black text-brand-800">{money(d.amount)}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${statusClasses[d.status ?? 'succeeded'] ?? statusClasses.succeeded}`}>
                        {d.status ?? 'succeeded'}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-500">{dateLabel(d.created_at)}</td>
                  </tr>
                );
              })}
              {(donations ?? []).length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-zinc-400">No donations yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
