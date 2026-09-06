import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { sanitizeRichTextHtml } from "@/lib/sanitize-html";
import { isAllowedHttpUrl } from "@/lib/safe-url";
import { CAMPAIGN_CATEGORIES } from "@/lib/categories";
import { enforceRateLimit } from "@/lib/rate-limit";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MAX_TITLE = 140;
const MAX_STORY_CHARS = 200_000;
const MAX_URL_CHARS = 2000;
const MAX_GOAL = 100_000_000;

function cleanStr(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * POST /api/fundraisers — server-controlled fundraiser creation (Obj1).
 *
 * Pipeline: authenticate -> validate -> authorize organizer ->
 * sanitize story (lib/sanitize-html.ts) -> service-role insert.
 * `status` is never accepted from the client (DB default + RLS force
 * pending_review; only the admin route may publish).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  // H2: per-user budget against mass campaign-creation abuse.
  const limited = await enforceRateLimit("fundraiserCreate", req, user.id);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request body.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return bad("Invalid request body.");
  }

  const title = cleanStr(body.title, MAX_TITLE);
  if (title.length < 3) {
    return bad("Title must be at least 3 characters.");
  }

  const slug = cleanStr(body.slug, 160).toLowerCase();
  if (!slugPattern.test(slug)) {
    return bad("Invalid slug.");
  }

  const category = cleanStr(body.category, 40);
  if (!(CAMPAIGN_CATEGORIES as readonly string[]).includes(category)) {
    return bad("Invalid category.");
  }

  const goal = Number(body.goal);
  if (!Number.isFinite(goal) || goal <= 0 || goal > MAX_GOAL) {
    return bad("Goal must be a positive amount.");
  }

  const raisedRaw = body.raised === undefined || body.raised === null || body.raised === "" ? 0 : Number(body.raised);
  if (!Number.isFinite(raisedRaw) || raisedRaw < 0 || raisedRaw > MAX_GOAL) {
    return bad("Invalid raised amount.");
  }

  // Obj1: the story is sanitized server-side; the stored value is always the
  // sanitized result, never the raw client HTML.
  const storyRaw = typeof body.story === "string" ? body.story : "";
  if (storyRaw.length > MAX_STORY_CHARS) {
    return bad("Story is too long.");
  }
  const story = sanitizeRichTextHtml(storyRaw);

  const organizerId = cleanStr(body.organizer_id, 60);
  let organizer_id: string | null = null;
  if (organizerId) {
    if (!uuidPattern.test(organizerId)) {
      return bad("Invalid organizer.");
    }
    const { data: organizer } = await supabaseAdmin
      .from("organizers")
      .select("id")
      .eq("id", organizerId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!organizer) {
      return NextResponse.json({ error: "You do not own this organizer profile." }, { status: 403 });
    }
    organizer_id = organizerId;
  }

  const organizer = cleanStr(body.organizer, 200);
  const banner = cleanStr(body.banner, MAX_URL_CHARS);
  const image_url = cleanStr(body.image_url, MAX_URL_CHARS);
  const video_url = cleanStr(body.video_url, MAX_URL_CHARS);
  for (const [label, url] of [["banner", banner], ["image_url", image_url], ["video_url", video_url]] as const) {
    if (url && !isAllowedHttpUrl(url)) {
      return bad(`Invalid ${label} URL.`);
    }
  }

  const beneficiary_id = cleanStr(body.beneficiary_id, 60);
  if (beneficiary_id && !uuidPattern.test(beneficiary_id)) {
    return bad("Invalid beneficiary.");
  }
  const beneficiary =
    body.beneficiary !== undefined && body.beneficiary !== null && typeof body.beneficiary === "object" && !Array.isArray(body.beneficiary)
      ? (body.beneficiary as Record<string, unknown>)
      : null;

  // Optional import provenance (CSV import flow). Validated as a URL when
  // present; omitted from the insert when empty.
  const source_url = cleanStr(body.source_url, MAX_URL_CHARS);
  if (source_url && !isAllowedHttpUrl(source_url)) {
    return bad("Invalid source_url.");
  }

  const { data: slugTaken } = await supabaseAdmin
    .from("fundraisers")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (slugTaken) {
    return NextResponse.json(
      { error: "A fundraiser with this title already exists. Please change the title." },
      { status: 409 }
    );
  }

  const row: Record<string, unknown> = {
    title,
    slug,
    story,
    goal,
    raised: raisedRaw,
    organizer: organizer || null,
    organizer_id,
    beneficiary,
    beneficiary_id: beneficiary_id || null,
    category,
    banner: banner || null,
    image_url: image_url || null,
    video_url: video_url || null,
    user_id: user.id,
  };
  if (source_url) row.source_url = source_url;

  let inserted: { id: string; slug: string } | null = null;
  {
    const { data, error } = await supabaseAdmin
      .from("fundraisers")
      .insert(row)
      .select("id, slug")
      .single();
    if (!error && data) {
      inserted = data;
    } else if (error && source_url && isMissingColumn(error.message, "source_url")) {
      // Older databases predate the source_url column (same fallback the CSV
      // client historically applied): retry without the optional field.
      const { source_url: _dropped, ...rowWithoutSource } = row;
      void _dropped;
      const retry = await supabaseAdmin
        .from("fundraisers")
        .insert(rowWithoutSource)
        .select("id, slug")
        .single();
      if (!retry.error && retry.data) {
        inserted = retry.data;
      } else {
        console.error("[POST /api/fundraisers] insert failed");
        return NextResponse.json({ error: "Could not create fundraiser." }, { status: 500 });
      }
    } else {
      console.error("[POST /api/fundraisers] insert failed");
      return NextResponse.json({ error: "Could not create fundraiser." }, { status: 500 });
    }
  }

  return NextResponse.json({ id: inserted.id, slug: inserted.slug }, { status: 201 });
}

const OPTIONAL_IMPORT_COLUMNS = ["source_url"];

/** Matches "column does not exist" failures for optional import columns. */
function isMissingColumn(message: string, column: string): boolean {
  const normalized = message.toLowerCase();
  return (
    OPTIONAL_IMPORT_COLUMNS.includes(column) &&
    normalized.includes(column) &&
    (normalized.includes("does not exist") ||
      normalized.includes("could not find") ||
      normalized.includes("schema cache"))
  );
}
