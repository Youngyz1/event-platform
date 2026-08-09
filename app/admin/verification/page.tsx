import { createSupabaseAdmin } from "@/lib/supabase-admin";
import VerificationQueueClient, {
  type QueueRow,
} from "./VerificationQueueClient";

/**
 * Admin verification review queue (Phase 2d).
 *
 * Read here with the service role, decide via /api/admin/verification/*. Both
 * this page and those routes are admin-gated independently — app/admin/layout.tsx
 * calls requireAdmin() for everything under /admin, and each route re-checks
 * isAdmin() rather than trusting that the caller came from this page.
 *
 * Documents are listed with their storage paths but NOT with URLs. A path is
 * useless on its own: the bucket has no SELECT policy, so opening a document
 * means asking /api/verification/document-url for a 60-second signed link at
 * click time. Nothing durable is ever embedded in this payload.
 */
export const dynamic = "force-dynamic";

type VerificationRecord = {
  id: string;
  user_id: string;
  organizer_id: string;
  organizer_type: string;
  subcategory: string | null;
  country: string | null;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  identity_verified_at: string | null;
  organization_verified_at: string | null;
  created_at: string;
  on_behalf_of_org: boolean;
  on_behalf_relationship: string | null;
};

export default async function AdminVerificationPage() {
  const admin = createSupabaseAdmin();

  const { data: verifications, error } = await admin
    .from("organizer_verification")
    .select(
      "id, user_id, organizer_id, organizer_type, subcategory, country, status, submitted_at, reviewed_at, identity_verified_at, organization_verified_at, created_at, on_behalf_of_org, on_behalf_relationship"
    )
    .order("submitted_at", { ascending: true, nullsFirst: false });

  // supabase-js resolves rather than throws, so an ignored `error` here would
  // render an empty queue that looks exactly like "nothing to review".
  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-black text-zinc-950">Verification</h1>
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          Could not load the queue: {error.message}
        </p>
      </main>
    );
  }

  const records = (verifications ?? []) as VerificationRecord[];

  const [{ data: organizers }, { data: documents }, { data: profiles }] =
    await Promise.all([
      admin
        .from("organizers")
        .select("id, name, slug, status")
        .in("id", records.map((r) => r.organizer_id)),
      admin
        .from("verification_documents")
        .select(
          "id, verification_id, document_type, storage_path, file_name, status, rejection_reason, uploaded_at"
        )
        .in("verification_id", records.map((r) => r.id)),
      admin
        .from("profiles")
        .select("id, display_name")
        .in("id", records.map((r) => r.user_id)),
    ]);

  const organizerById = new Map((organizers ?? []).map((o) => [o.id, o]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const rows: QueueRow[] = records.map((record) => {
    const organizer = organizerById.get(record.organizer_id);
    const profile = profileById.get(record.user_id);
    return {
      id: record.id,
      organizerId: record.organizer_id,
      organizerName: organizer?.name ?? "Unknown organizer",
      organizerSlug: organizer?.slug ?? null,
      organizerStatus: organizer?.status ?? null,
      organizerType: record.organizer_type,
      subcategory: record.subcategory,
      country: record.country,
      status: record.status,
      submitterName: profile?.display_name ?? null,
      submittedAt: record.submitted_at,
      reviewedAt: record.reviewed_at,
      identityVerifiedAt: record.identity_verified_at,
      organizationVerifiedAt: record.organization_verified_at,
      createdAt: record.created_at,
      onBehalfOfOrg: record.on_behalf_of_org,
      onBehalfRelationship: record.on_behalf_relationship,
      documents: (documents ?? [])
        .filter((doc) => doc.verification_id === record.id)
        .map((doc) => ({
          id: doc.id,
          documentType: doc.document_type,
          storagePath: doc.storage_path,
          fileName: doc.file_name,
          status: doc.status,
          rejectionReason: doc.rejection_reason,
          uploadedAt: doc.uploaded_at,
        })),
    };
  });

  return <VerificationQueueClient rows={rows} />;
}
