import { NextRequest, NextResponse } from "next/server";

type RawImage = { ratio?: string; width?: number; url?: string };
type RawVenue = { city?: { name?: string }; name?: string };
type RawDates = { start?: { localDate?: string; localTime?: string } };
type RawClassification = { segment?: { name?: string } };
type RawEvent = {
  id: string;
  name?: string;
  dates?: RawDates;
  _embedded?: { venues?: RawVenue[] };
  images?: RawImage[];
  classifications?: RawClassification[];
  url?: string;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get("location");
  const query = searchParams.get("q");
  const category = searchParams.get("category");
  const date = searchParams.get("date");

  if (!location && !query && !category && !date) {
    return NextResponse.json({ events: [] });
  }

  const params = new URLSearchParams({
    apikey: process.env.TICKETMASTER_API_KEY!,
    size: "20",
    sort: "date,asc",
  });

  if (location) {
    params.set("city", location.split(",")[0].trim()); // "Jersey City, NJ" → "Jersey City"
  } else {
    params.set("countryCode", "US");
  }

  const keyword = [query, category].filter(Boolean).join(" ");
  if (keyword) params.set("keyword", keyword);
  if (date) {
    params.set("startDateTime", `${date}T00:00:00Z`);
    params.set("endDateTime", `${date}T23:59:59Z`);
  }

  try {
    const response = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`,
      { next: { revalidate: 300 } }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Ticketmaster error:", data);
      return NextResponse.json({ events: [] });
    }

    const rawEvents = data._embedded?.events || [];

    const events = rawEvents.map((e: RawEvent) => ({
      id: `tm_${e.id}`,
      slug: null,
      title: e.name || "Untitled Event",
      event_date: e.dates?.start?.localDate
        ? `${e.dates.start.localDate}T${e.dates.start.localTime || "00:00:00"}`
        : null,
      city: e._embedded?.venues?.[0]?.city?.name || location || null,
      venue: e._embedded?.venues?.[0]?.name || null,
      banner:
        e.images?.find((img: RawImage) => img.ratio === "16_9" && (img.width ?? 0) > 500)?.url ||
        e.images?.[0]?.url ||
        null,
      category: e.classifications?.[0]?.segment?.name || null,
      url: e.url,
      source: "ticketmaster",
    }));

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Ticketmaster fetch error:", error);
    return NextResponse.json({ events: [] });
  }
}
