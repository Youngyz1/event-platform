// app/dashboard/analytics/loading.tsx — Analytics skeleton
export default function AnalyticsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-2.5 w-16 rounded bg-zinc-200" />
        <div className="h-7 w-56 rounded bg-zinc-200" />
        <div className="h-2.5 w-72 rounded bg-zinc-200" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-zinc-200" />
            <div className="h-7 w-16 rounded bg-zinc-200" />
            <div className="h-2.5 w-32 rounded bg-zinc-200" />
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-200 py-10 text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-zinc-200" />
        <div className="mx-auto h-5 w-48 rounded bg-zinc-200" />
        <div className="mx-auto h-2.5 w-64 rounded bg-zinc-200" />
      </div>
    </div>
  );
}
