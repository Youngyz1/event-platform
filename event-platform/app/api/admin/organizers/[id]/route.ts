/**
 * app/api/admin/organizers/[id]/route.ts
 * PATCH — update organizer status (pending | verified | rejected | suspended).
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

const VALID_STATUSES = ['pending', 'verified', 'rejected', 'suspended'] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { status } = (await req.json()) as { status?: string };

  if (!status || !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ error: 'Invalid status value.' }, { status: 400 });
  }

  const update: Record<string, unknown> = { status };
  if (status === 'verified') {
    update.verified_at = new Date().toISOString();
  }

  const { error } = await supabaseAdmin
    .from('organizers')
    .update(update)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id, status });
}
