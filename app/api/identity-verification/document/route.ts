import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * Record a government-ID document that has already been uploaded to the
 * private bucket, against the caller's own identity verification.
 *
 * Mirrors app/api/verification/document/route.ts exactly, except the row it
 * writes points at identity_verification_id instead of verification_id (the
 * two are mutually exclusive per migration_64's CHECK constraint). The bytes
 * still go straight from the browser to storage via uploadPrivateDocument —
 * this route only writes the metadata row, and only ever one row, since
 * identity verification has exactly one document type.
 *
 * Session client again, so migration_64's policy stays live: the caller must
 * own the identity_verification row, it must be in draft/changes_requested,
 * and status must be 'pending' — an owner cannot mark their own document
 * accepted.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: {
    identityVerificationId?: string;
    storagePath?: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const identityVerificationId = body.identityVerificationId?.trim();
  const storagePath = body.storagePath?.trim();

  if (!identityVerificationId || !storagePath) {
    return NextResponse.json(
      { error: "identityVerificationId and storagePath are required." },
      { status: 400 }
    );
  }

  // Reject traversal before anything else looks at the path.
  if (
    storagePath.includes("..") ||
    storagePath.startsWith("/") ||
    storagePath.includes("\\")
  ) {
    return NextResponse.json({ error: "Invalid document path." }, { status: 400 });
  }

  // The path must live in the caller's own folder — mirrors the storage
  // INSERT policy so the metadata row cannot disagree with where the bytes
  // actually are.
  const [ownerSegment, ...rest] = storagePath.split("/");
  if (ownerSegment !== user.id || rest.length === 0) {
    return NextResponse.json({ error: "Invalid document path." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("verification_documents")
    .insert({
      identity_verification_id: identityVerificationId,
      document_type: "government_id",
      storage_path: storagePath,
      file_name: body.fileName ?? null,
      mime_type: body.mimeType ?? null,
      size_bytes: body.sizeBytes ?? null,
      uploaded_by: user.id,
      status: "pending",
    })
    .select("id, document_type, status, storage_path, uploaded_at")
    .maybeSingle();

  if (error) {
    // Not your identity verification, or it is no longer editable.
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (!data) {
    return NextResponse.json({ error: "Could not attach document." }, { status: 403 });
  }

  return NextResponse.json({ document: data });
}
