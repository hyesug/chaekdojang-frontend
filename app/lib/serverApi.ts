export const SERVER_API_BASE = (
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://api.chaekdojang.com"
).replace(/\/$/, "");

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.chaekdojang.com"
).replace(/\/$/, "");

export type ReviewDetail = {
  id: number;
  author: { id: number | null; nickname: string; profileImage: string | null };
  book: {
    id: number;
    isbn13?: string;
    title: string;
    author: string;
    thumbnail: string | null;
  } | null;
  content: string;
  rating: number;
  hidden?: boolean;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BookDetail = {
  id: number;
  isbn13: string;
  title: string;
  author: string;
  publisher: string;
  thumbnail: string | null;
  source: string;
  category: string | null;
  reviewCount: number;
};

export async function fetchApiData<T>(
  path: string,
  options: RequestInit & { next?: { revalidate?: number } } = {}
): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER_API_BASE}${path}`, {
      ...options,
      next: options.next ?? { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data ?? json) as T;
  } catch {
    return null;
  }
}

export function reviewTitle(review: ReviewDetail): string {
  return review.book?.title ? `${review.book.title} 독후감 - 책도장` : "독후감 - 책도장";
}

export function reviewDescription(review: ReviewDetail): string {
  const clean = review.content.replace(/\s+/g, " ").trim();
  return clean.length > 120 ? `${clean.slice(0, 119)}…` : clean;
}

export function shareText(): string {
  return "읽은 책에 나만의 감상을 찍다";
}
