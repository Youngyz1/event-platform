import { headers } from "next/headers";

const DEFAULT_COUNTRY = "US";
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

/**
 * Best-effort visitor country, derived server-side from the platform's own
 * edge geolocation of the real incoming request IP — not the country a
 * payment provider's client-side widget guesses from the browser's own
 * network path, which can be wrong behind VPNs/proxies/unusual egress routes.
 * (Confirmed empirically: this project's dev sandbox egress IP itself
 * geolocates to Cote d'Ivoire, which is exactly the class of failure this
 * guards against — see the Stripe country-default bug fix.)
 *
 * Vercel injects `x-vercel-ip-country` at the edge for every request; when
 * that header is absent (local dev, or hosting elsewhere) this falls back to
 * "US" rather than leaving the caller to show whatever a less trustworthy
 * signal produces.
 */
export async function getVisitorCountry(): Promise<string> {
  const headerList = await headers();
  const vercelCountry = headerList.get("x-vercel-ip-country");
  if (vercelCountry && COUNTRY_CODE_PATTERN.test(vercelCountry)) {
    return vercelCountry;
  }
  return DEFAULT_COUNTRY;
}
