"use client";

import { SettingsCard } from "@/components/ui/settings-card";
import { Landmark, Mail, Sparkles } from "lucide-react";

/**
 * Payouts settings.
 *
 * This page previously presented a working payout system that did not exist:
 * "Connect Stripe Account" ran a 1.5s timeout and toasted "setup successfully
 * in sandbox mode!", "Save Payout Settings" persisted nothing, and the currency
 * and schedule selects were local state. None of it reached Stripe — there is
 * no Connect integration in the codebase (no stripe.accounts, transfers,
 * payouts, transfer_data or application_fee anywhere).
 *
 * Since real donations are being collected, telling organizers they had linked
 * a bank account and chosen a payout schedule was the most misleading surface
 * on the platform. It now states the actual process.
 *
 * When Stripe Connect is built, the onboarding entry point belongs in the first
 * card below, replacing the "how you get paid today" copy.
 */
export default function PaymentsClient({
  organizerName,
}: {
  userId: string;
  organizerName: string | null;
}) {
  return (
    <div className="space-y-6">
      <SettingsCard
        title="How you get paid"
        description="Where the money raised by your campaigns goes, and how it reaches you."
      >
        <div className="space-y-4 text-sm leading-relaxed text-zinc-600">
          <p>
            Donations to
            {organizerName ? (
              <> <span className="font-bold text-zinc-900">{organizerName}</span>&apos;s</>
            ) : (
              " your"
            )}{" "}
            campaigns are collected securely by Fund4Good through Stripe. We then
            transfer the funds to you directly.
          </p>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
              Requesting a payout
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              Payouts are arranged by our team rather than through an automated
              schedule. Email us and we&apos;ll confirm your bank details and the
              amount available.
            </p>
            <a
              href="mailto:support@fund4agoodcause.com?subject=Payout%20request"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-xs font-black text-white transition hover:bg-brand-800"
            >
              <Mail size={14} />
              Request a payout
            </a>
          </div>
          <p className="text-xs text-zinc-500">
            Connecting your own Stripe account, so payouts settle automatically
            without going through us, is planned — we&apos;ll email you when it
            is available.
          </p>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Linked bank account"
        description="Where we send funds when you request a payout."
      >
        <div className="flex items-center gap-4 p-1 text-zinc-500">
          <Landmark size={24} className="shrink-0 text-zinc-400" />
          <div>
            <p className="text-sm font-bold text-zinc-700">
              Confirmed when you request a payout
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              We collect bank details at the point of transfer rather than
              storing them here, so there is nothing to link in advance.
            </p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Payout history"
        description="Transfers we have sent you."
      >
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Sparkles size={20} />
          </div>
          <p className="mt-4 text-sm font-bold text-zinc-950">No payouts yet</p>
          <p className="mt-1 max-w-xs text-xs leading-normal text-zinc-500">
            Transfers we send you will be listed here once payout records are
            tracked in your dashboard.
          </p>
        </div>
      </SettingsCard>
    </div>
  );
}
