import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

type SyncBody = {
  sourceId?: string;
  syncAll?: boolean;
};

type SourceRow = {
  id: string;
  user_id: string;
  fundraiser_id: string | null;
  title: string | null;
  organizer: string | null;
  source_url: string;
  enabled: boolean;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

const optionalFundraiserFields = ["source_url", "gofundme_source_id"];

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

function jsonString(value: JsonValue | undefined) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function thingName(value: JsonValue | undefined) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return thingName(value[0]);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return jsonString(value.name);
  }
  return "";
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
      addObjects(JSON.parse(json) as JsonValue);
    } catch {
      // Ignore malformed JSON-LD.
    }
  }

  return parsed;
}

function firstImage(value: JsonValue | undefined) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return firstImage(value[0]);
  if (value && typeof value === "object" && !Array.isArray(value)) return jsonString(value.url);
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

function numberFromText(value: string) {
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function findMoneyValue(html: string, names: string[]) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`"${escaped}"\\s*:\\s*"?\\$?([0-9,.]+)`, "i"),
      new RegExp(`"${escaped}"\\s*:\\s*\\{[^}]*"amount"\\s*:\\s*"?\\$?([0-9,.]+)`, "i"),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return numberFromText(match[1]);
    }
  }

  return null;
}

function isMissingOptionalColumn(message: string) {
  const normalized = message.toLowerCase();
  return optionalFundraiserFields.some((field) => normalized.includes(field));
}

function omitOptionalFields<T extends Record<string, unknown>>(row: T) {
  const copy = { ...row };
  optionalFundraiserFields.forEach((field) => {
    delete copy[field];
  });
  return copy;
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function fetchGoFundMeFundraiser(source: SourceRow) {
  const parsedUrl = new URL(source.source_url);
  const response = await fetch(parsedUrl.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 EventPlatformImporter/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) throw new Error(`Could not fetch GoFundMe page: ${response.status}`);

  const html = await response.text();
  const items = findJsonLd(html);
  const selected =
    items.find((item) => isType(item, "fundraiser")) ||
    items.find((item) => isType(item, "donate")) ||
    items.find((item) => isType(item, "webpage")) ||
    items[0];

  const title =
    source.title ||
    jsonString(selected?.name) ||
    getMeta(html, "og:title") ||
    getMeta(html, "twitter:title") ||
    getTitle(html).replace(/\s*\|\s*GoFundMe\s*$/i, "");
  const story =
    stripHtml(jsonString(selected?.description)) ||
    getMeta(html, "og:description") ||
    getMeta(html, "description") ||
    "Imported from GoFundMe.";
  const organizer = source.organizer || thingName(selected?.author) || thingName(selected?.organizer);
  const banner = firstImage(selected?.image) || getMeta(html, "og:image") || getMeta(html, "twitter:image");
  const goal = findMoneyValue(html, ["goal", "goalAmount", "goal_amount", "goalTotal", "goal_total"]) ?? 1;
  const raised = findMoneyValue(html, ["raised", "amountRaised", "currentAmount", "current_amount", "totalRaised"]) ?? 0;

  return {
    title: title || "GoFundMe Fundraiser",
    story,
    organizer,
    banner,
    goal,
    raised,
  };
}

async function syncSource(source: SourceRow, userId: string) {
  const supabase = await createSupabaseServer();
  const fundraiser = await fetchGoFundMeFundraiser(source);
  const slug = `${slugify(fundraiser.title)}-${source.id.slice(0, 8)}`;

  const payload = {
    title: fundraiser.title,
    slug,
    story: fundraiser.story,
    goal: fundraiser.goal,
    raised: fundraiser.raised,
    organizer: fundraiser.organizer || "",
    banner: fundraiser.banner || "",
    video_url: null,
    user_id: userId,
    source_url: source.source_url,
    gofundme_source_id: source.id,
  };

  let imported = 0;
  let updated = 0;
  let localFundraiserId = source.fundraiser_id;

  if (localFundraiserId) {
    const { error: updateError } = await supabase
      .from("fundraisers")
      .update({
        title: payload.title,
        story: payload.story,
        goal: payload.goal,
        raised: payload.raised,
        organizer: payload.organizer,
        banner: payload.banner,
      })
      .eq("id", localFundraiserId)
      .eq("user_id", userId);

    if (updateError) throw new Error(updateError.message);
    updated = 1;
  } else {
    const { data: existing } = await supabase
      .from("fundraisers")
      .select("id")
      .eq("source_url", source.source_url)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      localFundraiserId = existing.id;
      const { error: updateError } = await supabase
        .from("fundraisers")
        .update({
          title: payload.title,
          story: payload.story,
          goal: payload.goal,
          raised: payload.raised,
          organizer: payload.organizer,
          banner: payload.banner,
        })
        .eq("id", localFundraiserId)
        .eq("user_id", userId);

      if (updateError) throw new Error(updateError.message);
      updated = 1;
    } else {
      let { data: inserted, error: insertError } = await supabase.from("fundraisers").insert(payload).select().single();

      if (insertError && isMissingOptionalColumn(insertError.message)) {
        const retry = await supabase.from("fundraisers").insert(omitOptionalFields(payload)).select().single();
        inserted = retry.data;
        insertError = retry.error;
      }

      if (insertError) throw new Error(insertError.message);
      if (!inserted) throw new Error("Fundraiser was not created.");
      localFundraiserId = inserted.id;
      imported = 1;
    }
  }

  const message = imported ? "Imported 1. Updated 0." : `Imported 0. Updated ${updated}.`;
  await supabase
    .from("gofundme_sources")
    .update({
      fundraiser_id: localFundraiserId,
      title: fundraiser.title,
      organizer: fundraiser.organizer || source.organizer,
      last_synced_at: new Date().toISOString(),
      last_sync_message: message,
    })
    .eq("id", source.id)
    .eq("user_id", userId);

  return {
    sourceId: source.id,
    sourceName: fundraiser.title,
    imported,
    updated,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SyncBody;
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "You must be logged in to sync GoFundMe." }, { status: 401 });
    }

    let query = supabase
      .from("gofundme_sources")
      .select("*")
      .eq("user_id", user.id)
      .eq("enabled", true);

    if (!body.syncAll) {
      if (!body.sourceId) {
        return NextResponse.json({ error: "sourceId or syncAll is required." }, { status: 400 });
      }
      query = query.eq("id", body.sourceId);
    }

    const { data: sources, error } = await query;
    if (error) throw new Error(error.message);
    if (!sources || sources.length === 0) {
      return NextResponse.json({ error: "No enabled GoFundMe sources found." }, { status: 404 });
    }

    const results = [];
    for (const source of sources as SourceRow[]) {
      results.push(await syncSource(source, user.id));
    }

    const imported = results.reduce((total, result) => total + result.imported, 0);
    const updated = results.reduce((total, result) => total + result.updated, 0);

    return NextResponse.json({ imported, updated, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "GoFundMe sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
