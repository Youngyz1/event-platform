import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import NavbarWrapper from "@/components/NavbarWrapper";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";
import { getSiteUrl } from "@/lib/site-url";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: "Fund4Good",
  title: "Fund4Good",
  description: "Discover events, fundraisers, and community gatherings near you.",
  openGraph: {
    siteName: "Fund4Good",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${font.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"
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
    </html>
  );
}
