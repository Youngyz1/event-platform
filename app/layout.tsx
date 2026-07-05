import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import NavbarWrapper from "@/components/NavbarWrapper";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";
import { getSiteUrl } from "@/lib/site-url";
import { GoogleAnalytics } from "@next/third-parties/google";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: "Fund4Good",
  title: "Fund4GoodCause — Online Fundraising Platform | Fund4Good",
  description:
    "Fund4GoodCause (Fund4Good) is an online fundraising platform that helps individuals, nonprofits, and communities raise money for causes that matter. Start a fundraiser, accept donations, and connect with donors — all in one place.",
  keywords: [
    "fund4good",
    "fund4goodcause",
    "fund4agoodcause",
    "online fundraising",
    "fundraising platform",
    "raise money online",
    "donate to causes",
    "community fundraising",
    "nonprofit fundraising",
    "crowdfunding platform",
    "fundraiser NJ",
    "fundraising New Jersey",
  ],
  verification: {
    google: "po4G29Q4YxDRxL3h7QbPGk_Wz4eYvinBleV7ISM5LBA",
  },
  openGraph: {
    siteName: "Fund4GoodCause",
    title: "Fund4GoodCause — Online Fundraising Platform | Fund4Good",
    description:
      "Fund4GoodCause (Fund4Good) is an online fundraising platform that helps individuals, nonprofits, and communities raise money for causes that matter. Start a fundraiser, accept donations, and connect with donors — all in one place.",
    type: "website",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fund4GoodCause — Online Fundraising Platform | Fund4Good",
    description:
      "Fund4GoodCause (Fund4Good) is an online fundraising platform that helps individuals, nonprofits, and communities raise money for causes that matter. Start a fundraiser, accept donations, and connect with donors — all in one place.",
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteUrl = getSiteUrl().replace(/\/$/, "");

  return (
    <html lang="en" className={`h-full antialiased ${font.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Fund4GoodCause",
              alternateName: ["Fund4Good", "Fund4AGoodCause"],
              url: siteUrl,
              description:
                "Online fundraising platform helping individuals, nonprofits, and communities raise money for causes that matter.",
              potentialAction: {
                "@type": "SearchAction",
                target: `${siteUrl}/search?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <NavbarWrapper />
        <div className="flex-1">
          {children}
        </div>
        <Footer />
        <CookieConsent />
      </body>
      <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID!} />
    </html>
  );
}
