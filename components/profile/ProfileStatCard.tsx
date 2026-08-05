import type { LucideIcon } from "lucide-react";

interface ProfileStatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
}

/** One KPI tile — matches the existing AdminStatsCards/DashboardStatsCards visual convention. */
export default function ProfileStatCard({ label, value, icon: Icon }: ProfileStatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-orange-500" />}
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 sm:text-xs">
          {label}
        </p>
      </div>
      <p className="mt-1.5 text-xl font-black text-zinc-950 sm:text-2xl">{value}</p>
    </div>
  );
}
