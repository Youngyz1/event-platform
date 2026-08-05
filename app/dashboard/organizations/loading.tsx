export default function OrganizationsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded bg-slate-200" />
          <div className="h-4 w-64 rounded bg-slate-100" />
        </div>
        <div className="h-11 w-full rounded-lg bg-slate-200 sm:w-40" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="h-4 w-16 rounded bg-slate-100" />
              <div className="h-8 w-8 rounded-lg bg-slate-100" />
            </div>
            <div className="h-7 w-14 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 shrink-0 rounded-xl bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-slate-200" />
                <div className="flex gap-1.5">
                  <div className="h-5 w-16 rounded-full bg-slate-100" />
                  <div className="h-5 w-14 rounded-full bg-slate-100" />
                </div>
              </div>
            </div>
            <div className="space-y-2 border-t border-slate-100 pt-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex justify-between">
                  <div className="h-3.5 w-20 rounded bg-slate-100" />
                  <div className="h-3.5 w-12 rounded bg-slate-100" />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
              <div className="h-11 w-full rounded-lg bg-slate-200" />
              <div className="h-11 w-full rounded-lg bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
