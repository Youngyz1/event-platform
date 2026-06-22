import { NextRequest, NextResponse } from 'next/server';
import { getDashboardApiContext } from '@/lib/dashboard-api';
import { getDashboardFundraiserDetail } from '@/lib/dashboard-data';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await getDashboardApiContext();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const fundraiser = await getDashboardFundraiserDetail(auth.ctx.organizerIds, id);
  if (!fundraiser) {
    return NextResponse.json({ error: 'Fundraiser not found.' }, { status: 404 });
  }

  return NextResponse.json({ fundraiser });
}
