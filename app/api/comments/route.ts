import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TargetType = "event" | "fundraiser";

function isTargetType(value: string | null): value is TargetType {
  return value === "event" || value === "fundraiser";
}

function targetTable(targetType: TargetType) {
  return targetType === "event" ? "events" : "fundraisers";
}

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

async function targetExists(targetType: TargetType, targetId: string) {
  const { data, error } = await supabaseAdmin
    .from(targetTable(targetType))
    .select("id")
    .eq("id", targetId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetType = searchParams.get("targetType");
  const targetId = searchParams.get("targetId") || "";

  if (!isTargetType(targetType) || !uuidPattern.test(targetId)) {
    return NextResponse.json({ error: "Invalid comment target." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("comments")
    .select("id, author_name, body, created_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comments: data || [] });
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);

  if (!payload) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const targetType = cleanText(payload.targetType);
  const targetId = cleanText(payload.targetId);
  const authorName = cleanText(payload.authorName, "Anonymous").slice(0, 120) || "Anonymous";
  const authorEmail = cleanText(payload.authorEmail).slice(0, 255) || null;
  const body = cleanText(payload.body);

  if (!isTargetType(targetType) || !uuidPattern.test(targetId)) {
    return NextResponse.json({ error: "Invalid comment target." }, { status: 400 });
  }

  if (body.length < 2 || body.length > 1000) {
    return NextResponse.json(
      { error: "Comments must be between 2 and 1000 characters." },
      { status: 400 }
    );
  }

  try {
    const exists = await targetExists(targetType, targetId);

    if (!exists) {
      return NextResponse.json({ error: "This page no longer exists." }, { status: 404 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify comment target.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("comments")
    .insert({
      target_type: targetType,
      target_id: targetId,
      author_name: authorName,
      author_email: authorEmail,
      body,
      status: "approved",
    })
    .select("id, author_name, body, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comment: data }, { status: 201 });
}
