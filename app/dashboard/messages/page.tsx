import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import DashboardEmptyState from "@/components/dashboard/DashboardEmptyState";

export default function AccountMessagesPage() {
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Messages"
        description="Communicate with your followers, ticket holders, and donors across your organizations."
      />

      <DashboardEmptyState
        title="Inbox is empty"
        description="Messages from followers and customer support requests will appear here once messaging is live."
        actionLabel="Back to Overview"
        actionHref="/dashboard"
      />
    </div>
  );
}
