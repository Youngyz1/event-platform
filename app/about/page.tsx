import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";


export const metadata: Metadata = {
  metadataBase: new URL("https://www.fund4agoodcause.com"),
  title: "About — Fund4Good",
  description: "Learn about Fund4Good's mission to connect communities through fundraising.",
  alternates: {
    canonical: "https://www.fund4agoodcause.com/about",
  },
  openGraph: {
    title: "About — Fund4Good",
    description: "Learn about Fund4Good's mission to connect communities through fundraising.",
    url: "https://www.fund4agoodcause.com/about",
    siteName: "Fund4Good",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "About Fund4Good" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
};

const platformStats = [
  { value: "Causes", label: "Launch fundraisers with clear stories, goals, and donor updates." },
  { value: "Organizers", label: "Build editable profiles with photos, followers, and details." },
];

const pathways = [
  {
    title: "Start",
    description:
      "Launch a fundraiser, tell your story, and start collecting donations. Every campaign stays editable after it goes live.",
    href: "/create-fundraiser",
    label: "Start a fundraiser",
  },
  {
    title: "Discover",
    description:
      "Find causes and campaigns worth supporting from organizers and communities around New Jersey and nearby cities.",
    href: "/campaigns",
    label: "Browse fundraisers",
  },
  {
    title: "Support",
    description:
      "Give to fundraisers that explain the need, show progress, share success stories, and make supporters feel confident.",
    href: "/campaigns",
    label: "View fundraisers",
  },
];

const trustPoints = [
  "Organizer profiles can be updated with photos, bios, follower counts, and contact details.",
  "Imported fundraisers remain editable, so listings can be cleaned up after they are pulled in.",
  "Campaign pages include story, impact, progress, and supporter-focused calls to action.",
  "Source links help visitors understand where imported campaigns came from.",
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-950">
       

      <section className="relative isolate overflow-hidden bg-zinc-950 text-white">
        <Image
          src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=1800&auto=format&fit=crop"
          alt="People gathered in a local community"
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-10 object-cover opacity-45"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />
        <div className="mx-auto grid min-h-[560px] max-w-7xl content-end px-4 pb-16 pt-24 sm:px-6 lg:pb-24">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-400">
            About Fund4Good
          </p>
          <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Bringing local communities together through causes and trusted organizers.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300 sm:text-xl">
            Fund4Good helps people create, discover, and support real causes. The goal is simple: make it easier for communities to show up for each other.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/campaigns" className="rounded-full bg-brand-700 px-6 py-3 font-semibold text-white transition hover:bg-brand-800">
              Find a cause
            </Link>
            <Link href="/create-fundraiser" className="rounded-full bg-white px-6 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-100">
              Start a fundraiser
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Our mission</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              Help organizers grow while helping people find where they belong.
            </h2>
          </div>
          <div className="space-y-5 text-lg leading-8 text-zinc-600">
            <p>
              We are building a home for fundraising campaigns that need more than a simple listing. A strong page should show who is behind it, why it matters, what supporters can expect, and how people can take action.
            </p>
            <p>
              That means organizers can publish from scratch, import from places like GoFundMe, then edit the final page so it feels complete on their own website.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-100 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 sm:grid-cols-2">
            {platformStats.map((item) => (
              <div key={item.value}>
                <h3 className="text-3xl font-bold text-brand-700">{item.value}</h3>
                <p className="mt-2 text-base text-zinc-600">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-100 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">What you can do</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              One platform for the full community flow.
            </h2>
          </div>
          <div className="mt-10 grid gap-x-8 gap-y-10 lg:grid-cols-3">
            {pathways.map((item) => (
              <article key={item.title}>
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 min-h-24 text-base leading-7 text-zinc-600">{item.description}</p>
                <Link href={item.href} className="mt-4 inline-flex rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
                  {item.label}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#1f0a3d] px-4 py-14 text-white sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-300">Built for trust</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              Imported does not have to mean unfinished.
            </h2>
            <p className="mt-5 text-lg leading-8 text-violet-100">
              Every imported organizer or campaign should still feel owned by your website. The page can be improved with real details, stronger images, better descriptions, and the right local organizer name.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {trustPoints.map((point) => (
              <p key={point} className="border-l-2 border-white/20 pl-4 text-base leading-7 text-violet-100">
                {point}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 border-t border-zinc-100 pt-14 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Ready to build</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Create a page people can trust.</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600">
              Start with a fundraiser or organizer profile, then shape the details until it feels complete.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/create-fundraiser" className="rounded-full bg-zinc-950 px-6 py-3 font-semibold text-white transition hover:bg-zinc-800">
              Start fundraiser
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
