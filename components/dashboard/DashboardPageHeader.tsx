import PageHeader from "@/components/ui/page-header";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export default function DashboardPageHeader({
  eyebrow = "Dashboard",
  title,
  description,
  action,
}: Props) {
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      action={action}
      size="compact"
    />
  );
}
