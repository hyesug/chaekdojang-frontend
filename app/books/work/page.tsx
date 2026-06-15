"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ReviewCard, { type Review } from "../../components/ReviewCard";
import { API_BASE } from "../../lib/api";

function WorkReviewsContent() {
  const searchParams = useSearchParams();
  const title = searchParams.get("title") ?? "";
  const author = searchParams.get("author") ?? "";
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!title || !author) {
      setLoading(false);
      return;
    }

    fetch(
      `${API_BASE}/api/books/work/reviews?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setReviews(json?.data ?? []))
      .finally(() => setLoading(false));
  }, [title, author]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/search" className="text-sm text-brown-400 hover:text-brown-600">
          ← 검색으로
        </Link>
        <h1 className="font-serif text-2xl font-bold text-brown-800 mt-3">
          {title || "작품"} 독후감
        </h1>
        {author && <p className="text-sm text-brown-400 mt-1">{author}</p>}
        <p className="text-xs text-brown-300 mt-2">
          제목과 저자가 같은 여러 판본의 독후감을 함께 모아봅니다.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-brown-400">불러오는 중...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 text-brown-400 bg-white border border-cream-200 rounded-lg">
          <p className="text-4xl mb-3">📖</p>
          <p>아직 이 작품에 찍힌 독후감이 없어요.</p>
          <Link
            href={`/search?q=${encodeURIComponent(title)}`}
            className="inline-block mt-4 text-sm text-brown-600 underline underline-offset-2"
          >
            다른 판본 찾아보기
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-brown-400">{reviews.length}개의 독후감을 모았어요</p>
          {reviews.map((review) => (
            <ReviewCard key={review.id} post={review} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkReviewsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-16 text-center text-brown-400">
          불러오는 중...
        </div>
      }
    >
      <WorkReviewsContent />
    </Suspense>
  );
}
