/**
 * app/api/admin/organizers/route.ts
 * GET — returns all organizers with their owner's email.
 * Admin-only.
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

  const { data: organizers, error } = await supabaseAdmin
    .from('organizers')
    .select('id, name, user_id, status, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Attach owner emails
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
  const emailMap = new Map((authData?.users ?? []).map((u) => [u.id, u.email ?? '']));

  const result = (organizers ?? []).map((o) => ({
    ...o,
    email: emailMap.get(o.user_id) ?? '',
  }));

  return NextResponse.json({ organizers: result });
}
