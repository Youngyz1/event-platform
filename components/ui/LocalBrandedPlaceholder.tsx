import React from "react";
import { Heart, Building2, User, Sparkles, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type LocalBrandedPlaceholderProps = {
  variant?: "fundraiser" | "organizer" | "avatar" | "banner" | "general";
  title?: string | null;
  className?: string;
  iconClassName?: string;
};

export default function LocalBrandedPlaceholder({
  variant = "general",
  title,
  className,
  iconClassName,
}: LocalBrandedPlaceholderProps) {
  const getInitials = (name?: string | null) => {
    if (!name?.trim()) return "";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (variant === "avatar") {
    const initials = getInitials(title);
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-amber-200 text-orange-800 font-black shadow-inner select-none",
          className
        )}
      >
        {initials ? (
          <span className="text-sm sm:text-base tracking-wider">{initials}</span>
        ) : (
          <User className={cn("h-1/2 w-1/2 text-orange-600/80", iconClassName)} />
        )}
      </div>
    );
  }

  if (variant === "organizer") {
    const initials = getInitials(title);
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-zinc-100 via-zinc-200/70 to-orange-50 text-zinc-600 select-none p-3 text-center",
          className
        )}
      >
        <div className="flex items-center justify-center rounded-2xl bg-white/80 p-2.5 shadow-sm backdrop-blur">
          <Building2 className={cn("h-6 w-6 text-orange-600", iconClassName)} />
        </div>
        {title && (
          <span className="mt-2 line-clamp-1 text-xs font-black text-zinc-700">
            {title}
          </span>
        )}
      </div>
    );
  }

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-gradient-to-r from-orange-600 via-amber-500 to-emerald-600 text-white select-none p-6 relative overflow-hidden",
          className
        )}
      >
        <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />
        <div className="relative z-10 flex items-center gap-2 text-white/90">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-black uppercase tracking-widest">Fund4Good</span>
        </div>
      </div>
    );
  }

  if (variant === "fundraiser") {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-orange-100/60 to-orange-200/40 text-orange-800 select-none p-4 relative overflow-hidden",
          className
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-sm backdrop-blur text-orange-600 mb-1">
          <Heart className={cn("h-6 w-6 fill-orange-500/20 text-orange-600", iconClassName)} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-orange-700/80">
          Fund4Good Campaign
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-400 select-none p-4",
        className
      )}
    >
      <ImageOff className={cn("h-6 w-6 text-zinc-400", iconClassName)} />
    </div>
  );
}
