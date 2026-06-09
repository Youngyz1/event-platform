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

  const [profilesResult, authUsersResult] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, role, status, created_at'),
    listAllAuthUsers(),
  ]);

  if (profilesResult.error) {
    return NextResponse.json({ error: profilesResult.error.message }, { status: 500 });
  }

  if (authUsersResult.error) {
    return NextResponse.json({ error: authUsersResult.error }, { status: 500 });
  }

  const profileMap = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, profile])
  );

  const users = authUsersResult.users
    .map((authUser) => {
      const profile = profileMap.get(authUser.id);

      return {
        id: authUser.id,
        email: authUser.email ?? '',
        role: profile?.role ?? 'user',
        status: profile?.status ?? 'active',
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
