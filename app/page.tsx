import Link from "next/link";
import type { Metadata } from "next";
import EventCard from "@/components/EventCard";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";
import FeaturedSlider, { type FeaturedSliderItem } from "@/components/FeaturedSlider";
import AboutUsSection from "@/components/ui/about-us-section";
import { Gallery4, type Gallery4Item } from "@/components/ui/gallery4";
import {
  Briefcase,
  GraduationCap,
  HandHeart,
  HeartHandshake,
  Laptop,
  Mic,
  Stethoscope,
  Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

// ── TASK 5 — Page metadata ───────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "EventBrithe — Buy Tickets, Run Events & Fundraise",
  description:
    "Discover local events, buy tickets, and support fundraising campaigns on EventBrithe. The all-in-one platform for attendees, organizers, and donors.",
  openGraph: {
    title: "EventBrithe — Buy Tickets, Run Events & Fundraise",
    description: "Discover events, buy tickets, support causes.",
    type: "website",
  },
};

// ────────────────────────────────────────────────────────────────────────────

const categoryCards = [
  { name: "Music", icon: Mic },
  { name: "Business", icon: Briefcase },
  { name: "Education", icon: GraduationCap },
  { name: "Charity", icon: HandHeart },
  { name: "Medical", icon: Stethoscope },
  { name: "Church", icon: HeartHandshake },
  { name: "Community", icon: Users },
  { name: "Technology", icon: Laptop },
];

const FUNDRAISER_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=1080&auto=format&fit=crop";

function money(value: number | null | undefined) {
  return `$${Number(value ?? 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function fundraiserImage(src: string | null | undefined) {
  if (!src?.startsWith("http")) return FUNDRAISER_FALLBACK_IMAGE;
  if (src.includes("youtube.com") || src.includes("google.com/imgres")) {
    return FUNDRAISER_FALLBACK_IMAGE;
  }
  if (/\.(mp4|mov|webm)(\?|$)/i.test(src)) return FUNDRAISER_FALLBACK_IMAGE;

  return src;
}

export default async function HomePage() {
  const [{ data: featuredEvents }, { data: featuredFundraisers }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, title, slug, date:event_date, location:city, image_url:banner, category")
        .eq("is_homepage_featured", true)
        .limit(6),
      supabase
        .from("fundraisers")
        .select("id, title, slug, goal_amount:goal, raised_amount:raised, image_url:banner")
        .eq("is_homepage_featured", true)
        .limit(6),
    ]);

  const [featuredSliderEvents, featuredSliderFundraisers] = await Promise.all([
    (featuredEvents?.length ?? 0) >= 2
      ? Promise.resolve(featuredEvents ?? [])
      : supabase
          .from("events")
          .select("id, title, slug, date:event_date, location:city, image_url:banner, category")
          .order("created_at", { ascending: false })
          .limit(5)
          .then(({ data }) => data ?? []),
    (featuredFundraisers?.length ?? 0) >= 2
      ? Promise.resolve(featuredFundraisers ?? [])
      : supabase
          .from("fundraisers")
          .select("id, title, slug, goal_amount:goal, raised_amount:raised, image_url:banner")
          .order("created_at", { ascending: false })
          .limit(5)
          .then(({ data }) => data ?? []),
  ]);

  const combinedFeaturedItems: FeaturedSliderItem[] = [];
  const maxFeaturedLength = Math.max(
    featuredSliderEvents.length,
    featuredSliderFundraisers.length
  );

  for (let i = 0; i < maxFeaturedLength; i++) {
    if (featuredSliderEvents[i]) {
      combinedFeaturedItems.push({ ...featuredSliderEvents[i], type: "event" });
    }

    if (featuredSliderFundraisers[i]) {
      combinedFeaturedItems.push({
        ...featuredSliderFundraisers[i],
        type: "fundraiser",
      });
    }
  }

  // ── Events grid (below-fold, existing section) ──────────────────────────────
  const { data: rawEvents } = await supabase
    .from("events")
    .select("id, title, slug, event_date, city, venue, banner, visibility, status")
    .eq("visibility", "public")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(12);

  // ── Fundraisers grid (below-fold, existing section) ─────────────────────────
  const { data: fundraisers } = await supabase
    .from("fundraisers")
    .select("id, title, slug, goal, raised, banner")
    .order("created_at", { ascending: false })
    .limit(3);

  // Deduplicate events grid
  const seen = new Set<string>();
  const events = (rawEvents ?? [])
    .filter((ev) => { if (seen.has(ev.id)) return false; seen.add(ev.id); return true; })
    .slice(0, 6);

  const fundraiserGalleryItems: Gallery4Item[] = (fundraisers ?? []).map((fundraiser) => ({
    id: fundraiser.id,
    title: fundraiser.title,
    description: `${money(fundraiser.raised)} raised of ${money(fundraiser.goal)} goal`,
    href: `/fundraisers/${fundraiser.slug}`,
    image: fundraiserImage(fundraiser.banner),
    cta: "Donate Now",
  }));

  return (
    <main className="min-h-screen bg-white text-zinc-950">

      <section className="bg-white px-4 pt-6 sm:px-6 lg:px-8">
        <div
          className="relative mx-auto flex min-h-[360px] max-w-7xl items-center overflow-hidden rounded-b-lg rounded-t-sm bg-cover bg-center px-6 py-16 sm:min-h-[420px] sm:px-12 lg:px-20"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1800&auto=format&fit=crop)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-black/10" />
          <div className="relative max-w-3xl">
            <p className="inline-flex bg-pink-200 px-3 py-1 text-sm font-black uppercase tracking-wide text-zinc-950">
              Events • Fundraising • Sponsorships
            </p>
            <h1 className="mt-3 max-w-4xl text-5xl font-black leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
              <span className="box-decoration-clone bg-indigo-300 px-3 text-zinc-950">
                Sell Tickets. Raise Funds.
              </span>
              <br />
              <span className="box-decoration-clone bg-pink-200 px-3 text-zinc-950">
                Find Sponsors.
              </span>
            </h1>
            <Link
              href="/events"
              className="mt-8 inline-flex rounded-full bg-white px-8 py-3 text-base font-black text-zinc-950 transition hover:bg-orange-50"
            >
              Browse Events
            </Link>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 py-12 sm:grid-cols-4 lg:grid-cols-8">
          {categoryCards.map(({ name, icon: Icon }) => (
            <Link
              key={name}
              href={`/events?category=${encodeURIComponent(name)}`}
              className="group flex flex-col items-center text-center"
            >
              <span className="flex h-24 w-24 items-center justify-center rounded-full border border-indigo-100 bg-white text-zinc-600 transition group-hover:border-orange-200 group-hover:text-orange-600">
                <Icon className="h-9 w-9" strokeWidth={1.6} />
              </span>
              <span className="mt-3 text-sm font-bold text-zinc-950">{name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="py-10 bg-white">
        <div className="mx-auto max-w-7xl px-4 mb-5 sm:px-6 lg:px-8 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-widest text-orange-600">
            Featured This Week
          </p>
        </div>
        <FeaturedSlider items={combinedFeaturedItems} />
      </section>

      {/* ── TASK 1 — Events grid (deduplicated, max 6) ─────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-orange-600">Events</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight">Discover events</h2>
            <p className="mt-2 text-zinc-600">Buy tickets, save events, and explore local organizers.</p>
          </div>
          <Link href="/events" className="text-sm font-black text-orange-600 hover:text-orange-700">
            View all events →
          </Link>
        </div>

        {events.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {events.map((event) => (
              <EventCard
                key={event.id}
                slug={event.slug}
                title={event.title}
                date={
                  event.event_date
                    ? new Date(event.event_date).toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric",
                      })
                    : "Date TBA"
                }
                location={event.city || event.venue || "Location TBA"}
                image={
                  event.banner ||
                  "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200&auto=format&fit=crop"
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center">
            <h3 className="text-2xl font-black">No events yet.</h3>
            <Link href="/create-event" className="mt-4 inline-block rounded-xl bg-orange-600 px-5 py-3 font-black text-white">
              Create the first event
            </Link>
          </div>
        )}
      </section>

      <Gallery4
        eyebrow="Fundraising"
        title="Crowdfunding for causes, communities, and events."
        description="Campaigns can tell a story, show progress, collect donations, and keep supporters engaged."
        items={fundraiserGalleryItems}
      />

      {/* ── About Us section ──────────────────────────────────────────────────── */}
      <AboutUsSection />

      <Footer />
    </main>
  );
}
