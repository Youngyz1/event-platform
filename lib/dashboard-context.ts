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
  organizer: { id: string; name: string } | null;
  organizerId: string | null;
};

/**
 * Returns the current user and their organizer profile.
 * Cached per-request by React — safe to call from both layout and page
 * without duplicating DB queries.
 */
export const getDashboardContext = cache(async (): Promise<DashboardContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: organizer } = await supabaseAdmin
    .from('organizers')
    .select('id, name')
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    user,
    organizer: organizer ?? null,
    organizerId: organizer?.id ?? null,
  };
});

// Re-export supabaseAdmin so pages can import it from one place
export { supabaseAdmin };
