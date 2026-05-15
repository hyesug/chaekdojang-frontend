"use client";

import { useState, useEffect } from "react";
import ReviewCard, { type Review } from "../components/ReviewCard";

const BASE = "http://localhost:8080";

type SortType = "recent" | "popular";

export default function ExplorePage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortType>("recent");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${BASE}/api/reviews`);
        if (res.ok) {
          const json = await res.json();
          const data: Review[] = json.data ?? [];
          if (sort === "popular") {
            data.sort((a, b) => b.likeCount - a.likeCount);
          }
          setReviews(data);
        }
      } catch {
        /* 무시 */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sort]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brown-800">탐색</h1>
          <p className="text-xs text-brown-400 mt-0.5">모든 독후감 둘러보기</p>
        </div>
      </div>

      {/* 정렬 탭 */}
      <div className="flex gap-1 mb-6 bg-cream-200 rounded-xl p-1">
        {(
          [
            { value: "recent", label: "🕐 최신순" },
            { value: "popular", label: "🔥 인기순" },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSort(value)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              sort === value
                ? "bg-white text-brown-800 shadow-sm"
                : "text-brown-400 hover:text-brown-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-brown-400">불러오는 중...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20 text-brown-400">
          <p className="text-5xl mb-4">📖</p>
          <p>아직 독후감이 없어요</p>
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
