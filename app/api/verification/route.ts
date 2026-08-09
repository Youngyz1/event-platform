import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { ORGANIZER_TYPES, type OrganizerType } from "@/lib/verification-requirements";

/**
 * Create or update the caller's draft verification for one organizer.
 *
 * DELIBERATELY USES THE CALLER'S SESSION CLIENT, not the service role.
 *
 * Every rule this route depends on is already enforced by RLS (migration_59):
 * the row must belong to the caller, the organizer must be theirs, creation is
 * confined to status='draft', and updates are confined to
 * draft/changes_requested -> draft/submitted. Running as the user means those
 * policies stay live rather than being bypassed, so a mistake in this file
 * degrades to a 4xx instead of a privilege escalation.
 *
 * Service role would have made this route the ONLY thing standing between a
 * caller and their own approval. It isn't.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: {
    organizerId?: string;
    organizerType?: string;
    subcategory?: string | null;
    country?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const organizerId = body.organizerId?.trim();
  const organizerType = body.organizerType?.trim();

  if (!organizerId || !organizerType) {
    return NextResponse.json(
      { error: "An organizer and organizer type are required." },
      { status: 400 }
    );
  }

  if (!ORGANIZER_TYPES.includes(organizerType as OrganizerType)) {
    return NextResponse.json({ error: "Unknown organizer type." }, { status: 400 });
  }

  // Normalised so the requirement lookup matches the seeded rules, which are
  // lowercase. An uppercase country would otherwise silently miss its rules.
  const subcategory = body.subcategory?.trim().toLowerCase() || null;
  const country = body.country?.trim().toUpperCase() || null;

  // upsert on the unique organizer_id: re-running the wizard edits the existing
  // draft rather than failing on a duplicate.
  //
  // `status` is NOT included. On insert the column defaults to 'draft'; on
  // update, omitting it means a submitted row keeps its status even if this
  // route is replayed. Writing 'draft' here would silently un-submit a
  // verification that was already under review.
  const { data, error } = await supabase
    .from("organizer_verification")
    .upsert(
      {
        organizer_id: organizerId,
        user_id: user.id,
        organizer_type: organizerType,
        subcategory,
        country,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organizer_id" }
    )
    .select("id, status, organizer_type, subcategory, country")
    .maybeSingle();

  if (error) {
    // RLS refusals land here: not your organizer, or the row is past the point
    // where you may edit it.
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (!data) {
    return NextResponse.json({ error: "Could not save verification." }, { status: 403 });
  }

  return NextResponse.json({ verification: data });
}
