import Link from "next/link";

type EventCardProps = {
  title: string;
  date: string;
  location: string;
  image: string;
  slug: string | null;
  badge?: string;
};

export default function EventCard({ title, date, location, image, slug, badge }: EventCardProps) {
  const card = (
    <div className="overflow-hidden rounded-xl bg-white transition hover:shadow-lg sm:rounded-2xl sm:border sm:border-zinc-200">
      <div className="relative h-36 w-full bg-zinc-100 sm:h-56">
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
      <div className="px-1 py-3 sm:p-5">
        <p className="text-sm font-bold text-orange-600">{date}</p>
        <h3 className="mt-1 text-lg font-black leading-snug text-zinc-950 sm:mt-2 sm:text-xl">{title}</h3>
        <p className="mt-1 text-sm font-semibold text-zinc-600 sm:mt-2 sm:text-base">{location}</p>
      </div>
    </div>
  );

  // Eventbrite cards have no slug — wrapping <a> is handled by the parent
  if (!slug) return card;

  return <Link href={`/events/${slug}`}>{card}</Link>;
}
