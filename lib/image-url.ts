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

type ProxyUnwrapRule = {
  matches: (url: URL) => boolean;
  param: string;
};

export const PROXY_UNWRAP_RULES: ProxyUnwrapRule[] = [
  {
    matches: (url) =>
      url.hostname.startsWith("www.eventbrite.") &&
      url.pathname.endsWith("/_next/image"),
    param: "url",
  },
];

function isAllowedImageHost(hostname: string) {
  return (
    EXACT_IMAGE_HOSTS.has(hostname) ||
    WILDCARD_IMAGE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  );
}

export function unwrapKnownImageProxy(url: URL): string | null {
  for (const rule of PROXY_UNWRAP_RULES) {
    if (rule.matches(url)) {
      return url.searchParams.get(rule.param);
    }
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
