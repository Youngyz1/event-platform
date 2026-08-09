import { Building2, CircleDashed, MinusCircle } from "lucide-react";

type OrganizationStatusBadgeProps = {
  /** organizer_verification.organization_verified_at (via .organizationVerified) —
   *  never identity_verified_at. Identity is a separate, person-scoped fact
   *  as of the identity_verification split and is no longer this table's
   *  concern for display purposes. */
  verified: boolean;
  /** False for organizer_type='individual' — there's no organization to
   *  verify, distinct from "not yet verified". */
  applicable: boolean;
  className?: string;
};

/**
 * Organization-only status, shown on the organizer's own public profile
 * (app/org/[slug]), near the organization's own contact/connect info.
 *
 * Deliberately a separate component from IdentityStatusBadge, not a shared
 * one with a "kind" prop — the two facts live on different tables, apply to
 * different subjects (a person vs. an organization), and this phase's brief
 * is explicit that they should look and read distinctly, not like the same
 * badge reused. Label says "Organization", never "Verified" alone.
 *
 * Note: this page already renders VerificationFactsPanel (identity +
 * organization facts together) and the legacy organizers.status directory
 * badge — this is a third, additive signal, not a replacement for either.
 * Reconciling that overlap is out of scope for this phase; see the phase
 * report.
 */
export default function OrganizationStatusBadge({
  verified,
  applicable,
  className = "",
}: OrganizationStatusBadgeProps) {
  if (!applicable) {
    return (
      <span
        title="Individual organizer — no organization to verify"
        className={`inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2.5 py-0.5 text-xs font-bold text-zinc-400 ${className}`}
      >
        <MinusCircle size={13} aria-hidden />
        Organization: not applicable
      </span>
    );
  }

  return (
    <span
      title={
        verified
          ? "Registration and authority to fundraise confirmed"
          : "Organization not yet verified"
      }
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
        verified ? "bg-brand-100 text-brand-800" : "bg-zinc-100 text-zinc-500"
      } ${className}`}
    >
      {verified ? <Building2 size={13} aria-hidden /> : <CircleDashed size={13} aria-hidden />}
      {verified ? "Organization verified" : "Organization not yet verified"}
    </span>
  );
}
