import Link from "next/link";

type EventCardProps = {
  title: string;
  date: string;
  location: string;
  image: string;
  slug: string | null;
  badge?: string;
  variant?: "default" | "homepage";
};

export default function EventCard({ title, date, location, image, slug, badge, variant = "default" }: EventCardProps) {
  const imageClass =
    variant === "homepage"
      ? "relative h-40 w-full bg-zinc-100 sm:h-56"
      : "relative h-40 w-full bg-zinc-100 sm:h-56";
  const bodyClass = variant === "homepage" ? "p-3 sm:p-5" : "px-2 py-3 sm:p-5";
  const titleClass =
    variant === "homepage"
      ? "mt-1 text-sm font-black leading-snug text-zinc-950 sm:mt-2 sm:text-xl"
      : "mt-1 text-base font-black leading-snug text-zinc-950 sm:mt-2 sm:text-xl";

  const card = (
    <div className="overflow-hidden rounded-xl border border-zinc-100 bg-white transition hover:shadow-lg sm:rounded-2xl sm:border-zinc-200">
      <div className={imageClass}>
        <img
          src={image}
          alt={title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
        {badge && (
          <span className="absolute top-3 right-3 bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
            {badge}
          </span>
        )}
      </div>
      <div className={bodyClass}>
        <p className="text-xs font-bold text-orange-600 sm:text-sm">{date}</p>
        <h3 className={titleClass}>{title}</h3>
        <p className="mt-1 text-xs font-semibold text-zinc-600 sm:mt-2 sm:text-base">{location}</p>
      </div>
    </div>
  );

  // Eventbrite cards have no slug — wrapping <a> is handled by the parent
  if (!slug) return card;

  return <Link href={`/events/${slug}`}>{card}</Link>;
}
