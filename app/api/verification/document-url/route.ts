import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { isAdmin } from "@/lib/auth";
import { VERIFICATION_BUCKET } from "@/lib/uploads";

/**
 * Mints a short-lived signed URL for one verification document.
 *
 * This is the ONLY way anything in the private bucket becomes readable. The
 * bucket has no SELECT policy at all, so neither anon nor authenticated can
 * read or list an object directly — not even its owner. Reads therefore cannot
 * bypass the authorisation below, and there is no second path to audit later.
 *
 * Authorised for exactly two callers:
 *   - the document's owner, determined by the first path segment
 *   - an active admin, via the same isAdmin() used across /api/admin
 *
 * The URL expires in 60 seconds: long enough to open, short enough that a
 * leaked link from a log or referrer is worthless.
 */

const SIGNED_URL_TTL_SECONDS = 60;

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { path?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const path = body.path?.trim();
  if (!path) {
    return NextResponse.json({ error: "A document path is required." }, { status: 400 });
  }

  /**
   * Reject traversal and absolute paths before they reach storage.
   *
   * Ownership is decided by the first path segment, so a path containing ".."
   * could otherwise be crafted to pass the ownership check while resolving
   * somewhere else.
   */
  if (path.includes("..") || path.startsWith("/") || path.includes("\\")) {
    return NextResponse.json({ error: "Invalid document path." }, { status: 400 });
  }

  const [ownerId, ...rest] = path.split("/");
  if (!ownerId || rest.length === 0) {
    return NextResponse.json({ error: "Invalid document path." }, { status: 400 });
  }

  const isOwner = ownerId === user.id;
  const callerIsAdmin = isOwner ? false : await isAdmin();

  if (!isOwner && !callerIsAdmin) {
    // Same response either way — a caller cannot distinguish "not yours" from
    // "does not exist", so this cannot be used to probe which paths are real.
    return NextResponse.json({ error: "Not found." }, { status: 403 });
  }

  // Service role: the bucket has no SELECT policy, so only this key can sign.
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(VERIFICATION_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "Could not generate a link for that document." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    expiresInSeconds: SIGNED_URL_TTL_SECONDS,
  });
}
