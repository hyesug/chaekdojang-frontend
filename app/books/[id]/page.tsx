import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import BackButton from "../../components/BackButton";
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

type BookConnection = {
  bookId: number;
  title: string;
  author: string;
  thumbnail: string | null;
  sharedReaderCount: number;
  reason: string;
};

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
    next: { revalidate: 600 },
  });
}

async function getBookReviews(bookId: number, sort: SortType) {
  return (
    (await fetchApiData<ReviewDetail[]>(`/api/books/${bookId}/reviews?sort=${sort}`, {
      cache: "no-store",
    })) ?? []
  );
}

async function getBookConnections(bookId: number) {
  return (await fetchApiData<BookConnection[]>(`/api/books/${bookId}/connections`, {
    next: { revalidate: 600 },
  })) ?? [];
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

  const [reviews, connections] = await Promise.all([
    getBookReviews(book.id, sort),
    getBookConnections(book.id),
  ]);
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

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <BookReturnMemory bookId={book.id} href={currentBookPath} />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mb-4">
        <BackButton fallbackHref="/search" />
      </div>

      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
        <div className="flex gap-4">
          {book.thumbnail ? (
            <Image
              src={book.thumbnail}
              alt={`${book.title} 책 표지`}
              width={78}
              height={112}
              className="h-28 w-[78px] flex-shrink-0 rounded object-cover shadow-sm"
              priority
            />
          ) : (
            <div className="h-28 w-[78px] flex-shrink-0 rounded bg-cream-200" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl font-bold text-brown-900">{book.title}</h1>
            <p className="mt-1 text-sm text-brown-600">{book.author}</p>
            {book.publisher && <p className="text-sm text-brown-500">{book.publisher}</p>}
            {book.description && (
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-brown-600">
                {book.description}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href={writeHref(book)}
                className="rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800"
              >
                나도 이 책에 도장 찍기
              </Link>
              <Link
                href={`/books/${book.id}/reaction-report`}
                className="rounded-full border border-cream-300 px-3 py-2 text-xs font-medium text-brown-500 hover:bg-cream-50 hover:text-brown-800"
              >
                독자 반응 리포트 보기
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-brown-400">이 책에 찍힌 도장</p>
            <p className="mt-1 font-serif text-2xl font-bold text-brown-900">{book.reviewCount}개</p>
          </div>
          <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-brown-400">평균 별점</p>
            <p className="mt-1 font-serif text-2xl font-bold text-brown-900">{averageRating(reviews)}</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-cream-200 bg-white p-4 shadow-sm sm:col-span-1">
            <p className="text-xs font-medium text-brown-400">참여 독자</p>
            <p className="mt-1 font-serif text-2xl font-bold text-brown-900">{book.readerCount}명</p>
          </div>
        </div>

        {emotionKeywords.length > 0 && (
          <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-brown-800">많이 남긴 감정</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {emotionKeywords.map((keyword) => (
                <span key={keyword} className="rounded-full bg-cream-100 px-3 py-1 text-sm text-brown-600">
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-lg font-bold text-brown-900">한 줄 감상 모아보기</h2>
            {reviews.length > 5 && (
              <Link href={`/books/${book.id}/reviews`} className="text-xs font-medium text-brown-400 hover:text-brown-700">
                더보기
              </Link>
            )}
          </div>
          {oneLines.length === 0 ? (
            <p className="mt-3 rounded-xl bg-cream-50 px-4 py-5 text-center text-sm text-brown-400">
              아직 한 줄 감상이 없습니다. 독후감을 남기면 이 책의 감상 모음에 표시됩니다.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {oneLines.map((line, index) => (
                <li key={`${line}-${index}`} className="rounded-xl bg-cream-50 px-4 py-3 text-sm leading-6 text-brown-700">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {connections.length > 0 && (
        <section className="mt-7">
          <div>
            <h2 className="font-serif text-xl font-bold text-brown-900">이 책에서 이어진 실제 독서 흐름</h2>
            <p className="mt-1 text-xs text-brown-400">AI 추천이 아니라, 같은 독자들이 실제로 함께 기록한 책만 보여줍니다.</p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {connections.map((item) => (
              <Link key={item.bookId} href={`/books/${item.bookId}`} className="flex gap-3 rounded-2xl border border-cream-200 bg-white p-3 hover:border-brown-300">
                {item.thumbnail ? (
                  <Image src={item.thumbnail} alt={item.title} width={44} height={64} className="h-16 w-11 rounded object-cover" />
                ) : <div className="h-16 w-11 rounded bg-cream-200" />}
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold text-brown-800">{item.title}</p>
                  <p className="mt-0.5 truncate text-xs text-brown-400">{item.author}</p>
                  <p className="mt-1 text-[11px] leading-4 text-brown-500">{item.reason}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-bold text-brown-900">
            이 책을 읽은 사람들의 독후감{" "}
            <span className="font-sans text-base font-normal text-brown-400">{book.reviewCount}개</span>
          </h2>
          <div className="flex rounded-full border border-cream-200 bg-white p-1">
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
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-brown-700 font-semibold text-white"
                      : "text-brown-500 hover:bg-cream-50 hover:text-brown-800"
                  }`}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
        </div>

        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-cream-200 bg-white py-16 text-center text-brown-400">
            <p>아직 공개 독후감이 없어요.</p>
            <p className="mt-1 text-sm">첫 번째 도장을 찍어보세요.</p>
            <Link
              href={writeHref(book)}
              className="mt-5 inline-flex rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800"
            >
              나도 이 책에 도장 찍기
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {reviews.map((review) => (
              <ReviewCard key={review.id} post={review} returnTo={currentBookPath} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
