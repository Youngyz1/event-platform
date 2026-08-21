import { createSupabaseAdmin } from "@/lib/supabase-admin";

export interface PerFundraiserStat {
  fundraiser_id: string;
  title: string;
  slug: string | null;
  banner: string | null;
  donationCount: number;
  subtotal: number;
}

export interface DonorStats {
  totalDonated: number;
  donationCount: number;
  fundraiserIds: string[];
  perFundraiser: PerFundraiserStat[];
}

/**
 * Reusable helper to compute donor stats and per-fundraiser breakdown for a user.
 * Queries the public_donation_activity view which filters for valid completed/succeeded donations.
 */
export async function getDonorStats(userId: string): Promise<DonorStats> {
  const emptyResult: DonorStats = {
    totalDonated: 0,
    donationCount: 0,
    fundraiserIds: [],
    perFundraiser: [],
  };

  if (!userId) return emptyResult;

  const supabaseAdmin = createSupabaseAdmin();

  const { data: rows, error } = await supabaseAdmin
    .from("public_donation_activity")
    .select(
      "id, user_id, fundraiser_id, amount, created_at, fundraiser_title, fundraiser_slug, fundraiser_banner"
    )
    .eq("user_id", userId);

  if (error || !rows || rows.length === 0) {
    if (error) {
      console.error("[getDonorStats] Error fetching public_donation_activity:", error.message);
    }
    return emptyResult;
  }

  let totalDonated = 0;
  const fundraiserMap = new Map<string, PerFundraiserStat>();

  for (const row of rows) {
    const amt = Number(row.amount ?? 0);
    totalDonated += amt;

    const existing = fundraiserMap.get(row.fundraiser_id);
    if (existing) {
      existing.donationCount += 1;
      existing.subtotal += amt;
    } else {
      fundraiserMap.set(row.fundraiser_id, {
        fundraiser_id: row.fundraiser_id,
        title: row.fundraiser_title ?? "Fundraiser",
        slug: row.fundraiser_slug ?? null,
        banner: row.fundraiser_banner ?? null,
        donationCount: 1,
        subtotal: amt,
      });
    }
  }

  const perFundraiser = Array.from(fundraiserMap.values());
  const fundraiserIds = perFundraiser.map((pf) => pf.fundraiser_id);

  return {
    totalDonated: Math.round(totalDonated * 100) / 100,
    donationCount: rows.length,
    fundraiserIds,
    perFundraiser,
  };
}
