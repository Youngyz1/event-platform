/**
 * lib/dashboard-context.ts
 * Uses React's per-request cache() so getCurrentUser() and the organizer
 * lookup run ONCE per request, no matter how many layout/page server
 * components call this function.
 *
 * Without this: layout + every sub-page each independently hit Supabase
 * for auth + organizer → 2 extra round-trips per page load.
 * With this: those calls are deduped to a single round-trip per request.
 */

import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUser } from '@/lib/auth';

// Module-level client — instantiated once at cold-start, not per-request
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type DashboardContext = {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  organizers: { id: string; name: string; bio?: string | null; photo?: string | null; slug?: string | null; org_type?: string | null; status?: string | null }[];
  organizer: { id: string; name: string; bio?: string | null; photo?: string | null; slug?: string | null; org_type?: string | null; status?: string | null } | null;
  organizerIds: string[];
  organizerId: string | null;
  /**
   * The beneficiary profile this user has claimed, if any.
   *
   * A claimed beneficiary is a real account with no organizer of their own, so
   * without this the dashboard sees them as a user with nothing and sends them
   * to the organizer view. `isBeneficiaryOnly` is what routing should key on.
   */
  beneficiary: {
    id: string;
    name: string | null;
    slug: string | null;
    photo: string | null;
  } | null;
  /** Claimed a beneficiary profile and runs no organizer of their own. */
  isBeneficiaryOnly: boolean;
};

/**
 * Returns the current user and all organizer profiles owned by them.
 * Cached per-request by React — safe to call from both layout and page
 * without duplicating DB queries.
 */
export const getDashboardContext = cache(async (): Promise<DashboardContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("deleted_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.deleted_at) return null;

  // Both lookups depend only on user.id, so they run together rather than
  // adding a second round-trip for the beneficiary check.
  const [{ data: organizers }, { data: beneficiary }] = await Promise.all([
    supabaseAdmin
      .from('organizers')
      .select('id, name, bio, photo, slug, org_type, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('beneficiaries')
      .select('id, name, slug, photo')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle(),
  ]);

  const safeOrganizers = organizers ?? [];
  const primaryOrganizer = safeOrganizers[0] ?? null;

  return {
    user,
    organizers: safeOrganizers,
    organizer: primaryOrganizer,
    organizerIds: safeOrganizers.map((organizer) => organizer.id),
    organizerId: primaryOrganizer?.id ?? null,
    beneficiary: beneficiary ?? null,
    // Someone who runs campaigns AND has claimed a beneficiary profile keeps
    // the organizer dashboard — it is the larger surface, and the beneficiary
    // view remains reachable at /dashboard/beneficiary.
    isBeneficiaryOnly: Boolean(beneficiary) && safeOrganizers.length === 0,
  };
});

// Re-export supabaseAdmin so pages can import it from one place
export { supabaseAdmin };
