import { NextRequest, NextResponse } from 'next/server';
import { type DateFilter } from '@/lib/admin-query';
import { getDashboardApiContext } from '@/lib/dashboard-api';
import { exportDonationsCsv, queryDashboardDonations } from '@/lib/dashboard-data';
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
    const result = await queryDashboardDonations({
      organizerIds: auth.ctx.organizerIds,
      userId: auth.ctx.userId,
      search: sp.get('search') ?? '',
      campaign: sp.get('campaign') ?? 'all',
      status: sp.get('status') ?? 'all',
      date: (sp.get('date') ?? 'all') as DateFilter,
      sort: sp.get('sort') ?? 'newest',
      page: 1,
      perPage: 10000,
    });

    const csv = exportDonationsCsv(result.items);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="donations-export.csv"',
      },
    });
  } catch (err) {
    return internalError("dashboard/donations/export", err);
  }
}
