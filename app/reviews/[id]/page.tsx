import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BackButton from "../../components/BackButton";
import BookReturnLink from "../../components/BookReturnLink";
import ReviewAiSummaryCard from "../../components/ReviewAiSummaryCard";
import ReviewOwnerActions from "../../components/ReviewOwnerActions";
import ReviewEngagement from "../../components/ReviewEngagement";
import ReviewCard, { type Review } from "../../components/ReviewCard";
import ReviewReturnMemory from "../../components/ReviewReturnMemory";
import ReviewRereadHistory from "../../components/ReviewRereadHistory";
import ReviewContinuations from "../../components/ReviewContinuations";
import ReviewReflectionPanel from "../../components/ReviewReflectionPanel";
import SpoilerContent from "../../components/SpoilerContent";
import ReviewViewTracker from "../../components/ReviewViewTracker";
import ProfileAvatar from "../../components/ProfileAvatar";
import StarRating from "../../components/ui/StarRating";
import { bookReturnStorageKey } from "../../lib/returnMemory";
import {
  fetchApiData,
  fetchAuthenticatedApiData,
  reviewDescription,
  reviewTitle,
  shareText,
  SITE_URL,
  type ReviewDetail,
} from "../../lib/serverApi";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
};

async function getReview(id: string) {
  // 숫자가 아닌 id는 백엔드로 넘기지 않는다.
  // 봇이 /reviews/null 같은 주소를 긁으면 백엔드에서 400이 나고 오류 로그만 쌓인다.
  if (!/^\d+$/.test(id)) return null;
  return fetchAuthenticatedApiData<ReviewDetail>(`/api/reviews/${id}`);
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

function safeInternalHref(value?: string) {
  if (!value) return null;
  const candidates = [value];
  try {
    candidates.push(decodeURIComponent(value));
  } catch {
    /* keep the original candidate */
  }

  return candidates.find((candidate) => candidate.startsWith("/") && !candidate.startsWith("//")) ?? null;
}

export default async function PublicReviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = searchParams ? await searchParams : undefined;
  const returnTo = safeInternalHref(query?.returnTo);
  const review = await getReview(id);
  if (!review) notFound();
  const bookReviewsHref = returnTo || (review.book?.id ? `/books/${review.book.id}` : "/");
  const returnStorageKey = `chaekdojang:return-to:${review.id}`;

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

  const kindLabel =
    review.previousReviewId != null
      ? "재독 독후감"
      : review.sourceReviewId != null
        ? "이어 쓴 독후감"
        : "독후감";
  const authorHref = `/u/${encodeURIComponent(review.author.nickname)}`;

  return (
    <div className="min-h-screen">
      <ReviewReturnMemory
        bookId={review.book?.id ?? null}
        reviewId={review.id}
        returnTo={returnTo}
      />
      <ReviewViewTracker reviewId={review.id} />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="cdj-page cdj-page--reading">
        <div className="mb-6 flex items-center justify-between gap-3">
          <BackButton
            fallbackHref={bookReviewsHref}
            fallbackStorageKey={review.book?.id ? bookReturnStorageKey(review.book.id) : undefined}
            preferFallback={Boolean(returnTo)}
            storageKey={returnStorageKey}
          />
          <Link href="/write" className="cdj-button cdj-button--secondary cdj-button--sm">
            나도 도장 찍기
          </Link>
        </div>

        <div className="cdj-card overflow-hidden">
          {/* 책 머리 */}
          <header className="flex gap-5 border-b border-cream-300 bg-cream-100/60 px-5 py-6 sm:px-8 sm:py-8">
            <div className="cdj-cover w-[84px] sm:w-[96px]">
              {review.book?.thumbnail ? (
                <img src={review.book.thumbnail} alt={review.book.title} />
              ) : (
                <span className="block h-full bg-brown-300" />
              )}
            </div>
            <div className="flex min-w-0 flex-col justify-center">
              <p className="cdj-kicker">{kindLabel}</p>
              <h1 className="mt-1.5 font-serif text-2xl font-bold leading-tight text-brown-800 sm:text-[1.875rem]">
                {review.book?.id ? (
                  <Link href={bookReviewsHref} className="transition-colors hover:text-brown-600">
                    {review.book.title}
                  </Link>
                ) : (
                  review.book?.title ?? "독후감"
                )}
              </h1>
              {review.book && <p className="mt-1 text-sm text-sage-600">{review.book.author}</p>}
              <StarRating rating={review.rating} size={16} className="mt-3" />
            </div>
          </header>

          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <ReviewOwnerActions reviewId={review.id} authorId={review.author.id ?? null} />

            {/* 작성자 */}
            <div className="flex items-center gap-3">
              <ProfileAvatar src={review.author.profileImage} name={review.author.nickname} size="sm" />
              <div className="min-w-0 leading-tight">
                {review.author.id != null ? (
                  <Link href={authorHref} className="text-[15px] font-semibold text-brown-800 hover:underline">
                    {review.author.nickname}
                  </Link>
                ) : (
                  <span className="text-[15px] font-semibold text-brown-800">{review.author.nickname}</span>
                )}
                <time className="cdj-meta mt-0.5 block" dateTime={review.createdAt}>
                  {review.createdAt.slice(0, 10).replaceAll("-", ".")}
                </time>
              </div>
            </div>

            {review.keywords && review.keywords.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {review.keywords.map((keyword) => (
                  <span key={keyword} className="rounded bg-cream-200/80 px-2 py-0.5 text-xs text-sage-700">
                    #{keyword}
                  </span>
                ))}
              </div>
            )}

            {review.spoiler ? (
              <SpoilerContent content={review.content} />
            ) : (
              <p className="mt-7 whitespace-pre-wrap text-[16.5px] leading-[1.95] text-brown-900">
                {review.content}
              </p>
            )}

            <ReviewRereadHistory reviewId={review.id} />
            <ReviewContinuations reviewId={review.id} />
            <ReviewReflectionPanel
              reviewId={review.id}
              authorId={review.author.id ?? null}
              hasPreviousReview={review.previousReviewId != null}
            />

            <ReviewEngagement
              reviewId={review.id}
              initialLikeCount={review.likeCount}
              initialCommentCount={review.commentCount}
            />

            {review.book?.id && (
              <div className="mt-5 text-right text-sm">
                <BookReturnLink
                  bookId={review.book.id}
                  href={bookReviewsHref}
                  preferHref={Boolean(returnTo)}
                  className="font-medium text-brown-700 underline decoration-brown-200 underline-offset-4 hover:decoration-brown-700"
                >
                  이 책의 다른 독후감 보기
                </BookReturnLink>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <ReviewAiSummaryCard
            reviewId={review.id}
            authorId={review.author.id ?? null}
            bookTitle={review.book?.title ?? ""}
            bookAuthor={review.book?.author}
            bookThumbnail={review.book?.thumbnail}
            authorNickname={review.author.nickname}
          />
        </div>

        {relatedReviews.length > 0 && (
          <section className="mt-12">
            <h2 className="cdj-heading mb-4">같은 책에 찍힌 다른 도장</h2>
            <div className="flex flex-col gap-4">
              {relatedReviews.map((item) => (
                <ReviewCard key={item.id} post={item} returnTo={bookReviewsHref} />
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
