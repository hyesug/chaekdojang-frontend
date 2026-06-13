"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReviewCard, { type Review } from "./components/ReviewCard";
import { API_BASE } from "./lib/api";

const BASE = API_BASE;
const PAGE_SIZE = 10;

type FeedTab = "all" | "following";

export default function FeedPage() {
  const router = useRouter();
  const [tab, setTab] = useState<FeedTab>("all");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

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
  const loadAllPage = useCallback(async (pageNum: number) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetch(`${BASE}/api/reviews?page=${pageNum}&size=${PAGE_SIZE}`);
      if (!res.ok) {
        setHasMore(false);
        return;
      }
      const json = await res.json();
      // 백엔드가 Spring Page 객체를 반환: { content: [...], last: boolean, ... }
      const content: Review[] = json.data?.content ?? [];
      const last: boolean = json.data?.last ?? true;
      setReviews((prev) =>
        pageNum === 0 ? content : [...prev, ...content]
      );
      setHasMore(!last);
    } catch {
      // 에러 시 빈 상태 유지
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

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

  /* 탭 바뀔 때 — 상태 초기화 후 첫 페이지 로드 */
  useEffect(() => {
    setReviews([]);
    setPage(0);
    setHasMore(true);
    if (tab === "all") {
      loadAllPage(0);
    } else {
      loadFollowing();
    }
  }, [tab, loadAllPage, loadFollowing]);

  /* page 증가 시 추가 로드 (전체 탭만) */
  useEffect(() => {
    if (page === 0 || tab !== "all") return;
    loadAllPage(page);
  }, [page, tab, loadAllPage]);

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

      {/* 탭: 전체 / 팔로잉 */}
      <div className="flex gap-1 mb-6 bg-cream-200 rounded-xl p-1">
        {(
          [
            { value: "all", label: "📚 전체" },
            { value: "following", label: "❤️ 팔로잉" },
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

      {/* 로딩 */}
      {loading && (
        <div className="text-center py-12 text-brown-400">불러오는 중...</div>
      )}

      {/* 팔로잉 탭 — 미로그인 안내 */}
      {!loading && tab === "following" && !loggedIn && (
        <div className="text-center py-16 text-brown-400">
          <p className="text-4xl mb-3">🔒</p>
          <p className="font-medium text-brown-600 mb-1">
            팔로잉 피드는 로그인 후 이용할 수 있어요
          </p>
          <p className="text-sm mb-6">팔로우한 사람들의 독후감만 모아볼 수 있어요</p>
          <Link
            href="/auth/login"
            className="inline-block px-6 py-2.5 bg-brown-600 text-white rounded-full text-sm font-medium hover:bg-brown-700 transition-colors"
          >
            로그인하기
          </Link>
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
      {!loading && reviews.length === 0 && !(tab === "following" && !loggedIn) && (
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
