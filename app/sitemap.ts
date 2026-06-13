import type { MetadataRoute } from "next";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.chaekdojang.com"
).replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes = [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/search", changeFrequency: "weekly", priority: 0.8 },
    { path: "/explore", changeFrequency: "weekly", priority: 0.7 },
    { path: "/cs", changeFrequency: "monthly", priority: 0.3 },
  ] satisfies Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }>;

  return routes.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
