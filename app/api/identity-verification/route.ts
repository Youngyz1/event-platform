import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * Create or update the caller's own draft identity verification.
 *
 * Mirrors app/api/verification/route.ts exactly, minus the organizer fields:
 * no organizerId, no organizerType, no subcategory/country. Identity is one
 * row per person, not per organizer, so there is nothing to select — the
 * caller's own auth.uid() IS the key (identity_verification.user_id UNIQUE).
 *
 * DELIBERATELY USES THE CALLER'S SESSION CLIENT, not the service role, same
 * reasoning as the organizer route: every rule this depends on is already
 * enforced by RLS (migration_64) — the row must belong to the caller, and
 * updates are confined to draft/changes_requested -> draft/submitted. Running
 * as the user keeps those policies live rather than bypassed.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // upsert on the unique user_id: re-running the wizard edits the existing
  // draft rather than failing on a duplicate.
  //
  // `status` is NOT included, same reasoning as the organizer route: on
  // insert the column defaults to 'draft'; on update, omitting it means a
  // submitted row keeps its status even if this route is replayed.
  const { data, error } = await supabase
    .from("identity_verification")
    .upsert(
      {
        user_id: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("id, status")
    .maybeSingle();

  if (error) {
    // RLS refusals land here: the row is past the point where you may edit it.
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (!data) {
    return NextResponse.json({ error: "Could not save identity verification." }, { status: 403 });
  }

  return NextResponse.json({ verification: data });
}
