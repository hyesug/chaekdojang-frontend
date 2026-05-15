"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReviewCard, { type Review } from "../components/ReviewCard";

const BASE = "http://localhost:8080";
const PAGE_SIZE = 10;

type SortType = "recent" | "popular";

export default function ExplorePage() {
  const [sort, setSort] = useState<SortType>("recent");

  // 최신순: 무한 스크롤
  const [reviews, setReviews] = useState<Review[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // 인기순: 전체 로드 후 클라이언트 정렬
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [popularLoading, setPopularLoading] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // 최신순 — 페이지 단위 로드
  const loadPage = useCallback(async (pageNum: number) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await fetch(`${BASE}/api/reviews/paged?page=${pageNum}&size=${PAGE_SIZE}`);
      if (!res.ok) return;
      const json = await res.json();
      const pageData = json.data;
      const content: Review[] = pageData.content ?? [];
      const last: boolean = pageData.last ?? true;
      setReviews((prev) => (pageNum === 0 ? content : [...prev, ...content]));
      setHasMore(!last);
    } catch {
      /* 무시 */
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // 인기순 — 전체 로드
  const loadPopular = useCallback(async () => {
    if (allReviews.length > 0) return; // 이미 로드됨
    setPopularLoading(true);
    try {
      const res = await fetch(`${BASE}/api/reviews`);
      if (res.ok) {
        const json = await res.json();
        const data: Review[] = json.data ?? [];
        data.sort((a, b) => b.likeCount - a.likeCount);
        setAllReviews(data);
      }
    } catch {
      /* 무시 */
    } finally {
      setPopularLoading(false);
    }
  }, [allReviews.length]);

  // 탭 전환 시 처리
  useEffect(() => {
    if (sort === "recent") {
      setReviews([]);
      setPage(0);
      setHasMore(true);
      loadPage(0);
    } else {
      loadPopular();
    }
  }, [sort]); // eslint-disable-line react-hooks/exhaustive-deps

  // 페이지 증가 시 추가 로드
  useEffect(() => {
    if (page === 0) return;
    loadPage(page);
  }, [page, loadPage]);

  // Intersection Observer — sentinel 요소가 보이면 다음 페이지 요청
  useEffect(() => {
    if (sort !== "recent") return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((p) => p + 1);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sort, hasMore, loadingMore, loading]);

  const displayedReviews = sort === "recent" ? reviews : allReviews;
  const isLoading = sort === "recent" ? loading : popularLoading;

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

      {isLoading ? (
        <div className="text-center py-12 text-brown-400">불러오는 중...</div>
      ) : displayedReviews.length === 0 ? (
        <div className="text-center py-20 text-brown-400">
          <p className="text-5xl mb-4">📖</p>
          <p>아직 독후감이 없어요</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {displayedReviews.map((review) => (
              <ReviewCard key={review.id} post={review} />
            ))}
          </div>

          {/* 무한 스크롤 sentinel (최신순에서만) */}
          {sort === "recent" && (
            <div ref={sentinelRef} className="py-6 text-center text-sm text-brown-300">
              {loadingMore ? "불러오는 중..." : hasMore ? "" : "마지막 독후감이에요"}
            </div>
          )}
        </>
      )}
    </div>
  );
}
