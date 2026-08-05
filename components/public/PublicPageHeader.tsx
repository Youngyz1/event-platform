import Link from "next/link";
import PageHeader from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

type PublicPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
};

export default function PublicPageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: PublicPageHeaderProps) {
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      size="large"
      className={className ? `mb-8 sm:mb-10 ${className}` : "mb-8 sm:mb-10"}
      action={
        action ? (
          <Button asChild size="lg">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
