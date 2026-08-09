import { redirect } from "next/navigation";
import { getDashboardContext, supabaseAdmin } from "@/lib/dashboard-context";
import type { DocumentRecord } from "@/lib/verification-requirements";
import IdentityVerificationWizard from "./IdentityVerificationWizard";

/**
 * User identity verification (Phase 1 of the organizer/identity split).
 *
 * Deliberately not linked from anywhere yet — per the task this shipped
 * under, the dashboard nav entry point is a separate, later step. This route
 * just needs to exist and work when visited directly.
 *
 * Minimal by design: one document type (government_id), no organizer-type
 * selection, no subcategory/country branching — unlike
 * app/dashboard/verification, there is nothing here that varies per person,
 * so this does not fetch or resolve verification_requirements at all.
 */
export default async function IdentityVerificationPage() {
  const context = await getDashboardContext();
  if (!context) redirect("/login?redirect=/dashboard/identity-verification");

  const { data: verification } = await supabaseAdmin
    .from("identity_verification")
    .select("id, status")
    .eq("user_id", context.user.id)
    .maybeSingle();

  let documents: DocumentRecord[] = [];
  if (verification) {
    const { data } = await supabaseAdmin
      .from("verification_documents")
      .select("document_type, status")
      .eq("identity_verification_id", verification.id);
    documents = (data ?? []) as DocumentRecord[];
  }

  return (
    <IdentityVerificationWizard
      userId={context.user.id}
      initialVerificationId={verification?.id ?? null}
      initialStatus={verification?.status ?? "draft"}
      initialHasDocument={documents.length > 0}
    />
  );
}
