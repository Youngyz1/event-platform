/**
 * app/api/admin/fundraisers/[id]/route.ts
 * PATCH — update fundraiser is_featured flag and/or backdate created_at.
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

const TEN_YEARS_MS = 10 * 365.25 * 24 * 60 * 60 * 1000;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json()) as {
    is_featured?: boolean;
    created_at?: string;
  };

  if (body.is_featured === undefined && body.created_at === undefined) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (body.is_featured !== undefined) {
    update.is_featured = body.is_featured;
    update.featured_until = body.is_featured
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;
  }

  if (body.created_at !== undefined) {
    const parsed = new Date(body.created_at);
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Invalid date format for created_at.' }, { status: 400 });
    }
    const now = Date.now();
    if (parsed.getTime() > now) {
      return NextResponse.json({ error: 'created_at cannot be in the future.' }, { status: 400 });
    }
    if (now - parsed.getTime() > TEN_YEARS_MS) {
      return NextResponse.json({ error: 'created_at cannot be more than 10 years in the past.' }, { status: 400 });
    }
    update.created_at = parsed.toISOString();
  }

  const { error } = await supabaseAdmin
    .from('fundraisers')
    .update(update)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, fundraiser: update });
}
