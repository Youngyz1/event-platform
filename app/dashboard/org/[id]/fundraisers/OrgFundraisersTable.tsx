"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProgressBar from "@/components/ui/ProgressBar";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import ReviewBadge from "@/components/trust/ReviewBadge";
import { calculateFundraisingPercentage } from "@/lib/fundraising-progress";
import { cn } from "@/lib/utils";

export interface OrgFundraiserItem {
  id: string;
  title: string;
  slug: string;
  goal: number | string | null;
  raised: number | string | null;
  status: string | null;
  created_at: string | null;
}

function money(v: number | string | null) {
  return `$${Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function OrgFundraisersTable({ fundraisers }: { fundraisers: OrgFundraiserItem[] }) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<OrgFundraiserItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/dashboard/fundraisers/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Delete failed.");
        return;
      }

      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wide text-zinc-500">Campaign</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wide text-zinc-500">Raised</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wide text-zinc-500">Goal</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wide text-zinc-500">Progress</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wide text-zinc-500">Status</th>
                <th className="px-5 py-3 text-right text-xs font-black uppercase tracking-wide text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {fundraisers.map((f) => {
                const pct = calculateFundraisingPercentage(f.raised, f.goal);
                const raisedNum = Number(f.raised ?? 0);
                const hasDonations = raisedNum > 0;

                return (
                  <tr key={f.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-4 font-bold text-zinc-900">{f.title}</td>
                    <td className="px-5 py-4 font-bold text-brand-800">{money(f.raised)}</td>
                    <td className="px-5 py-4 text-zinc-600">{money(f.goal)}</td>
                    <td className="px-5 py-4">
                      <ProgressBar percentage={pct} height={6} className="w-24" />
                      <span className="mt-0.5 text-xs text-zinc-500">{pct}%</span>
                    </td>
                    <td className="px-5 py-4">
                      {f.status === "published" ? (
                        <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-800">
                          Published
                        </span>
                      ) : (
                        <ReviewBadge status={f.status} />
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/fundraisers/${f.slug}`}
                          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-black text-zinc-700 hover:bg-zinc-50"
                        >
                          View
                        </Link>
                        <Link
                          href={`/fundraisers/edit/${f.id}`}
                          className="rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-xs font-black text-brand-800 hover:bg-brand-50"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          disabled={hasDonations}
                          title={
                            hasDonations
                              ? "Campaigns with donations cannot be deleted to preserve payment history."
                              : "Delete fundraiser"
                          }
                          onClick={() => {
                            setError("");
                            setDeleteTarget(f);
                          }}
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-xs font-black transition",
                            hasDonations
                              ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 opacity-60"
                              : "border-red-200 bg-white text-red-700 hover:bg-red-50"
                          )}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AdminConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Fundraiser"
        description={`Delete "${deleteTarget?.title ?? "this fundraiser"}"? Fundraisers with donation payment records are blocked to preserve payment history.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={deleting}
        variant="danger"
      />
    </div>
  );
}
