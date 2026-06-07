import DashboardModulePage from "../DashboardModulePage";

export default function DashboardOrganizersPage() {
  return (
    <DashboardModulePage
      eyebrow="Organizer dashboard"
      title="Organizers"
      description="Create and manage public organizer profiles for events, campaigns, and future sponsorship opportunities."
      actions={[
        { href: "/create-organizer", label: "Create Organizer", primary: true },
        { href: "/organizers", label: "Browse Organizers" },
        { href: "/dashboard", label: "Back to Overview" },
      ]}
      items={["Public profile", "Organizer bio", "Profile image", "Linked events and campaigns"]}
    />
  );
}
