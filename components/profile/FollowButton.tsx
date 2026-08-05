import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  isFollowing: boolean;
  isLoading?: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
}

/**
 * Presentational follow toggle — has no knowledge of which mechanism is
 * underneath (direct Supabase mutation for organizations, /api/follow for
 * users). Callers own the state and pass it in.
 */
export default function FollowButton({
  isFollowing,
  isLoading,
  onToggle,
  size = "md",
}: FollowButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isLoading}
      className={cn(
        "flex items-center gap-2 rounded-xl font-black transition disabled:opacity-60",
        size === "sm" ? "px-4 py-2 text-xs" : "px-5 py-2.5 text-sm",
        isFollowing
          ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          : "bg-zinc-950 text-white hover:bg-orange-600"
      )}
    >
      <Heart className={cn("h-4 w-4", isFollowing && "fill-current")} />
      {isLoading ? "…" : isFollowing ? "Following" : "Follow"}
    </button>
  );
}
