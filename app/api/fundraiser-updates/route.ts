import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { internalError } from "@/lib/api-error";
import { sanitizePlainText, sanitizeRichTextHtml } from "@/lib/sanitize-html";
import { enforceRateLimit } from "@/lib/rate-limit";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  // H2: owner edits are cheap but unbounded automation is not.
  const limited = await enforceRateLimit("fundraiserUpdate", request, user.id);
  if (limited) return limited;

  const payload = await request.json().catch(() => null);
  const fundraiserId = cleanText(payload?.fundraiser_id);
  // C2: server-side sanitization before persistence. The client editor
  // validates links, but any caller can POST here directly, so raw HTML must
  // never reach the database. Titles are plain text; content keeps the shared
  // rich-text allow-list (dangerous schemes/attributes removed).
  const title = sanitizePlainText(payload?.title, 200);
  const content = sanitizeRichTextHtml(payload?.content);

  if (!uuidPattern.test(fundraiserId)) {
    return NextResponse.json({ error: "Invalid fundraiser." }, { status: 400 });
  }

  if (content.length < 20) {
    return NextResponse.json(
      { error: "Update content must be at least 20 characters." },
      { status: 400 }
    );
  }

  const { data: fundraiser, error: fundraiserError } = await supabaseAdmin
    .from("fundraisers")
    .select("id, user_id, organizer_id")
    .eq("id", fundraiserId)
    .maybeSingle();

  if (fundraiserError) {
    return internalError("fundraiser-updates", fundraiserError);
  }

  if (!fundraiser) {
    return NextResponse.json({ error: "You do not own this fundraiser." }, { status: 403 });
  }

  let owns = fundraiser.user_id === user.id;

  if (!owns && fundraiser.organizer_id) {
    const { data: organizer, error: organizerError } = await supabaseAdmin
      .from("organizers")
      .select("id")
      .eq("id", fundraiser.organizer_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (organizerError) {
      return internalError("fundraiser-updates/org", organizerError);
    }

    owns = Boolean(organizer);
  }

  if (!owns) {
    return NextResponse.json({ error: "You do not own this fundraiser." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("fundraiser_updates")
    .insert({
      fundraiser_id: fundraiserId,
      organizer_id: fundraiser.organizer_id,
      title: title || null,
      content,
    })
    .select("id, title, content, created_at")
    .single();

  if (error) {
    return internalError("fundraiser-updates", error);
  }

  return NextResponse.json({ update: data }, { status: 201 });
}
