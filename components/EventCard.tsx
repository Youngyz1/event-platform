import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

type EventCardProps = {
  title: string;
  date: string;
  location: string;
  image: string;
  slug: string | null;
  badge?: string;
  price?: string | null;
  category?: string | null;
  variant?: "default" | "homepage" | "compact";
};

export default function EventCard({
  title,
  date,
  location,
  image,
  slug,
  badge,
  price,
  category,
  variant = "default",
}: EventCardProps) {
  const compact = variant === "compact";

  const card = (
    <article
      className={cn(
        "group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg",
        compact && "rounded-xl"
      )}
    >
      <div className={cn("relative w-full bg-zinc-100", compact ? "h-36" : "h-44 sm:h-52")}>
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
        {badge && (
          <span className="absolute left-3 top-3 rounded-full bg-orange-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow">
            {badge}
          </span>
        )}
        {price && (
          <span className="absolute bottom-3 right-3 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-black text-zinc-950 shadow-sm backdrop-blur">
            {price}
          </span>
        )}
      </div>
      <div className={cn("p-4", compact && "p-3")}>
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-orange-600">{date}</p>
          {category && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
              {category}
            </span>
          )}
        </div>
        <h3
          className={cn(
            "mt-1.5 line-clamp-2 font-black leading-snug text-zinc-950",
            compact ? "text-sm" : "text-base sm:text-lg"
          )}
        >
          {title}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs font-semibold text-zinc-500 sm:text-sm">{location}</p>
      </div>
    </article>
  );

  if (!slug) return card;
  return <Link href={`/events/${slug}`}>{card}</Link>;
}
