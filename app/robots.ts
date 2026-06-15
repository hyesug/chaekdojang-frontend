import type { MetadataRoute } from "next";
import { SITE_URL } from "./lib/serverApi";

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
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
