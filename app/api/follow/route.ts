import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabaseServer = await createSupabaseServer();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "You must be signed in to follow someone." },
      { status: 401 }
    );
  }

  // ── Payload validation ────────────────────────────────────────────────────
  const payload = await req.json().catch(() => null);
  const targetUserId: string | undefined = payload?.userId;

  if (!targetUserId || !uuidPattern.test(targetUserId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_target", message: "A valid user ID is required." },
      { status: 400 }
    );
  }

  // ── Self-follow guard ─────────────────────────────────────────────────────
  if (user.id === targetUserId) {
    return NextResponse.json(
      { ok: false, error: "self_follow", message: "You cannot follow yourself." },
      { status: 400 }
    );
  }

  const supabaseAdmin = createSupabaseAdmin();

  // ── Toggle follow / unfollow ──────────────────────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();

  let following: boolean;

  if (existing) {
    // Already following → unfollow
    await supabaseAdmin
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId);
    following = false;
  } else {
    // Not following → follow
    await supabaseAdmin
      .from("follows")
      .insert({ follower_id: user.id, following_id: targetUserId });
    following = true;
  }

  // ── Return updated follower count ─────────────────────────────────────────
  const { count } = await supabaseAdmin
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", targetUserId);

  return NextResponse.json({
    ok: true,
    following,
    followerCount: count ?? 0,
  });
}
