import { NextRequest, NextResponse } from 'next/server';
import { parsePageParams, type DateFilter } from '@/lib/admin-query';
import { getDashboardApiContext } from '@/lib/dashboard-api';
import { queryDashboardDonations } from '@/lib/dashboard-data';
import { supabaseAdmin } from '@/lib/dashboard-context';
import { internalError } from '@/lib/api-error';

export async function GET(req: NextRequest) {
  const auth = await getDashboardApiContext();
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const { page, perPage } = parsePageParams(sp);

  try {
    const result = await queryDashboardDonations({
      organizerIds: auth.ctx.organizerIds,
      userId: auth.ctx.userId,
      search: sp.get('search') ?? '',
      campaign: sp.get('campaign') ?? 'all',
      status: sp.get('status') ?? 'all',
      date: (sp.get('date') ?? 'all') as DateFilter,
      sort: sp.get('sort') ?? 'newest',
      page,
      perPage,
    });

    const ownerFilter =
      auth.ctx.organizerIds.length > 0
        ? `organizer_id.in.(${auth.ctx.organizerIds.join(',')}),user_id.eq.${auth.ctx.userId}`
        : `user_id.eq.${auth.ctx.userId}`;
    const { data: campaigns } = await supabaseAdmin
      .from('fundraisers')
      .select('id, title')
      .or(ownerFilter);

    return NextResponse.json({
      donations: result.items,
      stats: result.stats,
      campaigns: campaigns ?? [],
      total: result.total,
      page: result.page,
      per_page: result.per_page,
      total_pages: result.total_pages,
    });
  } catch (err) {
    return internalError("dashboard/donations", err);
  }
}
