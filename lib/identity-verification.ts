import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * User-scoped identity verification — separate from organizer_verification.
 *
 * One row per PERSON (UNIQUE on user_id), not per organizer. A person who
 * owns several organizer profiles verifies their government ID once here;
 * organizer_verification looks this up read-only rather than storing its own
 * copy (see fetchIdentityStatusForUsers below) — nothing to drift out of sync
 * because nothing is duplicated.
 */

export type IdentityVerificationStatus = {
  status: string;
  identityVerifiedAt: string | null;
};

const CLAIMING_STATUSES = new Set(["approved"]);

/** True once a person's identity is a live, standing fact — not merely on file. */
export function isIdentityVerified(fact: IdentityVerificationStatus | null): boolean {
  return Boolean(fact && CLAIMING_STATUSES.has(fact.status) && fact.identityVerifiedAt);
}

/**
 * Read-only lookup for a single user, e.g. from the identity wizard itself.
 */
export async function fetchIdentityVerificationStatus(
  client: SupabaseClient,
  userId: string | null | undefined
): Promise<IdentityVerificationStatus | null> {
  if (!userId) return null;

  const { data, error } = await client
    .from("identity_verification")
    .select("status, identity_verified_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(`[identity-verification] lookup failed for ${userId}: ${error.message}`);
    return null;
  }
  if (!data) return null;

  return { status: data.status, identityVerifiedAt: data.identity_verified_at };
}

/**
 * Batched lookup for the admin queue, which needs this fact for every
 * organizer_verification row's submitter in one page load — one query for
 * the whole page rather than one per row.
 */
export async function fetchIdentityStatusForUsers(
  client: SupabaseClient,
  userIds: readonly (string | null | undefined)[]
): Promise<Map<string, IdentityVerificationStatus>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  if (ids.length === 0) return new Map();

  const { data, error } = await client
    .from("identity_verification")
    .select("user_id, status, identity_verified_at")
    .in("user_id", ids);

  if (error) {
    console.error(`[identity-verification] batch lookup failed for ${ids.length} users: ${error.message}`);
    return new Map();
  }

  return new Map(
    (data ?? []).map((row) => [
      row.user_id as string,
      { status: row.status, identityVerifiedAt: row.identity_verified_at },
    ])
  );
}
