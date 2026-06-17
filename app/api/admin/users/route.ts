/**
 * app/api/admin/users/route.ts
 * GET — returns all auth users joined with profile role/status.
 * Admin-only: checks isAdmin() before any DB operation.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/lib/auth';

// Service role: bypasses RLS — admin operations only
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [profilesResult, authUsersResult, organizersResult, eventsResult] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, role, status, created_at, account_info'),
    listAllAuthUsers(),
    supabaseAdmin
      .from('organizers')
      .select('id, user_id'),
    supabaseAdmin
      .from('events')
      .select('id, organizer_id'),
  ]);

  if (profilesResult.error) {
    return NextResponse.json({ error: profilesResult.error.message }, { status: 500 });
  }
  if (organizersResult.error) {
    return NextResponse.json({ error: organizersResult.error.message }, { status: 500 });
  }
  if (eventsResult.error) {
    return NextResponse.json({ error: eventsResult.error.message }, { status: 500 });
  }

  if (authUsersResult.error) {
    return NextResponse.json({ error: authUsersResult.error }, { status: 500 });
  }

  const profileMap = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, profile])
  );
  const organizerOwnerMap = new Map(
    (organizersResult.data ?? []).map((organizer) => [organizer.id, organizer.user_id])
  );
  const organizerCounts = new Map<string, number>();
  for (const organizer of organizersResult.data ?? []) {
    organizerCounts.set(organizer.user_id, (organizerCounts.get(organizer.user_id) ?? 0) + 1);
  }

  const eventCounts = new Map<string, number>();
  for (const event of eventsResult.data ?? []) {
    const ownerId = event.organizer_id ? organizerOwnerMap.get(event.organizer_id) : undefined;
    if (ownerId) eventCounts.set(ownerId, (eventCounts.get(ownerId) ?? 0) + 1);
  }

  const users = authUsersResult.users
    .map((authUser) => {
      const profile = profileMap.get(authUser.id);
      const accountInfo = (profile?.account_info ?? {}) as {
        firstName?: string;
        lastName?: string;
      };
      const metadata = authUser.user_metadata ?? {};
      const fullName =
        [accountInfo.firstName, accountInfo.lastName].filter(Boolean).join(' ').trim() ||
        String(metadata.display_name ?? metadata.full_name ?? metadata.name ?? '').trim() ||
        authUser.email?.split('@')[0] ||
        'User';

      return {
        id: authUser.id,
        full_name: fullName,
        email: authUser.email ?? '',
        role: profile?.role ?? 'user',
        status: profile?.status ?? 'active',
        organizer_count: organizerCounts.get(authUser.id) ?? 0,
        event_count: eventCounts.get(authUser.id) ?? 0,
        created_at: profile?.created_at ?? authUser.created_at,
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ users });
}

async function listAllAuthUsers() {
  const perPage = 1000;
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) return { users: [], error: error.message };

    users.push(...(data.users ?? []));
    if ((data.users ?? []).length < perPage) break;
    page += 1;
  }

  return { users, error: null };
}
