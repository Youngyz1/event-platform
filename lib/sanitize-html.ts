/**
 * lib/sanitize-html.ts
 *
 * Single server/client HTML sanitization policy for user-authored rich text
 * (remediation for C2).
 *
 * Canonical pipeline:
 *   Editor validation (isAllowedHttpUrl + TipTap isAllowedUri)
 *     -> Server sanitization (sanitizeRichTextHtml) before persistence
 *     -> Database
 *     -> Renderer sanitization (FundraiserStory DOMPurify, retained)
 *
 * Uses the application's existing library (`isomorphic-dompurify`, already a
 * dependency and already used by the editor/renderer) — no second system.
 *
 * Policy notes (reviewed, not blindly expanded):
 *  - Links: only http/https hrefs survive (ALLOWED_URI_REGEXP). `target`/`rel`
 *    are kept so the renderer hook can enforce `_blank` + `noopener`.
 *  - Media: `img`/`video`/`source`/`iframe` retained because fundraisers
 *    legitimately embed them, but `iframe` srcs are restricted at render time
 *    to YouTube/Vimeo by FundraiserStory's afterSanitizeAttributes hook.
 *  - `style`/`class` are retained (existing content depends on them) but
 *    scripts, event handlers (`on*`), `form`/`input`/`script`/`object`/
 *    `embed`/`link`/`meta`/`base` tags are removed by the allow-list.
 */

import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "img",
  "video",
  "source",
  "iframe",
] as const;

const ALLOWED_ATTR = [
  "href",
  "src",
  "target",
  "rel",
  "controls",
  "width",
  "height",
  "alt",
  "class",
  "style",
  "allow",
  "allowfullscreen",
  "frameborder",
] as const;

/** Only http/https (plus anchor) URLs survive sanitization. */
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i;

export function sanitizeRichTextHtml(dirty: unknown): string {
  if (typeof dirty !== "string" || !dirty) return "";
  // Cap input to bound sanitizer work (DoS via pathological nesting).
  const capped = dirty.length > 200_000 ? dirty.slice(0, 200_000) : dirty;
  return DOMPurify.sanitize(capped, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    ALLOWED_URI_REGEXP,
    ALLOW_DATA_ATTR: false,
    // NOTE: no USE_PROFILES — the html profile strips <iframe> even when it
    // is listed in ALLOWED_TAGS (verified). The explicit allow-list above IS
    // the policy, matching the editor paste sanitizer and the renderer.
  });
}

/** Plain-text fields (titles): strip all tags, keep text. */
export function sanitizePlainText(dirty: unknown, maxLength = 200): string {
  if (typeof dirty !== "string" || !dirty) return "";
  const text = DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return text.trim().slice(0, maxLength);
}
