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

