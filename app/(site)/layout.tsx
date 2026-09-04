import type { ReactNode } from "react";
import LightFooter from "@/components/footers/LightFooter";

/**
 * Wrapper for all public content routes (campaigns, organizers, profiles,
 * search, static pages, …). Renders the compact LightFooter after the page.
 * Home (`/`), `/admin/*`, `/dashboard/*`, and bare auth/creation pages sit
 * outside this group and are unaffected.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <LightFooter />
    </>
  );
}
