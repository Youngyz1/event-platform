const EXACT_IMAGE_HOSTS = new Set([
  "images.unsplash.com",
  "img.evbuc.com",
  "s1.ticketm.net",
  "images.gofundme.com",
  "d2g8igdw686xgo.cloudfront.net",
  "lh3.googleusercontent.com",
]);

const WILDCARD_IMAGE_HOST_SUFFIXES = [
  ".supabase.co",
  ".supabase.in",
  ".googleusercontent.com",
];

function isAllowedImageHost(hostname: string) {
  return (
    EXACT_IMAGE_HOSTS.has(hostname) ||
    WILDCARD_IMAGE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  );
}

function unwrapKnownImageProxy(url: URL): string | null {
  if (
    url.hostname.startsWith("www.eventbrite.") &&
    url.pathname.endsWith("/_next/image")
  ) {
    return url.searchParams.get("url");
  }

  return null;
}

export function normalizeImageUrl(
  value: string | null | undefined,
  fallback: string
) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const unwrapped = unwrapKnownImageProxy(url);
    if (unwrapped) {
      return normalizeImageUrl(decodeURIComponent(unwrapped), fallback);
    }

    if (url.protocol !== "https:") return fallback;
    if (!isAllowedImageHost(url.hostname)) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}
