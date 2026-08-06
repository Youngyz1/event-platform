"use client";

import { useState } from "react";
import Link from "next/link";
import { X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PendingTask {
  id: string;
  message: string;
  href: string;
  urgency: "high" | "medium" | "low";
}

const URGENCY_STYLES: Record<PendingTask["urgency"], string> = {
  high: "bg-red-50 text-red-600 border-red-200",
  medium: "bg-amber-50 text-amber-600 border-amber-200",
  low: "bg-slate-50 text-slate-500 border-slate-200",
};

export function PendingTasksList({ tasks }: { tasks: PendingTask[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = tasks.filter((t) => !dismissed.has(t.id));

  if (visible.length === 0) {
    return (
      <div className="py-5 text-center">
        <p className="text-sm font-medium text-slate-500">You&apos;re all caught up — no pending tasks.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" role="list">
      {visible.map((task) => (
        <li
          key={task.id}
          className="flex min-w-0 items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4"
        >
          <span
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
              URGENCY_STYLES[task.urgency]
            )}
            aria-hidden
          >
            <AlertCircle className="h-3.5 w-3.5" />
          </span>
          <Link href={task.href} className="min-w-0 flex-1 break-words text-sm font-medium text-slate-700 hover:text-brand-700">
            {task.message}
          </Link>
          <button
            type="button"
            onClick={() => setDismissed((prev) => new Set(prev).add(task.id))}
            aria-label="Dismiss task"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-50 hover:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
