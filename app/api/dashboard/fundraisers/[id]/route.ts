import { NextRequest, NextResponse } from 'next/server';
import { getDashboardApiContext } from '@/lib/dashboard-api';
import { getDashboardFundraiserDetail } from '@/lib/dashboard-data';
import { supabaseAdmin } from '@/lib/dashboard-context';
import { deleteFundraisersWithoutPaymentRecords } from '@/lib/dashboard-delete';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await getDashboardApiContext();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const fundraiser = await getDashboardFundraiserDetail(auth.ctx.organizerIds, id, auth.ctx.userId);
  if (!fundraiser) {
    return NextResponse.json({ error: 'Fundraiser not found.' }, { status: 404 });
  }

  return NextResponse.json({ fundraiser });
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await getDashboardApiContext();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const ownerFilter =
    auth.ctx.organizerIds.length > 0
      ? `organizer_id.in.(${auth.ctx.organizerIds.join(',')}),user_id.eq.${auth.ctx.userId}`
      : `user_id.eq.${auth.ctx.userId}`;
  const { data: existing } = await supabaseAdmin
    .from('fundraisers')
    .select('id')
    .eq('id', id)
    .or(ownerFilter)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Fundraiser not found.' }, { status: 404 });
  }

  try {
    const result = await deleteFundraisersWithoutPaymentRecords([id]);
    if (result.blocked) {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete fundraiser.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
