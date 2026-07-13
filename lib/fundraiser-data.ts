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
