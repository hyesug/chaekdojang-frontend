import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewCard from "../../../components/ReviewCard";
import {
  fetchApiData,
  SITE_URL,
  type BookDetail,
  type ReviewDetail,
} from "../../../lib/serverApi";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ sort?: string; length?: string; spoiler?: string; keyword?: string }>;
};

async function getBook(id: string) {
  return fetchApiData<BookDetail>(`/api/books/${id}`, {
    next: { revalidate: 300 },
  });
}

async function getReviews(
  id: string,
  filters?: { sort?: string; length?: string; spoiler?: string; keyword?: string },
) {
  const params = new URLSearchParams();
  if (filters?.sort === "popular" || filters?.sort === "rating") params.set("sort", filters.sort);
  if (filters?.length === "short" || filters?.length === "long") params.set("length", filters.length);
  if (filters?.spoiler === "exclude" || filters?.spoiler === "only") params.set("spoiler", filters.spoiler);
  if (filters?.keyword) params.set("keyword", filters.keyword);
  const query = params.toString();
  return (
    (await fetchApiData<ReviewDetail[]>(`/api/books/${id}/reviews${query ? `?${query}` : ""}`, {
      cache: "no-store",
    })) ?? []
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) {
    return {
      title: "책별 생각 모아보기 - 책도장",
      description: "한 권의 책에 남겨진 다양한 생각과 이어진 독후감을 모아보세요.",
      robots: { index: false, follow: false },
    };
  }

  const reviews = await getReviews(id);
  const title = `${book.title} 책별 생각 모아보기 - 책도장`;
  const description = `${book.title}에 남겨진 ${reviews.length}개의 생각과 이어진 독후감을 책도장에서 확인해보세요.`;

  return {
    title,
    description,
    keywords: [`${book.title} 독후감`, `${book.title} 서평`, `${book.title} 감상문`, book.author],
    alternates: { canonical: `/books/${book.id}` },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      url: `${SITE_URL}/books/${book.id}/reviews`,
      siteName: "책도장",
      title,
      description,
      images: book.thumbnail
        ? [{ url: book.thumbnail, width: 400, height: 600, alt: book.title }]
        : undefined,
    },
  };
}

export default async function BookReviewsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = searchParams ? await searchParams : undefined;
  const sort = query?.sort === "popular" || query?.sort === "rating" ? query.sort : undefined;
  const length = query?.length === "short" || query?.length === "long" ? query.length : undefined;
  const spoiler = query?.spoiler === "exclude" || query?.spoiler === "only" ? query.spoiler : undefined;
  const keyword = query?.keyword?.trim() || undefined;
  const filters = { sort, length, spoiler, keyword };
  const [book, reviews, allReviews] = await Promise.all([
    getBook(id),
    getReviews(id, filters),
    getReviews(id),
  ]);
  if (!book) notFound();
  const currentParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value && currentParams.set(key, value));
  const returnTo = `/books/${encodeURIComponent(id)}/reviews${currentParams.size ? `?${currentParams}` : ""}`;
  const topKeywords = Array.from(
    allReviews.flatMap((review) => review.keywords ?? []).reduce((counts, value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()),
  )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, 8);
  const readerCount = new Set(
    allReviews.map((review) => review.author.id ?? `nickname:${review.author.nickname}`),
  ).size;
  const connectedReviewCount = allReviews.filter(
    (review) => review.previousReviewId != null || review.sourceReviewId != null,
  ).length;

  function filterHref(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(currentParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    return `/books/${encodeURIComponent(id)}/reviews${params.size ? `?${params}` : ""}`;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${book.title} 독후감 모음`,
    description: `${book.title}에 남겨진 독후감 목록`,
    url: `${SITE_URL}/books/${book.id}/reviews`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: reviews.map((review, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}/reviews/${review.id}`,
        name: `${book.title} 독후감`,
      })),
    },
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mb-6">
        <Link href={`/books/${book.id}`} className="text-sm text-brown-500 hover:text-brown-700">
          책 정보로 돌아가기
        </Link>
        <h1 className="mt-3 font-serif text-2xl font-bold text-brown-800">
          {book.title} 책별 생각 모아보기
        </h1>
        <p className="mt-1 text-sm text-brown-500">{book.author}</p>
        <p className="mt-2 text-sm leading-6 text-brown-400">
          이 책을 읽은 독자들의 짧고 긴 기록, 키워드와 서로 이어진 생각을 한곳에서 살펴보세요.
        </p>
      </div>

      <section className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-cream-200 bg-white px-3 py-4 text-center">
          <p className="text-xs text-brown-400">공개 생각</p>
          <p className="mt-1 font-serif text-xl font-bold text-brown-800">{allReviews.length}개</p>
        </div>
        <div className="rounded-2xl border border-cream-200 bg-white px-3 py-4 text-center">
          <p className="text-xs text-brown-400">참여 독자</p>
          <p className="mt-1 font-serif text-xl font-bold text-brown-800">{readerCount}명</p>
        </div>
        <div className="rounded-2xl border border-cream-200 bg-white px-3 py-4 text-center">
          <p className="text-xs text-brown-400">이어진 생각</p>
          <p className="mt-1 font-serif text-xl font-bold text-brown-800">{connectedReviewCount}개</p>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-cream-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold text-brown-600">생각 골라보기</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {([
            [undefined, "최신순"],
            ["popular", "공감순"],
            ["rating", "별점순"],
          ] as const).map(([value, label]) => (
            <Link
              key={label}
              href={filterHref({ sort: value })}
              className={`rounded-full px-3 py-1.5 ${sort === value ? "bg-sage-700 text-white" : "bg-sage-50 text-sage-700"}`}
            >
              {label}
            </Link>
          ))}
          {[
            [undefined, "전체 길이"],
            ["short", "짧은 기록"],
            ["long", "긴 기록"],
          ].map(([value, label]) => (
            <Link
              key={label}
              href={filterHref({ length: value })}
              className={`rounded-full px-3 py-1.5 ${length === value ? "bg-brown-700 text-white" : "bg-cream-100 text-brown-500"}`}
            >
              {label}
            </Link>
          ))}
          {[
            [undefined, "스포일러 전체"],
            ["exclude", "스포일러 제외"],
            ["only", "스포일러만"],
          ].map(([value, label]) => (
            <Link
              key={label}
              href={filterHref({ spoiler: value })}
              className={`rounded-full px-3 py-1.5 ${spoiler === value ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700"}`}
            >
              {label}
            </Link>
          ))}
        </div>
        {topKeywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-cream-100 pt-3">
            <Link href={filterHref({ keyword: undefined })} className={`text-xs ${!keyword ? "font-bold text-brown-700" : "text-brown-400"}`}>
              키워드 전체
            </Link>
            {topKeywords.map(([value, count]) => (
              <Link
                key={value}
                href={filterHref({ keyword: value })}
                className={`text-xs ${keyword === value ? "font-bold text-brown-700" : "text-brown-400"}`}
              >
                #{value} {count}
              </Link>
            ))}
          </div>
        )}
      </section>

      {reviews.length === 0 ? (
        <div className="text-center py-16 text-brown-400">
          <p className="text-4xl mb-3">✏️</p>
          <p>아직 독후감이 없어요</p>
          <p className="text-sm mt-1">첫 번째 독후감을 남겨보세요.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => {
            const connection = review.previousReviewId != null
              ? { href: `/reviews/${review.previousReviewId}`, label: "이 책을 다시 읽고 남긴 새로운 생각입니다." }
              : review.sourceReviewId != null
                ? { href: `/reviews/${review.sourceReviewId}`, label: "다른 독자의 글을 읽고 이어서 남긴 생각입니다." }
                : null;
            return (
              <div key={review.id}>
                {connection && (
                  <Link
                    href={connection.href}
                    className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-sage-200 bg-sage-50 px-3 py-2 text-xs text-sage-800 hover:border-sage-400"
                  >
                    <span>{connection.label}</span>
                    <span className="shrink-0 font-semibold">연결된 글 보기 →</span>
                  </Link>
                )}
                <ReviewCard post={review} returnTo={returnTo} />
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
