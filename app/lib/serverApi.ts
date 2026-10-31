export const SERVER_API_BASE = (
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:8080"
    : "https://api.chaekdojang.com")
).replace(/\/$/, "");

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.chaekdojang.com"
).replace(/\/$/, "");

export function bookPathSegment(bookId: number | string, slug?: string | null) {
  const normalizedSlug = slug?.trim();
  return normalizedSlug && !/^\d+$/.test(normalizedSlug)
    ? normalizedSlug
    : String(bookId);
}

export type ReviewDetail = {
  id: number;
  author: { id: number | null; nickname: string; profileImage: string | null };
  book: {
    id: number;
    isbn13?: string;
    title: string;
    author: string;
    thumbnail: string | null;
    source?: string;
    contentType?: "BOOK" | "WEB_NOVEL";
    sourceUrl?: string | null;
  } | null;
  aiSummary?: {
    oneLineReview: string;
    emotionKeywords: string[];
    recommendedFor: string;
    impressivePoint: string;
  } | null;
  content: string;
  rating: number;
  hidden?: boolean;
  viewCount?: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  previousReviewId?: number | null;
  sourceReviewId?: number | null;
  keywords?: string[];
  spoiler?: boolean;
};

export type BookDetail = {
  id: number;
  isbn13: string | null;
  title: string;
  author: string;
  publisher: string;
  thumbnail: string | null;
  slug?: string | null;
  source: string;
  contentType?: "BOOK" | "WEB_NOVEL";
  externalId?: string | null;
  sourceUrl?: string | null;
  category: string | null;
  reviewCount: number;
};

export type PublicBookDetail = {
  id: number;
  isbn13?: string;
  contentType: "BOOK" | "WEB_NOVEL";
  title: string;
  author: string;
  publisher?: string;
  thumbnail: string | null;
  slug: string | null;
  description: string | null;
  synopsis: string | null;
  publishedYear: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  reviewCount: number;
  readerCount: number;
  updatedAt: string;
  reviewExcerpts: Array<{
    id: number;
    authorNickname: string;
    content: string;
    rating: number;
    likeCount: number;
    commentCount: number;
    createdAt: string;
  }>;
  sentenceExcerpts: string[];
};

export async function fetchApiData<T>(
  path: string,
  options: RequestInit & { next?: { revalidate?: number } } = {}
): Promise<T | null> {
  try {
    const headers = new Headers(options.headers);
    headers.set("X-Chaekdojang-Internal-Request", "web-ssr");

    const res = await fetch(`${SERVER_API_BASE}${path}`, {
      ...options,
      headers,
      next: options.cache === "no-store" ? undefined : options.next ?? { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data ?? json) as T;
  } catch {
    return null;
  }
}

export async function fetchAuthenticatedApiData<T>(
  path: string,
  options: RequestInit = {},
): Promise<T | null> {
  try {
    const headers = new Headers(options.headers);
    headers.set("X-Chaekdojang-Internal-Request", "web-ssr");
    const cookieStore = await cookies();
    const loggedOut = cookieStore.get("chaekdojang_logged_out")?.value === "true";
    const cookieHeader = cookieStore.toString();
    if (!loggedOut && cookieHeader) headers.set("Cookie", cookieHeader);
    const response = await fetch(`${SERVER_API_BASE}${path}`, {
      ...options,
      headers,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const json = await response.json();
    return (json.data ?? json) as T;
  } catch {
    return null;
  }
}

export function reviewTitle(review: ReviewDetail): string {
  return review.book?.title
    ? `${review.book.title} 독후감 - ${review.author.nickname} | 책도장`
    : `${review.author.nickname}님의 독후감 | 책도장`;
}

export function reviewDescription(review: ReviewDetail): string {
  const clean = review.content.replace(/\s+/g, " ").trim();
  const excerpt = clean.length > 90 ? `${clean.slice(0, 89)}…` : clean;
  if (review.book?.title) {
    return `${review.author.nickname}님이 남긴 『${review.book.title}』 독후감입니다. 책도장에서 책 감상과 독서 기록을 확인해보세요. ${excerpt}`.trim();
  }
  return `${review.author.nickname}님이 남긴 독후감입니다. 책도장에서 책 감상과 독서 기록을 확인해보세요. ${excerpt}`.trim();
}

export function shareText(): string {
  return "읽은 책에 나만의 감상을 찍다";
}

// 검색 결과·AI 답변에 쓰일 서비스 한 줄 설명. 실제로 있는 기능만 적는다(기능이 바뀌면 /about 과 함께 고친다).
export const SERVICE_DESCRIPTION =
  "책도장은 독후감을 쓰고 읽은 책을 온라인 서재에 모으는 독서 기록 SNS입니다. 독서모임에서 함께 읽은 기록을 나누고, 긴 독후감은 AI 독서카드로 정리할 수 있어요.";

export const DEFAULT_OG_IMAGE = {
  url: "/chaekdojang-logo-512.png",
  width: 512,
  height: 512,
  alt: "책도장",
};
import { cookies } from "next/headers";
