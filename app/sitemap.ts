import type { MetadataRoute } from "next";
import { bookPathSegment, fetchApiData, SITE_URL, type BookDetail, type ReviewDetail } from "./lib/serverApi";
import { IS_PRODUCTION } from "./lib/deployEnv";
import { ABOUT_UPDATED_AT } from "./about/content";

type ReviewPage = {
  content: ReviewDetail[];
};

type GroupSummary = {
  slug: string;
  visibility: "PUBLIC" | "PRIVATE";
};

function encodeSegment(value: string | number | null | undefined) {
  return encodeURIComponent(String(value ?? "").trim());
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // lastModified 는 실제 수정일을 아는 주소에만 넣는다. 매번 "지금"을 넣으면 검색 엔진이 날짜를 믿지 않게 된다.
  const routes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
    lastModified?: string;
  }> = [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/about", changeFrequency: "monthly", priority: 0.9, lastModified: ABOUT_UPDATED_AT },
    { path: "/search", changeFrequency: "weekly", priority: 0.8 },
    { path: "/explore", changeFrequency: "weekly", priority: 0.7 },
    { path: "/groups", changeFrequency: "weekly", priority: 0.7 },
    { path: "/contests", changeFrequency: "weekly", priority: 0.6 },
    { path: "/dojangdan", changeFrequency: "monthly", priority: 0.6 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
    { path: "/cs", changeFrequency: "monthly", priority: 0.3 },
    // 운세는 운영에서만 검색에 연다(staging 은 색인하지 않는다)
    ...(IS_PRODUCTION ? [{ path: "/unse", changeFrequency: "monthly", priority: 0.7 } as const] : []),
  ];

  const staticRoutes = routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    ...(route.lastModified ? { lastModified: new Date(route.lastModified) } : {}),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const reviewPage = await fetchApiData<ReviewPage>("/api/reviews?page=0&size=1000&sort=recent", {
    next: { revalidate: 3600 },
  });

  const reviewRoutes = (reviewPage?.content ?? []).map((review) => ({
    url: `${SITE_URL}/reviews/${encodeSegment(review.id)}`,
    ...(review.updatedAt ? { lastModified: new Date(review.updatedAt) } : {}),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const publicBooks = await fetchApiData<BookDetail[]>("/api/books/public", {
    next: { revalidate: 3600 },
  });

  // 독후감이 없는 책은 화면에 내용이 없다. 빈 페이지를 대량으로 제출하면 색인 품질이 떨어진다.
  const bookRoutes = (publicBooks ?? [])
    .filter((book) => book.reviewCount > 0)
    .map((book) => ({
      url: `${SITE_URL}/books/${encodeSegment(bookPathSegment(book.id, book.slug))}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));

  // 비공개 모임은 페이지에 noindex 를 붙이므로 사이트맵에도 넣지 않는다.
  const groups = await fetchApiData<GroupSummary[]>("/api/groups", {
    next: { revalidate: 3600 },
  });

  const groupRoutes = (groups ?? [])
    .filter((group) => group.visibility === "PUBLIC" && group.slug)
    .map((group) => ({
      url: `${SITE_URL}/groups/${encodeSegment(group.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));

  return [...staticRoutes, ...reviewRoutes, ...bookRoutes, ...groupRoutes];
}
