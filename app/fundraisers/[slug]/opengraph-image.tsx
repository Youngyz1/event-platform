import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import {
  FUNDRAISER_FALLBACK_IMAGE,
  getFundraiserCardData,
} from "@/lib/fundraiser-data";
import { money } from "@/lib/format";
import { truncateWords } from "@/lib/text";

// Node.js runtime (not edge) so we can read the local font/logo files below.
export const runtime = "nodejs";
// Time-based revalidation — a donation total a few minutes stale on a social
// card is unnoticeable, and this avoids wiring cache invalidation through the
// Stripe/crypto webhooks for v1.
export const revalidate = 300;

export const alt = "Fund4Good fundraiser campaign card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND = {
  backdrop: "#062A22",
  card: "#FFFFFF",
  ink: "#0B0F0E",
  muted: "#6B7280",
  emerald: "#059669",
  emeraldSoft: "#ECFDF5",
  track: "#E5E7EB",
};

async function readFontFile(filename: string) {
  return readFile(join(process.cwd(), "assets", "fonts", filename));
}

async function readLogoDataUri() {
  const buffer = await readFile(join(process.cwd(), "public", "logo.png"));
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

/**
 * Fetches a remote image and inlines it as a data URI so Satori always has
 * real bytes to render. There's no onError DOM event in a server-rendered
 * image, so a missing/broken campaign photo falls back to the same stock
 * placeholder FundraiserMediaSlider.tsx uses, resolved the same way.
 */
async function resolveCardPhoto(url: string): Promise<string | null> {
  for (const candidate of [url, FUNDRAISER_FALLBACK_IMAGE]) {
    try {
      const res = await fetch(candidate, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const buffer = await res.arrayBuffer();
      return `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
    } catch {
      continue;
    }
  }
  return null;
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [card, logo, fontRegular, fontBold] = await Promise.all([
    getFundraiserCardData(slug),
    readLogoDataUri(),
    readFontFile("PlusJakartaSans-Regular.woff"),
    readFontFile("PlusJakartaSans-Bold.woff"),
  ]);

  const fonts = [
    { name: "Plus Jakarta Sans", data: fontRegular, weight: 400 as const, style: "normal" as const },
    { name: "Plus Jakarta Sans", data: fontBold, weight: 700 as const, style: "normal" as const },
  ];

  const outerStyle = {
    display: "flex" as const,
    width: "100%",
    height: "100%",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    background: BRAND.backdrop,
    fontFamily: "Plus Jakarta Sans",
  };

  // Fundraiser not found (deleted/unpublished slug) — a minimal branded
  // fallback rather than a broken image or a 500 on a shared link.
  if (!card) {
    return new ImageResponse(
      (
        <div style={outerStyle}>
          <img src={logo} height={64} style={{ objectFit: "contain" }} />
        </div>
      ),
      { ...size, fonts }
    );
  }

  const photo = await resolveCardPhoto(card.coverImage);
  const title = truncateWords(card.title, 70);
  const organizerLabel = truncateWords(card.organizerName, 40);
  const raisedLabel = money(card.raised);
  const goalLabel = money(card.goal);

  return new ImageResponse(
    (
      <div style={outerStyle}>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            width: 1104,
            height: 542,
            borderRadius: 28,
            overflow: "hidden",
            background: BRAND.card,
          }}
        >
          <div style={{ display: "flex", width: 460, height: "100%" }}>
            {photo ? (
              <img
                src={photo}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  height: "100%",
                  background: BRAND.emeraldSoft,
                }}
              />
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              flex: 1,
              padding: "40px 48px",
            }}
          >
            <img src={logo} height={36} style={{ objectFit: "contain" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 40,
                  fontWeight: 700,
                  color: BRAND.ink,
                  lineHeight: 1.2,
                }}
              >
                {title}
              </div>
              <div style={{ display: "flex", fontSize: 21, color: BRAND.muted }}>
                Organised by {organizerLabel}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: BRAND.emerald }}>
                  {raisedLabel}
                </div>
                <div style={{ display: "flex", fontSize: 20, color: BRAND.muted }}>
                  raised of {goalLabel}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  height: 16,
                  borderRadius: 999,
                  background: BRAND.track,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: `${card.percentage}%`,
                    height: "100%",
                    background: BRAND.emerald,
                    borderRadius: 999,
                  }}
                />
              </div>
              <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: BRAND.emerald }}>
                {card.percentage}% funded
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
