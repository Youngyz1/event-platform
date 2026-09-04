"use client";

import { memo } from "react";
import {
  type Activity,
  getTimeAgo,
} from "@/lib/fund4good-data";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";

interface ActivityFeedProps {
  activities?: Activity[];
  className?: string;
}

export const ActivityFeed = memo(function ActivityFeed({ activities = [], className }: ActivityFeedProps) {
  return (
    <div className={cn("rounded-xl border border-zinc-200 bg-white", className)}>
      {/* Header */}
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
      </div>

      {/* Timeline List */}
      {activities.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Donations, updates, comments, and new followers will show up here."
        />
      ) : (
      <ul className="divide-y divide-slate-50 px-5" role="list" aria-label="Campaign activity feed">
        {activities.map((activity) => {
          return (
            <li key={activity.id} className="py-3.5">
              {/* Content */}
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-sm font-medium text-slate-900 leading-snug">
                  {activity.title}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {activity.description}
                </p>
                <span className="text-xs text-slate-400 mt-1">
                  {getTimeAgo(activity.timestamp)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      )}
    </div>
  );
});
