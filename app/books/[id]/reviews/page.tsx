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
};

async function getBook(id: string) {
  return fetchApiData<BookDetail>(`/api/books/${id}`, {
    next: { revalidate: 300 },
  });
}

async function getReviews(id: string) {
  return (
    (await fetchApiData<ReviewDetail[]>(`/api/books/${id}/reviews`, {
      next: { revalidate: 300 },
    })) ?? []
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) {
    return {
      title: "책별 독후감 - 책도장",
      description: "책도장에서 책별 독후감을 찾아보세요.",
      robots: { index: false, follow: false },
    };
  }

  const reviews = await getReviews(id);
  const title = `${book.title} 독후감 모음 - 책도장`;
  const description = `${book.title}에 남겨진 ${reviews.length}개의 독후감과 감상을 책도장에서 확인해보세요.`;

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

export default async function BookReviewsPage({ params }: Props) {
  const { id } = await params;
  const [book, reviews] = await Promise.all([getBook(id), getReviews(id)]);
  if (!book) notFound();

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
          {book.title} 독후감 모음
        </h1>
        <p className="mt-1 text-sm text-brown-500">{book.author}</p>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-16 text-brown-400">
          <p className="text-4xl mb-3">✏️</p>
          <p>아직 독후감이 없어요</p>
          <p className="text-sm mt-1">첫 번째 독후감을 남겨보세요.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} post={review} />
          ))}
        </div>
      )}
    </main>
  );
}
