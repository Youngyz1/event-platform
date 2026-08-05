import type { LucideIcon } from "lucide-react";
import { Heading } from "@/components/ui/heading";
import ProfileStatCard from "./ProfileStatCard";

export interface ProfileMetric {
  label: string;
  value: string | number;
  icon?: LucideIcon;
}

interface ProfileMetricsProps {
  metrics: ProfileMetric[];
  layout: "strip" | "sidebar";
}

/**
 * Renders the same metrics data as either a mobile KPI strip (2-col grid of
 * `ProfileStatCard`) or a desktop sidebar block (stacked rows) — one dataset,
 * responsive placement, no duplicate fetch.
 */
export default function ProfileMetrics({ metrics, layout }: ProfileMetricsProps) {
  if (layout === "sidebar") {
    return (
      <div>
        <Heading as="h2" variant="eyebrow" className="mb-4 text-zinc-500">
          Metrics
        </Heading>
        <div className="space-y-4">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-medium text-zinc-500">
                {m.icon && <m.icon className="h-4 w-4 text-orange-500" />}
                {m.label}
              </span>
              <span className="text-base font-black text-zinc-950">{m.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {metrics.map((m) => (
        <ProfileStatCard key={m.label} label={m.label} value={m.value} icon={m.icon} />
      ))}
    </div>
  );
}
