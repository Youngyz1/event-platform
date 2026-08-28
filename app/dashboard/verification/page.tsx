import { redirect } from "next/navigation";
import { getDashboardContext, supabaseAdmin } from "@/lib/dashboard-context";
import type { DocumentRecord, RequirementRow } from "@/lib/verification-requirements";
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
export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ organizerId?: string }>;
}) {
  const context = await getDashboardContext();
  if (!context) redirect("/login?redirect=/dashboard/verification");

  const { organizerId } = await searchParams;
  const ownedOrganizerIds = new Set(context.organizers.map((organizer) => organizer.id));
  const selectedOrganizerId =
    organizerId && ownedOrganizerIds.has(organizerId)
      ? organizerId
      : context.organizers[0]?.id ?? "";

  const [requirementsResult, verificationResult] = await Promise.all([
    supabaseAdmin
      .from("verification_requirements")
      .select(
        "organizer_type, subcategory, country, document_type, is_required, label, description, sort_order"
      ),
    selectedOrganizerId
      ? supabaseAdmin
          .from("organizer_verification")
          .select(
            "id, organizer_id, organizer_type, subcategory, country, status, on_behalf_of_org, on_behalf_relationship"
          )
          .eq("organizer_id", selectedOrganizerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let documents: DocumentRecord[] = [];
  if (verificationResult.data?.id) {
    const { data: documentRows } = await supabaseAdmin
      .from("verification_documents")
      .select("document_type, status")
      .eq("verification_id", verificationResult.data.id);
    documents = (documentRows ?? []) as DocumentRecord[];
  }

  return (
    <VerificationWizard
      requirementRows={(requirementsResult.data ?? []) as RequirementRow[]}
      // Passed from the session rather than read client-side: it becomes the
      // storage path prefix, and the bucket's RLS policy requires that prefix
      // to equal auth.uid(). Deriving it here keeps the two in step.
      userId={context.user.id}
      organizers={context.organizers.map((organizer) => ({
        id: organizer.id,
        name: organizer.name,
      }))}
      selectedOrganizerId={selectedOrganizerId}
      initialVerification={verificationResult.data ?? null}
      initialDocuments={documents}
    />
  );
}
