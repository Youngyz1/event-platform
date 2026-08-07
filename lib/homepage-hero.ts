export type HomepageSettings = {
  imageUrl: string;
  eyebrow: string;
  headlineLine1: string;
  headlineLine2: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonHref: string;
  secondaryButtonText: string;
  secondaryButtonHref: string;
  seoTitle: string;
  seoDescription: string;
  seoOgImageUrl: string;
  // Fundraisers landing
  fundraisersHeroImageUrl: string;
  fundraisersHeroEyebrow: string;
  fundraisersHeroHeadlineLine1: string;
  fundraisersHeroHeadlineLine2: string;
  fundraisersHeroDescription: string;
  /** Ordered hero photo-fan image URLs (max 5), admin-managed. */
  fundraisersHeroImages: string[];
  // Organizers landing
  organizersHeroImageUrl: string;
  organizersHeroEyebrow: string;
  organizersHeroHeadlineLine1: string;
  organizersHeroHeadlineLine2: string;
  organizersHeroDescription: string;
};

// Legacy type alias for safety
export type HomepageHeroSettings = HomepageSettings;

export const DEFAULT_HOMEPAGE_SETTINGS: HomepageSettings = {
  imageUrl:
    "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1800&auto=format&fit=crop",
  eyebrow: "FUNDRAISING • COMMUNITY",
  headlineLine1: "Raise Funds.",
  headlineLine2: "Support Causes.",
  title: "Raise Funds.",
  subtitle: "FUNDRAISING • COMMUNITY",
  buttonText: "Browse Fundraisers",
  buttonHref: "/campaigns",
  secondaryButtonText: "Start a Fundraiser",
  secondaryButtonHref: "/create-fundraiser",
  seoTitle: "Fund4Good — Support Causes, Start a Fundraiser",
  seoDescription: "Discover fundraisers and support causes that matter.",
  seoOgImageUrl:
    "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1800&auto=format&fit=crop",
  // Fundraisers landing defaults
  fundraisersHeroImageUrl: "https://images.unsplash.com/photo-1529390079861-591de354faf5?q=80&w=1800&auto=format&fit=crop",
  fundraisersHeroEyebrow: "COMMUNITY FUNDRAISING",
  fundraisersHeroHeadlineLine1: "Support Causes That Matter",
  fundraisersHeroHeadlineLine2: "",
  fundraisersHeroDescription: "Help communities, charities, and individuals reach their goals.",
  fundraisersHeroImages: [],
  // Organizers defaults
  organizersHeroImageUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=1800&auto=format&fit=crop",
  organizersHeroEyebrow: "ORGANIZER DIRECTORY",
  organizersHeroHeadlineLine1: "Meet Event Creators",
  organizersHeroHeadlineLine2: "",
  organizersHeroDescription: "Discover trusted organizers building amazing experiences.",
};

export const DEFAULT_HOMEPAGE_HERO = DEFAULT_HOMEPAGE_SETTINGS;

export const HOMEPAGE_SETTING_KEYS = [
  "homepage_hero_image_url",
  "homepage_hero_eyebrow",
  "homepage_hero_headline_line_1",
  "homepage_hero_headline_line_2",
  "homepage_hero_title",
  "homepage_hero_subtitle",
  "homepage_hero_button_text",
  "homepage_hero_button_href",
  "homepage_hero_secondary_button_text",
  "homepage_hero_secondary_button_href",
  "homepage_seo_title",
  "homepage_seo_description",
  "homepage_seo_og_image_url",
  // Fundraisers Landing keys
  "fundraisers_hero_image_url",
  "fundraisers_hero_eyebrow",
  "fundraisers_hero_headline_line_1",
  "fundraisers_hero_headline_line_2",
  "fundraisers_hero_description",
  "fundraisers_hero_images",
  // Organizers Landing keys
  "organizers_hero_image_url",
  "organizers_hero_eyebrow",
  "organizers_hero_headline_line_1",
  "organizers_hero_headline_line_2",
  "organizers_hero_description",
] as const;

export const HOMEPAGE_HERO_SETTING_KEYS = HOMEPAGE_SETTING_KEYS;

export const MAX_HERO_FAN_IMAGES = 5;

/**
 * Parse the stored `fundraisers_hero_images` value (a JSON array of URLs) into a
 * sanitized, capped list. Anything malformed collapses to an empty list so a
 * bad value can never crash the hero.
 */
export function parseHeroImages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      .map((u) => u.trim())
      .slice(0, MAX_HERO_FAN_IMAGES);
  } catch {
    return [];
  }
}

export function getHomepageSettings(
  rows: { key: string; value: string | null }[] | null | undefined
): HomepageSettings {
  const settings = { ...DEFAULT_HOMEPAGE_SETTINGS };
  const dbSettings: Record<string, string> = {};

  for (const row of rows ?? []) {
    if (row.value !== null && row.value !== undefined) {
      dbSettings[row.key] = row.value.trim();
    }
  }

  // Bind homepage hero values
  if (dbSettings.homepage_hero_image_url) settings.imageUrl = dbSettings.homepage_hero_image_url;
  if (dbSettings.homepage_hero_eyebrow) settings.eyebrow = dbSettings.homepage_hero_eyebrow;
  if (dbSettings.homepage_hero_headline_line_1) settings.headlineLine1 = dbSettings.homepage_hero_headline_line_1;
  if (dbSettings.homepage_hero_headline_line_2) settings.headlineLine2 = dbSettings.homepage_hero_headline_line_2;
  
  settings.title = dbSettings.homepage_hero_title || settings.headlineLine1 || "Raise Funds.";
  settings.subtitle = dbSettings.homepage_hero_subtitle || settings.eyebrow || "FUNDRAISING • COMMUNITY";

  if (dbSettings.homepage_hero_button_text) settings.buttonText = dbSettings.homepage_hero_button_text;
  if (dbSettings.homepage_hero_button_href) settings.buttonHref = dbSettings.homepage_hero_button_href;

  settings.secondaryButtonText = dbSettings.homepage_hero_secondary_button_text ?? "Start a Fundraiser";
  settings.secondaryButtonHref = dbSettings.homepage_hero_secondary_button_href ?? "/create-fundraiser";

  // SEO settings
  settings.seoTitle = dbSettings.homepage_seo_title || "Fund4Good — Support Causes, Start a Fundraiser";
  settings.seoDescription = dbSettings.homepage_seo_description || "Discover fundraisers and support causes that matter.";
  settings.seoOgImageUrl = dbSettings.homepage_seo_og_image_url || settings.imageUrl;

  // Bind Fundraisers Landing values
  if (dbSettings.fundraisers_hero_image_url) settings.fundraisersHeroImageUrl = dbSettings.fundraisers_hero_image_url;
  if (dbSettings.fundraisers_hero_eyebrow) settings.fundraisersHeroEyebrow = dbSettings.fundraisers_hero_eyebrow;
  if (dbSettings.fundraisers_hero_headline_line_1) settings.fundraisersHeroHeadlineLine1 = dbSettings.fundraisers_hero_headline_line_1;
  if (dbSettings.fundraisers_hero_headline_line_2 !== undefined) settings.fundraisersHeroHeadlineLine2 = dbSettings.fundraisers_hero_headline_line_2;
  if (dbSettings.fundraisers_hero_description) settings.fundraisersHeroDescription = dbSettings.fundraisers_hero_description;
  settings.fundraisersHeroImages = parseHeroImages(dbSettings.fundraisers_hero_images);

  // Bind Organizers Landing values
  if (dbSettings.organizers_hero_image_url) settings.organizersHeroImageUrl = dbSettings.organizers_hero_image_url;
  if (dbSettings.organizers_hero_eyebrow) settings.organizersHeroEyebrow = dbSettings.organizers_hero_eyebrow;
  if (dbSettings.organizers_hero_headline_line_1) settings.organizersHeroHeadlineLine1 = dbSettings.organizers_hero_headline_line_1;
  if (dbSettings.organizers_hero_headline_line_2 !== undefined) settings.organizersHeroHeadlineLine2 = dbSettings.organizers_hero_headline_line_2;
  if (dbSettings.organizers_hero_description) settings.organizersHeroDescription = dbSettings.organizers_hero_description;

  // Validation
  if (!settings.imageUrl.startsWith("http")) {
    settings.imageUrl = DEFAULT_HOMEPAGE_SETTINGS.imageUrl;
  }
  if (!settings.buttonHref.startsWith("/") && !settings.buttonHref.startsWith("http")) {
    settings.buttonHref = DEFAULT_HOMEPAGE_SETTINGS.buttonHref;
  }
  if (settings.secondaryButtonHref && !settings.secondaryButtonHref.startsWith("/") && !settings.secondaryButtonHref.startsWith("http")) {
    settings.secondaryButtonHref = DEFAULT_HOMEPAGE_SETTINGS.secondaryButtonHref;
  }
  if (!settings.seoOgImageUrl.startsWith("http")) {
    settings.seoOgImageUrl = settings.imageUrl;
  }

  // URL fallback validations for landing images
  if (settings.fundraisersHeroImageUrl && !settings.fundraisersHeroImageUrl.startsWith("http")) {
    settings.fundraisersHeroImageUrl = DEFAULT_HOMEPAGE_SETTINGS.fundraisersHeroImageUrl;
  }
  if (settings.organizersHeroImageUrl && !settings.organizersHeroImageUrl.startsWith("http")) {
    settings.organizersHeroImageUrl = DEFAULT_HOMEPAGE_SETTINGS.organizersHeroImageUrl;
  }

  return settings;
}

// Legacy alias
export const getHomepageHeroSettings = getHomepageSettings;

export function homepageSettingsToRows(settings: HomepageSettings) {
  return [
    { key: "homepage_hero_image_url", value: settings.imageUrl },
    { key: "homepage_hero_eyebrow", value: settings.subtitle }, // Keep in sync for legacy compatibility
    { key: "homepage_hero_headline_line_1", value: settings.title },
    { key: "homepage_hero_headline_line_2", value: settings.headlineLine2 },
    { key: "homepage_hero_title", value: settings.title },
    { key: "homepage_hero_subtitle", value: settings.subtitle },
    { key: "homepage_hero_button_text", value: settings.buttonText },
    { key: "homepage_hero_button_href", value: settings.buttonHref },
    { key: "homepage_hero_secondary_button_text", value: settings.secondaryButtonText },
    { key: "homepage_hero_secondary_button_href", value: settings.secondaryButtonHref },
    { key: "homepage_seo_title", value: settings.seoTitle },
    { key: "homepage_seo_description", value: settings.seoDescription },
    { key: "homepage_seo_og_image_url", value: settings.seoOgImageUrl },
    // Fundraisers Landing keys
    { key: "fundraisers_hero_image_url", value: settings.fundraisersHeroImageUrl },
    { key: "fundraisers_hero_eyebrow", value: settings.fundraisersHeroEyebrow },
    { key: "fundraisers_hero_headline_line_1", value: settings.fundraisersHeroHeadlineLine1 },
    { key: "fundraisers_hero_headline_line_2", value: settings.fundraisersHeroHeadlineLine2 },
    { key: "fundraisers_hero_description", value: settings.fundraisersHeroDescription },
    { key: "fundraisers_hero_images", value: JSON.stringify(settings.fundraisersHeroImages ?? []) },
    // Organizers Landing keys
    { key: "organizers_hero_image_url", value: settings.organizersHeroImageUrl },
    { key: "organizers_hero_eyebrow", value: settings.organizersHeroEyebrow },
    { key: "organizers_hero_headline_line_1", value: settings.organizersHeroHeadlineLine1 },
    { key: "organizers_hero_headline_line_2", value: settings.organizersHeroHeadlineLine2 },
    { key: "organizers_hero_description", value: settings.organizersHeroDescription },
  ];
}

// Legacy alias
export function homepageHeroToSettings(settings: HomepageHeroSettings) {
  return homepageSettingsToRows(settings);
}

export function normalizeHomepageSettings(settings: HomepageSettings): HomepageSettings {
  const normalized: HomepageSettings = {
    imageUrl: settings.imageUrl.trim(),
    eyebrow: settings.eyebrow.trim(),
    headlineLine1: settings.headlineLine1.trim(),
    headlineLine2: settings.headlineLine2.trim(),
    title: settings.title.trim(),
    subtitle: settings.subtitle.trim(),
    buttonText: settings.buttonText.trim(),
    buttonHref: settings.buttonHref.trim(),
    secondaryButtonText: settings.secondaryButtonText.trim(),
    secondaryButtonHref: settings.secondaryButtonHref.trim(),
    seoTitle: settings.seoTitle.trim(),
    seoDescription: settings.seoDescription.trim(),
    seoOgImageUrl: settings.seoOgImageUrl.trim(),
    // Fundraisers
    fundraisersHeroImageUrl: settings.fundraisersHeroImageUrl.trim(),
    fundraisersHeroEyebrow: settings.fundraisersHeroEyebrow.trim(),
    fundraisersHeroHeadlineLine1: settings.fundraisersHeroHeadlineLine1.trim(),
    fundraisersHeroHeadlineLine2: settings.fundraisersHeroHeadlineLine2.trim(),
    fundraisersHeroDescription: settings.fundraisersHeroDescription.trim(),
    fundraisersHeroImages: (settings.fundraisersHeroImages ?? [])
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, MAX_HERO_FAN_IMAGES),
    // Organizers
    organizersHeroImageUrl: settings.organizersHeroImageUrl.trim(),
    organizersHeroEyebrow: settings.organizersHeroEyebrow.trim(),
    organizersHeroHeadlineLine1: settings.organizersHeroHeadlineLine1.trim(),
    organizersHeroHeadlineLine2: settings.organizersHeroHeadlineLine2.trim(),
    organizersHeroDescription: settings.organizersHeroDescription.trim(),
  };

  return getHomepageSettings(homepageSettingsToRows(normalized));
}

// Legacy alias
export function normalizeHomepageHeroSettings(settings: HomepageHeroSettings) {
  return normalizeHomepageSettings(settings);
}
