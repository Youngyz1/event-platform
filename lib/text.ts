/** Decodes basic HTML entities commonly found in rich text. */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

/** Truncates on a word boundary rather than mid-word, appending an ellipsis. */
export function truncateWords(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Strips HTML tags and decodes entities for previews of rich-text fields; a no-op on plain text. */
export function stripHtml(value: string): string {
  if (!value) return "";
  const noTags = value.replace(/<[^>]*>/g, " ");
  const decoded = decodeHtmlEntities(noTags);
  return decoded.replace(/\s+/g, " ").trim();
}

/** Cleans up malformed unicode replacement question marks (e.g. " ??") from title strings. */
export function cleanTitle(title: string): string {
  if (!title) return "";
  return title.replace(/(\s*\?\?)+\s*$/g, "").trim();
}

// Matches emoji pictographs (including ZWJ families like 👨‍👩‍👧, skin tones,
// flags, and keycaps) plus emoji-capable symbols (★ ♥ ♦ ♣ ● ▶ ▼ ‼ ⁉ ℹ ™ © ®).
// Standalone ZWJ characters in non-emoji text (e.g. Indic scripts) are left
// alone — ZWJ is only removed as part of an emoji run.
const EMOJI_RUN_PATTERN = new RegExp(
  "(?:" +
    "\\p{Extended_Pictographic}\\uFE0F?(?:\\u200D\\p{Extended_Pictographic}\\uFE0F?)*" +
    "|[\\u2600-\\u27BF\\u2B00-\\u2BFF\\u2300-\\u23FF\\u25A0-\\u25FF]" +
    "|\\u203C|\\u2049|\\u2122|\\u2139|\\u00A9|\\u00AE" +
    "|[\\u{1F1E6}-\\u{1F1FF}]" +
    "|[\\u{1F3FB}-\\u{1F3FF}]" +
    "|[\\u{E0020}-\\u{E007F}]" +
    "|[0-9#*]\\uFE0F?\\u20E3" +
    "|\\uFE0F|\\u20E3" +
    ")",
  "gu"
);

/**
 * Removes emojis and emoji-presentation characters from display text.
 * Used for imported/external strings (e.g. GoFundMe titles arrive with
 * decorative hearts) and for sanitizing titles at render time. Genuine
 * user-authored message bodies are NOT passed through this — only titles
 * and other short display labels where emojis are never meaningful.
 */
export function stripEmojis(value: string): string {
  if (!value) return "";
  return value.replace(EMOJI_RUN_PATTERN, "").replace(/\s+/g, " ").trim();
}

