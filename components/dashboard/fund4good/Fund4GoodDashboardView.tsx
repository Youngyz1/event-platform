"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type Campaign,
  type Donation,
  type Activity,
  type TopDonor,
  type WithdrawalStatus,
  type TimelineEvent,
  buildDailyDonations,
} from "@/lib/fund4good-data";
import DashboardEmptyState from "@/components/dashboard/DashboardEmptyState";

import { CampaignSelector } from "./CampaignSelector";
import { CampaignHeader } from "./CampaignHeader";
import { CampaignHealthCard } from "./CampaignHealthCard";
import { KpiGrid } from "./KpiGrid";
import { DonationList } from "./DonationList";
import { ActivityFeed } from "./ActivityFeed";
import { AnalyticsCard } from "./AnalyticsCard";
import { CampaignTimeline } from "./CampaignTimeline";
import { TopDonors } from "./TopDonors";
import { WithdrawalStatusCard } from "./WithdrawalStatusCard";
import { QuickActions } from "./QuickActions";
import { SmartInsightsCard } from "./SmartInsightsCard";
import { DonationListSkeleton, ActivityFeedSkeleton } from "./Skeletons";

// Short synthetic transition so switching campaigns feels like a deliberate
// data refresh rather than an instant, jarring swap — all data is already
// client-side, so this is purely a perceived-performance micro-interaction.
const CAMPAIGN_SWITCH_TRANSITION_MS = 220;

interface Fund4GoodDashboardViewProps {
  displayName?: string;
  initialCampaigns?: Campaign[];
  initialDonations?: Donation[];
  initialActivities?: Activity[];
  initialWithdrawals?: WithdrawalStatus[];
  initialTimelineEvents?: TimelineEvent[];
  loadError?: boolean;
}

export default function Fund4GoodDashboardView({
  displayName = "Fundraiser",
  initialCampaigns,
  initialDonations,
  initialActivities,
  initialWithdrawals,
  initialTimelineEvents,
  loadError = false,
}: Fund4GoodDashboardViewProps) {
  const [switching, setSwitching] = useState(false);
  const [campaignsList] = useState<Campaign[]>(initialCampaigns ?? []);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    campaignsList[0] ?? null
  );

  function handleSelectCampaign(campaign: Campaign) {
    if (campaign.id === selectedCampaign?.id) return;
    setSwitching(true);
    setSelectedCampaign(campaign);
  }

  useEffect(() => {
    if (!switching) return;
    const timer = setTimeout(() => setSwitching(false), CAMPAIGN_SWITCH_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [switching]);

  // initialDonations/initialActivities/initialTimelineEvents span every
  // campaign the fundraiser owns, not just the selected one — scope them
  // here so switching campaigns actually changes what these panels show
  // instead of leaking cross-campaign data. The analytics chart is rebuilt
  // from the scoped donations too, fixing the same leak for daily totals.
  const campaignDonations = useMemo(
    () => (initialDonations ?? []).filter((d) => d.campaignId === selectedCampaign?.id),
    [initialDonations, selectedCampaign?.id]
  );
  const campaignActivities = useMemo(
    () => (initialActivities ?? []).filter((a) => a.campaignId === selectedCampaign?.id),
    [initialActivities, selectedCampaign?.id]
  );
  const campaignTimelineEvents = useMemo(
    () => (initialTimelineEvents ?? []).filter((e) => e.campaignId === selectedCampaign?.id),
    [initialTimelineEvents, selectedCampaign?.id]
  );
  const campaignWithdrawals = useMemo(
    () => (initialWithdrawals ?? []).filter((w) => w.campaignId === selectedCampaign?.id),
    [initialWithdrawals, selectedCampaign?.id]
  );
  const campaignDailyDonations = useMemo(
    () => buildDailyDonations(campaignDonations),
    [campaignDonations]
  );
  const campaignTopDonors = useMemo(() => {
    const byDonor = new Map<
      string,
      { total: number; count: number; isAnonymous: boolean; tier: TopDonor["tier"] }
    >();
    for (const d of campaignDonations) {
      const key = d.isAnonymous ? "Anonymous" : d.donorName;
      const prev = byDonor.get(key) ?? {
        total: 0,
        count: 0,
        isAnonymous: d.isAnonymous,
        tier: d.tier,
      };
      byDonor.set(key, {
        total: prev.total + d.amount,
        count: prev.count + 1,
        isAnonymous: d.isAnonymous,
        tier: d.tier,
      });
    }
    return [...byDonor.entries()]
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 5)
      .map(
        ([name, v], i) =>
          ({
            id: `scoped-td-${i}`,
            name,
            totalGiven: v.total,
            currency: "USD",
            donationCount: v.count,
            lastDonation: "",
            tier: v.tier,
            isAnonymous: v.isAnonymous,
          }) satisfies TopDonor
      );
  }, [campaignDonations]);

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeading displayName={displayName} />
        <DashboardEmptyState
          title="Couldn't load your dashboard"
          description="Something went wrong fetching your campaign data. Try refreshing the page — if this keeps happening, contact support."
          actionLabel="Retry"
          actionHref="/dashboard"
        />
      </div>
    );
  }

  if (!selectedCampaign) {
    return (
      <div className="space-y-6">
        <PageHeading displayName={displayName} />
        <DashboardEmptyState
          title="No fundraisers yet"
          description="Create your first fundraiser to start tracking donations, donors, and campaign performance here."
          actionLabel="Create a fundraiser"
          actionHref="/dashboard/fundraisers/new"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome + Campaign Selector */}
      <div className="flex flex-col gap-3">
        <PageHeading displayName={displayName} />
        <CampaignSelector
          campaigns={campaignsList}
          selectedCampaign={selectedCampaign}
          onSelect={handleSelectCampaign}
        />
      </div>

      {/* Primary Hero — Campaign Header with health metrics */}
      <CampaignHeader campaign={selectedCampaign} />

      {/* Campaign Health + KPI Cards */}
      <CampaignHealthCard campaign={selectedCampaign} />
      <KpiGrid campaign={selectedCampaign} dailyDonations={campaignDailyDonations} />

      {/* Main content (wide) + utility rail (narrow) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <QuickActions campaign={selectedCampaign} className="lg:col-start-2 lg:row-start-1" />

        <SmartInsightsCard
          campaign={selectedCampaign}
          campaignDonations={campaignDonations}
          className="lg:col-start-2 lg:row-start-2"
        />

        {/* Analytics */}
        <AnalyticsCard dailyDonations={campaignDailyDonations} className="lg:col-start-1 lg:row-start-1" />

        {/* Recent Activity */}
        {switching ? (
          <ActivityFeedSkeleton className="lg:col-start-1 lg:row-start-2" />
        ) : (
          <ActivityFeed activities={campaignActivities} className="lg:col-start-1 lg:row-start-2" />
        )}
        <TopDonors donors={campaignTopDonors} className="lg:col-start-2 lg:row-start-3" />

        {/* Campaign Timeline */}
        <CampaignTimeline events={campaignTimelineEvents} className="lg:col-start-1 lg:row-start-3" />
        <WithdrawalStatusCard data={campaignWithdrawals} className="lg:col-start-2 lg:row-start-4" />

        {/* Recent Donations */}
        {switching ? (
          <DonationListSkeleton className="lg:col-start-1 lg:row-start-4" />
        ) : (
          <DonationList donations={campaignDonations} className="lg:col-start-1 lg:row-start-4" />
        )}
      </div>
    </div>
  );
}

function PageHeading({ displayName }: { displayName: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-sm font-medium text-slate-500">
        Welcome back, {displayName} ·{" "}
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>
    </div>
  );
}
