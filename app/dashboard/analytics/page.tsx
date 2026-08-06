import { getDashboardContext, supabaseAdmin } from "@/lib/dashboard-context";
import { redirect } from "next/navigation";
import { BarChart2, Calendar, Heart, DollarSign } from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/dashboard/fund4good/StatCard";

export default async function AccountAnalyticsPage() {
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/login");

  const { organizerIds } = ctx;

  let eventCount = 0;
  let fundraiserCount = 0;
  let totalRaised = 0;

  if (organizerIds.length > 0) {
    const [eventsRes, fundraisersRes] = await Promise.all([
      supabaseAdmin
        .from("events")
        .select("id", { count: "exact", head: true })
        .in("organizer_id", organizerIds),
      supabaseAdmin
        .from("fundraisers")
        .select("raised, raised_amount")
        .in("organizer_id", organizerIds)
        .is("deleted_at", null),
    ]);

    eventCount = eventsRes.count ?? 0;
    fundraiserCount = fundraisersRes.data?.length ?? 0;
    totalRaised =
      fundraisersRes.data?.reduce((sum, f) => sum + Number(f.raised_amount ?? f.raised ?? 0), 0) ?? 0;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Account Dashboard</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Cross-Organization Analytics</h1>
        <p className="text-sm text-slate-500">Aggregated performance stats across all of your organization workspaces.</p>
      </header>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Events Hosted"
          value={eventCount.toLocaleString()}
          icon={Calendar}
          iconBg="bg-brand-50"
          iconColor="text-brand-700"
        />
        <StatCard
          label="Total Campaigns Launched"
          value={fundraiserCount.toLocaleString()}
          icon={Heart}
          iconBg="bg-brand-50"
          iconColor="text-brand-700"
        />
        <StatCard
          label="Total Funds Raised"
          value={`$${totalRaised.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
        />
      </div>

      <div className="border-t border-zinc-200 py-10 text-center">
        <BarChart2 className="mx-auto h-12 w-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">Detailed charts are coming soon</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
          We are currently building aggregated performance visual charts for tracking page views, ticket buyer demographics, and donation timelines.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-brand-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        >
          Back to Overview
        </Link>
      </div>
    </div>
  );
}
