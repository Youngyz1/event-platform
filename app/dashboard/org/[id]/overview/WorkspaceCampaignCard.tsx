"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import ProgressBar from "@/components/ui/ProgressBar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { calculateFundraisingPercentage } from "@/lib/fundraising-progress";
import { cn } from "@/lib/utils";

export interface WorkspaceCampaign {
  id: string;
  title: string;
  raised: number;
  goal: number;
  status: string;
  daysRemaining: number;
}

const STATUS_STYLES: Record<string, string> = {
  published: "border-emerald-200 bg-emerald-50 text-emerald-700",
  draft: "border-slate-200 bg-slate-100 text-slate-600",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
};

export function WorkspaceCampaignCard({ campaign }: { campaign: WorkspaceCampaign }) {
  const progress = calculateFundraisingPercentage(campaign.raised, campaign.goal);
  const statusStyle = STATUS_STYLES[campaign.status] ?? STATUS_STYLES.draft;

  return (
    <div className="min-w-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <Link
          href={`/dashboard/fundraisers`}
          className="min-w-0 break-words text-sm font-semibold leading-snug text-slate-900 line-clamp-2 hover:text-orange-600"
        >
          {campaign.title}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Manage ${campaign.title}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 p-1">
            <DropdownMenuItem asChild className="rounded-lg">
              <Link href={`/fundraisers/edit/${campaign.id}`}>Edit</Link>
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="rounded-lg" title="Coming soon">
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="rounded-lg" title="Coming soon">
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-lg text-red-600 focus:text-red-600">
              <Link href="/dashboard/fundraisers">Delete…</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 space-y-1.5">
        <ProgressBar percentage={progress} height={8} />
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs">
          <span className="font-semibold text-slate-900 tabular-nums">
            ${campaign.raised.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span className="text-slate-400 tabular-nums">
            of ${campaign.goal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", statusStyle)}>
          {campaign.status}
        </span>
        <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
          {campaign.daysRemaining > 0 ? `${campaign.daysRemaining}d left` : "Ended"}
        </span>
      </div>
    </div>
  );
}
