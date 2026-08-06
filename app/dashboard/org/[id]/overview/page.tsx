import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  type Activity,
  type Donation,
  type DonationTier,
} from "@/lib/fund4good-data";
import { ActivityFeed } from "@/components/dashboard/fund4good/ActivityFeed";
import { DonationList } from "@/components/dashboard/fund4good/DonationList";
import { WorkspaceCampaignCard, type WorkspaceCampaign } from "./WorkspaceCampaignCard";
import { PendingTasksList, type PendingTask } from "./PendingTasksList";
import {
  Heart, DollarSign, Users, Calendar, Plus, Megaphone, UserPlus, Globe, LayoutGrid,
} from "lucide-react";

// No end_date column exists on fundraisers yet — every campaign gets the
// same honest default rather than a fabricated per-campaign countdown.
const DEFAULT_DAYS_REMAINING = 30;

function donorTier(amount: number): DonationTier {
  if (amount >= 500) return "platinum";
  if (amount >= 200) return "gold";
  if (amount >= 75) return "silver";
  return "bronze";
}

function isAnonDonor(donorName: string | null | undefined): boolean {
  return donorName === "Anonymous";
}

export default async function OrgOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createSupabaseAdmin();
  const base = `/dashboard/org/${id}`;

  const { data: org } = await supabase
    .from("organizers")
    .select("id, name, slug, bio, photo")
    .eq("id", id)
    .maybeSingle();

  if (!org) return null;

  const [{ data: fundraisers }, { count: eventCount }] = await Promise.all([
    supabase
      .from("fundraisers")
      .select("id, title, slug, goal, raised, raised_amount, status, created_at")
      .eq("organizer_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("organizer_id", id),
  ]);

  const ownFundraisers = fundraisers ?? [];
  const fundraiserIds = ownFundraisers.map((f) => f.id);

  const [{ data: rawDonations }, { data: rawUpdates }] = fundraiserIds.length
    ? await Promise.all([
        supabase
          .from("donations")
          .select("id, donor_name, amount, currency, message, created_at, fundraiser_id")
          .in("fundraiser_id", fundraiserIds)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("fundraiser_updates")
          .select("id, title, created_at, fundraiser_id")
          .in("fundraiser_id", fundraiserIds)
          .order("created_at", { ascending: false })
          .limit(10),
      ])
    : [{ data: [] }, { data: [] }];

  const donations = rawDonations ?? [];
  const updates = rawUpdates ?? [];
  const fundraiserTitleById = new Map(ownFundraisers.map((f) => [f.id, f.title] as const));

  // ── stats ────────────────────────────────────────────────────────────────
  const activeCampaigns = ownFundraisers.filter((f) => f.status === "published").length;
  const raised = ownFundraisers.reduce((sum, f) => sum + Number(f.raised_amount ?? f.raised ?? 0), 0);
  const donorCount = new Set(
    donations.map((d) => (isAnonDonor(d.donor_name) ? d.id : d.donor_name))
  ).size;

  // ── campaign cards (most recent 6) ──────────────────────────────────────
  const campaignCards: WorkspaceCampaign[] = ownFundraisers.slice(0, 6).map((f) => ({
    id: f.id,
    title: f.title ?? "Untitled Campaign",
    raised: Number(f.raised_amount ?? f.raised ?? 0),
    goal: Number(f.goal ?? 1),
    status: f.status ?? "draft",
    daysRemaining: DEFAULT_DAYS_REMAINING,
  }));

  // ── recent activity (real events only — no fabricated "member joined" or
  // "campaign completed" entries, since neither has a real timestamp source) ──
  const activities: Activity[] = [
    ...ownFundraisers.slice(0, 3).map((f) => ({
      id: `camp-${f.id}`,
      type: "campaign_started" as const,
      title: "Campaign created",
      description: `"${f.title}" was created.`,
      timestamp: f.created_at ?? new Date().toISOString(),
      campaignId: f.id,
    })),
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

  // ── recent donations ────────────────────────────────────────────────────
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

  // ── pending tasks — only genuinely derivable signals, no invented ones ──
  const pendingTasks: PendingTask[] = [
    ...(!org.bio
      ? [{ id: "missing-bio", message: "Add a description to your organization profile", href: `${base}/settings`, urgency: "medium" as const }]
      : []),
    ...(!org.photo
      ? [{ id: "missing-photo", message: "Upload a logo for your organization", href: `${base}/settings`, urgency: "low" as const }]
      : []),
  ];

  const mostRecentFundraiser = ownFundraisers[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Organization</p>
          <h1 className="mt-1 min-w-0 break-words text-2xl font-bold text-slate-900">{org.name}</h1>
          <p className="text-sm text-slate-500">Your organization at a glance</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`${base}/settings`}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-none"
          >
            Settings
          </Link>
          <button
            type="button"
            disabled
            title="Team collaboration is coming soon"
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-400 opacity-60 sm:flex-none"
          >
            <UserPlus className="h-4 w-4" />
            Invite
          </button>
        </div>
      </header>

      {/* Stats — 2x2 mobile, 4 columns desktop */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Campaigns", value: activeCampaigns.toLocaleString(), icon: Heart, tint: "bg-brand-50 text-brand-700" },
          { label: "Raised", value: `$${raised.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign, tint: "bg-brand-50 text-brand-700" },
          { label: "Donors", value: donorCount.toLocaleString(), icon: Users, tint: "bg-sky-50 text-sky-600" },
          { label: "Events", value: (eventCount ?? 0).toLocaleString(), icon: Calendar, tint: "bg-violet-50 text-violet-600" },
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

      {/* Quick Actions */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Link
            href="/create-fundraiser"
            className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-center transition hover:border-brand-300 hover:bg-brand-50/40"
          >
            <Plus className="h-5 w-5 text-brand-700" />
            <span className="text-sm font-semibold text-slate-900">Create Campaign</span>
          </Link>
          {mostRecentFundraiser ? (
            <Link
              href={`/dashboard/fundraisers/${mostRecentFundraiser.id}/updates`}
              className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-center transition hover:border-brand-300 hover:bg-brand-50/40"
            >
              <Megaphone className="h-5 w-5 text-brand-700" />
              <span className="text-sm font-semibold text-slate-900">Post Update</span>
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="Create a campaign first"
              className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-center opacity-50"
            >
              <Megaphone className="h-5 w-5 text-slate-400" />
              <span className="text-sm font-semibold text-slate-500">Post Update</span>
            </button>
          )}
          <button
            type="button"
            disabled
            title="Team collaboration is coming soon"
            className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-center opacity-50"
          >
            <UserPlus className="h-5 w-5 text-slate-400" />
            <span className="text-sm font-semibold text-slate-500">Invite Member</span>
          </button>
          <a
            href={org.slug ? `/org/${org.slug}` : `/organizers/${org.id}`}
            target="_blank"
            className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-center transition hover:border-brand-300 hover:bg-brand-50/40"
          >
            <Globe className="h-5 w-5 text-brand-700" />
            <span className="text-sm font-semibold text-slate-900">View Public Page</span>
          </a>
        </div>
      </section>

      {/* Campaign Overview */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Campaigns</h2>
          <Link href={`${base}/fundraisers`} className="text-xs font-medium text-brand-700 hover:text-brand-800">
            View all
          </Link>
        </div>
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
            <p className="mt-1 max-w-xs text-sm text-slate-500">Launch your first campaign to start tracking donations here.</p>
            <Link
              href="/create-fundraiser"
              className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              <Plus className="h-4 w-4" />
              Create Campaign
            </Link>
          </div>
        )}
      </section>

      {/* Activity + Donations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityFeed activities={activities} />
        <DonationList donations={recentDonations} />
      </div>

      {/* Members + Pending Tasks */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Members</h2>
            <button
              type="button"
              disabled
              title="Team collaboration is coming soon"
              className="text-xs font-medium text-slate-400"
            >
              Invite
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
              {org.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">You</p>
              <p className="text-xs text-slate-400">Sole owner of this organization</p>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800">
              Owner
            </span>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Team collaboration and invites aren&apos;t available yet — this organization currently has a single owner.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Pending Tasks</h2>
          <PendingTasksList tasks={pendingTasks} />
        </section>
      </div>
    </div>
  );
}
