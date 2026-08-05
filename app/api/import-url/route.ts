import { NextRequest, NextResponse } from "next/server";
import { normalizeImageUrl } from "@/lib/image-url";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getMeta(html: string, key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${key}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${key}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }

  return "";
}

function getTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtml(stripHtml(match[1])) : "";
}

function absoluteUrl(value: string, baseUrl: URL) {
  if (!value) return "";

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function findJsonLd(html: string) {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  const parsed: JsonObject[] = [];

  function addObjects(value: JsonValue) {
    if (Array.isArray(value)) {
      value.forEach(addObjects);
      return;
    }

    if (!value || typeof value !== "object") return;

    const graph = value["@graph"];
    if (Array.isArray(graph)) graph.forEach(addObjects);
    parsed.push(value);
  }

  for (const script of scripts) {
    const json = script
      .replace(/<script[^>]*>/i, "")
      .replace(/<\/script>/i, "")
      .trim();

    try {
      const value = JSON.parse(json) as JsonValue;
      addObjects(value);
    } catch {
      // Ignore malformed JSON-LD blocks from third-party pages.
    }
  }

  return parsed;
}

function jsonString(value: JsonValue | undefined) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function jsonObject(value: JsonValue | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function jsonArray(value: JsonValue | undefined) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function thingName(value: JsonValue | undefined) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return thingName(value[0]);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return jsonString(value.name);
  }
  return "";
}

function thingUrl(value: JsonValue | undefined) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return thingUrl(value[0]);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return jsonString(value.url);
  }
  return "";
}

function thingDescription(value: JsonValue | undefined) {
  if (Array.isArray(value)) return thingDescription(value[0]);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return stripHtml(jsonString(value.description));
  }
  return "";
}

function firstImage(value: JsonValue | undefined) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && !Array.isArray(first)) {
      return jsonString(first.url);
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return jsonString(value.url);
  }
  return "";
}

function isType(item: JsonObject, expected: string) {
  const type = item["@type"];
  if (typeof type === "string") return type.toLowerCase().includes(expected);
  if (Array.isArray(type)) {
    return type.some((entry) => typeof entry === "string" && entry.toLowerCase().includes(expected));
  }
  return false;
}

function getFaqText(items: JsonObject[]) {
  const faq = items.find((item) => isType(item, "faqpage"));
  const questions = jsonArray(faq?.mainEntity)
    .map((entry) => jsonObject(entry))
    .filter((entry): entry is JsonObject => !!entry)
    .map((question) => {
      const answer = jsonObject(question.acceptedAnswer);
      return {
        name: stripHtml(jsonString(question.name)),
        text: stripHtml(jsonString(answer?.text)),
      };
    })
    .filter((entry) => entry.name && entry.text);

  if (questions.length === 0) return "";

  return questions.map((entry) => `Q: ${entry.name}\nA: ${entry.text}`).join("\n\n");
}

function buildDescription(item: JsonObject | undefined, html: string, items: JsonObject[]) {
  const main =
    stripHtml(jsonString(item?.description)) ||
    getMeta(html, "og:description") ||
    getMeta(html, "description");
  const faq = getFaqText(items);

  return [main, faq].filter(Boolean).join("\n\n");
}

function sourceOrganizer(item: JsonObject | undefined) {
  const organizer = item?.organizer || item?.performer || item?.author;

  return {
    name: thingName(organizer),
    url: thingUrl(organizer),
    description: thingDescription(organizer),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url?: string };

    if (!url) {
      return NextResponse.json({ error: "URL is required." }, { status: 400 });
    }

    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Only http and https URLs can be imported." }, { status: 400 });
    }

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 Fund4GoodImporter/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Could not fetch page: ${response.status}` }, { status: 400 });
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({ error: "URL did not return an HTML page." }, { status: 400 });
    }

    const html = await response.text();
    const items = findJsonLd(html);
    const selected = items.find((item) => isType(item, "fundraiser") || isType(item, "donate"));

    const title =
      jsonString(selected?.name) ||
      getMeta(html, "og:title") ||
      getMeta(html, "twitter:title") ||
      getTitle(html);

    const description = buildDescription(selected, html, items);

    const rawImage = absoluteUrl(
      firstImage(selected?.image) || getMeta(html, "og:image") || getMeta(html, "twitter:image"),
      parsedUrl
    );
    const image = normalizeImageUrl(rawImage, "");
    const organizer = sourceOrganizer(selected);

    return NextResponse.json({
      data: {
        title,
        story: description,
        goal: "",
        organizer: organizer.name,
        banner: image,
        video_url: "",
        source_url: parsedUrl.toString(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not import this URL.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
