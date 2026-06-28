"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import ReviewCard, { type Review } from "../components/ReviewCard";
import ProfileAvatar from "../components/ProfileAvatar";
import { API_BASE } from "../lib/api";

const BASE = API_BASE;
const PAGE_SIZE = 10;

type SortType = "recent" | "rating" | "popular";

type RecommendedUser = {
  id: number;
  nickname: string;
  profileImage: string | null;
  bio: string | null;
  overlapCount: number;
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return "cookie-session";
}

function normalizeSort(value: string | null): SortType {
  return value === "rating" || value === "popular" ? value : "recent";
}

function getSortFromUrl(): SortType {
  if (typeof window === "undefined") return "recent";
  return normalizeSort(new URLSearchParams(window.location.search).get("sort"));
}

export default function ExplorePage() {
  const [sort, setSort] = useState<SortType>(getSortFromUrl);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // 추천 독자
  const [recommendedUsers, setRecommendedUsers] = useState<RecommendedUser[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<number, boolean>>({});
  const [followLoadingMap, setFollowLoadingMap] = useState<Record<number, boolean>>({});

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePopState = () => setSort(getSortFromUrl());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function changeSort(nextSort: SortType) {
    setSort(nextSort);
    const params = new URLSearchParams(window.location.search);
    if (nextSort === "recent") {
      params.delete("sort");
    } else {
      params.set("sort", nextSort);
    }
    const query = params.toString();
    window.history.pushState(null, "", query ? `/explore?${query}` : "/explore");
  }

  // 추천 독자 로드
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${BASE}/api/users/me/recommendations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) setRecommendedUsers(json.data ?? []);
      })
      .catch(() => {});
  }, []);

  async function handleFollow(userId: number) {
    const token = getToken();
    if (!token) return;
    const next = !followingMap[userId];
    setFollowingMap((prev) => ({ ...prev, [userId]: next }));
    setFollowLoadingMap((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`${BASE}/api/users/${userId}/follow`, {
        method: next ? "POST" : "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setFollowingMap((prev) => ({ ...prev, [userId]: !next }));
      }
    } catch {
      setFollowingMap((prev) => ({ ...prev, [userId]: !next }));
    } finally {
      setFollowLoadingMap((prev) => ({ ...prev, [userId]: false }));
    }
  }

  const loadPage = useCallback(async (pageNum: number, sortType: SortType) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await fetch(`${BASE}/api/reviews?page=${pageNum}&size=${PAGE_SIZE}&sort=${sortType}`);
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

  // 탭 전환 시 처리
  useEffect(() => {
    setReviews([]);
    setPage(0);
    setHasMore(true);
    loadPage(0, sort);
  }, [sort, loadPage]);

  // 페이지 증가 시 추가 로드
  useEffect(() => {
    if (page === 0) return;
    loadPage(page, sort);
  }, [page, sort, loadPage]);

  // Intersection Observer — sentinel 요소가 보이면 다음 페이지 요청
  useEffect(() => {
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
  }, [hasMore, loadingMore, loading]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brown-800">탐색</h1>
          <p className="text-xs text-brown-400 mt-0.5">모든 독후감 둘러보기</p>
        </div>
      </div>

      {/* 추천 독자 섹션 — 로그인 + 추천 있을 때만 */}
      {recommendedUsers.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-brown-600 mb-3">👥 추천 독자</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {recommendedUsers.map((user) => (
              <div
                key={user.id}
                className="flex-shrink-0 w-40 bg-white rounded-2xl border border-cream-200 p-3 flex flex-col items-center gap-2"
              >
                <Link href={`/users/${user.id}`}>
                  <ProfileAvatar src={user.profileImage} name={user.nickname} size="md" />
                </Link>
                <div className="text-center min-w-0 w-full">
                  <Link
                    href={`/users/${user.id}`}
                    className="text-xs font-semibold text-brown-700 hover:underline truncate block"
                  >
                    {user.nickname}
                  </Link>
                  {user.overlapCount > 0 && (
                    <span className="text-xs text-brown-400">{user.overlapCount}권 겹침</span>
                  )}
                </div>
                <button
                  onClick={() => handleFollow(user.id)}
                  disabled={followLoadingMap[user.id]}
                  className={`w-full py-1 text-xs rounded-full transition-colors disabled:opacity-50 ${
                    followingMap[user.id]
                      ? "bg-cream-200 text-brown-600 border border-brown-300"
                      : "bg-brown-600 text-white hover:bg-brown-700"
                  }`}
                >
                  {followingMap[user.id] ? "팔로잉" : "팔로우"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 정렬 탭 */}
      <div className="flex gap-1 mb-6 bg-cream-200 rounded-xl p-1">
        {(
          [
            { value: "recent", label: "🕐 최신순" },
            { value: "rating", label: "⭐ 별점순" },
            { value: "popular", label: "🔥 인기순" },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => changeSort(value)}
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
        <>
          <div className="flex flex-col gap-4">
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

          <div ref={sentinelRef} className="py-6 text-center text-sm text-brown-300">
            {loadingMore ? "불러오는 중..." : hasMore ? "" : "마지막 독후감이에요"}
          </div>
        </>
      )}
    </div>
  );
}
