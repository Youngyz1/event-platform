import Image from "next/image";
import { cn } from "@/lib/utils";
import { safeImageSrc } from "@/lib/image-url";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = { sm: 36, md: 48, lg: 80, xl: 112 };
const SIZE_CLASS: Record<Size, string> = {
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-20 w-20",
  xl: "h-28 w-28",
};
const TEXT_CLASS: Record<Size, string> = {
  sm: "text-xs",
  md: "text-base",
  lg: "text-2xl",
  xl: "text-4xl",
};

interface ProfileAvatarProps {
  src?: string | null;
  name: string;
  size?: Size;
  shape?: "circle" | "square";
  className?: string;
}

/** Image-or-initials avatar shared across every profile type. */
export default function ProfileAvatar({
  src,
  name,
  size = "md",
  shape = "circle",
  className,
}: ProfileAvatarProps) {
  const safeSrc = safeImageSrc(src);
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-2xl";

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden",
        SIZE_CLASS[size],
        shapeClass,
        className
      )}
    >
      {safeSrc ? (
        <Image
          src={safeSrc}
          alt={name}
          fill
          sizes={`${SIZE_PX[size]}px`}
          className="object-cover"
        />
      ) : (
        <span
          className={cn(
            "flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-400 to-brand-700 font-black text-white",
            TEXT_CLASS[size]
          )}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
