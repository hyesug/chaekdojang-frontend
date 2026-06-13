import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.chaekdojang.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/notifications", "/auth", "/setup-nickname"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
