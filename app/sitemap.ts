import type { MetadataRoute } from "next";
import { fetchApiData, SITE_URL, type ReviewDetail } from "./lib/serverApi";

type ReviewPage = {
  content: ReviewDetail[];
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  const staticRoutes = routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const reviewPage = await fetchApiData<ReviewPage>("/api/reviews?page=0&size=1000&sort=recent", {
    next: { revalidate: 3600 },
  });

  const reviewRoutes = (reviewPage?.content ?? []).map((review) => ({
    url: `${SITE_URL}/reviews/${review.id}`,
    lastModified: review.updatedAt ? new Date(review.updatedAt) : now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
    images: review.book?.thumbnail ? [review.book.thumbnail] : undefined,
  }));

  return [...staticRoutes, ...reviewRoutes];
}
