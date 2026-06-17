import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import TicketCheckout from "./TicketCheckout";
import VenueMapClient from "@/components/VenueMapClient";
import CommentsSection from "@/components/CommentsSection";
import { createSupabaseServer } from "@/lib/supabase-server";
import VerifiedBadge from "@/components/ui/VerifiedBadge";

function paragraphs(value: string | null | undefined) {
  return (value || "")
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!event) return notFound();

  // FIXED: private events are only visible to their owner.
  if (event.visibility === "private") {
    const supabaseServer = await createSupabaseServer();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user || user.id !== event.user_id) return notFound();
  }

  const { data: organizer } = event.organizer_id
    ? await supabase
        .from("organizers")
        .select("id, name, bio, photo, website, status")
        .eq("id", event.organizer_id)
        .single()
    : { data: null };

  const { data: tickets } = await supabase
    .from("tickets")
    .select("*")
    .eq("event_id", event.id);

  const lowestPrice = tickets && tickets.length > 0
    ? Math.min(...tickets.map((t) => t.price))
    : null;
  const primaryOrganizerName = event.source_organizer_name || organizer?.name || "";
  const primaryOrganizerUrl = event.source_organizer_url || (organizer ? `/organizers/${organizer.id}` : "");
  const primaryOrganizerDescription = event.source_organizer_description || organizer?.bio || "";
  const primaryOrganizerPhoto = event.source_organizer_name ? "" : organizer?.photo || "";
  const descriptionParagraphs = paragraphs(event.description);
  const eventCity = event.city || "the local area";
  const ticketLabel = lowestPrice === null
    ? "Tickets TBA"
    : lowestPrice === 0
      ? "Free entry"
      : `From $${Number(lowestPrice).toFixed(2)}`;
  const eventHighlights = [
    event.category ? `${event.category} event` : "Community event",
    event.venue || event.city ? `Hosted in ${[event.venue, event.city].filter(Boolean).join(", ")}` : "Venue details listed below",
    ticketLabel,
  ];

  const formattedDate = event.event_date
    ? new Date(event.event_date).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Date TBA";

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">

      <section className="relative h-[560px] w-full overflow-hidden bg-zinc-950 md:h-[620px]">
        <img
          src={event.banner || "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1600&auto=format&fit=crop"}
          alt={event.title}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/45 to-transparent" />
        <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-6 pb-16">
          <div className="max-w-4xl">
            <p className="mb-4 w-fit rounded-full bg-white px-4 py-2 text-sm font-black uppercase tracking-wide text-orange-600">
              {event.category || "Event"}
            </p>
            <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl lg:text-7xl">{event.title}</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-100 sm:text-xl">
              {descriptionParagraphs[0] || `Join ${primaryOrganizerName || "the organizer"} for a memorable event in ${eventCity}.`}
            </p>
            <div className="mt-8 grid gap-3 text-white sm:grid-cols-3">
              {eventHighlights.map((highlight) => (
                <div key={highlight} className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
                  <p className="text-sm font-black">{highlight}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-12">

          <div className="lg:col-span-2">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-zinc-200 p-6">
                <p className="text-sm text-zinc-500 mb-2">Date</p>
                <h3 className="text-xl font-bold">{formattedDate}</h3>
              </div>
              <div className="bg-white rounded-2xl border border-zinc-200 p-6">
                <p className="text-sm text-zinc-500 mb-2">Venue</p>
                <h3 className="text-xl font-bold">
                  {event.venue}{event.city ? `, ${event.city}` : ""}
                </h3>
              </div>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-sm font-black uppercase tracking-wide text-zinc-500">Tickets</p>
                <h3 className="mt-2 text-2xl font-black">{ticketLabel}</h3>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-sm font-black uppercase tracking-wide text-zinc-500">Organizer</p>
                <h3 className="mt-2 text-2xl font-black">{primaryOrganizerName || "Verified host"}</h3>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-sm font-black uppercase tracking-wide text-zinc-500">Booking</p>
                <h3 className="mt-2 text-2xl font-black">Secure checkout</h3>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-zinc-200 p-8 mt-12">
              <h2 className="text-3xl font-black mb-6">About this event</h2>
              <div className="space-y-5 text-lg leading-relaxed text-zinc-700">
                {descriptionParagraphs.length > 0 ? (
                  descriptionParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
                ) : (
                  <p>Details are being finalized by the organizer. Check the date, venue, and ticket options before booking.</p>
                )}
              </div>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-zinc-200 bg-white p-8">
                <h2 className="text-2xl font-black">Why Attend</h2>
                <ul className="mt-5 space-y-4 text-zinc-700">
                  <li className="flex gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                    <span>Meet people who are already interested in this kind of local experience.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                    <span>Get the key event details in one place before you book.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                    <span>Support organizers bringing more community events to {eventCity}.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-8">
                <h2 className="text-2xl font-black">Good To Know</h2>
                <div className="mt-5 space-y-4 text-zinc-700">
                  <p><span className="font-black text-zinc-950">Arrival:</span> Plan to arrive early so check-in is smooth.</p>
                  <p><span className="font-black text-zinc-950">Tickets:</span> Choose your ticket type before checkout.</p>
                  <p><span className="font-black text-zinc-950">Updates:</span> Organizer details and source links are shown when available.</p>
                </div>
              </div>
            </div>

            {primaryOrganizerName && (
              <div className="bg-white rounded-3xl border border-zinc-200 p-8 mt-12">
                <h2 className="text-3xl font-black mb-6">Organizer</h2>
                <div className="flex gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-100 font-black text-orange-700">
                    {primaryOrganizerPhoto ? (
                      <img src={primaryOrganizerPhoto} alt={primaryOrganizerName} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      primaryOrganizerName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black uppercase tracking-wide text-zinc-500">
                      {event.source_organizer_name ? "Organizer" : "Platform organizer"}
                    </p>
                    {primaryOrganizerUrl ? (
                      <a
                        href={primaryOrganizerUrl}
                        target={primaryOrganizerUrl.startsWith("http") ? "_blank" : undefined}
                        rel={primaryOrganizerUrl.startsWith("http") ? "noreferrer" : undefined}
                        className="flex flex-wrap items-center gap-2 break-words text-xl font-black text-zinc-950 hover:text-orange-600"
                      >
                        <span className="break-words">{primaryOrganizerName}</span>
                        <VerifiedBadge verified={organizer?.status === 'verified'} />
                      </a>
                    ) : (
                      <h3 className="flex flex-wrap items-center gap-2 text-xl font-black text-zinc-950">
                        <span className="break-words">{primaryOrganizerName}</span>
                        <VerifiedBadge verified={organizer?.status === 'verified'} />
                      </h3>
                    )}
                    {primaryOrganizerDescription && (
                      <p className="mt-2 break-words text-zinc-600">{primaryOrganizerDescription}</p>
                    )}
                    {event.source_organizer_name && organizer && (
                      <p className="mt-3 text-sm font-semibold text-zinc-500">
                        Local profile:{" "}
                        <a href={`/organizers/${organizer.id}`} className="text-orange-600 hover:text-orange-700">
                          {organizer.name}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-12 rounded-3xl border border-zinc-200 bg-white p-8">
              <h2 className="text-3xl font-black">Frequently Asked Questions</h2>
              <div className="mt-6 divide-y divide-zinc-200">
                {[
                  ["How do I get my ticket?", "After checkout you will see your QR code ticket on screen. Download or screenshot it — you can also print it. Show the QR code to staff at the door."],
                  ["Can I share this event?", "Yes. Copy the page link and share it with friends or your community."],
                  ["Who should I contact about event details?", primaryOrganizerName ? `Contact ${primaryOrganizerName} using the organizer link when available.` : "Use the source or organizer information listed on this page."],
                ].map(([question, answer]) => (
                  <div key={question} className="py-5">
                    <h3 className="font-black">{question}</h3>
                    <p className="mt-2 text-zinc-600">{answer}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-12">
              <CommentsSection
                targetType="event"
                targetId={event.id}
                title="Event Comments"
                accent="orange"
              />
            </div>

            {/* Venue Map */}
            {event.latitude && event.longitude && (
              <div className="bg-white rounded-3xl border border-zinc-200 p-8 mt-12">
                <h2 className="text-3xl font-black mb-4">Venue Location</h2>
                <div className="mb-4">
                  <p className="font-semibold text-zinc-900">{event.venue || "Venue"}</p>
                  {event.city && <p className="text-zinc-500 text-sm">{event.city}</p>}
                </div>
                <VenueMapClient
                  lat={event.latitude}
                  lng={event.longitude}
                  title={event.title}
                  venue={event.venue}
                  city={event.city}
                />
              </div>
            )}

            {event.video_url && (
              <div className="bg-white rounded-3xl border border-zinc-200 p-6 mt-12">
                <h2 className="text-3xl font-black mb-4">Event Video</h2>
                <video src={event.video_url} controls className="w-full rounded-2xl" />
              </div>
            )}
          </div>

          <TicketCheckout
            event={event}
            tickets={tickets || []}
            lowestPrice={lowestPrice}
          />

        </div>
      </section>
    </main>
  );
}
