import { Footerdemo } from "@/components/ui/footer-section";

/**
 * Full marketing footer — home page (`/`) only.
 * Reuses the existing Footerdemo implementation (newsletter, quick links,
 * contact, follow/social, dark-mode toggle, copyright) so there is exactly
 * one copy of that markup.
 */
export default function MarketingFooter() {
  return <Footerdemo />;
}
