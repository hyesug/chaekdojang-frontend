import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3, BookOpen, PenLine } from "lucide-react";
import BackButton from "../../components/BackButton";
import { EmptyState } from "../../components/ui/EmptyState";
import BookReturnMemory from "../../components/BookReturnMemory";
import ReviewCard from "../../components/ReviewCard";
import {
  bookPathSegment,
  fetchApiData,
  shareText,
  SITE_URL,
  type PublicBookDetail,
  type ReviewDetail,
} from "../../lib/serverApi";

type SortType = "recent" | "popular" | "rating";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ sort?: string }>;
};

const SORT_OPTIONS: Array<{ value: SortType; label: string }> = [
  { value: "recent", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "rating", label: "별점순" },
];

async function getPublicBook(slug: string) {
  return fetchApiData<PublicBookDetail>(`/api/books/public/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
}

async function getBookReviews(bookId: number, sort: SortType) {
  return (
    (await fetchApiData<ReviewDetail[]>(`/api/books/${bookId}/reviews?sort=${sort}`, {
      cache: "no-store",
    })) ?? []
  );
}

function normalizeSort(value?: string): SortType {
  return value === "popular" || value === "rating" ? value : "recent";
}

function bookUrl(book: PublicBookDetail) {
  return `${SITE_URL}/books/${bookPathSegment(book.id, book.slug)}`;
}

function descriptionFor(book: PublicBookDetail) {
  if (book.seoDescription) return book.seoDescription;
  if (book.author) {
    return `${book.author}의 『${book.title}』을 읽은 독자들의 독후감과 감상을 책도장에서 모아보세요.`;
  }
  return `『${book.title}』을 읽은 독자들의 독후감과 감상을 책도장에서 모아보세요.`;
}

function writeHref(book: PublicBookDetail) {
  const params = new URLSearchParams({
    bookId: String(book.id),
    title: book.title,
    author: book.author,
  });
  if (book.publisher) params.set("publisher", book.publisher);
  if (book.thumbnail) params.set("thumbnail", book.thumbnail);
  return `/write?${params.toString()}`;
}

function averageRating(reviews: ReviewDetail[]) {
  if (reviews.length === 0) return "0.0";
  const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  return average.toFixed(1);
}

function commonEmotionKeywords(reviews: ReviewDetail[]) {
  const counts = new Map<string, number>();
  reviews.forEach((review) => {
    review.aiSummary?.emotionKeywords?.forEach((keyword) => {
      const normalized = keyword.trim();
      if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, 5)
    .map(([keyword]) => keyword);
}

function oneLineReviews(reviews: ReviewDetail[]) {
  return reviews
    .map((review) => review.aiSummary?.oneLineReview?.trim())
    .filter((value): value is string => Boolean(value))
    .slice(0, 5);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const book = await getPublicBook(id);
  if (!book) {
    return {
      title: "책 상세 - 책도장",
      description: shareText(),
      robots: { index: false, follow: false },
    };
  }

  const title = book.seoTitle || (book.author
    ? `${book.title} - ${book.author} 독후감 모아보기 | 책도장`
    : `${book.title} 독후감 모아보기 | 책도장`);
  const description = descriptionFor(book);
  const url = bookUrl(book);
  const keywords = [
    `${book.title} 독후감`,
    `${book.title} 리뷰`,
    `${book.title} 책 기록`,
    `${book.title} 독서 기록`,
    `${book.title} 감상문`,
    `책도장 ${book.title}`,
    `책도장 ${book.title} 독후감`,
  ];
  if (book.author) {
    keywords.push(`${book.author} 책`, `${book.author} ${book.title} 독후감`);
  }

  return {
    title: { absolute: title },
    description,
    keywords,
    alternates: { canonical: `/books/${bookPathSegment(book.id, book.slug)}` },
    openGraph: {
      type: "book",
      locale: "ko_KR",
      url,
      siteName: "책도장",
      title,
      description,
      images: book.thumbnail
        ? [{ url: book.thumbnail, width: 400, height: 600, alt: book.title }]
        : undefined,
    },
    twitter: {
      card: book.thumbnail ? "summary_large_image" : "summary",
      title,
      description,
      images: book.thumbnail ? [book.thumbnail] : undefined,
    },
  };
}

export default async function BookDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = searchParams ? await searchParams : undefined;
  const sort = normalizeSort(query?.sort);
  const book = await getPublicBook(id);
  if (!book) notFound();
  const isWebNovel = book.contentType === "WEB_NOVEL";

  const reviews = await getBookReviews(book.id, sort);
  const emotionKeywords = commonEmotionKeywords(reviews);
  const oneLines = oneLineReviews(reviews);
  const canonicalUrl = bookUrl(book);
  const currentBookPath =
    sort === "recent"
      ? `/books/${book.id}`
      : `/books/${book.id}?sort=${sort}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${book.title} 독후감`,
    description: descriptionFor(book),
    url: canonicalUrl,
    about: {
      "@type": "Book",
      name: book.title,
      author: book.author ? { "@type": "Person", name: book.author } : undefined,
      publisher: book.publisher ? { "@type": "Organization", name: book.publisher } : undefined,
      image: book.thumbnail || undefined,
      description: book.description || descriptionFor(book),
    },
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

  const unit = isWebNovel ? "작품" : "책";
  const stats = [
    { label: "찍힌 도장", value: `${book.reviewCount}`, suffix: "개" },
    { label: "평균 별점", value: `${averageRating(reviews)}`, suffix: "" },
    { label: "참여 독자", value: `${book.readerCount}`, suffix: "명" },
  ];

  return (
    <div className="cdj-page cdj-page--reading">
      <BookReturnMemory bookId={book.id} href={currentBookPath} />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mb-6">
        <BackButton fallbackHref="/search" />
      </div>

      {/* 책 머리 */}
      <section className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <div className="cdj-cover w-[132px] self-center sm:w-[156px] sm:self-start">
          {book.thumbnail ? (
            <img src={book.thumbnail} alt={`${book.title} ${unit} 표지`} />
          ) : (
            <span className="block h-full bg-cream-300" />
          )}
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          {isWebNovel && <span className="cdj-tag mb-2">웹소설</span>}
          <h1 className="cdj-title">{book.title}</h1>
          <p className="mt-2 text-[15px] text-sage-600">
            {book.author}
            {book.publisher && <span className="text-sage-500"> · {book.publisher}</span>}
          </p>

          <dl className="mt-5 inline-grid grid-cols-3 divide-x divide-cream-300 rounded-xl border border-cream-300 bg-cream-50 sm:inline-flex">
            {stats.map((stat) => (
              <div key={stat.label} className="px-4 py-2.5 text-center sm:min-w-[96px] sm:text-left">
                <dt className="text-[11px] font-medium text-sage-600">{stat.label}</dt>
                <dd className="mt-0.5 text-lg font-bold text-brown-800 tabular">
                  {stat.value}
                  {stat.suffix && <span className="ml-0.5 text-sm font-medium text-sage-600">{stat.suffix}</span>}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Link href={writeHref(book)} className="cdj-button cdj-button--primary">
              <PenLine size={16} aria-hidden="true" />
              이 {unit}에 도장 찍기
            </Link>
            <Link href={`/books/${book.id}/reaction-report`} className="cdj-button cdj-button--secondary">
              <BarChart3 size={16} aria-hidden="true" />
              독자 반응 리포트
            </Link>
          </div>
        </div>
      </section>

      {/* 소개 */}
      <section className="mt-12 border-t border-cream-300 pt-8">
        <h2 className="text-lg font-bold text-brown-800">{isWebNovel ? "작품 소개" : "책 소개"}</h2>
        {book.synopsis ? (
          <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-brown-900/85">{book.synopsis}</p>
        ) : (
          <p className="mt-3 text-sm text-sage-600">아직 제공된 {isWebNovel ? "작품 소개" : "줄거리"} 정보가 없어요.</p>
        )}
      </section>

      {/* 독자 반응 요약 */}
      <section className="mt-10 border-t border-cream-300 pt-8">
        <h2 className="text-lg font-bold text-brown-800">독자들의 한 줄 감상</h2>
        {emotionKeywords.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[13px] text-sage-600">많이 남긴 감정</span>
            {emotionKeywords.map((keyword) => (
              <span key={keyword} className="cdj-tag">{keyword}</span>
            ))}
          </div>
        )}
        {oneLines.length === 0 ? (
          <p className="mt-4 text-sm text-sage-600">
            아직 한 줄 감상이 없어요. 독후감을 남기면 이 {unit}의 감상 모음에 표시돼요.
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {oneLines.map((line, index) => (
              <li key={`${line}-${index}`} className="cdj-quote text-[15px]">
                {line}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 독후감 목록 */}
      <section className="mt-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-cream-300">
          <h2 className="pb-3 text-lg font-bold text-brown-800">
            독후감 <span className="ml-1 text-base font-medium text-sage-600 tabular">{book.reviewCount}</span>
          </h2>
          <nav className="-mb-px flex" aria-label="독후감 정렬">
            {SORT_OPTIONS.map((option) => {
              const active = option.value === sort;
              const sortParams = new URLSearchParams();
              if (option.value !== "recent") {
                sortParams.set("sort", option.value);
              }
              const href = sortParams.size > 0
                ? `/books/${encodeURIComponent(id)}?${sortParams.toString()}`
                : `/books/${encodeURIComponent(id)}`;

              return (
                <Link
                  key={option.value}
                  href={href}
                  scroll={false}
                  className="cdj-tab text-sm"
                  aria-current={active ? "page" : undefined}
                >
                  {option.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {reviews.length === 0 ? (
          <EmptyState
            title="아직 공개 독후감이 없어요"
            icon={<BookOpen size={22} aria-hidden="true" />}
            action={<Link href={writeHref(book)} className="cdj-button cdj-button--primary">첫 도장 찍기</Link>}
          >
            이 {unit}의 첫 번째 독자가 되어보세요.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {reviews.map((review) => (
              <ReviewCard key={review.id} post={review} returnTo={currentBookPath} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}