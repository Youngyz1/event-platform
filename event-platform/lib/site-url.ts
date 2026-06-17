export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  const vercelUrl = process.env.VERCEL_URL;
  const fallbackUrl = "http://localhost:3000";

  const siteUrl =
    configuredUrl || (vercelUrl ? `https://${vercelUrl}` : fallbackUrl);

  return siteUrl.replace(/\/$/, "");
}
