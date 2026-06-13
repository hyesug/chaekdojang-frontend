import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/notifications", "/auth", "/setup-nickname"],
    },
    sitemap: "https://www.chaekingam.com/sitemap.xml",
  };
}
