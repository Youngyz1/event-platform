import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Submit an identity verification for review.
 *
 * Mirrors app/api/verification/submit/route.ts's shape and reasoning exactly,
 * shrunk to match the simpler shape: there is exactly one required document
 * (government_id), so "ready to submit" is just "has anything been
 * uploaded" — no requirement engine needed, unlike the organizer route which
 * must resolve type/subcategory/country-dependent rules. Same trust model:
 * this route is a shallow gate (protects reviewers' time), RLS is the real
 * boundary (migration_64's WITH CHECK confines the reachable states).
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { identityVerificationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const identityVerificationId = body.identityVerificationId?.trim();
  if (!identityVerificationId) {
    return NextResponse.json({ error: "identityVerificationId is required." }, { status: 400 });
  }

  // Read through the session client: RLS returns nothing for someone else's
  // verification, so a wrong id is indistinguishable from a missing one.
  const { data: verification } = await supabase
    .from("identity_verification")
    .select("id, user_id, status")
    .eq("id", identityVerificationId)
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
    .select("id")
    .eq("identity_verification_id", identityVerificationId)
    .limit(1);

  if (!documents || documents.length === 0) {
    return NextResponse.json(
      { error: "Upload a government-issued ID before submitting." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("identity_verification")
    .update({ status: "submitted", submitted_at: now, updated_at: now })
    .eq("id", identityVerificationId)
    .select("id, status, submitted_at")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? "Could not submit for review." },
      { status: 403 }
    );
  }

  // Best-effort audit event, same reasoning as the organizer route: the
  // submission already succeeded, so a logging failure here must not tell the
  // person their submission didn't go through when it did.
  const admin = createSupabaseAdmin();
  const { error: eventError } = await admin.from("verification_events").insert({
    identity_verification_id: identityVerificationId,
    actor_id: user.id,
    action: "submitted",
  });
  if (eventError) {
    console.error(
      `[identity-verification] submitted ${identityVerificationId} but audit event failed: ${eventError.message}`
    );
  }

  return NextResponse.json({ verification: updated });
}
