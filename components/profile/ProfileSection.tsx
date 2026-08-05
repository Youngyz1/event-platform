import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Heading } from "@/components/ui/heading";

interface ProfileSectionProps {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}

/** Page-layout content section — divider + label, not a bordered card. */
export default function ProfileSection({ title, icon: Icon, children, className }: ProfileSectionProps) {
  return (
    <div className={cn("border-t border-zinc-200 pt-5 first:border-t-0 first:pt-0", className)}>
      <Heading as="h2" variant="eyebrow" className="mb-4 flex items-center gap-2 text-zinc-500">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {title}
      </Heading>
      {children}
    </div>
  );
}
