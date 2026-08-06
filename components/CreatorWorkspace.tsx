import type { ReactNode } from "react";
import Link from "next/link";
import { Home, LayoutDashboard, Building2, Settings } from "lucide-react";
import DashboardSidebar from "@/app/dashboard/DashboardSidebar";
import MobilePillNav from "@/components/nav/MobilePillNav";
import type { NavItem } from "@/components/nav/nav-active";

type Step = {
  label: string;
};

const mobileDashboardItems: NavItem[] = [
  { label: "Home", href: "/", icon: Home, exact: true },
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Organizations", href: "/dashboard/organizations", icon: Building2 },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function CreatorWorkspace({
  accent,
  title,
  description,
  email,
  steps,
  currentStep,
  onStepChange,
  onSaveDraft,
  children,
  aside,
  footer,
}: {
  accent: "orange" | "green";
  title: string;
  description: string;
  email?: string | null;
  steps: Step[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onSaveDraft: () => void;
  children: ReactNode;
  aside: ReactNode;
  footer: ReactNode;
}) {
  const accentClasses = {
    orange: {
      text: "text-brand-700",
      bg: "bg-brand-700",
      soft: "bg-brand-50 text-brand-800",
    },
    green: {
      text: "text-brand-700",
      bg: "bg-brand-700",
      soft: "bg-brand-50 text-brand-800",
    },
  };
  const theme = accentClasses[accent];

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="mx-auto flex max-w-[1500px] gap-5 px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
        <DashboardSidebar />

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="lg:hidden">
            <MobilePillNav items={mobileDashboardItems} ariaLabel="Dashboard navigation" />
          </div>

        <div className="min-w-0 flex-1">
          <header className="border-b border-zinc-200 pb-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="grid gap-3 sm:grid-cols-[1fr_220px] xl:w-[620px]">
                <label className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-500">
                  <i className="ti ti-search text-lg" aria-hidden="true" />
                  <input className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Search events..." type="search" />
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-500">
                  <i className="ti ti-map-pin text-lg" aria-hidden="true" />
                  <input className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Location" type="search" />
                </label>
              </div>

              <div className="flex items-center justify-between gap-3 xl:justify-end">
                <button className="hidden rounded-xl p-2.5 text-zinc-500 hover:bg-zinc-100 sm:block" type="button" aria-label="Notifications">
                  <i className="ti ti-bell text-xl" aria-hidden="true" />
                </button>
                <div className="flex h-10 items-center gap-2 rounded-xl bg-zinc-100 px-3 text-sm font-black text-zinc-700">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full ${theme.bg} text-xs text-white`}>
                    {(email || "U").charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-32 truncate">{email || "User"}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
              <div>
                <h1 className="text-3xl font-black tracking-tight">{title}</h1>
                <p className="mt-1 text-sm font-medium text-zinc-500">{description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={onSaveDraft} type="button" className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-black text-zinc-900 hover:bg-zinc-50">
                  Save as Draft
                </button>
                <Link href="/dashboard" className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-black text-zinc-500 hover:bg-zinc-50">
                  Close
                </Link>
              </div>
            </div>

            <div className="mt-4 flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0">
              {steps.map((step, index) => {
                const activeStep = index === currentStep;
                const complete = index < currentStep;
                return (
                  <button
                    key={step.label}
                    onClick={() => onStepChange(index)}
                    type="button"
                    className="flex shrink-0 items-center gap-3 text-left"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                        activeStep || complete ? `${theme.bg} text-white` : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className={`whitespace-nowrap text-xs font-black ${activeStep ? "text-zinc-950" : "text-zinc-500"}`}>{step.label}</span>
                  </button>
                );
              })}
            </div>
          </header>

          <div className="grid gap-5 py-5 xl:grid-cols-[1fr_320px]">
            <div>{children}</div>
            <aside className="space-y-5">{aside}</aside>
          </div>

          <div className="border-t border-zinc-200 pt-4">{footer}</div>
        </div>
        </div>
      </div>
    </main>
  );
}

export function CreatorPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function CreatorField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-zinc-800">{label}</span>
      {children}
      {hint && <span className="mt-2 block text-xs font-medium text-zinc-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100";

export const greenInputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100";
