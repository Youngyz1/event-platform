import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/api/", "/my-tickets", "/create-event", "/create-fundraiser", "/create-organizer"],
      },
    ],
    sitemap: "https://www.fund4agoodcause.com/sitemap.xml",
    host: "https://www.fund4agoodcause.com",
  };
}
