import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchApiData,
  shareText,
  SITE_URL,
  type PublicBookDetail,
} from "../../lib/serverApi";

type Props = {
  params: Promise<{ id: string }>;
};

async function getPublicBook(slug: string) {
  return fetchApiData<PublicBookDetail>(`/api/books/public/${encodeURIComponent(slug)}`, {
    next: { revalidate: 600 },
  });
}

function bookUrl(book: PublicBookDetail) {
  return `${SITE_URL}/books/${book.slug || book.id}`;
}

function descriptionFor(book: PublicBookDetail) {
  return (
    book.seoDescription ||
    book.description ||
    `${book.author}의 ${book.title} 독후감, 리뷰, 독서 기록과 인상 깊은 문장을 책도장에서 확인해보세요.`
  );
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
    title,
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

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`별점 ${rating}점`}>
      <span className="text-amber-500">{"★".repeat(rating)}</span>
      <span className="text-cream-300">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default async function BookDetailPage({ params }: Props) {
  const { id } = await params;
  const book = await getPublicBook(id);
  if (!book) notFound();

  const writeHref = `/write?bookId=${book.id}&title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}${book.publisher ? `&publisher=${encodeURIComponent(book.publisher)}` : ""}${book.thumbnail ? `&thumbnail=${encodeURIComponent(book.thumbnail)}` : ""}`;
  const url = bookUrl(book);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    author: book.author ? { "@type": "Person", name: book.author } : undefined,
    publisher: book.publisher ? { "@type": "Organization", name: book.publisher } : undefined,
    isbn: book.isbn13 || undefined,
    image: book.thumbnail || undefined,
    description: book.description || descriptionFor(book),
    url,
    aggregateRating: book.reviewCount > 0
      ? {
          "@type": "AggregateRating",
          ratingValue:
            book.reviewExcerpts.reduce((sum, review) => sum + review.rating, 0) /
            Math.max(book.reviewExcerpts.length, 1),
          reviewCount: book.reviewCount,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined,
    review: book.reviewExcerpts.map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.authorNickname },
      reviewBody: review.content,
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
      datePublished: review.createdAt,
      url: `${SITE_URL}/reviews/${review.id}`,
    })),
  };

  return (
    <div className="bg-cream-100">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link href="/" className="text-sm text-brown-500 hover:text-brown-700">
            책도장 피드
          </Link>
          <Link
            href={writeHref}
            className="rounded-full bg-brown-700 px-4 py-2 text-sm text-white hover:bg-brown-800"
          >
            내 독서 기록 남기기
          </Link>
        </div>

        <header className="border-b border-cream-200 bg-white px-5 py-6 sm:px-8">
          <div className="flex gap-5">
            {book.thumbnail ? (
              <Image
                src={book.thumbnail}
                alt={`${book.title} 책 표지`}
                width={104}
                height={150}
                className="h-[150px] w-[104px] flex-shrink-0 rounded object-cover shadow-sm"
                priority
              />
            ) : (
              <div className="h-[150px] w-[104px] flex-shrink-0 rounded bg-brown-300" />
            )}
            <div className="min-w-0">
              <p className="mb-1 text-xs text-brown-400">책 상세 공개 페이지</p>
              <h1 className="font-serif text-3xl font-bold leading-tight text-brown-800">
                {book.title}
              </h1>
              <p className="mt-2 text-sm text-brown-600">{book.author}</p>
              {book.publisher && (
                <p className="mt-1 text-xs text-brown-400">{book.publisher}</p>
              )}
              <p className="mt-4 text-sm text-brown-500">
                {book.readerCount}명이 이 책에 기록을 남겼고, 공개 독후감 {book.reviewCount}개를 볼 수 있어요.
              </p>
            </div>
          </div>
        </header>

        <section className="bg-white px-5 py-6 sm:px-8">
          <h2 className="font-serif text-xl font-bold text-brown-800">{book.title} 줄거리</h2>
          <p className="mt-3 text-base leading-8 text-brown-700">
            {book.description || descriptionFor(book)}
          </p>
        </section>

        <section className="border-t border-cream-200 bg-white px-5 py-6 sm:px-8">
          <h2 className="font-serif text-xl font-bold text-brown-800">{book.title} 독후감</h2>
          {book.reviewExcerpts.length === 0 ? (
            <p className="mt-3 text-sm leading-7 text-brown-500">
              아직 공개 독후감이 없습니다. {book.title}을 읽었다면 첫 독서 기록을 남겨보세요.
            </p>
          ) : (
            <div className="mt-4 space-y-5">
              {book.reviewExcerpts.map((review) => (
                <div key={review.id} className="border-b border-cream-100 pb-5 last:border-0 last:pb-0">
                  <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-semibold text-brown-700">{review.authorNickname}</span>
                    <Stars rating={review.rating} />
                    <time className="text-xs text-brown-300" dateTime={review.createdAt}>
                      {review.createdAt.slice(0, 10)}
                    </time>
                  </div>
                  <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-7 text-brown-700">
                    {review.content}
                  </p>
                  <Link href={`/reviews/${review.id}`} className="mt-2 inline-block text-xs text-brown-500 hover:underline">
                    독후감 전체 보기
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="border-t border-cream-200 bg-white px-5 py-6 sm:px-8">
          <h2 className="font-serif text-xl font-bold text-brown-800">{book.title} 인상 깊은 문장</h2>
          <div className="mt-4 space-y-3">
            {(book.sentenceExcerpts.length > 0 ? book.sentenceExcerpts : [`${book.title}에 대한 독서 기록과 문장 기록이 책도장에 쌓이고 있습니다.`]).map((sentence, index) => (
              <blockquote key={`${sentence}-${index}`} className="border-l-4 border-brown-200 pl-4 text-sm leading-7 text-brown-600">
                {sentence}
              </blockquote>
            ))}
          </div>
        </section>

        <section className="border-t border-cream-200 bg-white px-5 py-6 sm:px-8">
          <h2 className="font-serif text-xl font-bold text-brown-800">
            {book.title}을 읽은 사람들의 기록
          </h2>
          <p className="mt-3 text-sm leading-7 text-brown-600">
            책도장에서는 {book.author}의 {book.title}을 읽은 사람들이 독후감, 리뷰, 독서 기록을 남기고 서로의 생각을 확인할 수 있습니다.
          </p>
          <Link
            href={writeHref}
            className="mt-5 inline-block rounded-full bg-brown-700 px-5 py-2.5 text-sm text-white hover:bg-brown-800"
          >
            내 독서 기록 남기기
          </Link>
        </section>
      </article>
    </div>
  );
}
