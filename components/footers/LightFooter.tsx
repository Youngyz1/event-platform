import Link from "next/link";
import { AtSign, Globe, MessageCircle, Network } from "lucide-react";
import BrandMark from "@/components/BrandMark";

// NOTE: /terms does not exist in app/ yet, so it is deliberately NOT linked
// here. Link only to legal routes that genuinely exist: /privacy, /cookies.
const legalLinks = [
  ["Privacy", "/privacy"],
  ["Cookies", "/cookies"],
] as const;

const socialLinks = [
  ["Community", Globe],
  ["Updates", MessageCircle],
  ["Email", AtSign],
  ["Partners", Network],
] as const;

/**
 * Stripped-down footer for all public content routes (campaigns, events,
 * organizers, profiles, articles, search, static pages, …).
 * Copyright + legal links + social icons only — no newsletter signup
 * ("Stay connected" lives on the home page's MarketingFooter only),
 * no quick links, and no dashboard-style navigation.
 */
export default function LightFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white text-zinc-950">
      <div className="mx-auto max-w-7xl px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <BrandMark textClassName="text-zinc-950" />
            <p className="mt-2 text-xs text-zinc-500">
              © 2026 Fund4Good. All rights reserved.
            </p>
            <nav aria-label="Legal" className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {legalLinks.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="text-xs font-semibold text-zinc-500 transition-colors hover:text-brand-700"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight">Follow us</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {socialLinks.map(([label, Icon]) => (
                <span
                  key={label}
                  title={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span className="sr-only">{label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
