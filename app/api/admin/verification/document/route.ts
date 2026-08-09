import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Accept or reject a single verification document — organizer OR identity.
 *
 * Not split into two routes: this operation never depended on which kind of
 * submission the document belongs to (organizer_verification vs
 * identity_verification) — it always just read/wrote one
 * verification_documents row by id. The only place that distinction ever
 * mattered is the audit-event insert at the bottom, which now branches on
 * whichever of the two parent FKs is set (migration_64's exactly-one-parent
 * constraint guarantees exactly one is).
 *
 * Per-document rather than all-or-nothing: a submission is usually right in
 * parts, and telling someone "something was wrong" without saying which
 * document forces them to re-upload everything.
 *
 * Service role, so this route is the boundary — see the note in ../review.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { documentId?: string; action?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const documentId = body.documentId?.trim();
  const action = body.action?.trim();
  const reason = body.reason?.trim() || null;

  if (!documentId || (action !== "accept" && action !== "reject")) {
    return NextResponse.json(
      { error: "A document and an accept/reject action are required." },
      { status: 400 }
    );
  }

  // Rejecting without a reason leaves the organizer guessing what to fix.
  if (action === "reject" && !reason) {
    return NextResponse.json(
      { error: "A reason is required when rejecting a document." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdmin();

  const { data: document } = await admin
    .from("verification_documents")
    .select("id, verification_id, identity_verification_id, document_type")
    .eq("id", documentId)
    .maybeSingle();

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("verification_documents")
    .update({
      status: action === "accept" ? "accepted" : "rejected",
      rejection_reason: action === "reject" ? reason : null,
      reviewed_by: user.id,
      reviewed_at: now,
    })
    .eq("id", documentId)
    .select("id, document_type, status, rejection_reason")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "Could not update the document." },
      { status: 500 }
    );
  }

  await admin.from("verification_events").insert({
    verification_id: document.verification_id,
    identity_verification_id: document.identity_verification_id,
    actor_id: user.id,
    action: action === "accept" ? "document_accepted" : "document_rejected",
    reason,
    metadata: { document_type: document.document_type, document_id: documentId },
  });

  return NextResponse.json({ document: updated });
}
