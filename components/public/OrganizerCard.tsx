import Link from "next/link";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import { CalendarDays, Heart, Users } from "lucide-react";

export type OrganizerCardData = {
  id: string;
  name: string;
  bio?: string | null;
  photo?: string | null;
  banner?: string | null;
  status?: string | null;
  eventCount?: number;
  fundraiserCount?: number;
  followerCount?: number;
};

export default function OrganizerCard({
  organizer,
  featured = false,
}: {
  organizer: OrganizerCardData;
  featured?: boolean;
}) {
  const verified = organizer.status === "verified";

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-0.5 hover:shadow-lg ${
        featured ? "border-orange-200 ring-1 ring-orange-100" : "border-zinc-200"
      }`}
    >
      <div className="relative h-24 bg-gradient-to-br from-zinc-100 to-zinc-200">
        {organizer.banner && (
          <img
            src={organizer.banner}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        )}
        {featured && (
          <span className="absolute left-3 top-3 rounded-full bg-orange-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
            Featured
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5">
        <div className="-mt-10 mb-3">
          <div className="mx-auto h-16 w-16 overflow-hidden rounded-full border-4 border-white bg-zinc-200 shadow-md sm:mx-0">
            {organizer.photo ? (
              <img
                src={organizer.photo}
                alt={organizer.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-black text-zinc-400">
                {organizer.name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <h3 className="flex items-center justify-center gap-2 text-lg font-black text-zinc-950 sm:justify-start">
            <span className="line-clamp-1">{organizer.name}</span>
            <VerifiedBadge verified={verified} size="sm" />
          </h3>
          <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-zinc-600">
            {organizer.bio || "Community organizer on Fund4Good."}
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs font-bold text-zinc-500 sm:justify-start">
            {(organizer.eventCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {organizer.eventCount} events
              </span>
            )}
            {(organizer.fundraiserCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" />
                {organizer.fundraiserCount} campaigns
              </span>
            )}
            {(organizer.followerCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {organizer.followerCount} followers
              </span>
            )}
          </div>
        </div>

        <Link
          href={`/organizers/${organizer.id}`}
          className="mt-5 block w-full rounded-xl bg-zinc-950 py-3 text-center text-sm font-black text-white transition group-hover:bg-orange-600"
        >
          View profile
        </Link>
      </div>
    </article>
  );
}
