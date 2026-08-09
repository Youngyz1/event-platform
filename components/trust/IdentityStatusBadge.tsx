import { BadgeCheck, CircleDashed } from "lucide-react";

type IdentityStatusBadgeProps = {
  /** True only when identity_verification.status === 'approved' for this
   *  person — never inferred from any other table or flag. */
  verified: boolean;
  className?: string;
};

/**
 * Personal identity status, shown on a user's own public profile
 * (app/profile/[id]). Deliberately distinct from:
 *   - components/trust/VerificationBadge.tsx — that one collapses an
 *     ORGANIZER's identity+organization facts into one compact "fully
 *     verified" signal for card contexts; this is a single, standalone
 *     per-person fact with no organization dimension at all.
 *   - components/ui/VerifiedBadge.tsx — the legacy organizers.status
 *     directory-listing flag, unrelated to either verification table.
 *
 * Always renders something rather than hiding the unconfirmed case: a
 * profile showing only "Verified" badges when true, and nothing otherwise,
 * would let "never checked" and "checked and it's fine" look identical —
 * the same reasoning VerificationFactsPanel already applies to organizer
 * facts.
 */
export default function IdentityStatusBadge({
  verified,
  className = "",
}: IdentityStatusBadgeProps) {
  return (
    <span
      title={verified ? "Government ID checked by our team" : "Identity not yet verified"}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
        verified ? "bg-brand-100 text-brand-800" : "bg-zinc-100 text-zinc-500"
      } ${className}`}
    >
      {verified ? (
        <BadgeCheck size={13} aria-hidden />
      ) : (
        <CircleDashed size={13} aria-hidden />
      )}
      {verified ? "Verified" : "Not yet verified"}
    </span>
  );
}
