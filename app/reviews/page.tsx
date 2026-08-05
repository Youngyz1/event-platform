import type { Metadata } from "next";
import ReviewSection from "@/components/ReviewSection";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.fund4agoodcause.com"),
  title: "Reviews — Fund4Good",
  description: "See what people are saying about Fund4Good.",
  alternates: {
    canonical: "https://www.fund4agoodcause.com/reviews",
  },
  openGraph: {
    title: "Reviews — Fund4Good",
    description: "See what people are saying about Fund4Good.",
    url: "https://www.fund4agoodcause.com/reviews",
    siteName: "Fund4Good",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Fund4Good Reviews" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
};

export default function PlatformReviewsPage() {
  return (
    <main className="min-h-screen bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">

        <header className="mb-10 text-center sm:mb-14">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
            Reviews
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
            Community Feedback
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-zinc-500">
            Tell us about your experience with ease of use, fundraising, ticketing, and support on Fund4Good.
          </p>
        </header>

        <ReviewSection
          targetType="platform"
          targetId="platform"
          accentColor="orange"
        />

      </div>
    </main>
  );
}
