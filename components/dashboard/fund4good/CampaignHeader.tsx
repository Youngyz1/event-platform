"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type Campaign,
  formatCurrency,
  getProgressPercentage,
} from "@/lib/fund4good-data";
import { copyTextToClipboard } from "@/lib/clipboard";
import { getSiteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";
import { getStatusMeta } from "./campaign-status";
import { Share2, Pencil, ExternalLink, Check, Trash2 } from "lucide-react";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import ReviewBadge from "@/components/trust/ReviewBadge";

interface CampaignHeaderProps {
  campaign: Campaign;
  className?: string;
}

export function CampaignHeader({ campaign, className }: CampaignHeaderProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const status = getStatusMeta(campaign.status, campaign.healthScore);
  const progress = getProgressPercentage(campaign.raised, campaign.goal);
  const hasDonations = Number(campaign.raised ?? 0) > 0 || Number(campaign.donorCount ?? 0) > 0;

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/dashboard/fundraisers/${campaign.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error ?? "Delete failed.");
        return;
      }
      setShowDeleteConfirm(false);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function handleShare() {
    const url = `${getSiteUrl()}/fundraisers/${campaign.slug}`;
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const progressColor =
    progress >= 75
      ? "bg-brand-600"
      : progress >= 40
      ? "bg-brand-600"
      : "bg-amber-400";

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200 bg-white p-5 sm:p-6",
        className
      )}
    >
      {/* Title row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {/* Badges */}
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <ReviewBadge status={campaign.reviewStatus} />
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                status.color
              )}
            >
              <span aria-hidden>{status.emoji}</span>
              {status.label}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {campaign.category}
            </span>
          </div>

          {/* Campaign title */}
          <h1 className="break-words text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
            {campaign.title}
          </h1>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-brand-700" aria-hidden />
            ) : (
              <Share2 className="h-3.5 w-3.5" aria-hidden />
            )}
            {copied ? "Copied" : "Share"}
          </button>
          <Link
            href={`/fundraisers/edit/${campaign.id}`}
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit
          </Link>
          <Link
            href={`/fundraisers/${campaign.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            View Page
          </Link>
          <button
            type="button"
            disabled={hasDonations}
            title={hasDonations ? "Campaigns with donations cannot be deleted to preserve payment history." : "Delete fundraiser"}
            onClick={() => { setDeleteError(""); setShowDeleteConfirm(true); }}
            className={cn(
              "flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600",
              hasDonations
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60"
                : "border-red-200 bg-white text-red-700 hover:bg-red-50"
            )}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete
          </button>
        </div>
      </div>

      {deleteError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">
          {deleteError}
        </div>
      )}

      <AdminConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => !open && setShowDeleteConfirm(false)}
        title="Delete Fundraiser"
        description={`Delete "${campaign.title}"? Fundraisers with donation payment records are blocked to preserve payment history.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={deleting}
        variant="danger"
      />

      {/* Progress section */}
      <div className="mt-5 space-y-2">
        {/* Raised vs Goal */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-extrabold tabular-nums text-slate-900">
            {formatCurrency(campaign.raised, campaign.currency, true)}
          </span>
          <span className="text-sm text-slate-500">
            of{" "}
            <span className="font-semibold text-slate-700">
              {formatCurrency(campaign.goal, campaign.currency, true)}
            </span>{" "}
            goal
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${progress}% funded`}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              progressColor
            )}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Four-stat metric strip */}
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip
          label="Raised"
          value={formatCurrency(campaign.raised, campaign.currency, true)}
          highlight
        />
        <StatChip label="Funded" value={`${progress}%`} />
        <StatChip
          label="Days Left"
          value={campaign.daysRemaining > 0 ? `${campaign.daysRemaining}` : "—"}
          subValue={campaign.daysRemaining > 0 ? "days remaining" : "Ended"}
        />
        <StatChip
          label="Avg / Day"
          value={formatCurrency(
            campaign.averageDailyRaised,
            campaign.currency,
            true
          )}
        />
      </dl>
    </div>
  );
}

function StatChip({
  label,
  value,
  subValue,
  highlight,
}: {
  label: string;
  value: string;
  subValue?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-slate-50 px-3 py-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd
        className={cn(
          "truncate text-sm font-bold tabular-nums",
          highlight ? "text-brand-700" : "text-slate-900"
        )}
      >
        {value}
      </dd>
      {subValue && (
        <span className="text-[11px] leading-tight text-slate-400">
          {subValue}
        </span>
      )}
    </div>
  );
}
