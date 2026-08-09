import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  evaluateSubmission,
  fetchRequirements,
  type DocumentRecord,
  type OrganizerType,
} from "@/lib/verification-requirements";

/**
 * Submit a verification for review.
 *
 * This is the one rule in the feature that RLS cannot express: "every required
 * document has an upload" depends on the requirement engine resolving rules for
 * this organizer's type/subcategory/country, which is application logic.
 *
 * So this route is a real security boundary — but a shallow one, on purpose.
 * The status write below still goes through the caller's session client, so
 * migration_59's WITH CHECK confines the reachable states to draft/submitted.
 * If the completeness gate were bypassed entirely, the worst outcome is an
 * INCOMPLETE submission landing in the review queue — not an approved one. The
 * gate protects reviewers' time; RLS protects the trust boundary.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { verificationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const verificationId = body.verificationId?.trim();
  if (!verificationId) {
    return NextResponse.json({ error: "verificationId is required." }, { status: 400 });
  }

  // Read through the session client: RLS returns nothing for someone else's
  // verification, so a wrong id is indistinguishable from a missing one.
  const { data: verification } = await supabase
    .from("organizer_verification")
    .select("id, user_id, organizer_type, subcategory, country, status")
    .eq("id", verificationId)
    .maybeSingle();

  if (!verification) {
    return NextResponse.json({ error: "Verification not found." }, { status: 404 });
  }

  // Belt and braces. RLS already scopes the read, but this route must never
  // depend on that alone for a decision it is about to act on.
  if (verification.user_id !== user.id) {
    return NextResponse.json({ error: "Verification not found." }, { status: 404 });
  }

  if (!["draft", "changes_requested"].includes(verification.status)) {
    return NextResponse.json(
      { error: "This verification has already been submitted." },
      { status: 409 }
    );
  }

  const { data: documents } = await supabase
    .from("verification_documents")
    .select("document_type, status")
    .eq("verification_id", verificationId);

  const requirements = await fetchRequirements(supabase, {
    organizerType: verification.organizer_type as OrganizerType,
    subcategory: verification.subcategory,
    country: verification.country,
  });

  const readiness = evaluateSubmission(
    requirements,
    (documents ?? []) as DocumentRecord[]
  );

  if (!readiness.canSubmit) {
    return NextResponse.json(
      {
        error: "Some required documents are still missing.",
        missing: readiness.missingRequired,
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("organizer_verification")
    .update({ status: "submitted", submitted_at: now, updated_at: now })
    .eq("id", verificationId)
    .select("id, status, submitted_at")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? "Could not submit for review." },
      { status: 403 }
    );
  }

  /**
   * Audit event — the ONLY service-role write in this route.
   *
   * verification_events has no INSERT policy for any user role by design: the
   * trail is written by the system, never by the subject of the review. That
   * makes the service role genuinely necessary here, unlike everything above.
   *
   * Best-effort: the submission has already succeeded, and failing the request
   * now would tell the organizer their submission did not go through when it
   * did. Logged loudly instead.
   */
  const admin = createSupabaseAdmin();
  const { error: eventError } = await admin.from("verification_events").insert({
    verification_id: verificationId,
    actor_id: user.id,
    action: "submitted",
  });
  if (eventError) {
    console.error(
      `[verification] submitted ${verificationId} but audit event failed: ${eventError.message}`
    );
  }

  return NextResponse.json({ verification: updated });
}
