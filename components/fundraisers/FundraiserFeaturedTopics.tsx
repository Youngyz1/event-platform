import FeaturedTopics, { type FeaturedTopic } from "@/components/marketing/FeaturedTopics";
import { getCuratedFundraiserImages } from "@/lib/fundraiser-data";
import { normalizeImageUrl } from "@/lib/image-url";

/**
 * Fundraisers "featured topics" row. Every destination is real:
 *  1. Needs a boost  → the needs-momentum smart filter, fronted by a real
 *     campaign that has an actual banner image.
 *  2. Just launched  → Katie's Cancer & Homelessness campaign, resolved dynamically
 *     via getCuratedFundraiserImages.
 *  3. Learn more     → the real /reviews page, using the customer reviews illustration graphic.
 */

// Real campaign banner for card 1 (on an allowed host — see lib/image-url.ts).
const NEEDS_BOOST_IMAGE =
  "https://d2g8igdw686xgo.cloudfront.net/104399749_1780270023625266_r.jpg";

const KATIE_SLUG = "help-katie-in-her-battle-against-cancer-and-homelessness-";

export default async function FundraiserFeaturedTopics() {
  const [katieImage] = await getCuratedFundraiserImages([KATIE_SLUG]);

  const topics: FeaturedTopic[] = [
    {
      tag: "Needs a boost",
      tone: "emerald-solid",
      image: normalizeImageUrl(NEEDS_BOOST_IMAGE, ""),
      imageAlt: "Miracle & Amiri's recovery and rebuilding fundraiser",
      title: "Miracle & Amiri's Recovery and Rebuilding",
      href: "/campaigns?filter=needs-momentum",
      cta: "Donate now",
    },
    {
      tag: "Just launched",
      tone: "emerald-soft",
      image: katieImage || null,
      imageAlt: "Help Katie In Her Battle Against Cancer And Homelessness",
      title: "Help Katie In Her Battle Against Cancer And Homelessness ❤️",
      href: `/fundraisers/${KATIE_SLUG}`,
      cta: "Donate now",
    },
    {
      tag: "Learn more",
      tone: "neutral",
      image: "/images/reviews-card.png",
      imageAlt: "Customer Review illustration with five stars",
      title: "Real reviews from our community",
      href: "/reviews",
      cta: "Read more",
    },
  ];

  return <FeaturedTopics heading="Featured topics" topics={topics} />;
}
