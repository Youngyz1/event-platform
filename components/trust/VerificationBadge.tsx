import { BadgeCheck } from "lucide-react";

type VerificationBadgeProps = {
  verified: boolean;
  className?: string;
};

/**
 * Compact "fully verified" indicator for card contexts (fundraiser cards,
 * list rows) where there's no room for the three separate facts shown on
 * VerificationFactsPanel. Renders nothing when false, same fail-safe pattern
 * as components/ui/VerifiedBadge — but deliberately a different icon: this
 * reads organizer_verification (the document-based flow), not the legacy
 * organizers.status flag VerifiedBadge shows on the organizer directory.
 */
export default function VerificationBadge({
  verified,
  className = "",
}: VerificationBadgeProps) {
  if (!verified) return null;

  return (
    <span
      title="Identity and organization verified"
      className={`inline-flex shrink-0 items-center text-brand-700 ${className}`}
    >
      <BadgeCheck size={14} aria-hidden />
    </span>
  );
}
