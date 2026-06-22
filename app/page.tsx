"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import ReviewCard, { type Review } from "./components/ReviewCard";
import { API_BASE } from "./lib/api";

const BASE = API_BASE;
const PAGE_SIZE = 10;
const FEED_STATE_KEY = "chaekdojang:feed-state";
const PENDING_REVIEW_KEY = "chaekdojang:pending-review";

type FeedTab = "all" | "following" | "taste";
type SortType = "recent" | "rating" | "popular";

type FeedState = {
  tab: FeedTab;
  sort: SortType;
  page: number;
  reviews: Review[];
  hasMore: boolean;
  scrollY: number;
};

export default function FeedPage() {
  const [tab, setTab] = useState<FeedTab>("all");
  const [sort, setSort] = useState<SortType>("recent");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);
  const [createdNotice, setCreatedNotice] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const pendingReviewRef = useRef<Review | null>(null);

  const mergePendingReview = useCallback((items: Review[], sortType: SortType) => {
    const pending = pendingReviewRef.current;
    if (!pending || sortType !== "recent") return items;
    return [pending, ...items.filter((item) => item.id !== pending.id)];
  }, []);

  useEffect(() => {
    const pendingRaw = sessionStorage.getItem(PENDING_REVIEW_KEY);
    if (pendingRaw) {
      try {
        pendingReviewRef.current = JSON.parse(pendingRaw) as Review;
        setCreatedNotice(true);
        window.setTimeout(() => setCreatedNotice(false), 4000);
        sessionStorage.removeItem(FEED_STATE_KEY);
        sessionStorage.removeItem(PENDING_REVIEW_KEY);
      } catch {
        sessionStorage.removeItem(PENDING_REVIEW_KEY);
      }
      return;
    }

    const raw = sessionStorage.getItem(FEED_STATE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as FeedState;
      if (!Array.isArray(saved.reviews) || saved.reviews.length === 0) return;
      restoredRef.current = true;
      setTab(saved.tab);
      setSort(saved.sort);
      setPage(saved.page);
      setReviews(saved.reviews);
      setHasMore(saved.hasMore);
      setLoading(false);
      requestAnimationFrame(() => window.scrollTo(0, saved.scrollY));
    } catch {
      sessionStorage.removeItem(FEED_STATE_KEY);
    }
  }, [mergePendingReview]);

  useEffect(() => {
    if (loading || reviews.length === 0) return;
    const save = () => {
      const state: FeedState = {
        tab,
        sort,
        page,
        reviews,
        hasMore,
        scrollY: window.scrollY,
      };
      sessionStorage.setItem(FEED_STATE_KEY, JSON.stringify(state));
    };
    save();
    window.addEventListener("pagehide", save);
    window.addEventListener("beforeunload", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
      window.removeEventListener("beforeunload", save);
    };
  }, [tab, sort, page, reviews, hasMore, loading]);

  /* 로그인 상태 동기화 */
  useEffect(() => {
    function syncAuth() {
      const token = localStorage.getItem("token");
      setLoggedIn(!!token && token !== "undefined" && token !== "null");
    }
    syncAuth();
    window.addEventListener("auth-change", syncAuth);
    return () => window.removeEventListener("auth-change", syncAuth);
  }, []);

  /* 전체 피드 — 페이지 단위 로드 */
  const loadAllPage = useCallback(async (pageNum: number, sortType: SortType) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetch(`${BASE}/api/reviews?page=${pageNum}&size=${PAGE_SIZE}&sort=${sortType}`);
      if (!res.ok) {
        setHasMore(false);
        return;
      }
      const json = await res.json();
      // 백엔드가 Spring Page 객체를 반환: { content: [...], last: boolean, ... }
      const content: Review[] = json.data?.content ?? [];
      const last: boolean = json.data?.last ?? true;
      setReviews((prev) =>
        pageNum === 0 ? mergePendingReview(content, sortType) : [...prev, ...content]
      );
      setHasMore(!last);
    } catch {
      // 에러 시 빈 상태 유지
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [mergePendingReview]);

  /* 팔로잉 피드 — 단일 로드 */
  const loadFollowing = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    const hasToken = !!token && token !== "undefined" && token !== "null";

    if (!hasToken) {
      setReviews([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${BASE}/api/reviews/feed`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("token");
        setLoggedIn(false);
        setReviews([]);
      } else if (res.ok) {
        const json = await res.json();
        setReviews(json.data ?? []);
      } else {
        setReviews([]);
      }
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* 취향 피드 — 단일 로드 */
  const loadTaste = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    const hasToken = !!token && token !== "undefined" && token !== "null";
    if (!hasToken) { setReviews([]); setLoading(false); return; }
    try {
      const res = await fetch(`${BASE}/api/reviews/feed/taste`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("token");
        setLoggedIn(false);
        setReviews([]);
      } else if (res.ok) {
        const json = await res.json();
        setReviews(json.data ?? []);
      } else {
        setReviews([]);
      }
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* 탭 또는 정렬 바뀔 때 — 상태 초기화 후 첫 페이지 로드 */
  useEffect(() => {
    if (restoredRef.current) {
      // 복원 직후 첫 실행은 건너뛰고, 다음 실제 탭/정렬 변경부터 정상 동작하도록 플래그를 내린다
      restoredRef.current = false;
      return;
    }
    setReviews([]);
    setPage(0);
    setHasMore(true);
    sessionStorage.removeItem(FEED_STATE_KEY);
    if (tab === "all") {
      loadAllPage(0, sort);
    } else if (tab === "following") {
      loadFollowing();
    } else {
      loadTaste();
    }
  }, [tab, sort, loadAllPage, loadFollowing, loadTaste]);

  /* page 증가 시 추가 로드 (전체 탭만) */
  useEffect(() => {
    if (page === 0 || tab !== "all") return;
    loadAllPage(page, sort);
  }, [page, tab, sort, loadAllPage]);

  /* Intersection Observer — 스크롤 끝에 sentinel이 보이면 다음 페이지 */
  useEffect(() => {
    if (tab !== "all") return;
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
  }, [tab, hasMore, loadingMore, loading]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 피드 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brown-800">피드</h1>
          <p className="text-xs text-brown-400 mt-0.5">이웃의 독후감</p>
        </div>
        <Link
          href="/write"
          className="px-4 py-2 text-sm bg-brown-600 text-white rounded-full hover:bg-brown-700 transition-colors"
        >
          + 독후감 쓰기
        </Link>
      </div>

      {/* 탭: 전체 / 팔로잉 / 취향 */}
      {createdNotice && (
        <div className="mb-4 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
          독후감이 등록됐어요. 피드에 바로 반영했어요.
        </div>
      )}

      <div className="flex gap-1 mb-6 bg-cream-200 rounded-xl p-1">
        {(
          [
            { value: "all", label: "📚 전체" },
            { value: "following", label: "❤️ 팔로잉" },
            { value: "taste", label: "✨ 취향" },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              tab === value
                ? "bg-white text-brown-800 shadow-sm"
                : "text-brown-400 hover:text-brown-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 전체 탭 — 정렬 선택 */}
      {tab === "all" && (
        <div className="flex gap-2 mb-4">
          {([{ value: "recent", label: "최신순" }, { value: "rating", label: "⭐ 별점순" }, { value: "popular", label: "🔥 인기순" }] as const).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSort(value)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                sort === value
                  ? "bg-brown-600 text-white border-brown-600"
                  : "bg-white text-brown-500 border-cream-300 hover:border-brown-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="text-center py-12 text-brown-400">불러오는 중...</div>
      )}

      {/* 취향/팔로잉 탭 — 미로그인 안내 */}
      {!loading && (tab === "following" || tab === "taste") && !loggedIn && (
        <div className="text-center py-16 text-brown-400">
          <p className="text-4xl mb-3">🔒</p>
          <p className="font-medium text-brown-600 mb-1">
            로그인 후 이용할 수 있어요
          </p>
          <p className="text-sm mb-6">
            {tab === "taste" ? "취향이 비슷한 독자들의 독후감을 모아볼 수 있어요" : "팔로우한 사람들의 독후감만 모아볼 수 있어요"}
          </p>
          <Link
            href="/auth/login"
            className="inline-block px-6 py-2.5 bg-brown-600 text-white rounded-full text-sm font-medium hover:bg-brown-700 transition-colors"
          >
            로그인하기
          </Link>
        </div>
      )}

      {/* 취향 탭 — 로그인했지만 추천 없음 */}
      {!loading && tab === "taste" && loggedIn && reviews.length === 0 && (
        <div className="text-center py-16 text-brown-400">
          <p className="text-4xl mb-3">✨</p>
          <p className="font-medium text-brown-600 mb-1">아직 추천할 독자가 없어요</p>
          <p className="text-sm">책을 더 읽고 독후감을 남기면 취향이 맞는 독자를 찾아드려요</p>
        </div>
      )}

      {/* 독후감 목록 */}
      {!loading && reviews.length > 0 && (
        <div className="flex flex-col gap-4">
          {reviews.map((post) => (
            <ReviewCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {/* 전체 탭 — 무한 스크롤 sentinel */}
      {tab === "all" && (
        <div ref={sentinelRef} className="py-6 text-center text-sm text-brown-300">
          {loadingMore ? "불러오는 중..." : hasMore ? "" : reviews.length > 0 ? "마지막 독후감이에요" : ""}
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && reviews.length === 0 && !(tab === "following" && !loggedIn) && !(tab === "taste" && loggedIn) && (
        <div className="text-center py-24 text-brown-400">
          <p className="text-5xl mb-4">📖</p>
          <p className="font-medium">
            {tab === "following"
              ? "팔로우한 사람의 독후감이 없어요"
              : "아직 독후감이 없어요"}
          </p>
          {tab === "all" && <p className="text-sm mt-2">첫 독후감을 작성해보세요!</p>}
        </div>
      )}
    </div>
  );
}
