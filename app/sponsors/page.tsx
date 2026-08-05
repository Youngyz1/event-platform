import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.fund4agoodcause.com"),
  title: "Sponsors — Fund4Good",
  description: "Sponsor fundraising campaigns and causes on Fund4Good.",
  alternates: {
    canonical: "https://www.fund4agoodcause.com/sponsors",
  },
  openGraph: {
    title: "Sponsors — Fund4Good",
    description: "Sponsor fundraising campaigns and causes on Fund4Good.",
    url: "https://www.fund4agoodcause.com/sponsors",
    siteName: "Fund4Good",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Fund4Good Sponsors" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
};


const packages = [
  {
    name: "Gold Sponsor",
    price: "Custom",
    benefits: ["Logo on campaign banner", "VIP recognition", "Campaign page mention", "Featured sponsor placement"],
  },
  {
    name: "Silver Sponsor",
    price: "Custom",
    benefits: ["Website mention", "Campaign page logo", "Sponsor profile link", "Organizer follow-up"],
  },
  {
    name: "Community Partner",
    price: "Custom",
    benefits: ["Local campaign support", "Donation matching", "Volunteer placement", "Public recognition"],
  },
];

export default function SponsorsPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <section className="bg-zinc-950 px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-400">Sponsor Marketplace</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">
            Back campaigns your audience already cares about.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
            Businesses can discover organizers, browse fundraising campaigns, and apply for sponsorship packages.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/fundraisers" className="rounded-full bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-700">
              Browse Campaigns
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {packages.map((pkg) => (
            <div key={pkg.name} className="rounded-2xl border border-zinc-200 p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">{pkg.price}</p>
              <h2 className="mt-2 text-xl font-semibold">{pkg.name}</h2>
              <div className="mt-6 space-y-3">
                {pkg.benefits.map((benefit) => (
                  <p key={benefit} className="flex gap-3 text-sm text-zinc-600">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                    {benefit}
                  </p>
                ))}
              </div>
              <Link href="/organizers" className="mt-6 inline-block rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50">
                Find Organizers
              </Link>
            </div>
          ))}
        </div>
      </section>

    </main>
  );
}
