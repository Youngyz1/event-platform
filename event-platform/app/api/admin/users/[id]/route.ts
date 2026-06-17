/**
 * app/api/admin/users/[id]/route.ts
 * PATCH — update a user's status (active | suspended).
 * Admin-only: checks isAdmin() before any DB operation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/lib/auth';

// Service role: bypasses RLS — admin operations only
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body   = await req.json();
  const { status } = body as { status?: string };

  if (!status || !['active', 'suspended'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status value.' }, { status: 400 });
  }

  const { data: updatedProfile, error } = await supabaseAdmin
    .from('profiles')
    .update({ status })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!updatedProfile) {
    const { error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({ id, status, role: 'user' });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, id, status });
}
