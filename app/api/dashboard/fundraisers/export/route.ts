import { NextRequest, NextResponse } from 'next/server';
import { getDashboardApiContext } from '@/lib/dashboard-api';
import { exportFundraisersCsv, queryDashboardFundraisers } from '@/lib/dashboard-data';
import { internalError } from '@/lib/api-error';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const auth = await getDashboardApiContext();
  if (!auth.ok) return auth.response;

  // H2: full-table scans — per-user budget.
  const limited = await enforceRateLimit("dataExport", req, auth.ctx.userId);
  if (limited) return limited;

  const sp = req.nextUrl.searchParams;

  try {
    const result = await queryDashboardFundraisers({
      organizerIds: auth.ctx.organizerIds,
      userId: auth.ctx.userId,
      search: sp.get('search') ?? '',
      status: sp.get('status') ?? 'all',
      category: sp.get('category') ?? 'all',
      sort: sp.get('sort') ?? 'newest',
      page: 1,
      perPage: 10000,
    });

    const csv = exportFundraisersCsv(result.items);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="fundraisers-export.csv"',
      },
    });
  } catch (err) {
    return internalError("dashboard/fundraisers/export", err);
  }
}
