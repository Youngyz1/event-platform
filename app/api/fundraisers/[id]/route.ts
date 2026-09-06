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

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/fundraisers/[id] — server-controlled fundraiser update (Obj1).
 *
 * Pipeline: authenticate -> load fundraiser -> authorize owner/organizer ->
 * validate allow-listed fields -> sanitize story -> service-role update.
 *
 * `status` / `rejection_reason` are never accepted here (admin route only);
 * the DB status-transition trigger additionally guards direct writes.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  // H2: same per-user budget as other fundraiser writes.
  const limited = await enforceRateLimit("fundraiserUpdate", req, user.id);
  if (limited) return limited;

  const { id } = await context.params;
  if (!uuidPattern.test(id)) {
    return bad("Invalid fundraiser.");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request body.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return bad("Invalid request body.");
  }

  const { data: fundraiser } = await supabaseAdmin
    .from("fundraisers")
    .select("id, user_id, organizer_id")
    .eq("id", id)
    .maybeSingle();
  if (!fundraiser) {
    return NextResponse.json({ error: "Fundraiser not found." }, { status: 404 });
  }

  // Authorization mirrors the RLS UPDATE policy: row owner, or the owner of
  // the fundraiser's organizer profile. Admins use the admin route instead.
  let authorized = fundraiser.user_id === user.id;
  if (!authorized && fundraiser.organizer_id) {
    const { data: organizer } = await supabaseAdmin
      .from("organizers")
      .select("id")
      .eq("id", fundraiser.organizer_id)
      .eq("user_id", user.id)
      .maybeSingle();
    authorized = Boolean(organizer);
  }
  if (!authorized) {
    return NextResponse.json({ error: "You do not own this fundraiser." }, { status: 403 });
  }

  const update: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = cleanStr(body.title, MAX_TITLE);
    if (title.length < 3) return bad("Title must be at least 3 characters.");
    update.title = title;
  }

  if (body.slug !== undefined) {
    const slug = cleanStr(body.slug, 160).toLowerCase();
    if (!slugPattern.test(slug)) return bad("Invalid slug.");
    const { data: clash } = await supabaseAdmin
      .from("fundraisers")
      .select("id")
      .eq("slug", slug)
      .neq("id", id)
      .maybeSingle();
    if (clash) {
      return NextResponse.json(
        { error: "Another fundraiser already uses this URL. Please change the title." },
        { status: 409 }
      );
    }
    update.slug = slug;
  }

  if (body.story !== undefined) {
    // Obj1: server-side sanitization — the stored value is always sanitized.
    const storyRaw = typeof body.story === "string" ? body.story : "";
    if (storyRaw.length > MAX_STORY_CHARS) return bad("Story is too long.");
    update.story = sanitizeRichTextHtml(storyRaw);
  }

  if (body.category !== undefined) {
    const category = cleanStr(body.category, 40);
    if (!(CAMPAIGN_CATEGORIES as readonly string[]).includes(category)) {
      return bad("Invalid category.");
    }
    update.category = category;
  }

  if (body.goal !== undefined) {
    const goal = Number(body.goal);
    if (!Number.isFinite(goal) || goal <= 0 || goal > MAX_GOAL) {
      return bad("Goal must be a positive amount.");
    }
    update.goal = goal;
  }

  if (body.raised !== undefined) {
    const raised = Number(body.raised);
    if (!Number.isFinite(raised) || raised < 0 || raised > MAX_GOAL) {
      return bad("Invalid raised amount.");
    }
    update.raised = raised;
  }

  if (body.organizer !== undefined) {
    update.organizer = cleanStr(body.organizer, 200) || null;
  }

  if (body.organizer_id !== undefined) {
    const organizerId = cleanStr(body.organizer_id, 60);
    if (organizerId) {
      if (!uuidPattern.test(organizerId)) return bad("Invalid organizer.");
      const { data: organizer } = await supabaseAdmin
        .from("organizers")
        .select("id")
        .eq("id", organizerId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!organizer) {
        return NextResponse.json({ error: "You do not own this organizer profile." }, { status: 403 });
      }
      update.organizer_id = organizerId;
    } else {
      update.organizer_id = null;
    }
  }

  for (const field of ["banner", "image_url", "video_url"] as const) {
    if (body[field] !== undefined) {
      const url = cleanStr(body[field], MAX_URL_CHARS);
      if (url && !isAllowedHttpUrl(url)) return bad(`Invalid ${field} URL.`);
      update[field] = url || null;
    }
  }

  if (body.beneficiary_id !== undefined) {
    const beneficiary_id = cleanStr(body.beneficiary_id, 60);
    if (beneficiary_id && !uuidPattern.test(beneficiary_id)) {
      return bad("Invalid beneficiary.");
    }
    update.beneficiary_id = beneficiary_id || null;
  }

  if (body.beneficiary !== undefined) {
    update.beneficiary =
      body.beneficiary !== null && typeof body.beneficiary === "object" && !Array.isArray(body.beneficiary)
        ? body.beneficiary
        : null;
  }

  if (Object.keys(update).length === 0) {
    return bad("Nothing to update.");
  }

  const { data: updated, error } = await supabaseAdmin
    .from("fundraisers")
    .update(update)
    .eq("id", id)
    .select("id, slug")
    .single();

  if (error || !updated) {
    console.error("[PATCH /api/fundraisers] update failed");
    return NextResponse.json({ error: "Could not update fundraiser." }, { status: 500 });
  }

  return NextResponse.json({ id: updated.id, slug: updated.slug });
}
