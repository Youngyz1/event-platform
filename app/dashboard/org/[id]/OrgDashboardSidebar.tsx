"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Globe } from "lucide-react";
import AppSidebar from "@/components/nav/AppSidebar";
import { getOrgNavItems } from "./nav-items";

type Org = {
  id: string;
  name: string;
  slug: string | null;
  photo: string | null;
  status: string | null;
  org_type: string | null;
};

const ORG_TYPE_LABELS: Record<string, string> = {
  nonprofit: "Nonprofit", business: "Business", church: "Church",
  school: "School", creator: "Creator", community: "Community",
  government: "Government", restaurant: "Restaurant",
  sports_club: "Sports Club", other: "Organization",
};

export default function OrgDashboardSidebar({ org }: { org: Org }) {
  const navItems = getOrgNavItems(org.id);
  const orgTypeLabel = ORG_TYPE_LABELS[org.org_type ?? "other"] ?? "Organization";

  return (
    <AppSidebar
      navAriaLabel="Workspace navigation"
      groups={[{ items: navItems }]}
      header={
        <>
          {/* ← Back to account */}
          <div className="border-b border-white/10 px-4 py-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              All Organizations
            </Link>
          </div>

          {/* Org identity */}
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white/10">
                {org.photo ? (
                  <Image src={org.photo} alt={org.name} width={40} height={40} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-lg font-black text-white/60">
                    {org.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{org.name}</p>
                <p className="text-xs text-slate-400">{orgTypeLabel}</p>
              </div>
            </div>
            {/* View public profile — uses slug for the public URL */}
            <Link
              href={org.slug ? `/org/${org.slug}` : `/organizers/${org.id}`}
              target="_blank"
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <Globe className="h-3 w-3" />
              View Public Profile
            </Link>
          </div>
        </>
      }
    />
  );
}
