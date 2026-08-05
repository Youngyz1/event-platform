import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  type Activity,
  type Donation,
  type TopDonor,
  type DonationTier,
} from "@/lib/fund4good-data";
import { ActivityFeed } from "@/components/dashboard/fund4good/ActivityFeed";
import { DonationList } from "@/components/dashboard/fund4good/DonationList";
import { TopDonors } from "@/components/dashboard/fund4good/TopDonors";
import { WorkspaceCampaignCard, type WorkspaceCampaign } from "../overview/WorkspaceCampaignCard";
import { FundraisingTrendChart, DonorGrowthChart, type DailyPoint, type DonorGrowthPoint } from "./OrgAnalyticsCharts";
import { Heart, DollarSign, Users, Receipt, Download, LayoutGrid, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_DAYS_REMAINING = 30;
const RANGE_OPTIONS = [
  { value: "7", label: "7 Days" },
  { value: "30", label: "30 Days" },
  { value: "90", label: "90 Days" },
  { value: "all", label: "All Time" },
] as const;

function donorTier(amount: number): DonationTier {
  if (amount >= 500) return "platinum";
  if (amount >= 200) return "gold";
  if (amount >= 75) return "silver";
  return "bronze";
}

function isAnonDonor(donorName: string | null | undefined): boolean {
  return donorName === "Anonymous";
}

export default async function OrgAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const { range: rangeParam } = await searchParams;
  const range = (["7", "30", "90", "all"] as const).includes(rangeParam as "7" | "30" | "90" | "all")
    ? (rangeParam as "7" | "30" | "90" | "all")
    : "30";
  const rangeDays = range === "7" ? 7 : range === "90" ? 90 : range === "all" ? null : 30;
  const sinceDate = rangeDays ? new Date(Date.now() - rangeDays * 86_400_000).toISOString() : null;

  const supabase = createSupabaseAdmin();
  const base = `/dashboard/org/${id}`;

  const { data: org } = await supabase
    .from("organizers")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!org) return null;

  const { data: fundraisers } = await supabase
    .from("fundraisers")
    .select("id, title, slug, goal, raised, raised_amount, status, created_at")
    .eq("organizer_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const ownFundraisers = fundraisers ?? [];
  const fundraiserIds = ownFundraisers.map((f) => f.id);
  const fundraiserTitleById = new Map(ownFundraisers.map((f) => [f.id, f.title] as const));

  let donationsQuery = fundraiserIds.length
    ? supabase
        .from("donations")
        .select("id, donor_name, amount, currency, message, created_at, fundraiser_id, source")
        .in("fundraiser_id", fundraiserIds)
        .order("created_at", { ascending: false })
    : null;
  if (donationsQuery && sinceDate) {
    donationsQuery = donationsQuery.gte("created_at", sinceDate);
  }

  const [donationsRes, updatesRes] = await Promise.all([
    donationsQuery ?? Promise.resolve({ data: [] as never[] }),
    fundraiserIds.length
      ? supabase
          .from("fundraiser_updates")
          .select("id, title, created_at, fundraiser_id")
          .in("fundraiser_id", fundraiserIds)
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const donations = (donationsRes.data ?? []) as {
    id: string; donor_name: string | null; amount: number; currency: string | null;
    message: string | null; created_at: string | null; fundraiser_id: string; source: string | null;
  }[];
  const updates = (updatesRes.data ?? []) as { id: string; title: string | null; created_at: string | null; fundraiser_id: string }[];

  // ── top stats (donation-derived numbers are scoped to the selected range;
  // goal/campaign count reflect current state, not a point in time) ──────────
  const totalGoal = ownFundraisers.reduce((sum, f) => sum + Number(f.goal ?? 0), 0);
  const raisedInRange = donations.reduce((sum, d) => sum + Number(d.amount ?? 0), 0);
  const donorsInRange = new Set(donations.map((d) => (isAnonDonor(d.donor_name) ? d.id : d.donor_name))).size;
  const avgDonation = donations.length > 0 ? raisedInRange / donations.length : 0;
  const activeCampaigns = ownFundraisers.filter((f) => f.status === "published").length;

  // ── fundraising trend (real daily totals) ──────────────────────────────────
  const dailyTotals = new Map<string, number>();
  for (const d of donations) {
    const key = new Date(d.created_at ?? Date.now()).toISOString().slice(0, 10);
    dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + Number(d.amount ?? 0));
  }
  const fundraisingTrend: DailyPoint[] = [...dailyTotals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), amount }));

  // ── donor growth (cumulative unique donors over time, by first-donation date) ─
  const firstDonationByDonor = new Map<string, string>();
  for (const d of [...donations].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())) {
    const key = isAnonDonor(d.donor_name) ? d.id : (d.donor_name ?? d.id);
    const dateKey = new Date(d.created_at ?? Date.now()).toISOString().slice(0, 10);
    if (!firstDonationByDonor.has(key)) firstDonationByDonor.set(key, dateKey);
  }
  const newDonorsByDay = new Map<string, number>();
  for (const dateKey of firstDonationByDonor.values()) {
    newDonorsByDay.set(dateKey, (newDonorsByDay.get(dateKey) ?? 0) + 1);
  }
  let cumulative = 0;
  const donorGrowth: DonorGrowthPoint[] = [...newDonorsByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => {
      cumulative += count;
      return { date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), donors: cumulative };
    });

  // ── donation sources (real donations.source values) ────────────────────────
  const sourceCounts = new Map<string, number>();
  for (const d of donations) {
    const key = d.source === "stripe" ? "Card (Stripe)" : d.source === "imported" ? "Imported" : "Other";
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + Number(d.amount ?? 0));
  }
  const donationSources = [...sourceCounts.entries()].sort(([, a], [, b]) => b - a);
  const donationSourcesTotal = donationSources.reduce((sum, [, v]) => sum + v, 0);

  // ── campaign performance cards (all campaigns, not just recent few) ────────
  const campaignCards: WorkspaceCampaign[] = ownFundraisers.map((f) => ({
    id: f.id,
    title: f.title ?? "Untitled Campaign",
    raised: Number(f.raised_amount ?? f.raised ?? 0),
    goal: Number(f.goal ?? 1),
    status: f.status ?? "draft",
    daysRemaining: DEFAULT_DAYS_REMAINING,
  }));

  // ── top donors (aggregated across the selected range) ──────────────────────
  const donorMap = new Map<string, { total: number; count: number; anon: boolean }>();
  for (const d of donations) {
    const anon = isAnonDonor(d.donor_name);
    const key = anon ? "anonymous" : (d.donor_name ?? "anonymous");
    const prev = donorMap.get(key) ?? { total: 0, count: 0, anon };
    donorMap.set(key, { total: prev.total + Number(d.amount ?? 0), count: prev.count + 1, anon });
  }
  const topDonors: TopDonor[] = [...donorMap.entries()]
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 5)
    .map(([name, v], i) => ({
      id: `td-${i}`,
      name: v.anon ? "Anonymous" : name,
      totalGiven: v.total,
      currency: "USD",
      donationCount: v.count,
      lastDonation: "",
      tier: donorTier(v.total),
      isAnonymous: v.anon,
    }));

  // ── recent donations + activity ─────────────────────────────────────────────
  const recentDonations: Donation[] = donations.slice(0, 5).map((d) => {
    const amount = Number(d.amount ?? 0);
    return {
      id: String(d.id),
      donorName: d.donor_name ?? "Anonymous",
      amount,
      currency: d.currency ?? "USD",
      message: d.message ?? undefined,
      timestamp: d.created_at ?? new Date().toISOString(),
      isAnonymous: isAnonDonor(d.donor_name),
      tier: donorTier(amount),
      campaignId: d.fundraiser_id,
    };
  });

  const activities: Activity[] = [
    ...donations.slice(0, 5).map((d) => ({
      id: `don-${d.id}`,
      type: "donation" as const,
      title: "Donation received",
      description: isAnonDonor(d.donor_name)
        ? `Anonymous donated $${Number(d.amount).toLocaleString()} to "${fundraiserTitleById.get(d.fundraiser_id) ?? "a campaign"}"`
        : `${d.donor_name ?? "Someone"} donated $${Number(d.amount).toLocaleString()} to "${fundraiserTitleById.get(d.fundraiser_id) ?? "a campaign"}"`,
      timestamp: d.created_at ?? new Date().toISOString(),
      campaignId: d.fundraiser_id,
      metadata: { donorName: d.donor_name ?? undefined, amount: Number(d.amount), currency: d.currency ?? "USD" },
    })),
    ...updates.slice(0, 3).map((u) => ({
      id: `upd-${u.id}`,
      type: "update_posted" as const,
      title: "Update posted",
      description: `"${u.title ?? "Campaign update"}" was published`,
      timestamp: u.created_at ?? new Date().toISOString(),
      campaignId: u.fundraiser_id,
      metadata: { updateTitle: u.title ?? undefined },
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);

  function rangeHref(value: string) {
    return `${base}/analytics?range=${value}`;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-600">Organization</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Organization Analytics</h1>
            <p className="text-sm text-slate-500">Performance for this workspace</p>
          </div>
          <button
            type="button"
            disabled
            title="Export is coming soon"
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-400 opacity-60"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
        <nav aria-label="Date range" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {RANGE_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={rangeHref(opt.value)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                range === opt.value
                  ? "border-orange-200 bg-orange-50 text-orange-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {opt.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: "Raised", value: `$${raisedInRange.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign, tint: "bg-orange-50 text-orange-600" },
          { label: "Goal", value: `$${totalGoal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: TrendingUp, tint: "bg-violet-50 text-violet-600" },
          { label: "Donors", value: donorsInRange.toLocaleString(), icon: Users, tint: "bg-sky-50 text-sky-600" },
          { label: "Avg Donation", value: `$${avgDonation.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: Receipt, tint: "bg-emerald-50 text-emerald-600" },
          { label: "Campaigns", value: activeCampaigns.toLocaleString(), icon: Heart, tint: "bg-rose-50 text-rose-600" },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-500">{stat.label}</span>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stat.tint}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Fundraising Trend</h2>
          </div>
          <div className="p-5">
            <FundraisingTrendChart data={fundraisingTrend} />
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Donor Growth</h2>
          </div>
          <div className="p-5">
            <DonorGrowthChart data={donorGrowth} />
          </div>
        </div>
      </div>

      {/* Donation Sources */}
      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Donation Sources</h2>
        </div>
        {donationSources.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-slate-400">No donations in this range yet.</p>
        ) : (
          <div className="space-y-3 p-5">
            {donationSources.map(([label, amount]) => {
              const pct = donationSourcesTotal > 0 ? Math.round((amount / donationSourcesTotal) * 100) : 0;
              return (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-700">{label}</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-orange-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Campaign performance */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Campaign Performance</h2>
        {campaignCards.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaignCards.map((c) => (
              <WorkspaceCampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <LayoutGrid className="mb-3 h-9 w-9 text-slate-300" />
            <p className="font-semibold text-slate-900">No campaigns yet</p>
            <p className="mt-1 max-w-xs text-sm text-slate-500">Launch a campaign to start seeing performance data here.</p>
            <Link
              href="/create-fundraiser"
              className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
            >
              Create Campaign
            </Link>
          </div>
        )}
      </section>

      {/* Top donors, recent donations, recent activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TopDonors donors={topDonors} />
        <DonationList donations={recentDonations} />
      </div>
      <ActivityFeed activities={activities} />
    </div>
  );
}
