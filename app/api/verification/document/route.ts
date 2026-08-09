import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * Record a document that has already been uploaded to the private bucket.
 *
 * The bytes go straight from the browser to storage via uploadPrivateDocument,
 * where the bucket's INSERT policy pins the path to the caller's own folder.
 * This route only writes the metadata row.
 *
 * Session client again, so migration_59's policy stays live: the caller must
 * own the verification, it must be in draft/changes_requested, and status must
 * be 'pending' — an owner cannot mark their own document accepted.
 *
 * The one check RLS cannot express is the path-ownership check below. A caller
 * could otherwise attach a storage_path pointing at ANOTHER user's folder:
 * harmless for reading, since the signed-URL route re-derives ownership from
 * the path itself, but it would let someone plant a reference to a file they do
 * not own and have a reviewer open it as if it were theirs.
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
    verificationId?: string;
    documentType?: string;
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

  const verificationId = body.verificationId?.trim();
  const documentType = body.documentType?.trim();
  const storagePath = body.storagePath?.trim();

  if (!verificationId || !documentType || !storagePath) {
    return NextResponse.json(
      { error: "verificationId, documentType and storagePath are required." },
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

  // The path must live in the caller's own folder. Mirrors the storage INSERT
  // policy so the metadata row cannot disagree with where the bytes actually
  // are.
  const [ownerSegment, ...rest] = storagePath.split("/");
  if (ownerSegment !== user.id || rest.length === 0) {
    return NextResponse.json({ error: "Invalid document path." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("verification_documents")
    .insert({
      verification_id: verificationId,
      document_type: documentType,
      storage_path: storagePath,
      file_name: body.fileName ?? null,
      mime_type: body.mimeType ?? null,
      size_bytes: body.sizeBytes ?? null,
      uploaded_by: user.id,
      // Explicit rather than relying on the column default: the RLS INSERT
      // policy requires status='pending', and stating it makes the intent
      // legible next to that policy.
      status: "pending",
    })
    .select("id, document_type, status, storage_path, uploaded_at")
    .maybeSingle();

  if (error) {
    // Not your verification, or it is no longer editable.
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (!data) {
    return NextResponse.json({ error: "Could not attach document." }, { status: 403 });
  }

  return NextResponse.json({ document: data });
}
