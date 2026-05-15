"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import ReviewCard, { type Review } from "../../components/ReviewCard";

const BASE = "http://localhost:8080";

type Book = {
  id: number;
  title: string;
  author: string;
  publisher: string;
  thumbnail: string | null;
  category: string | null;
};

export default function BookDetailPage() {
  const params = useParams();
  const bookId = Number(params.id);

  const [book, setBook] = useState<Book | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookId) return;

    Promise.all([
      fetch(`${BASE}/api/books/${bookId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${BASE}/api/books/${bookId}/reviews`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([bookJson, reviewsJson]) => {
        if (bookJson) setBook(bookJson.data ?? bookJson);
        if (reviewsJson) setReviews(reviewsJson.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookId]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-brown-400">
        불러오는 중...
      </div>
    );
  }

  if (!book) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-brown-400">
        <p className="text-4xl mb-3">📚</p>
        <p>책 정보를 찾을 수 없습니다.</p>
        <Link href="/search" className="inline-block mt-4 text-sm text-brown-500 underline">
          책 검색하기
        </Link>
      </div>
    );
  }

  const encodedTitle = encodeURIComponent(book.title);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 책 정보 카드 */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6 mb-8 flex gap-5">
        {book.thumbnail ? (
          <Image
            src={book.thumbnail}
            alt={book.title}
            width={80}
            height={112}
            className="rounded shadow-md object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-20 h-28 rounded shadow-md flex-shrink-0 bg-brown-200 flex items-center justify-center text-white text-2xl font-bold">
            {book.title[0]}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-xl font-bold text-brown-800 leading-snug mb-1">
            {book.title}
          </h1>
          <p className="text-sm text-brown-500">{book.author}</p>
          <p className="text-xs text-brown-300 mt-0.5">{book.publisher}</p>
          {book.category && (
            <span className="inline-block mt-2 px-2 py-0.5 bg-cream-200 text-brown-500 text-xs rounded-full">
              {book.category}
            </span>
          )}

          {/* 구매 링크 */}
          <div className="flex gap-3 mt-4">
            <a
              href={`https://www.coupang.com/np/search?q=${encodedTitle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brown-400 hover:text-brown-600 hover:underline transition-colors"
            >
              쿠팡에서 보기 →
            </a>
            <span className="text-brown-200 text-xs">|</span>
            <a
              href={`https://search.kyobobook.co.kr/search?keyword=${encodedTitle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brown-400 hover:text-brown-600 hover:underline transition-colors"
            >
              교보문고에서 보기 →
            </a>
          </div>

          {/* 독후감 쓰기 버튼 */}
          <Link
            href={`/write?bookId=${book.id}&title=${encodedTitle}&author=${encodeURIComponent(book.author)}&publisher=${encodeURIComponent(book.publisher)}${book.thumbnail ? `&thumbnail=${encodeURIComponent(book.thumbnail)}` : ""}`}
            className="inline-block mt-3 px-4 py-1.5 bg-brown-600 text-white text-xs rounded-full hover:bg-brown-700 transition-colors"
          >
            이 책 독후감 쓰기
          </Link>
        </div>
      </div>

      {/* 독후감 목록 */}
      <h2 className="font-serif text-lg font-bold text-brown-800 mb-4">
        이 책을 읽은 사람들의 독후감
        {reviews.length > 0 && (
          <span className="ml-2 text-sm font-normal text-brown-400">{reviews.length}개</span>
        )}
      </h2>

      {reviews.length === 0 ? (
        <div className="text-center py-16 text-brown-400">
          <p className="text-4xl mb-3">✏️</p>
          <p>아직 독후감이 없어요</p>
          <p className="text-sm mt-1">첫 번째 독후감을 남겨보세요!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} post={review} />
          ))}
        </div>
      )}
    </div>
  );
}
