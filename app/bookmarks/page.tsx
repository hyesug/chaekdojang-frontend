"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReviewCard, { type Review } from "../components/ReviewCard";
import { API_BASE } from "../lib/api";

const BASE = API_BASE;

export default function BookmarksPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token: string | null = "cookie-session";
    if (!token || token === "undefined" || token === "null") {
      router.push("/auth/login");
      return;
    }

    fetch(`${BASE}/api/reviews/bookmarked`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) setReviews(json.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-serif text-2xl font-bold text-brown-800 mb-6">저장한 독후감</h1>

      {loading ? (
        <div className="text-center py-12 text-brown-400">불러오는 중...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20 text-brown-400">
          <p className="text-5xl mb-4">🔖</p>
          <p>저장한 독후감이 없어요</p>
          <p className="text-sm mt-1">마음에 드는 독후감의 북마크 버튼을 눌러보세요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-brown-400">{reviews.length}개의 독후감을 저장했어요</p>
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              post={review}
              onVisibilityChange={(updated) => {
                setReviews((prev) =>
                  updated.hidden
                    ? prev.filter((item) => item.id !== updated.id)
                    : prev.map((item) => (item.id === updated.id ? updated : item))
                );
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
