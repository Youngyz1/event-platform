export type HomepageHeroSettings = {
  imageUrl: string;
  eyebrow: string;
  headlineLine1: string;
  headlineLine2: string;
  buttonText: string;
  buttonHref: string;
};

export type HomepageHeroSettingRow = {
  key: string;
  value: string | null;
};

export const DEFAULT_HOMEPAGE_HERO: HomepageHeroSettings = {
  imageUrl:
    "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1800&auto=format&fit=crop",
  eyebrow: "EVENTS • FUNDRAISING • SPONSORSHIPS",
  headlineLine1: "Sell Tickets. Raise Funds.",
  headlineLine2: "Find Sponsors.",
  buttonText: "Browse Events",
  buttonHref: "/events",
};

export const HOMEPAGE_HERO_SETTING_KEYS = [
  "homepage_hero_image_url",
  "homepage_hero_eyebrow",
  "homepage_hero_headline_line_1",
  "homepage_hero_headline_line_2",
  "homepage_hero_button_text",
  "homepage_hero_button_href",
] as const;

const keyToField = {
  homepage_hero_image_url: "imageUrl",
  homepage_hero_eyebrow: "eyebrow",
  homepage_hero_headline_line_1: "headlineLine1",
  homepage_hero_headline_line_2: "headlineLine2",
  homepage_hero_button_text: "buttonText",
  homepage_hero_button_href: "buttonHref",
} as const;

export function getHomepageHeroSettings(
  rows: HomepageHeroSettingRow[] | null | undefined
): HomepageHeroSettings {
  const hero = { ...DEFAULT_HOMEPAGE_HERO };

  for (const row of rows ?? []) {
    const field = keyToField[row.key as keyof typeof keyToField];
    const value = row.value?.trim();

    if (field && value) {
      hero[field] = value;
    }
  }

  if (!hero.imageUrl.startsWith("http")) {
    hero.imageUrl = DEFAULT_HOMEPAGE_HERO.imageUrl;
  }

  if (!hero.buttonHref.startsWith("/")) {
    hero.buttonHref = DEFAULT_HOMEPAGE_HERO.buttonHref;
  }

  return hero;
}

export function homepageHeroToSettings(hero: HomepageHeroSettings) {
  return [
    { key: "homepage_hero_image_url", value: hero.imageUrl },
    { key: "homepage_hero_eyebrow", value: hero.eyebrow },
    { key: "homepage_hero_headline_line_1", value: hero.headlineLine1 },
    { key: "homepage_hero_headline_line_2", value: hero.headlineLine2 },
    { key: "homepage_hero_button_text", value: hero.buttonText },
    { key: "homepage_hero_button_href", value: hero.buttonHref },
  ];
}

export function normalizeHomepageHeroSettings(
  hero: HomepageHeroSettings
): HomepageHeroSettings {
  const normalized = {
    imageUrl: hero.imageUrl.trim(),
    eyebrow: hero.eyebrow.trim(),
    headlineLine1: hero.headlineLine1.trim(),
    headlineLine2: hero.headlineLine2.trim(),
    buttonText: hero.buttonText.trim(),
    buttonHref: hero.buttonHref.trim(),
  };

  return getHomepageHeroSettings(homepageHeroToSettings(normalized));
}
