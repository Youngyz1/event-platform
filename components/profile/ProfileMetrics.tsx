import type { LucideIcon } from "lucide-react";
import { Heading } from "@/components/ui/heading";

export interface ProfileMetric {
  label: string;
  value: string | number;
  icon?: LucideIcon;
}

interface ProfileMetricsProps {
  metrics: ProfileMetric[];
}

/**
 * Desktop sidebar metrics block (stacked label/value rows). The former
 * mobile KPI strip layout was removed — profile pages go header → tabs →
 * content with no stat cards in between — so this renders the sidebar
 * variant only.
 */
export default function ProfileMetrics({ metrics }: ProfileMetricsProps) {
  return (
    <div>
      <Heading as="h2" variant="eyebrow" className="mb-4 text-zinc-500">
        Metrics
      </Heading>
      <div className="space-y-4">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-medium text-zinc-500">
              {m.icon && <m.icon className="h-4 w-4 text-brand-600" />}
              {m.label}
            </span>
            <span className="text-base font-black text-zinc-950">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
