import { cache } from "react";

import { normalizeImageUrl } from "@/lib/image-url";
import { supabase } from "@/lib/supabase";

export const FUNDRAISER_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1529390079861-591de354faf5?q=80&w=1600&auto=format&fit=crop";

type OptionalFundraiserFields = {
  description?: string | null;
  goal_amount?: number | string | null;
  short_description?: string | null;
  beneficiary?: string | null;
  beneficiary_name?: string | null;
};

const OPTIONAL_FUNDRAISER_FIELDS = [
  "description",
  "goal_amount",
  "short_description",
  "beneficiary",
  "beneficiary_name",
] as const;

/** Deduplicated cache helper for querying fundraiser details. */
export const getFundraiserBySlug = cache(async (slug: string) => {
  const { data: fundraiser } = await supabase
    .from("fundraisers")
    .select(
      "id, title, slug, banner, image_url, goal, raised, raised_amount, organizer_id, organizer, story, category, created_at, review_count, average_rating"
    )
    .eq("slug", slug)
    .maybeSingle();
  return fundraiser;
});

export const getOptionalFundraiserFields = cache(async (fundraiserId: string) => {
  const { data, error } = await supabase
    .from("fundraisers")
    .select(OPTIONAL_FUNDRAISER_FIELDS.join(", "))
    .eq("id", fundraiserId)
    .maybeSingle();

  if (error || !data) {
    return Object.fromEntries(
      OPTIONAL_FUNDRAISER_FIELDS.map((f) => [f, null])
    ) as OptionalFundraiserFields;
  }
  return data as unknown as OptionalFundraiserFields;
});

/**
 * Lightweight summary used for generated share/OG imagery — just the display
 * strings and numbers, not the profile IDs `page.tsx` resolves separately for
 * linking the organizer/beneficiary.
 */
export async function getFundraiserCardData(slug: string) {
  const fundraiser = await getFundraiserBySlug(slug);
  if (!fundraiser) return null;

  const optionalFundraiser = await getOptionalFundraiserFields(fundraiser.id);

  const { data: organizer } = fundraiser.organizer_id
    ? await supabase
        .from("organizers")
        .select("id, name")
        .eq("id", fundraiser.organizer_id)
        .maybeSingle()
    : { data: null };

  const organizerName =
    organizer?.name || fundraiser.organizer || "Campaign organizer";

  const beneficiaryName: string =
    optionalFundraiser.beneficiary ||
    optionalFundraiser.beneficiary_name ||
    fundraiser.title ||
    "This Cause";

  const coverImage = normalizeImageUrl(
    fundraiser.image_url || fundraiser.banner,
    FUNDRAISER_FALLBACK_IMAGE
  );

  const raised = Number(fundraiser.raised_amount ?? fundraiser.raised ?? 0);
  const goal = Number(optionalFundraiser.goal_amount ?? fundraiser.goal ?? 0);
  const percentage =
    goal > 0 ? Math.min(Math.round((raised / goal) * 100), 100) : 0;

  return {
    title: fundraiser.title as string,
    organizerName,
    beneficiaryName,
    coverImage,
    raised,
    goal,
    percentage,
  };
}

export type FundraiserCardData = NonNullable<
  Awaited<ReturnType<typeof getFundraiserCardData>>
>;

export type RelatedFundraiser = {
  id: string;
  title: string;
  slug: string;
  banner: string | null;
  image_url: string | null;
  organizer: string | null;
  goal: number | string | null;
  raised: number | string | null;
  raised_amount: number | string | null;
};

export type RelatedFundraiserCategory =
  | "worldwide"
  | "close-to-target"
  | "just-launched"
  | "needs-momentum"
  | "charities";

type RelatedFundraiserCandidate = {
  id: string;
  goal: number | string | null;
  raised: number | string | null;
  raised_amount: number | string | null;
  created_at: string | null;
  category: string | null;
};

const CLOSE_TO_TARGET_RATIO = 0.95;
const JUST_LAUNCHED_MAX_AGE_DAYS = 2;
// A fundraiser needs time to gather donations before "low raised/goal ratio"
// means anything — a campaign that's a day old at 0% isn't struggling, it
// just started. A week seems like a reasonable point past which a low ratio
// starts to actually signal stalled momentum rather than just being new.
const NEEDS_MOMENTUM_MIN_AGE_DAYS = 7;
const CHARITY_CATEGORY_VALUE = "Charity";

function fundraiserRatio(row: RelatedFundraiserCandidate): number {
  const goal = Number(row.goal ?? 0);
  if (goal <= 0) return 0;
  return Number(row.raised_amount ?? row.raised ?? 0) / goal;
}

function fundraiserAgeDays(row: RelatedFundraiserCandidate): number {
  if (!row.created_at) return 0;
  return (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24);
}

function shuffledIds(rows: RelatedFundraiserCandidate[]): string[] {
  const ids = rows.map((row) => row.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

function pickIdsForCategory(
  candidates: RelatedFundraiserCandidate[],
  category: RelatedFundraiserCategory,
  count: number
): string[] {
  switch (category) {
    case "close-to-target":
      return candidates
        .filter((row) => fundraiserRatio(row) >= CLOSE_TO_TARGET_RATIO)
        .sort((a, b) => fundraiserRatio(b) - fundraiserRatio(a))
        .slice(0, count)
        .map((row) => row.id);
    case "just-launched":
      return candidates
        .filter((row) => fundraiserAgeDays(row) <= JUST_LAUNCHED_MAX_AGE_DAYS)
        .sort((a, b) => fundraiserAgeDays(a) - fundraiserAgeDays(b))
        .slice(0, count)
        .map((row) => row.id);
    case "needs-momentum":
      return candidates
        .filter((row) => fundraiserAgeDays(row) >= NEEDS_MOMENTUM_MIN_AGE_DAYS)
        .sort((a, b) => fundraiserRatio(a) - fundraiserRatio(b))
        .slice(0, count)
        .map((row) => row.id);
    case "charities":
      return candidates
        .filter((row) => row.category === CHARITY_CATEGORY_VALUE)
        .slice(0, count)
        .map((row) => row.id);
    case "worldwide":
    default:
      return shuffledIds(candidates).slice(0, count);
  }
}

/**
 * Selection of other fundraisers for the "More ways to make a difference"
 * section — excludes the current fundraiser, refreshed on every call (no
 * caching). Supports 5 view categories via the `category` param, matching
 * the section's filter dropdown; "worldwide" (the default) is the original
 * random selection.
 *
 * Still two queries, not N, for every category: fetch every *other*
 * fundraiser's lightweight filtering columns (id, goal, raised, created_at,
 * category — cheap, no per-row work), pick/sort/filter in JS, then one
 * targeted `.in(...)` fetch for just the picked rows' full display columns.
 * This is the exact shape of query this codebase got burned by before
 * avoiding — getOptionalEventFields firing one query *per row* (22 queries,
 * ~51s) is the pattern being guarded against here, and this stays two total
 * round trips regardless of how many fundraisers exist or which category is
 * selected, not one round trip per card or per filter.
 *
 * A single SQL function (`ORDER BY random() LIMIT n` for "worldwide", a
 * `WHERE`/`ORDER BY` per other category) would be the more "textbook"
 * single-round-trip version of this — genuinely worth doing if this ever
 * needs applying against a live database, since fetching all rows with no
 * filter/status column (checked: none exists on this table) is simplest for
 * now given the table's actual size (11 rows in dev, and this platform's
 * realistic active-fundraiser count).
 */
export async function getRelatedFundraisers(
  excludeId: string,
  count = 10,
  category: RelatedFundraiserCategory = "worldwide"
): Promise<RelatedFundraiser[]> {
  const { data: candidateRows } = await supabase
    .from("fundraisers")
    .select("id, goal, raised, raised_amount, created_at, category")
    .neq("id", excludeId);

  const candidates = (candidateRows ?? []) as RelatedFundraiserCandidate[];
  if (candidates.length === 0) return [];

  const pickedIds = pickIdsForCategory(candidates, category, count);
  if (pickedIds.length === 0) return [];

  const { data } = await supabase
    .from("fundraisers")
    .select(
      "id, title, slug, banner, image_url, organizer, goal, raised, raised_amount"
    )
    .in("id", pickedIds);

  // `.in(...)` doesn't preserve row order, so re-sort to match the
  // category-specific ranking computed above (closest-to-target first,
  // newest first, etc.) rather than whatever order Postgres returns.
  const rowsById = new Map(
    ((data ?? []) as RelatedFundraiser[]).map((row) => [row.id, row])
  );
  return pickedIds
    .map((id) => rowsById.get(id))
    .filter((row): row is RelatedFundraiser => Boolean(row));
}
