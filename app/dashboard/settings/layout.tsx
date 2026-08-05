"use client";

import React from "react";
import { User, Lock, Bell, CreditCard, ShieldAlert, Link2 } from "lucide-react";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import SidebarNavList from "@/components/nav/SidebarNavList";
import MobilePillNav from "@/components/nav/MobilePillNav";
import type { NavGroup } from "@/components/nav/nav-active";

const groups: NavGroup[] = [
  {
    items: [
      { label: "Profile", href: "/dashboard/settings/profile", icon: User, description: "Personal details and addresses" },
      { label: "Security", href: "/dashboard/settings/security", icon: Lock, description: "Password and account access" },
      { label: "Notifications", href: "/dashboard/settings/notifications", icon: Bell, description: "Email preference settings" },
      { label: "Payments", href: "/dashboard/settings/payments", icon: CreditCard, description: "Stripe payouts and currency" },
      { label: "Privacy", href: "/dashboard/settings/privacy", icon: ShieldAlert, description: "Profile and display privacy" },
      { label: "Connected Accounts", href: "/dashboard/settings/accounts", icon: Link2, description: "Third-party sync integrations" },
    ],
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      {/* Settings Header */}
      <DashboardPageHeader
        eyebrow="Dashboard"
        title="Settings Center"
        description="Manage your personal details, credentials, security, notifications, and integrations."
      />

      {/* Main Settings Navigation and Content Container */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Navigation Sidebar (Desktop: Left, Mobile: Top Scrollable Tabs) */}
        <aside className="w-full shrink-0 lg:w-64">
          <div className="hidden lg:block">
            <SidebarNavList groups={groups} tone="light" ariaLabel="Settings navigation" />
          </div>
          <div className="lg:hidden">
            <MobilePillNav items={groups[0].items} ariaLabel="Settings navigation" />
          </div>
        </aside>

        {/* Settings Content Area */}
        <main className="flex-1 min-w-0">
          <div className="transition-all duration-200">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
