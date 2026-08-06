export const CAMPAIGN_CATEGORIES = [
  "Medical",
  "Memorial",
  "Emergency",
  "Charity",
  "Education",
  "Animal",
  "Environment",
  "Business",
  "Community",
  "Competition",
  "Creative",
  "Event",
  "Faith",
  "Family",
  "Sports",
  "Travel",
  "Volunteer",
  "Wishes",
  "Other",
] as const;

export type CampaignCategory = (typeof CAMPAIGN_CATEGORIES)[number];

/** Every category is a single word, so lowercasing is a safe, unambiguous slug. */
export function categoryToSlug(category: CampaignCategory): string {
  return category.toLowerCase();
}

export function categoryFromSlug(slug: string): CampaignCategory | null {
  const normalized = slug.toLowerCase();
  return CAMPAIGN_CATEGORIES.find((cat) => cat.toLowerCase() === normalized) ?? null;
}
