import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BookDetailClient, {
  type Book,
  type PurchaseLink,
} from "./BookDetailClient";
import {
  fetchApiData,
  SITE_URL,
  type ReviewDetail,
} from "../../lib/serverApi";

type Props = {
  params: Promise<{ id: string }>;
};

async function getBook(id: string) {
  return fetchApiData<Book>(`/api/books/${id}`, {
    next: { revalidate: 300 },
  });
}

async function getBookReviews(id: string) {
  return (
    (await fetchApiData<ReviewDetail[]>(`/api/books/${id}/reviews`, {
      next: { revalidate: 300 },
    })) ?? []
  );
}

async function getPurchaseLinks(id: string) {
  return (
    (await fetchApiData<PurchaseLink[]>(`/api/books/${id}/purchase-links`, {
      next: { revalidate: 3600 },
    })) ?? []
  );
}

function bookDescription(book: Book, reviewCount: number) {
  const pieces = [
    `${book.title} 독후감`,
    book.author ? `${book.author} 저자` : null,
    reviewCount > 0 ? `${reviewCount}개의 감상` : "첫 독후감을 기다리는 책",
  ].filter(Boolean);
  return `${pieces.join(" · ")}을 책도장에서 확인해보세요.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) {
    return {
      title: "책 정보 - 책도장",
      description: "책도장에서 책과 독후감을 찾아보세요.",
      robots: { index: false, follow: false },
    };
  }

  const reviewCount = book.reviewCount ?? (await getBookReviews(id)).length;
  const title = `${book.title} 독후감 - 책도장`;
  const description = bookDescription(book, reviewCount);

  return {
    title,
    description,
    keywords: [
      `${book.title} 독후감`,
      `${book.title} 서평`,
      `${book.title} 감상문`,
      book.author,
    ].filter(Boolean),
    alternates: { canonical: `/books/${book.id}` },
    openGraph: {
      type: "book",
      locale: "ko_KR",
      url: `${SITE_URL}/books/${book.id}`,
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

export default async function BookDetailPage({ params }: Props) {
  const { id } = await params;
  const [book, reviews, purchaseLinks] = await Promise.all([
    getBook(id),
    getBookReviews(id),
    getPurchaseLinks(id),
  ]);

  if (!book) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    author: book.author
      ? {
          "@type": "Person",
          name: book.author,
        }
      : undefined,
    publisher: book.publisher
      ? {
          "@type": "Organization",
          name: book.publisher,
        }
      : undefined,
    isbn: book.isbn13 || undefined,
    image: book.thumbnail || undefined,
    url: `${SITE_URL}/books/${book.id}`,
    review: reviews.slice(0, 10).map((review) => ({
      "@type": "Review",
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
      url: `${SITE_URL}/reviews/${review.id}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BookDetailClient
        book={{ ...book, reviewCount: reviews.length }}
        reviews={reviews}
        purchaseLinks={purchaseLinks}
      />
    </>
  );
}
