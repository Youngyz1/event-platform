import { redirect } from "next/navigation";
import { getDashboardContext, supabaseAdmin } from "@/lib/dashboard-context";
import type { RequirementRow } from "@/lib/verification-requirements";
import VerificationWizard from "./VerificationWizard";

/**
 * Organizer verification onboarding (Phase 2c-i).
 *
 * Type selection and requirement preview only. Upload and submit are 2c-ii —
 * this slice deliberately writes nothing.
 *
 * Every requirement row is fetched once here and resolved client-side as the
 * user changes their selection. The table is small configuration data, so
 * shipping it whole avoids a round-trip on every click and keeps the preview
 * instant. Nothing in it is sensitive — the RLS policy on
 * verification_requirements is a public read for exactly this reason.
 */
export default async function VerificationPage() {
  const context = await getDashboardContext();
  if (!context) redirect("/login?redirect=/dashboard/verification");

  const { data } = await supabaseAdmin
    .from("verification_requirements")
    .select(
      "organizer_type, subcategory, country, document_type, is_required, label, description, sort_order"
    );

  return (
    <VerificationWizard
      requirementRows={(data ?? []) as RequirementRow[]}
      // Passed from the session rather than read client-side: it becomes the
      // storage path prefix, and the bucket's RLS policy requires that prefix
      // to equal auth.uid(). Deriving it here keeps the two in step.
      userId={context.user.id}
      organizers={context.organizers.map((organizer) => ({
        id: organizer.id,
        name: organizer.name,
      }))}
    />
  );
}
