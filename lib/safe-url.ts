/**
 * lib/safe-url.ts
 *
 * URL allow-list for rich-text links (remediation for C2).
 *
 * Allowed: absolute `http:` / `https:` URLs only.
 * Rejected: `javascript:`, `data:`, `vbscript:`, `file:`, `blob:`, and any
 * other scheme, plus relative / scheme-relative / malformed URLs.
 *
 * Deliberately NOT a `startsWith("http")` check:
 *  - schemes are case-insensitive (`JaVaScRiPt:`)
 *  - leading whitespace / control chars can smuggle schemes past naive checks
 *  - HTML numeric entities (`&#106;avascript:`) decode in the browser
 *  - trailing/embedded newlines and backslashes confuse some parsers
 *
 * Dependency-free so it can run in the editor (client), in API routes
 * (server), and in plain-node security checks without path aliases.
 */

const DANGEROUS_SCHEME_PATTERN =
  /^(?:javascript|data|vbscript|file|blob|filesystem|about|chrome|view-source|mhtml)\s*:/i;

/** Decode decimal/hex HTML entities so `&#106;avascript:` cannot smuggle. */
function decodeEntitiesOnce(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);?/g, (_m, hex: string) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return "";
      }
    })
    .replace(/&#([0-9]+);?/g, (_m, dec: string) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return "";
      }
    })
    .replace(/&(colon|tab|newline|space|lpar|rpar|sol);?/gi, (m) => {
      switch (m.toLowerCase().replace(/;$/, "")) {
        case "&colon":
          return ":";
        case "&tab":
          return "\t";
        case "&newline":
          return "\n";
        case "&space":
          return " ";
        case "&lpar":
          return "(";
        case "&rpar":
          return ")";
        case "&sol":
          return "/";
        default:
          return m;
      }
    });
}

/**
 * Returns true only for absolute http/https URLs safe to store as link hrefs.
 * Everything else (including empty / relative / protocol-relative URLs) is false.
 */
export function isAllowedHttpUrl(raw: unknown): boolean {
  if (typeof raw !== "string") return false;

  // Strip ASCII whitespace/control chars AND common unicode spaces that
  // browsers trim before parsing a URL (e.g. ` javascript:alert(1)`).
  let href = raw.replace(/^[\u0000-\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+|[\u0000-\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+$/g, "");
  if (!href) return false;

  // Backslashes are treated as slashes by browsers (`java\tscript:` tricks).
  // Reject any URL containing them rather than trying to normalize.
  if (href.includes("\\")) return false;

  // Embedded tabs/newlines are stripped by browsers before parsing, so
  // `java\tscript:` becomes `javascript:`. Reject outright.
  if (/[\t\n\r]/.test(href)) return false;

  // Decode entities twice (double-encoding) before scheme inspection.
  href = decodeEntitiesOnce(decodeEntitiesOnce(href));

  // Fast reject on any known-dangerous scheme after decoding.
  if (DANGEROUS_SCHEME_PATTERN.test(href.trimStart())) return false;

  // Explicit scheme extraction: if a scheme is present it must be http/https.
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*)\s*:/.exec(href.trimStart());
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== "http" && scheme !== "https") return false;
  } else {
    // No scheme at all (relative path, anchor, protocol-relative `//host`).
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (!parsed.hostname) return false;
  if (parsed.username || parsed.password) return false;

  return true;
}

/** Alias matching TipTap's `isAllowedUri` signature. */
export function isAllowedUri(url: string): boolean {
  return isAllowedHttpUrl(url);
}
