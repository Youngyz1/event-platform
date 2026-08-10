import { redirect } from "next/navigation";
import { getDashboardContext, supabaseAdmin } from "@/lib/dashboard-context";
import Fund4GoodDashboardView from "@/components/dashboard/fund4good/Fund4GoodDashboardView";
import type {
  Campaign,
  CampaignStatus,
  Donation,
  DonationTier,
  Activity,
  WithdrawalStatus,
  TimelineEvent,
  RecommendedAction,
} from "@/lib/fund4good-data";

// ── helpers ──────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const MILESTONE_THRESHOLDS = [25, 50, 75, 100] as const;

function getDaysRemaining(endDate: string | null): number {
  if (!endDate) return 30;
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / DAY_MS));
}

function inferStatus(
  raised: number,
  goal: number,
  endDate: string | null
): CampaignStatus {
  const days = getDaysRemaining(endDate);
  if (days === 0 || raised >= goal) return "completed";
  const progress = raised / goal;
  const elapsed = 1 - days / 90; // rough estimate of campaign lifespan
  if (progress >= elapsed + 0.05) return "ahead";
  if (progress < elapsed - 0.1) return "behind";
  return "on_track";
}

// Composite 0-100 score built directly from the same pace numbers shown
// elsewhere on the dashboard (actual daily pace vs. required daily pace),
// so the health score never disagrees with the pace copy next to it.
function computeHealthScore(
  status: CampaignStatus,
  dailyPaceRequired: number | undefined,
  averageDailyRaised: number
): number {
  if (status === "completed") return 100;
  if (dailyPaceRequired === undefined || dailyPaceRequired <= 0) return 100;
  const paceRatio = averageDailyRaised / dailyPaceRequired;
  return Math.max(0, Math.min(100, Math.round(paceRatio * 65)));
}

function computeProjectedFinishDate(
  raised: number,
  goal: number,
  averageDailyRaised: number
): string | null {
  if (raised >= goal) return null; // caller checks status === "completed" for messaging
  if (averageDailyRaised <= 0) return null;
  const daysToGoal = Math.ceil((goal - raised) / averageDailyRaised);
  return new Date(Date.now() + daysToGoal * DAY_MS).toISOString();
}

function buildRecommendedAction(status: CampaignStatus): RecommendedAction {
  switch (status) {
    case "behind":
      return {
        type: "share_campaign",
        label: "Share Campaign",
        reason:
          "You're behind pace. Sharing on social media could unlock 3–5× more visibility.",
        urgency: "high",
      };
    case "completed":
      return {
        type: "thank_donors",
        label: "Thank Donors",
        reason: "Campaign complete — send a personal thank-you to your donors.",
        urgency: "low",
      };
    case "ahead":
      return {
        type: "post_update",
        label: "Post an Update",
        reason:
          "Keep momentum going with a fresh update — donations typically spike 48 h after each post.",
        urgency: "medium",
      };
    default:
      return {
        type: "boost_campaign",
        label: "Boost Campaign",
        reason: "Promote your campaign to reach new donors.",
        urgency: "low",
      };
  }
}

function donorTier(amount: number): DonationTier {
  if (amount >= 500) return "platinum";
  if (amount >= 200) return "gold";
  if (amount >= 75) return "silver";
  return "bronze";
}

// donations has no is_anonymous column — "Anonymous" is stored as the
// literal donor_name (its DB default) rather than tracked as a separate flag.
function isAnonDonor(donorName: string | null | undefined): boolean {
  return donorName === "Anonymous";
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

type RawDonationRow = {
  id: string;
  donor_name: string | null;
  amount: number | string | null;
  currency: string | null;
  message: string | null;
  created_at: string | null;
  fundraiser_id: string;
};

// Walks a campaign's donations in chronological order and returns the real
// cumulative-total crossings of each milestone threshold — never fabricated,
// simply derived from summing actual donation amounts in order.
function computeMilestoneCrossings(
  goal: number,
  donationsAscending: RawDonationRow[]
): Array<{ pct: (typeof MILESTONE_THRESHOLDS)[number]; date: string; amount: number }> {
  if (goal <= 0) return [];
  const crossed: Array<{ pct: (typeof MILESTONE_THRESHOLDS)[number]; date: string; amount: number }> = [];
  let cumulative = 0;
  let nextThresholdIdx = 0;

  for (const d of donationsAscending) {
    cumulative += Number(d.amount ?? 0);
    while (
      nextThresholdIdx < MILESTONE_THRESHOLDS.length &&
      cumulative >= (MILESTONE_THRESHOLDS[nextThresholdIdx] / 100) * goal
    ) {
      crossed.push({
        pct: MILESTONE_THRESHOLDS[nextThresholdIdx],
        date: d.created_at ?? new Date().toISOString(),
        amount: cumulative,
      });
      nextThresholdIdx += 1;
    }
  }
  return crossed;
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/login");

  const { user, organizerIds } = ctx;
  const displayName =
    (user.user_metadata?.display_name as string | undefined)?.trim() || "Fundraiser";

  // ── fetch fundraisers ──────────────────────────────────────────────────────
  // NOTE: fundraisers has no description/currency/start_date/end_date/donor_count
  // columns, and "raised" has a known split with "raised_amount" (see the
  // "fundraiser raised column split" memory note) — select real columns only
  // and reconcile raised/raised_amount below, the same way other pages do.
  //
  // Owner-scoped OR organizer-scoped: a personal fundraiser (organizer_id
  // null, no organizer of the owner's own) has to surface here via user_id
  // alone, or it never appears on its own owner's dashboard at all. Building
  // this filter string is safe — organizerIds come from organizers.id and
  // user.id from auth, both always well-formed UUIDs, never arbitrary input.
  const ownerFundraiserFilter = organizerIds.length
    ? `organizer_id.in.(${organizerIds.join(",")}),user_id.eq.${user.id}`
    : `user_id.eq.${user.id}`;
  const { data: rawFundraisers, error: fundraisersError } = await supabaseAdmin
    .from("fundraisers")
    .select(
      "id, title, story, category, raised, raised_amount, goal, slug, status, deleted_at, created_at, organizer_id"
    )
    .or(ownerFundraiserFilter)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (fundraisersError) {
    console.error("[dashboard] failed to load fundraisers:", fundraisersError);
  }

  // ── fetch donations ────────────────────────────────────────────────────────
  const fundraiserIds = (rawFundraisers ?? []).map((f) => f.id as string);

  // NOTE: donations has no is_anonymous column — the real convention is that
  // donor_name itself is the literal string "Anonymous" (its DB default),
  // so anonymity is derived from that rather than a separate boolean.
  //
  // Limit raised from 20 to 500: a global cap of 20 across every campaign a
  // fundraiser owns was too small to build accurate daily-totals charts or
  // real milestone-crossing history for anything but a brand-new campaign —
  // 500 comfortably covers this platform's real per-fundraiser donation
  // volumes while staying well short of an unbounded query.
  const { data: rawDonations, error: donationsError } =
    fundraiserIds.length > 0
      ? await supabaseAdmin
          .from("donations")
          .select(
            "id, donor_name, amount, currency, message, created_at, fundraiser_id"
          )
          .in("fundraiser_id", fundraiserIds)
          .order("created_at", { ascending: false })
          .limit(500)
      : { data: [], error: null };

  if (donationsError) {
    console.error("[dashboard] failed to load donations:", donationsError);
  }

  // ── fetch fundraiser updates for activity feed + timeline ─────────────────
  const { data: rawUpdates, error: updatesError } =
    fundraiserIds.length > 0
      ? await supabaseAdmin
          .from("fundraiser_updates")
          .select("id, title, created_at, fundraiser_id")
          .in("fundraiser_id", fundraiserIds)
          .order("created_at", { ascending: false })
          .limit(10)
      : { data: [], error: null };

  if (updatesError) {
    console.error("[dashboard] failed to load fundraiser updates:", updatesError);
  }

  // ── fetch approved comments for activity feed ──────────────────────────────
  const { data: rawComments, error: commentsError } =
    fundraiserIds.length > 0
      ? await supabaseAdmin
          .from("comments")
          .select("id, target_id, author_name, body, created_at")
          .eq("target_type", "fundraiser")
          .eq("status", "approved")
          .in("target_id", fundraiserIds)
          .order("created_at", { ascending: false })
          .limit(20)
      : { data: [], error: null };

  if (commentsError) {
    console.error("[dashboard] failed to load comments:", commentsError);
  }

  // ── fetch organizer follows for followers KPI + activity feed ─────────────
  const { data: rawFollows, error: followsError } = organizerIds.length
    ? await supabaseAdmin
        .from("organizer_follows")
        .select("id, organizer_id, created_at")
        .in("organizer_id", organizerIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (followsError) {
    console.error("[dashboard] failed to load organizer follows:", followsError);
  }

  const recentFollows = (rawFollows ?? []).slice(0, 10);

  // ── map to Campaign[] ──────────────────────────────────────────────────────
  const now = new Date();

  const campaigns: Campaign[] = (rawFundraisers ?? []).map((f) => {
    const raised = Number(f.raised_amount ?? f.raised ?? 0);
    const goal = Number(f.goal ?? 1);
    // No end_date column exists yet — getDaysRemaining/inferStatus already
    // fall back sensibly to a 30-day assumption when passed null.
    const daysLeft = getDaysRemaining(null);
    const status = inferStatus(raised, goal, null);
    const daysElapsed = Math.max(
      1,
      Math.floor((Date.now() - new Date(f.created_at ?? Date.now()).getTime()) / DAY_MS)
    );
    const avgDaily = Math.round(raised / daysElapsed);
    const dailyPaceRequired =
      daysLeft > 0 ? Math.round((goal - raised) / daysLeft) : undefined;

    const fundraiserDonations = (rawDonations ?? []).filter(
      (d) => String(d.fundraiser_id) === String(f.id)
    );
    const donorCount = new Set(
      fundraiserDonations.map((d) => (isAnonDonor(d.donor_name) ? d.id : d.donor_name))
    ).size;
    const averageDonation =
      fundraiserDonations.length > 0 ? Math.round(raised / fundraiserDonations.length) : 0;

    const todayDonations = fundraiserDonations.filter((d) =>
      isSameUtcDay(new Date(d.created_at ?? 0), now)
    );
    const todayAmount = todayDonations.reduce((sum, d) => sum + Number(d.amount ?? 0), 0);

    const followerCount = (rawFollows ?? []).filter(
      (fl) => String(fl.organizer_id) === String(f.organizer_id)
    ).length;
    const commentCount = (rawComments ?? []).filter(
      (c) => String(c.target_id) === String(f.id)
    ).length;

    return {
      id: String(f.id),
      title: f.title ?? "Untitled Campaign",
      description: f.story ?? "",
      category: f.category ?? "General",
      status,
      raised,
      goal,
      currency: "USD",
      startDate: f.created_at ?? new Date().toISOString(),
      endDate: "",
      daysRemaining: daysLeft,
      donorCount,
      shareCount: 0,
      updateCount: (rawUpdates ?? []).filter(
        (u) => String(u.fundraiser_id) === String(f.id)
      ).length,
      slug: f.slug ?? String(f.id),
      organizerId: String(f.organizer_id ?? ""),
      lastUpdateDate:
        (rawUpdates ?? [])
          .filter((u) => String(u.fundraiser_id) === String(f.id))
          .at(0)?.created_at ?? f.created_at ?? new Date().toISOString(),
      averageDailyRaised: avgDaily,
      averageDonation,
      todayAmount,
      todayCount: todayDonations.length,
      followerCount,
      commentCount,
      dailyPaceRequired,
      healthScore: computeHealthScore(status, dailyPaceRequired, avgDaily),
      projectedFinishDate: computeProjectedFinishDate(raised, goal, avgDaily),
      healthMessage:
        status === "completed"
          ? "Goal reached! Campaign completed successfully."
          : status === "ahead"
          ? "You are ahead of pace. Keep the momentum going."
          : status === "behind"
          ? `You need approximately $${dailyPaceRequired?.toLocaleString()}/day to reach your goal.`
          : "Your campaign is on track.",
      recommendedAction: buildRecommendedAction(status),
    } satisfies Campaign;
  });

  // ── map to Donation[] ──────────────────────────────────────────────────────
  const donations: Donation[] = (rawDonations ?? []).map((d) => {
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
      campaignId: String(d.fundraiser_id),
    } satisfies Donation;
  });

  // ── build unified activity feed: donations + updates + comments + follows + milestones ──
  const activities: Activity[] = [
    ...(rawDonations ?? []).slice(0, 8).map((d) => ({
      id: `don-${d.id}`,
      type: "donation" as const,
      title: "New donation received",
      description: isAnonDonor(d.donor_name)
        ? `Anonymous donated $${Number(d.amount).toLocaleString()}`
        : `${d.donor_name ?? "Someone"} donated $${Number(d.amount).toLocaleString()}`,
      timestamp: d.created_at ?? new Date().toISOString(),
      campaignId: String(d.fundraiser_id),
      metadata: {
        donorName: d.donor_name ?? undefined,
        amount: Number(d.amount),
        currency: d.currency ?? "USD",
      },
    })),
    ...(rawUpdates ?? []).slice(0, 5).map((u) => ({
      id: `upd-${u.id}`,
      type: "update_posted" as const,
      title: "Update posted",
      description: `"${u.title ?? "Campaign update"}" was published`,
      timestamp: u.created_at ?? new Date().toISOString(),
      campaignId: String(u.fundraiser_id),
      metadata: { updateTitle: u.title ?? undefined },
    })),
    ...(rawComments ?? []).slice(0, 8).map((c) => ({
      id: `com-${c.id}`,
      type: "comment" as const,
      title: "New comment",
      description: `${c.author_name ?? "Someone"}: "${(c.body ?? "").slice(0, 80)}${
        (c.body ?? "").length > 80 ? "…" : ""
      }"`,
      timestamp: c.created_at ?? new Date().toISOString(),
      campaignId: String(c.target_id),
      metadata: { commentAuthor: c.author_name ?? undefined, commentBody: c.body ?? undefined },
    })),
    // organizer follows aren't tied to one fundraiser — surface each recent
    // follow against every active campaign that organizer owns.
    ...recentFollows.flatMap((fl) =>
      campaigns
        .filter((c) => c.organizerId === String(fl.organizer_id))
        .map((c) => ({
          id: `fol-${fl.id}-${c.id}`,
          type: "follow" as const,
          title: "New follower",
          description: "Someone started following your organization",
          timestamp: fl.created_at ?? new Date().toISOString(),
          campaignId: c.id,
        }))
    ),
    ...campaigns.flatMap((c) => {
      const ascending = [...(rawDonations ?? [])]
        .filter((d) => String(d.fundraiser_id) === c.id)
        .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
      return computeMilestoneCrossings(c.goal, ascending as RawDonationRow[]).map((m) => ({
        id: `mil-${c.id}-${m.pct}`,
        type: "milestone" as const,
        title: "Milestone reached",
        description: `"${c.title}" hit ${m.pct}% of its goal — $${Math.round(m.amount).toLocaleString()} raised`,
        timestamp: m.date,
        campaignId: c.id,
        metadata: { milestone: `${m.pct}%` },
      }));
    }),
  ].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Top donors are computed client-side (per selected campaign) in
  // Fund4GoodDashboardView from the scoped donations list, so there's no
  // need to build a cross-campaign version of it here.

  // ── withdrawal data (empty until Stripe payouts are surfaced) ─────────────
  const withdrawals: WithdrawalStatus[] = [];

  // ── timeline events from launch + updates + real milestones, for every campaign ──
  // Built for every campaign (not just the most recent one) so the client can
  // correctly rescope the timeline when the user switches campaigns.
  const timelineEvents: TimelineEvent[] = campaigns.flatMap((c) => {
    const ascending = [...(rawDonations ?? [])]
      .filter((d) => String(d.fundraiser_id) === c.id)
      .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());

    return [
      {
        id: `tl-start-${c.id}`,
        date: c.startDate,
        title: "Campaign Launched",
        type: "campaign_start" as const,
        description: `"${c.title}" went live.`,
        campaignId: c.id,
      },
      ...computeMilestoneCrossings(c.goal, ascending as RawDonationRow[]).map((m) => ({
        id: `tl-mil-${c.id}-${m.pct}`,
        date: m.date,
        title: `${m.pct}% Goal Reached`,
        type: "milestone" as const,
        amount: Math.round(m.amount),
        description: `$${Math.round(m.amount).toLocaleString()} raised — ${m.pct}% of goal.`,
        campaignId: c.id,
      })),
      ...(rawUpdates ?? [])
        .filter((u) => String(u.fundraiser_id) === c.id)
        .slice(0, 6)
        .map((u) => ({
          id: `tl-upd-${u.id}`,
          date: u.created_at ?? "",
          title: u.title ?? "Campaign Update",
          type: "update" as const,
          description: `Update published: "${u.title ?? "Campaign update"}"`,
          campaignId: c.id,
        })),
    ];
  });

  // Daily donation totals for the analytics chart are derived client-side,
  // per selected campaign, from `donations` — see buildDailyDonations() in
  // lib/fund4good-data.ts. Building them here too would just be a global
  // (cross-campaign) total the client immediately discards.

  return (
    <Fund4GoodDashboardView
      displayName={displayName}
      initialCampaigns={campaigns.length > 0 ? campaigns : undefined}
      initialDonations={donations.length > 0 ? donations : undefined}
      initialActivities={activities.length > 0 ? activities : undefined}
      initialWithdrawals={withdrawals.length > 0 ? withdrawals : undefined}
      initialTimelineEvents={timelineEvents.length > 0 ? timelineEvents : undefined}
      loadError={Boolean(fundraisersError)}
    />
  );
}
