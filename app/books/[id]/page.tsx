import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewCard from "../../components/ReviewCard";
import {
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
    next: { revalidate: 600 },
  });
}

async function getBookReviews(bookId: number, sort: SortType) {
  return (
    (await fetchApiData<ReviewDetail[]>(`/api/books/${bookId}/reviews?sort=${sort}`, {
      next: { revalidate: 300 },
    })) ?? []
  );
}

function normalizeSort(value?: string): SortType {
  return value === "popular" || value === "rating" ? value : "recent";
}

function bookUrl(book: PublicBookDetail) {
  return `${SITE_URL}/books/${book.slug || book.id}`;
}

function descriptionFor(book: PublicBookDetail) {
  return (
    book.seoDescription ||
    book.description ||
    `${book.author}의 ${book.title} 독후감, 리뷰, 독서 기록을 책도장에서 확인해보세요.`
  );
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

  const title = book.seoTitle || `${book.title} 독후감과 문장 기록 | 책도장`;
  const description = descriptionFor(book);
  const url = bookUrl(book);

  return {
    title: { absolute: title },
    description,
    keywords: [
      `${book.title} 독후감`,
      `${book.title} 리뷰`,
      `${book.title} 책 기록`,
      `${book.title} 독서 기록`,
      `${book.author} 책`,
    ],
    alternates: { canonical: `/books/${book.slug || book.id}` },
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

  const reviews = await getBookReviews(book.id, sort);
  const canonicalUrl = bookUrl(book);
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
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
                독후감 쓰기
              </Link>
            </div>
          </div>
        </div>
      </section>

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
            <p className="mt-1 text-sm">첫 번째 독서 기록을 남겨보세요.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {reviews.map((review) => (
              <ReviewCard key={review.id} post={review} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
