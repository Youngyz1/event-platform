"use client";

import MobilePillNav from "@/components/nav/MobilePillNav";
import { getOrgNavItems } from "./nav-items";

export default function OrgMobileNav({ orgId }: { orgId: string }) {
  const navItems = getOrgNavItems(orgId);
  return (
    <div className="-mx-4 px-4 lg:hidden">
      <MobilePillNav items={navItems} ariaLabel="Workspace navigation" />
    </div>
  );
}
