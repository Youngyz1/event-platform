import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getDashboardContext, supabaseAdmin } from "@/lib/dashboard-context";
import { getTimeAgo } from "@/lib/fund4good-data";
import { Building2, Plus, ArrowRight, Globe, Layers, DollarSign, Users } from "lucide-react";

const ORG_TYPE_LABELS: Record<string, string> = {
  nonprofit: "Nonprofit", business: "Business", church: "Church",
  school: "School", creator: "Creator", community: "Community",
  government: "Government", restaurant: "Restaurant",
  sports_club: "Sports Club", other: "Organization",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  verified: { label: "Active", color: "border-brand-200 bg-brand-50 text-brand-800", dot: "bg-brand-600" },
  pending: { label: "Pending", color: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  rejected: { label: "Rejected", color: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500" },
  suspended: { label: "Suspended", color: "border-slate-200 bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

function SummaryStat({
  label, value, icon: Icon,
}: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50">
          <Icon className="h-4 w-4 text-brand-700" />
        </div>
      </div>
      <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</span>
    </div>
  );
}

export default async function DashboardOrganizationsPage() {
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/login");

  const { organizers } = ctx;
  const organizerIds = organizers.map((o) => o.id);

  // ── batch-fetch real per-org data (no N+1 queries) ─────────────────────────
  const [fundraisersRes, followsRes] = organizerIds.length
    ? await Promise.all([
        supabaseAdmin
          .from("fundraisers")
          .select("id, organizer_id, raised, raised_amount, status, created_at")
          .in("organizer_id", organizerIds)
          .is("deleted_at", null),
        supabaseAdmin
          .from("organizer_follows")
          .select("organizer_id")
          .in("organizer_id", organizerIds),
      ])
    : [{ data: [] }, { data: [] }];

  const fundraisers = fundraisersRes.data ?? [];
  const fundraiserIds = fundraisers.map((f) => f.id);
  const follows = followsRes.data ?? [];

  const [donationsRes, updatesRes] = fundraiserIds.length
    ? await Promise.all([
        supabaseAdmin.from("donations").select("fundraiser_id, created_at").in("fundraiser_id", fundraiserIds),
        supabaseAdmin.from("fundraiser_updates").select("fundraiser_id, created_at").in("fundraiser_id", fundraiserIds),
      ])
    : [{ data: [] }, { data: [] }];

  const donations = donationsRes.data ?? [];
  const updates = updatesRes.data ?? [];

  // ── per-org aggregates ──────────────────────────────────────────────────────
  const orgStats = new Map<
    string,
    { activeCampaigns: number; raised: number; followers: number; lastActivity: string | null }
  >();

  for (const org of organizers) {
    const ownFundraisers = fundraisers.filter((f) => f.organizer_id === org.id);
    const ownFundraiserIds = new Set(ownFundraisers.map((f) => f.id));
    const activeCampaigns = ownFundraisers.filter((f) => f.status === "published").length;
    const raised = ownFundraisers.reduce((sum, f) => sum + Number(f.raised_amount ?? f.raised ?? 0), 0);
    const followers = follows.filter((flw) => flw.organizer_id === org.id).length;

    const activityTimestamps = [
      ...ownFundraisers.map((f) => f.created_at),
      ...donations.filter((d) => ownFundraiserIds.has(d.fundraiser_id)).map((d) => d.created_at),
      ...updates.filter((u) => ownFundraiserIds.has(u.fundraiser_id)).map((u) => u.created_at),
    ].filter((t): t is string => Boolean(t));

    const lastActivity = activityTimestamps.length
      ? activityTimestamps.reduce((latest, t) => (new Date(t) > new Date(latest) ? t : latest))
      : null;

    orgStats.set(org.id, { activeCampaigns, raised, followers, lastActivity });
  }

  const totals = {
    organizations: organizers.length,
    campaigns: fundraisers.filter((f) => f.status === "published").length,
    raised: fundraisers.reduce((sum, f) => sum + Number(f.raised_amount ?? f.raised ?? 0), 0),
    followers: follows.length,
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Organizations</h1>
          <p className="text-sm text-slate-500">Manage every organization you own or collaborate on.</p>
        </div>
        <Link
          href="/create-organizer"
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-brand-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          New Organization
        </Link>
      </header>

      {organizers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
            <Building2 className="h-7 w-7 text-brand-700" />
          </div>
          <p className="text-lg font-semibold text-slate-900">No organizations yet</p>
          <p className="mt-1.5 max-w-sm text-sm text-slate-500">
            Create an organization to start launching fundraisers, tracking donations, and managing your workspace.
          </p>
          <Link
            href="/create-organizer"
            className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-brand-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Create Organization
          </Link>
        </div>
      ) : (
        <>
          {/* Summary stats — 2x2 on mobile, 4 across on desktop */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SummaryStat label="Organizations" value={totals.organizations.toLocaleString()} icon={Building2} />
            <SummaryStat label="Campaigns" value={totals.campaigns.toLocaleString()} icon={Layers} />
            <SummaryStat label="Raised" value={`$${totals.raised.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={DollarSign} />
            <SummaryStat label="Followers" value={totals.followers.toLocaleString()} icon={Users} />
          </div>

          {/* Workspace cards */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {organizers.map((org) => {
              const orgTypeLabel = ORG_TYPE_LABELS[org.org_type ?? "other"] ?? "Organization";
              const status = STATUS_CONFIG[org.status ?? "pending"] ?? STATUS_CONFIG.pending;
              const stats = orgStats.get(org.id) ?? { activeCampaigns: 0, raised: 0, followers: 0, lastActivity: null };

              return (
                <div
                  key={org.id}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md active:scale-[0.995]"
                >
                  <div className="min-w-0 space-y-4">
                    {/* Header */}
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                        {org.photo ? (
                          <Image src={org.photo} alt={org.name} fill sizes="48px" className="object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center font-semibold text-slate-400">
                            {org.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <h3 className="min-w-0 break-words text-sm font-semibold leading-snug text-slate-900 transition group-hover:text-brand-700 line-clamp-2">
                          {org.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                            {orgTypeLabel}
                          </span>
                          <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            Owner
                          </span>
                          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {org.bio && (
                      <p className="line-clamp-2 break-words text-sm text-slate-500 leading-relaxed">{org.bio}</p>
                    )}

                    {/* Live stats */}
                    <div className="space-y-2 border-t border-slate-100 pt-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Campaigns</span>
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {stats.activeCampaigns} Active
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Followers</span>
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {stats.followers.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Raised</span>
                        <span className="font-semibold text-brand-800 tabular-nums">
                          ${stats.raised.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Last Activity</span>
                        <span className="font-semibold text-slate-900">
                          {stats.lastActivity ? getTimeAgo(stats.lastActivity) : "No activity yet"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
                    <Link
                      href={`/dashboard/org/${org.id}/overview`}
                      className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-2.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-brand-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 sm:flex-1"
                    >
                      Enter Workspace
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <a
                      href={org.slug ? `/org/${org.slug}` : `/organizers/${org.id}`}
                      target="_blank"
                      className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-1"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Public Page
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
