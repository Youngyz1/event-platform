import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  evaluateSubmission,
  fetchRequirements,
  type DocumentRecord,
  type OrganizerType,
} from "@/lib/verification-requirements";

/**
 * Admin decision on a verification submission.
 *
 * UNLIKE the organizer-facing routes, this one genuinely IS the security
 * boundary. Those could run as the caller because RLS already expressed every
 * rule they needed; a reviewer has to write columns no user policy permits
 * (approval status, verified-at stamps, organizers.status), so it runs with the
 * service role and RLS is NOT a backstop here. Every check below is load
 * bearing.
 *
 * Actions: approve | reject | request_changes | suspend
 */

const ACTIONS = ["approve", "reject", "request_changes", "suspend"] as const;
type Action = (typeof ACTIONS)[number];

/** Rejecting or asking for changes without saying why is unactionable. */
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
    verificationId?: string;
    action?: string;
    reason?: string;
    note?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const verificationId = body.verificationId?.trim();
  const action = body.action?.trim() as Action | undefined;
  const reason = body.reason?.trim() || null;

  if (!verificationId || !action || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: "A verification and valid action are required." }, { status: 400 });
  }

  if (REASON_REQUIRED.includes(action) && !reason) {
    return NextResponse.json(
      { error: "A reason is required when rejecting, requesting changes or suspending." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdmin();

  const { data: verification } = await admin
    .from("organizer_verification")
    .select("id, organizer_id, organizer_type, subcategory, country, status")
    .eq("id", verificationId)
    .maybeSingle();

  if (!verification) {
    return NextResponse.json({ error: "Verification not found." }, { status: 404 });
  }

  /**
   * Approval requires every REQUIRED document to have been individually
   * accepted — `allRequiredAccepted`, not `canSubmit`.
   *
   * canSubmit only means the organizer uploaded something. Approving on that
   * basis would mean the platform vouches for documents nobody opened, which is
   * the precise failure this whole feature exists to prevent. A reviewer who
   * wants to approve must first accept each document.
   */
  if (action === "approve") {
    const { data: documents } = await admin
      .from("verification_documents")
      .select("document_type, status")
      .eq("verification_id", verificationId);

    const requirements = await fetchRequirements(admin, {
      organizerType: verification.organizer_type as OrganizerType,
      subcategory: verification.subcategory,
      country: verification.country,
    });

    const readiness = evaluateSubmission(requirements, (documents ?? []) as DocumentRecord[]);

    if (!readiness.allRequiredAccepted) {
      const outstanding = readiness.requirements
        .filter((r) => r.isRequired && r.status !== "accepted")
        .map((r) => r.documentType);
      return NextResponse.json(
        {
          error: "Every required document must be accepted before approving.",
          outstanding,
        },
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

  /**
   * Identity and organization verification are stamped SEPARATELY and only on
   * approval. They are different claims — "this human is who they say" versus
   * "this body exists and they may act for it" — and an individual organizer
   * has no organization to verify, so that stamp stays null for them.
   */
  if (action === "approve") {
    update.identity_verified_at = now;
    if (verification.organizer_type !== "individual") {
      update.organization_verified_at = now;
    }
  }

  const { data: updated, error: updateError } = await admin
    .from("organizer_verification")
    .update(update)
    .eq("id", verificationId)
    .select("id, status, identity_verified_at, organization_verified_at")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? "Could not record the decision." },
      { status: 500 }
    );
  }

  /**
   * organizers.status is the OUTCOME, set here and nowhere else.
   *
   * It stayed deliberately untouched through migrations 59-61 because the
   * public directory filters on it. This is the one place a review result is
   * allowed to move it, which keeps "what the directory shows" downstream of
   * "what a reviewer decided" rather than the two drifting apart.
   */
  const organizerStatus =
    action === "approve" ? "verified" : action === "suspend" ? "suspended" : null;

  if (organizerStatus) {
    const { error: orgError } = await admin
      .from("organizers")
      .update({ status: organizerStatus, verified_at: action === "approve" ? now : null })
      .eq("id", verification.organizer_id);
    if (orgError) {
      console.error(
        `[verification] decision recorded for ${verificationId} but organizer status update failed: ${orgError.message}`
      );
    }
  }

  // Append-only trail. Internal notes go in metadata, never in a column the
  // organizer can read.
  await admin.from("verification_events").insert({
    verification_id: verificationId,
    actor_id: user.id,
    action: EVENT_ACTION[action],
    reason,
    metadata: body.note ? { internal_note: body.note } : {},
  });

  return NextResponse.json({ verification: updated });
}
