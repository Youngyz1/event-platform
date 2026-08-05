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
  oneLiner?: string | null;
  ratingSlot?: ReactNode;
  actions?: ReactNode;
}

/**
 * Page-level identity header — avatar, name, badge/verified/rating row,
 * one-line bio, and an actions slot. Lives directly in page flow (it's the
 * page's masthead, not a content card).
 */
export default function ProfileHeader({
  avatarSrc,
  name,
  badge,
  verified,
  oneLiner,
  ratingSlot,
  actions,
}: ProfileHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
      <ProfileAvatar src={avatarSrc} name={name} size="lg" />

      <div className="min-w-0 flex-1">
        {(badge || verified || ratingSlot) && (
          <div className="flex flex-wrap items-center gap-2">
            {badge}
            {verified && <VerifiedBadge verified size="sm" />}
            {ratingSlot}
          </div>
        )}
        <Heading as="h1" variant="page-title" size="compact" className="mt-1 truncate">
          {name}
        </Heading>
        {oneLiner && (
          <Text variant="muted" className="mt-1 line-clamp-1">
            {oneLiner}
          </Text>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
