/**
 * app/api/admin/users/route.ts
 * GET — returns all profiles joined with auth user emails.
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

  // Fetch all profiles
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, status, created_at')
    .order('created_at', { ascending: false });

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  // Fetch auth users to get emails (service role required)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const emailMap = new Map(authData.users.map((u) => [u.id, u.email ?? '']));

  const users = (profiles ?? []).map((p) => ({
    ...p,
    email: emailMap.get(p.id) ?? '',
  }));

  return NextResponse.json({ users });
}
