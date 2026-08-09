import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reads the small set of verification facts that are safe to show a donor.
 *
 * Deliberately narrow. `organizer_verification` also holds country,
 * subcategory, reviewer id and review timestamps, none of which is any of a
 * donor's business — so this selects the four columns it needs by name rather
 * than `*`, and returns a shape that cannot carry anything else outward.
 *
 * Three facts, kept separate on purpose (see VerificationFacts):
 *   - identity verified   — this human is who they say they are
 *   - organization verified — this body exists and they may act for it
 *   - campaign reviewed   — this specific campaign passed admin review
 *
 * The third is NOT stored here. It has existed since migration 41 as
 * `fundraisers.status = 'published'`, and callers pass it in.
 */

export type VerificationFacts = {
  /** Null when the organizer never started verification. */
  organizerType: string | null;
  identityVerified: boolean;
  /** Individuals have no organization to verify — distinct from "not yet". */
  organizationApplicable: boolean;
  organizationVerified: boolean;
};

/**
 * Used when the organizer's type is genuinely unknown (never started
 * verification, no organizer id, or a failed lookup) — NOT for a confirmed
 * individual. `organizationApplicable: true` here so the row reads "not yet
 * verified" rather than falsely asserting "no organization to verify"; a
 * confirmed individual gets `organizationApplicable: false` from the real
 * data branch below instead.
 */
export const NO_VERIFICATION: VerificationFacts = {
  organizerType: null,
  identityVerified: false,
  organizationApplicable: true,
  organizationVerified: false,
};

/**
 * A verification that was approved and later suspended or rejected must stop
 * asserting anything, even though the stamps from the original approval are
 * still on the row — they are kept as history, not as a live claim.
 */
const CLAIMING_STATUSES = new Set(["approved"]);

export async function fetchVerificationFacts(
  client: SupabaseClient,
  organizerId: string | null | undefined
): Promise<VerificationFacts> {
  if (!organizerId) return NO_VERIFICATION;

  const { data, error } = await client
    .from("organizer_verification")
    .select("organizer_type, status, identity_verified_at, organization_verified_at")
    .eq("organizer_id", organizerId)
    .maybeSingle();

  // supabase-js resolves with {error} rather than throwing. Swallowing it here
  // would silently downgrade a verified organizer to unverified, which is the
  // safe direction but hides a real fault, so it is logged.
  if (error) {
    console.error(`[verification-facts] lookup failed for ${organizerId}: ${error.message}`);
    return NO_VERIFICATION;
  }
  if (!data) return NO_VERIFICATION;

  const claiming = CLAIMING_STATUSES.has(data.status);
  const organizationApplicable = data.organizer_type !== "individual";

  return {
    organizerType: data.organizer_type ?? null,
    identityVerified: claiming && Boolean(data.identity_verified_at),
    organizationApplicable,
    organizationVerified:
      claiming && organizationApplicable && Boolean(data.organization_verified_at),
  };
}
