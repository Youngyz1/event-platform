import type { ReactNode } from "react";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import ProfileAvatar from "./ProfileAvatar";

interface ProfileHeaderProps {
  avatarSrc?: string | null;
  name: string;
  badge?: ReactNode;
  verified?: boolean;
  /** Small line under the name, e.g. "120 followers" or "12 followers · 8 following". */
  subline?: ReactNode;
  /** Optional row rendered under the identity block, e.g. social icons. */
  socialRow?: ReactNode;
  oneLiner?: string | null;
  ratingSlot?: ReactNode;
  actions?: ReactNode;
}

/**
 * Page-level identity header — centered, profile-focused presentation:
 * avatar, name, verification/rating row, follower subline, primary actions,
 * optional social row. Lives directly in page flow (it's the page's
 * masthead, not a content card).
 */
export default function ProfileHeader({
  avatarSrc,
  name,
  badge,
  verified,
  subline,
  socialRow,
  oneLiner,
  ratingSlot,
  actions,
}: ProfileHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <ProfileAvatar src={avatarSrc} name={name} size="lg" />

      <div className="min-w-0">
        {(badge || verified || ratingSlot) && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {badge}
            {verified && <VerifiedBadge verified size="sm" />}
            {ratingSlot}
          </div>
        )}
        <Heading as="h1" variant="page-title" size="compact" className="mt-1 break-words">
          {name}
        </Heading>
        {subline && (
          <p className="mt-1 text-sm font-medium text-zinc-500">{subline}</p>
        )}
        {oneLiner && (
          <Text variant="muted" className="mx-auto mt-1 max-w-xl line-clamp-2">
            {oneLiner}
          </Text>
        )}
      </div>

      {actions && (
        <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto">
          {actions}
        </div>
      )}

      {socialRow}
    </div>
  );
}
