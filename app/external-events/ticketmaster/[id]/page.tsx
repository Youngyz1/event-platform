import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getDashboardContext } from "@/lib/dashboard-context";

type RawImage = { ratio?: string; width?: number; url?: string };
type RawVenue = {
  name?: string;
  city?: { name?: string };
  state?: { name?: string; stateCode?: string };
  address?: { line1?: string };
};
type RawEvent = {
  id: string;
  name?: string;
  info?: string;
  pleaseNote?: string;
  url?: string;
  images?: RawImage[];
  dates?: {
    start?: {
      dateTime?: string;
      localDate?: string;
      localTime?: string;
    };
    status?: { code?: string };
  };
  classifications?: Array<{
    segment?: { name?: string };
    genre?: { name?: string };
    subGenre?: { name?: string };
  }>;
  priceRanges?: Array<{
    min?: number;
    max?: number;
    currency?: string;
  }>;
  _embedded?: {
    venues?: RawVenue[];
  };
};

function eventImage(event: RawEvent) {
  return (
    event.images?.find((image) => image.ratio === "16_9" && (image.width ?? 0) >= 1000)?.url ||
    event.images?.find((image) => image.ratio === "16_9")?.url ||
    event.images?.[0]?.url ||
    "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1600&auto=format&fit=crop"
  );
}

function eventDate(event: RawEvent) {
  const start = event.dates?.start;
  if (start?.dateTime) return start.dateTime;
  if (start?.localDate) return `${start.localDate}T${start.localTime || "00:00:00"}`;
  return null;
}

function formattedDate(value: string | null) {
  if (!value) return "Date TBA";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date TBA";

  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function priceLabel(event: RawEvent) {
  const range = event.priceRanges?.[0];
  if (!range || range.min === undefined) return "Price shown at checkout";

  const currency = range.currency || "USD";
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  if (range.max !== undefined && range.max !== range.min) {
    return `${formatter.format(range.min)} - ${formatter.format(range.max)}`;
  }

  return `From ${formatter.format(range.min)}`;
}

async function getTicketmasterEvent(id: string) {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({ apikey: apiKey });
  const response = await fetch(
    `https://app.ticketmaster.com/discovery/v2/events/${encodeURIComponent(id)}.json?${params.toString()}`,
    { next: { revalidate: 300 } }
  );

  if (!response.ok) return null;

  return (await response.json()) as RawEvent;
}

export default async function TicketmasterEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [event, admin, dashboardContext] = await Promise.all([
    getTicketmasterEvent(id),
    isAdmin(),
    getDashboardContext(),
  ]);

  if (!event) return notFound();

  const canClaimExternalEvent = admin || Boolean(dashboardContext?.organizerId);
  const date = eventDate(event);
  const venue = event._embedded?.venues?.[0];
  const city = [venue?.city?.name, venue?.state?.stateCode || venue?.state?.name]
    .filter(Boolean)
    .join(", ");
  const category = [
    event.classifications?.[0]?.segment?.name,
    event.classifications?.[0]?.genre?.name,
  ].filter(Boolean).join(" / ") || "Event";
  const ticketUrl = event.url;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="relative h-[430px] w-full overflow-hidden bg-zinc-950 sm:h-[500px] md:h-[540px]">
        <img
          src={eventImage(event)}
          alt={event.name || "Ticketmaster event"}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
        <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-10 sm:px-6 sm:pb-12">
          <div className="max-w-4xl">
            <p className="mb-4 w-fit rounded-full bg-white px-4 py-2 text-sm font-black uppercase tracking-wide text-orange-600">
              Ticketmaster
            </p>
            <h1 className="text-3xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
              {event.name || "Untitled event"}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-zinc-100 sm:text-lg">
              {`View date, venue, and ticket options for this ${category.toLowerCase()}.`}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">
          <div className="lg:col-span-2">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="mb-2 text-sm text-zinc-500">Date</p>
                <h3 className="text-xl font-bold">{formattedDate(date)}</h3>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="mb-2 text-sm text-zinc-500">Venue</p>
                <h3 className="text-xl font-bold">
                  {[venue?.name, city].filter(Boolean).join(", ") || "Venue TBA"}
                </h3>
              </div>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-sm font-black uppercase tracking-wide text-zinc-500">Tickets</p>
                <h3 className="mt-2 text-2xl font-black">{priceLabel(event)}</h3>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-sm font-black uppercase tracking-wide text-zinc-500">Category</p>
                <h3 className="mt-2 text-2xl font-black">{category}</h3>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-sm font-black uppercase tracking-wide text-zinc-500">Source</p>
                <h3 className="mt-2 text-2xl font-black">Ticketmaster</h3>
              </div>
            </div>

            <div className="mt-12 rounded-3xl border border-zinc-200 bg-white p-8">
              <h2 className="mb-6 text-3xl font-black">About this event</h2>
              <div className="space-y-5 text-lg leading-relaxed text-zinc-700">
                <p>
                  {event.info || event.pleaseNote || "This event is pulled from Ticketmaster search results so you can discover it on Fund4Good."}
                </p>
                {venue?.address?.line1 && (
                  <p>
                    <span className="font-black text-zinc-950">Address:</span>{" "}
                    {[venue.address.line1, city].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            </div>

            {canClaimExternalEvent && (
              <div className="mt-10 rounded-3xl border border-orange-200 bg-orange-50 p-6 sm:p-8">
                <h2 className="text-2xl font-black">Want to sell this event on Fund4Good?</h2>
                <p className="mt-3 text-zinc-700">
                  External events can be discovered here, but Fund4Good checkout is only available for events that are created or claimed by the organizer on this platform.
                </p>
                <Link
                  href={`/import?mode=events&url=${encodeURIComponent(ticketUrl || "")}`}
                  className="mt-5 inline-block rounded-xl bg-orange-600 px-5 py-3 text-sm font-black text-white transition hover:bg-orange-700"
                >
                  Create or Claim Event
                </Link>
              </div>
            )}
          </div>

          <aside className="h-fit rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm lg:sticky lg:top-24 sm:p-8">
            <p className="text-sm font-black uppercase tracking-wide text-orange-600">
              External ticket source
            </p>
            <h2 className="mt-2 text-3xl font-black">{priceLabel(event)}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              This listing is imported from Ticketmaster. Checkout and ticket delivery happen through Ticketmaster until the organizer sells this event directly on Fund4Good.
            </p>
            {ticketUrl ? (
              <a
                href={ticketUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 block rounded-xl bg-orange-600 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-orange-700"
              >
                Buy on Ticketmaster
              </a>
            ) : (
              <button
                disabled
                className="mt-6 block w-full rounded-xl bg-zinc-200 px-5 py-3 text-center text-sm font-black text-zinc-500"
              >
                Tickets unavailable
              </button>
            )}
            <Link
              href="/events"
              className="mt-3 block rounded-xl border border-zinc-200 px-5 py-3 text-center text-sm font-black text-zinc-700 transition hover:border-orange-200 hover:text-orange-600"
            >
              Back to events
            </Link>
          </aside>
        </div>
      </section>

    </main>
  );
}
