import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewCard, { type Review } from "../../components/ReviewCard";
import {
  fetchApiData,
  reviewDescription,
  reviewTitle,
  shareText,
  SITE_URL,
  type ReviewDetail,
} from "../../lib/serverApi";

type Props = {
  params: Promise<{ id: string }>;
};

async function getReview(id: string) {
  return fetchApiData<ReviewDetail>(`/api/reviews/${id}`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const review = await getReview(id);
  if (!review) {
    return {
      title: "독후감 - 책도장",
      description: shareText(),
      robots: { index: false, follow: false },
    };
  }

  const title = reviewTitle(review);
  const description = reviewDescription(review) || shareText();
  const url = `${SITE_URL}/reviews/${review.id}`;
  const keywords = review.book?.title
    ? [`${review.book.title} 독후감`, `${review.book.title} 서평`, `${review.book.title} 감상문`]
    : ["독후감", "서평", "감상문"];

  return {
    title,
    description,
    keywords,
    alternates: { canonical: `/reviews/${review.id}` },
    openGraph: {
      type: "article",
      locale: "ko_KR",
      url,
      siteName: "책도장",
      title,
      description,
      images: [
        {
          url: `/reviews/${review.id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/reviews/${review.id}/opengraph-image`],
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

export default async function PublicReviewPage({ params }: Props) {
  const { id } = await params;
  const review = await getReview(id);
  if (!review) notFound();

  const related = review.book?.id
    ? await fetchApiData<Review[]>(`/api/books/${review.book.id}/reviews`)
    : [];
  const relatedReviews = (related ?? []).filter((item) => item.id !== review.id).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Review",
    itemReviewed: review.book
      ? {
          "@type": "Book",
          name: review.book.title,
          author: review.book.author,
        }
      : undefined,
    author: {
      "@type": "Person",
      name: review.author.nickname,
    },
    reviewBody: review.content,
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1,
    },
    datePublished: review.createdAt,
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8ea_0,#faf6ef_34%,#f2e4ce_100%)]">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link href="/" className="text-sm text-brown-500 hover:text-brown-700">
            책도장 피드
          </Link>
          <Link
            href="/write"
            className="px-4 py-2 rounded-full bg-brown-700 text-white text-sm hover:bg-brown-800"
          >
            나도 도장 찍기
          </Link>
        </div>

        <div className="bg-white border border-brown-100 shadow-sm rounded-lg overflow-hidden">
          <div className="px-5 sm:px-8 pt-7 pb-5 border-b border-cream-200 bg-cream-50">
            <div className="flex gap-4">
              {review.book?.thumbnail ? (
                <Image
                  src={review.book.thumbnail}
                  alt={review.book.title}
                  width={76}
                  height={108}
                  className="rounded shadow object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-[76px] h-[108px] rounded bg-brown-300 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs text-brown-400 mb-1">공개 독후감</p>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-brown-800 leading-tight">
                  {review.book?.title ?? "독후감"}
                </h1>
                {review.book && (
                  <p className="mt-1 text-sm text-brown-500">{review.book.author}</p>
                )}
                <div className="mt-3 text-sm">
                  <Stars rating={review.rating} />
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-8 py-6">
            <div className="mb-6 flex items-center justify-between gap-3 text-sm">
              <Link
                href={`/users/${review.author.id}`}
                className="font-semibold text-brown-700 hover:underline"
              >
                {review.author.nickname}
              </Link>
              <time className="text-brown-300" dateTime={review.createdAt}>
                {review.createdAt.slice(0, 10)}
              </time>
            </div>

            <p className="text-base leading-8 text-brown-800 whitespace-pre-wrap">
              {review.content}
            </p>

            <div className="mt-7 pt-5 border-t border-cream-200 flex flex-wrap items-center gap-3 text-sm text-brown-400">
              <span>좋아요 {review.likeCount}</span>
              <span>댓글 {review.commentCount}</span>
              {review.book?.id && (
                <Link href={`/books/${review.book.id}`} className="ml-auto text-brown-600 hover:underline">
                  이 책의 다른 독후감 보기
                </Link>
              )}
            </div>
          </div>
        </div>

        {relatedReviews.length > 0 && (
          <section className="mt-8">
            <h2 className="font-serif text-xl font-bold text-brown-800 mb-4">
              같은 책에 찍힌 다른 도장
            </h2>
            <div className="flex flex-col gap-4">
              {relatedReviews.map((item) => (
                <ReviewCard key={item.id} post={item} />
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
