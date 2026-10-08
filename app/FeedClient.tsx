"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import ReviewCard, { type Review } from "./components/ReviewCard";
import PwaInstallCta from "./components/PwaInstallCta";
import { EmptyState } from "./components/ui/EmptyState";
import { LoadingState, ReviewCardSkeleton } from "./components/ui/LoadingState";
import { BookOpen, CheckCircle2, ChevronRight, LogIn, PenLine, Sparkles } from "lucide-react";
import { API_BASE } from "./lib/api";

const BASE = API_BASE;
const PAGE_SIZE = 10;
const PENDING_REVIEW_KEY = "chaekdojang:pending-review";

type FeedTab = "all" | "following" | "taste";
type SortType = "recent" | "rating" | "popular";

export type FeedPageData = {
  content: Review[];
  last: boolean;
};

type FeedClientProps = {
  initialPage: FeedPageData | null;
};

export default function FeedClient({ initialPage }: FeedClientProps) {
  const [tab, setTab] = useState<FeedTab>("all");
  const [sort, setSort] = useState<SortType>("recent");
  const [reviews, setReviews] = useState<Review[]>(initialPage?.content ?? []);
  const [loading, setLoading] = useState(initialPage === null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialPage ? !initialPage.last : true);
  const [page, setPage] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);
  const [createdNotice, setCreatedNotice] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pendingReviewRef = useRef<Review | null>(null);
  const previousFilterRef = useRef<{ tab: FeedTab; sort: SortType }>({
    tab: "all",
    sort: "recent",
  });

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
        setReviews((prev) => mergePendingReview(prev, "recent"));
        setCreatedNotice(true);
        window.setTimeout(() => setCreatedNotice(false), 4000);
        sessionStorage.removeItem(PENDING_REVIEW_KEY);
      } catch {
        sessionStorage.removeItem(PENDING_REVIEW_KEY);
      }
    }
  }, [mergePendingReview]);

  /* 로그인 상태 동기화 */
  useEffect(() => {
    function syncAuth() {
      const token: string | null = "cookie-session";
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

  /* 서버에서 첫 페이지를 받지 못한 경우에만 브라우저에서 대체 로드 */
  useEffect(() => {
    if (initialPage === null) {
      loadAllPage(0, "recent");
    }
  }, [initialPage, loadAllPage]);

  /* 팔로잉 피드 — 단일 로드 */
  const loadFollowing = useCallback(async () => {
    setLoading(true);
    const token: string | null = "cookie-session";
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
    const token: string | null = "cookie-session";
    const hasToken = !!token && token !== "undefined" && token !== "null";
    if (!hasToken) { setReviews([]); setLoading(false); return; }
    try {
      const res = await fetch(`${BASE}/api/reviews/feed/taste`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
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

  /* 탭 또는 정렬이 실제로 바뀔 때만 첫 페이지 로드 */
  useEffect(() => {
    const previous = previousFilterRef.current;
    if (previous.tab === tab && previous.sort === sort) return;
    previousFilterRef.current = { tab, sort };

    setReviews([]);
    setPage(0);
    setHasMore(true);
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
    <div className="cdj-page cdj-page--reading">
      {/* 피드 헤더 */}
      <header className="mb-8">
        <h1 className="cdj-title">오늘의 독후감</h1>
        <p className="cdj-lead mt-2">
          책도장은 독후감을 기록하고, 읽은 책을 서재에 모으고, 다른 독자의 감상과 책 취향을 나누는 독서 기록 SNS입니다.
        </p>
        <Link
          href="/write"
          className="group mt-5 flex items-center gap-3 rounded-xl border border-cream-300 bg-cream-50 px-4 py-3.5 transition-colors hover:border-brown-200"
        >
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brown-100 text-brown-700">
            <PenLine size={17} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-brown-800">어떤 책을 읽으셨나요?</span>
            <span className="block truncate text-[13px] text-sage-600">
              긴 감상도 AI 독서카드로 한 줄 감상·감정 키워드까지 정리돼요
            </span>
          </span>
          <ChevronRight size={18} className="flex-none text-sage-500 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </header>

      {createdNotice && (
        <div className="cdj-alert mb-5 flex items-start gap-2" role="status">
          <CheckCircle2 size={18} className="mt-0.5 flex-none text-brown-700" aria-hidden="true" />
          <div>
            독후감이 등록됐어요. 피드에 바로 반영했어요.
            <PwaInstallCta variant="inline" />
          </div>
        </div>
      )}

      {/* 탭: 전체 / 팔로잉 / 취향 + 정렬 */}
      <div className="sticky top-16 z-20 -mx-1 mb-5 bg-cream-100 px-1 pt-1">
        <div className="flex items-end justify-between gap-3 border-b border-cream-300">
          <div className="-mb-px flex" role="tablist" aria-label="피드 필터">
            {(
              [
                { value: "all", label: "전체" },
                { value: "following", label: "팔로잉" },
                { value: "taste", label: "취향" },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                role="tab"
                aria-selected={tab === value}
                className="cdj-tab"
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "all" && (
            <label className="mb-2 flex items-center gap-1 text-[13px] text-sage-600">
              <span className="sr-only">정렬</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortType)}
                className="cursor-pointer rounded-md bg-transparent py-1 pl-2 pr-1 font-medium text-brown-800 hover:bg-cream-200 focus:outline-none"
              >
                <option value="recent">최신순</option>
                <option value="rating">별점순</option>
                <option value="popular">인기순</option>
              </select>
            </label>
          )}
        </div>
      </div>

      {/* 로딩 */}
      {loading && <ReviewCardSkeleton />}

      {/* 취향/팔로잉 탭 — 미로그인 안내 */}
      {!loading && (tab === "following" || tab === "taste") && !loggedIn && (
        <EmptyState
          title="로그인 후 이용할 수 있어요"
          icon={<LogIn size={22} aria-hidden="true" />}
          action={<Link href="/auth/login" className="cdj-button cdj-button--primary">로그인하기</Link>}
        >
          {tab === "taste" ? "취향이 비슷한 독자들의 독후감을 모아볼 수 있어요" : "팔로우한 사람들의 독후감만 모아볼 수 있어요"}
        </EmptyState>
      )}

      {/* 취향 탭 — 로그인했지만 추천 없음 */}
      {!loading && tab === "taste" && loggedIn && reviews.length === 0 && (
        <EmptyState title="아직 추천할 독자가 없어요" icon={<Sparkles size={22} aria-hidden="true" />}>
          책을 더 읽고 독후감을 남기면 취향이 맞는 독자를 찾아드려요
        </EmptyState>
      )}

      {/* 독후감 목록 */}
      {!loading && reviews.length > 0 && (
        <div className="flex flex-col gap-4">
          {reviews.map((post) => (
            <ReviewCard
              key={post.id}
              post={post}
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

      {/* 전체 탭 — 무한 스크롤 sentinel */}
      {tab === "all" && (
        <div ref={sentinelRef} className="py-8 text-center text-[13px] text-sage-500">
          {loadingMore ? (
            <LoadingState label="더 불러오는 중" />
          ) : hasMore ? "" : reviews.length > 0 ? (
            <span className="inline-flex items-center gap-3">
              <span className="h-px w-8 bg-cream-300" aria-hidden="true" />
              모든 독후감을 읽었어요
              <span className="h-px w-8 bg-cream-300" aria-hidden="true" />
            </span>
          ) : ""}
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && reviews.length === 0 && !(tab === "following" && !loggedIn) && !(tab === "taste" && loggedIn) && (
        <EmptyState
          title={tab === "following" ? "팔로우한 사람의 독후감이 없어요" : "아직 독후감이 없어요"}
          icon={<BookOpen size={22} aria-hidden="true" />}
          action={tab === "all" ? <Link href="/write" className="cdj-button cdj-button--primary">첫 독후감 쓰기</Link> : undefined}
        />
      )}
    </div>
  );
}
