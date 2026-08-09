import { BadgeCheck, Building2, CircleDashed, FileCheck2, MinusCircle } from "lucide-react";
import type { VerificationFacts } from "@/lib/verification-facts";

/**
 * The three verification facts, shown separately and never merged.
 *
 * A single "Verified" tick is the thing this component exists to avoid. The
 * three claims are genuinely independent and a donor deciding whether to give
 * needs them apart:
 *
 *   Identity      — a real person behind the campaign, ID checked
 *   Organization  — the body exists AND this person may raise funds for it
 *   Campaign      — this specific campaign passed admin review
 *
 * An individual organizer has no organization, so that row reads "Not
 * applicable", never "Not verified" — the second would imply a missing check
 * that was never owed.
 *
 * Unconfirmed facts are shown rather than hidden. A donor who sees only what
 * passed cannot tell the difference between "checked and fine" and "never
 * checked", and that difference is the entire point of the feature.
 */

type Props = {
  facts: VerificationFacts;
  /** fundraisers.status === "published" — the migration-41 approval gate. */
  campaignApproved: boolean;
  className?: string;
};

type Row = {
  key: string;
  icon: typeof BadgeCheck;
  label: string;
  state: "confirmed" | "unconfirmed" | "not-applicable";
  detail: string;
};

const STATE_STYLES = {
  confirmed: "text-brand-700",
  unconfirmed: "text-zinc-400",
  "not-applicable": "text-zinc-300",
} as const;

export default function VerificationFactsPanel({
  facts,
  campaignApproved,
  className = "",
}: Props) {
  const rows: Row[] = [
    {
      key: "identity",
      icon: BadgeCheck,
      label: "Organizer identity",
      state: facts.identityVerified ? "confirmed" : "unconfirmed",
      detail: facts.identityVerified
        ? "Government ID checked by our team"
        : "Not yet verified",
    },
    {
      key: "organization",
      icon: Building2,
      label: "Organization",
      state: !facts.organizationApplicable
        ? "not-applicable"
        : facts.organizationVerified
          ? "confirmed"
          : "unconfirmed",
      detail: !facts.organizationApplicable
        ? "Individual organizer — no organization to verify"
        : facts.organizationVerified
          ? "Registration and authority to fundraise confirmed"
          : "Not yet verified",
    },
    {
      key: "campaign",
      icon: FileCheck2,
      label: "This campaign",
      state: campaignApproved ? "confirmed" : "unconfirmed",
      detail: campaignApproved
        ? "Reviewed and approved before going live"
        : "Awaiting review",
    },
  ];

  return (
    <section
      className={`rounded-2xl border border-zinc-200 bg-white p-5 ${className}`}
      aria-labelledby="verification-facts-heading"
    >
      <h2
        id="verification-facts-heading"
        className="text-sm font-black text-zinc-950"
      >
        What we&apos;ve checked
      </h2>

      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          const Icon =
            row.state === "confirmed"
              ? row.icon
              : row.state === "not-applicable"
                ? MinusCircle
                : CircleDashed;
          return (
            <li key={row.key} className="flex gap-3">
              <Icon
                size={18}
                aria-hidden
                className={`mt-0.5 shrink-0 ${STATE_STYLES[row.state]}`}
              />
              <div className="min-w-0">
                <p
                  className={`text-sm font-bold ${
                    row.state === "confirmed" ? "text-zinc-900" : "text-zinc-500"
                  }`}
                >
                  {row.label}
                </p>
                <p className="text-xs leading-relaxed text-zinc-500">
                  {row.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-400">
        Verification tells you who is raising the money and that the campaign was
        reviewed. It is not a guarantee of how funds will be spent.
      </p>
    </section>
  );
}
