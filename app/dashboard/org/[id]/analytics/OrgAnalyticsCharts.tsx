"use client";

import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export type DailyPoint = { date: string; amount: number };
export type DonorGrowthPoint = { date: string; donors: number };

interface CurrencyTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CurrencyTooltip({ active, payload, label }: CurrencyTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-sm font-bold text-slate-900">${payload[0].value.toLocaleString()}</p>
    </div>
  );
}

function CountTooltip({ active, payload, label }: CurrencyTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-sm font-bold text-slate-900">{payload[0].value.toLocaleString()} donors</p>
    </div>
  );
}

export function FundraisingTrendChart({ data }: { data: DailyPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-48 items-center justify-center text-sm text-slate-400">
        Not enough donation history yet to show a trend.
      </p>
    );
  }
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={192} initialDimension={{ width: -1, height: 192 }}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="orgFundraisingTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ea580c" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip content={<CurrencyTooltip />} />
          <Area type="monotone" dataKey="amount" stroke="#ea580c" strokeWidth={2} fill="url(#orgFundraisingTrend)" dot={false} activeDot={{ r: 4, fill: "#ea580c", strokeWidth: 2, stroke: "#fff" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonorGrowthChart({ data }: { data: DonorGrowthPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-48 items-center justify-center text-sm text-slate-400">
        Not enough donor history yet to show growth.
      </p>
    );
  }
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={192} initialDimension={{ width: -1, height: 192 }}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<CountTooltip />} />
          <Line type="monotone" dataKey="donors" stroke="#0ea5e9" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#0ea5e9", strokeWidth: 2, stroke: "#fff" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
