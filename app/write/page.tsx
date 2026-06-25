"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE } from "../lib/api";
import { authFetch } from "../lib/auth";

const FEED_STATE_KEY = "chaekdojang:feed-state";
const PENDING_REVIEW_KEY = "chaekdojang:pending-review";
const LEGACY_REVIEW_DRAFT_KEY = "chaekdojang:review-draft";
const REVIEW_DRAFT_KEY_PREFIX = "chaekdojang:review-draft:v2";

type BookResult = {
  id: number;
  isbn13: string;
  title: string;
  author: string;
  publisher: string;
  thumbnail: string | null;
  source: string;
};

type ReviewDraft = {
  selectedBook?: BookResult | null;
  rating?: number;
  content?: string;
};

function getReviewDraftKey(userId: number | "anonymous", bookId?: number | null) {
  return `${REVIEW_DRAFT_KEY_PREFIX}:${userId}:${bookId ?? "general"}`;
}

/* 별점 선택 컴포넌트 — hover 시 색상 미리보기 */
function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const LABELS = ["", "별로예요", "그저 그래요", "괜찮아요", "좋아요", "최고예요"];

  return (
    <div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className={`text-3xl transition-colors leading-none ${
              star <= (hover || value) ? "text-amber-500" : "text-cream-300"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-sm text-brown-400 h-5">
        {LABELS[hover || value]}
      </p>
    </div>
  );
}

function WriteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const restoredKeyRef = useRef<string | null>(null);

  /* 책 검색 상태 */
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookResult | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | "anonymous" | null>(null);

  /* 검색 페이지에서 넘어온 경우 책 자동 선택 */
  useEffect(() => {
    const bookId = searchParams.get("bookId");
    const title = searchParams.get("title");
    const author = searchParams.get("author");
    if (bookId && title) {
      setSelectedBook({
        id: Number(bookId),
        title,
        author: author ?? "",
        publisher: searchParams.get("publisher") ?? "",
        thumbnail: searchParams.get("thumbnail"),
        isbn13: "",
        source: "",
      });
    }
  }, [searchParams]);

  /* 독후감 상태 */
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftReadyKey, setDraftReadyKey] = useState<string | null>(null);

  /* 제출 상태 */
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    localStorage.removeItem(LEGACY_REVIEW_DRAFT_KEY);

    authFetch(`${API_BASE}/api/users/me`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          setCurrentUserId("anonymous");
          return;
        }
        const json = await res.json().catch(() => null);
        const userId = json?.data?.id;
        setCurrentUserId(typeof userId === "number" ? userId : "anonymous");
      })
      .catch(() => setCurrentUserId("anonymous"));
  }, []);

  useEffect(() => {
    if (currentUserId === null) return;

    const draftKey = getReviewDraftKey(currentUserId, selectedBook?.id);
    if (restoredKeyRef.current === draftKey) return;

    restoredKeyRef.current = draftKey;
    setDraftReadyKey(draftKey);
    setDraftRestored(false);

    const hasCurrentInput = rating > 0 || content.trim().length > 0;
    if (hasCurrentInput) return;

    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as ReviewDraft;
      if (draft.selectedBook) setSelectedBook(draft.selectedBook);
      if (typeof draft.rating === "number") setRating(draft.rating);
      if (typeof draft.content === "string") setContent(draft.content);
      setDraftRestored(true);
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [content, currentUserId, rating, selectedBook?.id]);

  useEffect(() => {
    if (currentUserId === null) return;
    const draftKey = getReviewDraftKey(currentUserId, selectedBook?.id);
    if (draftReadyKey !== draftKey) return;
    if (!selectedBook && rating === 0 && !content.trim()) return;
    localStorage.setItem(draftKey, JSON.stringify({ selectedBook, rating, content }));
  }, [currentUserId, draftReadyKey, selectedBook, rating, content]);

  async function searchBooks() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/books/search?q=${encodeURIComponent(query)}`
      );
      if (res.ok) {
        /* 백엔드 응답: { success, data: BookResponse[], message } */
        const json = await res.json();
        setResults(json.data ?? json);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBook) { setError("책을 선택해주세요."); return; }
    if (rating === 0) { setError("별점을 선택해주세요."); return; }
    if (content.trim().length < 10) { setError("독후감을 10자 이상 작성해주세요."); return; }

    setSubmitting(true);
    setError("");

    try {
      const res = await authFetch(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookId: selectedBook.id, rating, content }),
      });

      if (res.status === 401) {
        
        router.push("/auth/login");
        return;
      }
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const createdReview = json?.data ?? json;
        if (currentUserId !== null) {
          localStorage.removeItem(getReviewDraftKey(currentUserId, selectedBook.id));
        }
        localStorage.removeItem(LEGACY_REVIEW_DRAFT_KEY);
        sessionStorage.removeItem(FEED_STATE_KEY);
        if (createdReview?.id) {
          sessionStorage.setItem(PENDING_REVIEW_KEY, JSON.stringify(createdReview));
        }
        router.push("/");
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { message?: string }).message ?? "저장에 실패했습니다.");
      }
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 pb-28 sm:pb-8">
      {submitting && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-xs rounded-2xl border border-cream-200 bg-white p-6 text-center shadow-lg">
            <div className="mx-auto mb-4 h-8 w-8 rounded-full border-2 border-brown-200 border-t-brown-600 animate-spin" />
            <p className="font-serif text-lg font-bold text-brown-800">독후감 등록 중</p>
            <p className="mt-2 text-sm text-brown-400">
              저장이 끝나면 피드로 이동해요. 잠시만 기다려 주세요.
            </p>
          </div>
        </div>
      )}
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-4 mb-5">
        <Link href="/" className="text-sm text-brown-400 hover:text-brown-600 transition-colors">
          ← 피드로
        </Link>
        <h1 className="font-serif text-2xl font-bold text-brown-800">독후감 쓰기</h1>
      </div>

      {draftRestored && (
        <p className="mb-4 rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-sm text-brown-500">
          이전에 쓰던 독후감을 불러왔어요.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* STEP 1: 책 검색 */}
        <section className="bg-white rounded-lg border border-cream-200 p-5 sm:p-6 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-700 mb-4">
            1. 어떤 책을 읽었나요?
          </h2>

          {selectedBook ? (
            /* 선택된 책 표시 */
            <div className="flex items-center gap-3 bg-cream-50 rounded-xl px-4 py-3 border border-cream-200">
              {selectedBook.thumbnail ? (
                <img src={selectedBook.thumbnail} alt="" className="w-10 h-14 object-cover rounded flex-shrink-0 shadow-sm" />
              ) : (
                <div className="w-10 h-14 bg-brown-300 rounded flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-brown-800">{selectedBook.title}</p>
                <p className="text-sm text-brown-400 mt-0.5">
                  {selectedBook.author} · {selectedBook.publisher}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedBook(null); setResults([]); setQuery(""); }}
                className="text-xs text-brown-400 hover:text-brown-600 transition-colors ml-2 flex-shrink-0"
              >
                변경
              </button>
            </div>
          ) : (
            <>
              {/* 검색 입력 */}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchBooks())}
                  placeholder="책 제목 또는 저자 검색"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-cream-300 text-sm text-brown-800 bg-cream-50 placeholder:text-brown-300 focus:outline-none focus:border-brown-400 focus:ring-2 focus:ring-brown-100 transition"
                />
                <button
                  type="button"
                  onClick={searchBooks}
                  disabled={searching}
                  className="px-5 py-2.5 bg-brown-600 text-white rounded-xl text-sm font-medium hover:bg-brown-700 transition-colors disabled:opacity-50"
                >
                  {searching ? "..." : "검색"}
                </button>
              </div>

              {/* 검색 결과 */}
              {results.length > 0 && (
                <ul className="mt-2 border border-cream-200 rounded-xl overflow-hidden">
                  {results.map((book) => (
                    <li key={`${book.isbn13}-${book.source}`} className="border-b border-cream-100 last:border-0">
                      <button
                        type="button"
                        onClick={() => { setSelectedBook(book); setResults([]); }}
                        className="w-full text-left px-4 py-3 hover:bg-cream-50 transition-colors flex items-center gap-3"
                      >
                        {book.thumbnail ? (
                          <img src={book.thumbnail} alt="" className="w-8 h-11 object-cover rounded flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-11 bg-brown-200 rounded flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-brown-800">{book.title}</p>
                          <p className="text-xs text-brown-400">{book.author} · {book.publisher}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {results.length === 0 && query && !searching && (
                <p className="mt-2 text-sm text-brown-400 text-center py-3">검색 결과가 없습니다.</p>
              )}
            </>
          )}
        </section>

        {/* STEP 2: 별점 */}
        <section className="bg-white rounded-lg border border-cream-200 p-5 sm:p-6 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-700 mb-4">
            2. 별점을 매겨주세요
          </h2>
          <StarPicker value={rating} onChange={setRating} />
        </section>

        {/* STEP 3: 독후감 본문 */}
        <section className="bg-white rounded-lg border border-cream-200 p-5 sm:p-6 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-700 mb-4">
            3. 독후감을 남겨주세요
          </h2>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="이 책을 읽고 어떤 생각이 드셨나요? 기억에 남는 문장, 감상, 추천 이유 등을 자유롭게 적어주세요."
            rows={10}
            className="w-full min-h-[42vh] sm:min-h-0 px-4 py-3 rounded-xl border border-cream-300 text-base sm:text-sm text-brown-800 bg-cream-50 placeholder:text-brown-300 focus:outline-none focus:border-brown-400 focus:ring-2 focus:ring-brown-100 transition resize-none leading-relaxed"
          />
          <p className="mt-1.5 text-xs text-brown-300 text-right">{content.length}자</p>
        </section>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="hidden sm:block w-full py-3 bg-brown-600 text-white rounded-xl font-medium hover:bg-brown-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "저장 중..." : "독후감 올리기"}
        </button>

        <div className="fixed left-0 right-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-cream-200 px-4 py-3 sm:hidden">
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-brown-700 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "저장 중..." : "독후감 올리기"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function WritePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
          <p className="text-sm text-brown-400">불러오는 중...</p>
        </div>
      }
    >
      <WriteContent />
    </Suspense>
  );
}
