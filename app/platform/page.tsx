import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.fund4agoodcause.com"),
  title: "One Platform for Fundraising | Fund4Good",
  description:
    "Focused workflows for donors, organizers, and sponsors around fundraising campaigns.",
  alternates: {
    canonical: "https://www.fund4agoodcause.com/platform",
  },
};

const roles = [
  {
    title: "Donors",
    description:
      "Find causes, support campaigns, and keep track of the organizers you follow.",
    features: [
      "Donate to campaigns",
      "Follow organizers",
      "Get email reminders",
      "Leave reviews",
    ],
    accent: "orange",
  },
  {
    title: "Organizers",
    description:
      "Launch fundraisers with campaign pages and analytics built in.",
    features: [
      "Run fundraisers",
      "View analytics",
      "Manage donors",
      "Send updates",
    ],
    accent: "emerald",
  },
  {
    title: "Sponsors",
    description:
      "Discover campaigns worth backing, then manage sponsorship opportunities.",
    features: [
      "Browse campaigns",
      "Offer sponsorships",
      "Manage requests",
      "Track ROI",
    ],
    accent: "blue",
  },
];

const accents: Record<string, { badge: string; dot: string }> = {
  orange: {
    badge: "bg-brand-100 text-brand-800",
    dot: "bg-brand-600",
  },
  emerald: {
    badge: "bg-brand-100 text-brand-800",
    dot: "bg-brand-600",
  },
  blue: {
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
  },
};

export default function PlatformPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <section className="bg-zinc-950 px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-400">
            Platform
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">
            One Platform for Fundraising
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
            Donors, organizers, and sponsors each get a focused workflow
            instead of a pile of disconnected tools.
          </p>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl divide-y divide-zinc-200">
          {roles.map((role) => {
            const accent = accents[role.accent];

            return (
              <article
                key={role.title}
                className="grid gap-8 py-10 first:pt-0 last:pb-0 md:grid-cols-[0.8fr_1.2fr]"
              >
                <div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${accent.badge}`}>
                    {role.title}
                  </span>
                  <p className="mt-5 text-xl font-semibold leading-tight text-zinc-950">
                    {role.description}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {role.features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-3 text-sm text-zinc-600"
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${accent.dot}`} />
                      {feature}
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-2xl bg-zinc-950 p-8 text-white md:flex md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-400">
              Ready to get started?
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Explore campaigns or start building your own.
            </h2>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 md:mt-0">
            <Link
              href="/fundraisers"
              className="rounded-full bg-brand-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              Browse Fundraisers
            </Link>
            <Link
              href="/create-fundraiser"
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
            >
              Start a Fundraiser
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
