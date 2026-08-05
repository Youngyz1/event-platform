import { Skeleton, DonationListSkeleton, ActivityFeedSkeleton } from "@/components/dashboard/fund4good/Skeletons";

export default function OrgAnalyticsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-56" />
          </div>
          <Skeleton className="h-11 w-28 rounded-lg" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-14" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>

      <Skeleton className="h-40 rounded-xl" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DonationListSkeleton />
        <DonationListSkeleton />
      </div>
      <ActivityFeedSkeleton />
    </div>
  );
}
