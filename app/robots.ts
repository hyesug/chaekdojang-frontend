import type { MetadataRoute } from "next";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.chaekdojang.com"
).replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/",
        "/auth",
        "/auth/",
        "/bookmarks",
        "/bookmarks/",
        "/chat",
        "/chat/",
        "/library",
        "/library/",
        "/notifications",
        "/notifications/",
        "/profile",
        "/profile/",
        "/setup-nickname",
        "/subscription",
        "/write",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
