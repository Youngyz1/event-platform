import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { fetchIdentityStatusForUsers, isIdentityVerified } from "@/lib/identity-verification";
import VerificationQueueClient, {
  type QueueRow,
} from "./VerificationQueueClient";

/**
 * Admin verification review queue (Phase 2d, extended in Phase 1 of the
 * identity-verification split to also list identity submissions).
 *
 * Read here with the service role, decide via /api/admin/verification/* or
 * /api/admin/identity-verification/*. Both this page and those routes are
 * admin-gated independently — app/admin/layout.tsx calls requireAdmin() for
 * everything under /admin, and each route re-checks isAdmin() rather than
 * trusting that the caller came from this page.
 *
 * Documents are listed with their storage paths but NOT with URLs. A path is
 * useless on its own: the bucket has no SELECT policy, so opening a document
 * means asking /api/verification/document-url for a 60-second signed link at
 * click time. Nothing durable is ever embedded in this payload.
 */
export const dynamic = "force-dynamic";

type OrganizerVerificationRecord = {
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

type IdentityVerificationRecord = {
  id: string;
  user_id: string;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  identity_verified_at: string | null;
  created_at: string;
};

export default async function AdminVerificationPage() {
  const admin = createSupabaseAdmin();

  const [{ data: orgVerifications, error: orgError }, { data: identityVerifications, error: identityError }] =
    await Promise.all([
      admin
        .from("organizer_verification")
        .select(
          "id, user_id, organizer_id, organizer_type, subcategory, country, status, submitted_at, reviewed_at, identity_verified_at, organization_verified_at, created_at, on_behalf_of_org, on_behalf_relationship"
        )
        .order("submitted_at", { ascending: true, nullsFirst: false }),
      admin
        .from("identity_verification")
        .select("id, user_id, status, submitted_at, reviewed_at, identity_verified_at, created_at")
        .order("submitted_at", { ascending: true, nullsFirst: false }),
    ]);

  // supabase-js resolves rather than throws, so an ignored `error` here would
  // render an empty queue that looks exactly like "nothing to review".
  if (orgError || identityError) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-black text-zinc-950">Verification</h1>
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          Could not load the queue: {orgError?.message ?? identityError?.message}
        </p>
      </main>
    );
  }

  const orgRecords = (orgVerifications ?? []) as OrganizerVerificationRecord[];
  const identityRecords = (identityVerifications ?? []) as IdentityVerificationRecord[];

  const allUserIds = [
    ...orgRecords.map((r) => r.user_id),
    ...identityRecords.map((r) => r.user_id),
  ];

  const DOCUMENT_COLUMNS =
    "id, verification_id, identity_verification_id, document_type, storage_path, file_name, status, rejection_reason, uploaded_at";

  const [
    { data: organizers },
    { data: orgDocuments },
    { data: identityDocuments },
    { data: profiles },
    identityStatusByUser,
  ] = await Promise.all([
    admin
      .from("organizers")
      .select("id, name, slug, status")
      .in("id", orgRecords.map((r) => r.organizer_id)),
    admin
      .from("verification_documents")
      .select(DOCUMENT_COLUMNS)
      .in("verification_id", orgRecords.map((r) => r.id)),
    admin
      .from("verification_documents")
      .select(DOCUMENT_COLUMNS)
      .in("identity_verification_id", identityRecords.map((r) => r.id)),
    admin.from("profiles").select("id, display_name").in("id", allUserIds),
    // Read-only cross-reference for organizer rows: "is this submitter's
    // identity already verified elsewhere" — never stored on
    // organizer_verification itself, looked up fresh every page load so
    // there is nothing to drift out of sync.
    fetchIdentityStatusForUsers(admin, orgRecords.map((r) => r.user_id)),
  ]);

  const organizerById = new Map((organizers ?? []).map((o) => [o.id, o]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const allDocuments = [...(orgDocuments ?? []), ...(identityDocuments ?? [])];

  const organizerRows: QueueRow[] = orgRecords.map((record) => {
    const organizer = organizerById.get(record.organizer_id);
    const profile = profileById.get(record.user_id);
    const identityStatus = identityStatusByUser.get(record.user_id) ?? null;
    return {
      kind: "organizer",
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
      submitterIdentityVerified: isIdentityVerified(identityStatus),
      submitterIdentityStatus: identityStatus?.status ?? null,
      documents: allDocuments
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

  const identityRows: QueueRow[] = identityRecords.map((record) => {
    const profile = profileById.get(record.user_id);
    return {
      kind: "identity",
      id: record.id,
      // Reused as the row's primary display name for both kinds — an
      // identity submission has no organizer to name, so this is the
      // submitter's own display name instead.
      organizerName: profile?.display_name ?? "Unnamed user",
      status: record.status,
      submitterName: profile?.display_name ?? null,
      submittedAt: record.submitted_at,
      reviewedAt: record.reviewed_at,
      identityVerifiedAt: record.identity_verified_at,
      createdAt: record.created_at,
      documents: allDocuments
        .filter((doc) => doc.identity_verification_id === record.id)
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

  const rows = [...organizerRows, ...identityRows].sort((a, b) => {
    const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return aTime - bTime;
  });

  return <VerificationQueueClient rows={rows} />;
}
