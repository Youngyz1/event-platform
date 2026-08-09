import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Admin decision on an identity verification submission.
 *
 * Separate route from /api/admin/verification/review by design, not a branch
 * of it: that route's approval-readiness check goes through
 * evaluateSubmission/fetchRequirements because organizer requirements vary by
 * type/subcategory/country. Identity verification has exactly one document
 * type that never varies, so "ready to approve" is just "the government_id
 * document was accepted" — forcing both cases through one function would be
 * the same kind of force-fit the wizard also avoids by not reusing the
 * organizer-type requirement engine.
 *
 * Same trust model as the organizer route: this genuinely IS the security
 * boundary, since a reviewer writes columns no user policy permits. Runs with
 * the service role; RLS is not a backstop here, every check below is load
 * bearing.
 *
 * Actions: approve | reject | request_changes | suspend
 */

const ACTIONS = ["approve", "reject", "request_changes", "suspend"] as const;
type Action = (typeof ACTIONS)[number];

const REASON_REQUIRED: Action[] = ["reject", "request_changes", "suspend"];

const NEXT_STATUS: Record<Action, string> = {
  approve: "approved",
  reject: "rejected",
  request_changes: "changes_requested",
  suspend: "suspended",
};

const EVENT_ACTION: Record<Action, string> = {
  approve: "approved",
  reject: "rejected",
  request_changes: "changes_requested",
  suspend: "suspended",
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    identityVerificationId?: string;
    action?: string;
    reason?: string;
    note?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const identityVerificationId = body.identityVerificationId?.trim();
  const action = body.action?.trim() as Action | undefined;
  const reason = body.reason?.trim() || null;

  if (!identityVerificationId || !action || !ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: "An identity verification and valid action are required." },
      { status: 400 }
    );
  }

  if (REASON_REQUIRED.includes(action) && !reason) {
    return NextResponse.json(
      { error: "A reason is required when rejecting, requesting changes or suspending." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdmin();

  const { data: verification } = await admin
    .from("identity_verification")
    .select("id, user_id, status")
    .eq("id", identityVerificationId)
    .maybeSingle();

  if (!verification) {
    return NextResponse.json({ error: "Identity verification not found." }, { status: 404 });
  }

  /**
   * Approval requires the government_id document to have been individually
   * accepted — not merely uploaded. Same reasoning as the organizer route:
   * approving on upload alone means the platform vouches for a document
   * nobody actually opened.
   */
  if (action === "approve") {
    const { data: documents } = await admin
      .from("verification_documents")
      .select("status")
      .eq("identity_verification_id", identityVerificationId);

    const accepted = (documents ?? []).some((d) => d.status === "accepted");
    if (!accepted) {
      return NextResponse.json(
        { error: "The government ID must be accepted before approving." },
        { status: 400 }
      );
    }
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: NEXT_STATUS[action],
    reviewed_at: now,
    reviewed_by: user.id,
    updated_at: now,
  };

  if (action === "approve") {
    update.identity_verified_at = now;
  }

  const { data: updated, error: updateError } = await admin
    .from("identity_verification")
    .update(update)
    .eq("id", identityVerificationId)
    .select("id, status, identity_verified_at")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? "Could not record the decision." },
      { status: 500 }
    );
  }

  // Append-only trail, same pattern as the organizer review route: internal
  // notes go in metadata, which migration_63/64 keep unreadable to the
  // submitter (column-restricted grant + the same exclusion now covers
  // identity-linked events too).
  await admin.from("verification_events").insert({
    identity_verification_id: identityVerificationId,
    actor_id: user.id,
    action: EVENT_ACTION[action],
    reason,
    metadata: body.note ? { internal_note: body.note } : {},
  });

  return NextResponse.json({ verification: updated });
}
