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
    <div className="bg-white rounded-2xl overflow-hidden border border-zinc-200 hover:shadow-lg transition cursor-pointer">
      <div className="relative h-56 w-full bg-zinc-100">
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
      <div className="p-5">
        <p className="text-orange-600 text-sm font-semibold">{date}</p>
        <h3 className="text-xl font-bold mt-2">{title}</h3>
        <p className="text-zinc-600 mt-2">{location}</p>
      </div>
    </div>
  );

  // Eventbrite cards have no slug — wrapping <a> is handled by the parent
  if (!slug) return card;

  return <Link href={`/events/${slug}`}>{card}</Link>;
}