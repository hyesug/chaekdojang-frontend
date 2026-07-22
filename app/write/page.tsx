"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE } from "../lib/api";
import { authFetch } from "../lib/auth";
import { getSessionId, trackMetric } from "../components/AnalyticsTracker";

const FEED_STATE_KEY = "chaekdojang:feed-state";
const PENDING_REVIEW_KEY = "chaekdojang:pending-review";
const LEGACY_REVIEW_DRAFT_KEY = "chaekdojang:review-draft";
const REVIEW_DRAFT_KEY_PREFIX = "chaekdojang:review-draft:v2";
const DEFAULT_FEEDBACK_MIN_CHARS = 150;
const DEFAULT_FEEDBACK_MAX_CHARS = 6000;

type BookResult = {
  id: number;
  isbn13: string | null;
  title: string;
  author: string;
  publisher: string;
  thumbnail: string | null;
  source: string;
  contentType?: "BOOK" | "WEB_NOVEL";
  externalId?: string | null;
  sourceUrl?: string | null;
};

type SearchMode = "BOOK" | "WEB_NOVEL";

type WebNovelResult = {
  title: string;
  author: string;
  platform: "NAVER_SERIES" | "KAKAO_PAGE" | "RIDI" | "MUNPIA";
  platformLabel: string;
  sourceUrl: string;
  externalId: string;
  description: string;
};

type FeedbackSentenceExample = {
  before: string;
  after: string;
};

type FeedbackImprovement = {
  point: string;
  before: string;
  direction: string;
  after: string;
  reason: string;
};

type FeedbackResult = {
  notReview: boolean;
  message?: string;
  coreTheme?: string;
  strengths?: string[];
  improvements?: FeedbackImprovement[];
  sentenceExamples?: FeedbackSentenceExample[];
  titleSuggestions?: string[];
  deepQuestion?: string;
};

type FeedbackConfig = {
  minChars: number;
  maxChars: number;
  boundaryMessage?: string | null;
  betaApplyUrl?: string | null;
  dailyLimitEnabled?: boolean;
};

function normalizeFeedbackText(value: string) {
  return value.replace(/[\s.,!?;:'"“”‘’()[\]{}·…-]/g, "").trim();
}

function hasMeaningfulRewrite(item: FeedbackImprovement) {
  return normalizeFeedbackText(item.before) !== normalizeFeedbackText(item.after);
}

function clearReviewDraftStorage() {
  localStorage.removeItem(LEGACY_REVIEW_DRAFT_KEY);
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(REVIEW_DRAFT_KEY_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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
      <p className="mt-1.5 text-sm text-brown-400 h-5">{LABELS[hover || value]}</p>
    </div>
  );
}

function WriteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 수정 모드: ?reviewId=123 이 있으면 기존 독후감 수정
  const reviewId = searchParams.get("reviewId");
  const isEditMode = !!reviewId;

  const [query, setQuery] = useState(() => searchParams.get("title") ?? "");
  const [results, setResults] = useState<BookResult[]>([]);
  const [webNovelResults, setWebNovelResults] = useState<WebNovelResult[]>([]);
  const [searchMode, setSearchMode] = useState<SearchMode>(() =>
    searchParams.get("contentType") === "WEB_NOVEL" ? "WEB_NOVEL" : "BOOK"
  );
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookResult | null>(null);
  const [webNovelCandidate, setWebNovelCandidate] = useState<WebNovelResult | null>(null);
  const [webNovelTitle, setWebNovelTitle] = useState("");
  const [webNovelAuthor, setWebNovelAuthor] = useState("");
  const [showDirectNaverRegister, setShowDirectNaverRegister] = useState(
    () => searchParams.get("direct") === "naver"
  );
  const [directNaverUrl, setDirectNaverUrl] = useState("");
  const [directNaverTitle, setDirectNaverTitle] = useState(() => searchParams.get("title") ?? "");
  const [directNaverAuthor, setDirectNaverAuthor] = useState(() => searchParams.get("author") ?? "");

  // 수정 모드: 기존 독후감 데이터 로드
  useEffect(() => {
    if (!reviewId) return;
    fetch(`/api/reviews/${reviewId}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const data = json?.data ?? json;
        if (!data) return;
        if (data.book) {
          setSelectedBook({
            id: data.book.id,
            title: data.book.title ?? "",
            author: data.book.author ?? "",
            publisher: data.book.publisher ?? "",
            thumbnail: data.book.thumbnail ?? null,
            isbn13: data.book.isbn13 ?? "",
            source: "edit",
          });
        }
        const fullContent: string = data.content ?? "";
        setOneLineReview("");
        setContent(fullContent);
        setRating(data.rating ?? 0);
        setIsPublic(!data.hidden);
        setGenerateAiSummary(false);
      })
      .catch(() => {});
  }, [reviewId]);

  useEffect(() => {
    if (isEditMode) return; // 수정 모드에서는 URL 파라미터 책 자동선택 건너뜀
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
        source: searchParams.get("source") ?? "",
        contentType: searchParams.get("contentType") === "WEB_NOVEL" ? "WEB_NOVEL" : "BOOK",
        sourceUrl: searchParams.get("sourceUrl"),
      });
    }
  }, [searchParams, isEditMode]);

  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [oneLineReview, setOneLineReview] = useState("");
  const [emotionInput, setEmotionInput] = useState("");
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [generateAiSummary, setGenerateAiSummary] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [feedbackConfig, setFeedbackConfig] = useState<FeedbackConfig>({
    minChars: DEFAULT_FEEDBACK_MIN_CHARS,
    maxChars: DEFAULT_FEEDBACK_MAX_CHARS,
  });
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackUsedForCurrentDraft, setFeedbackUsedForCurrentDraft] = useState(false);

  useEffect(() => {
    clearReviewDraftStorage();
  }, []);

  useEffect(() => {
    authFetch(`${API_BASE}/api/feedback/config`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        const data = json?.data;
        if (typeof data?.minChars === "number" && typeof data?.maxChars === "number") {
          setFeedbackConfig(data);
        }
      })
      .catch(() => {});
  }, []);

  function toggleEmotion(keyword: string) {
    setSelectedEmotions((prev) =>
      prev.includes(keyword) ? prev.filter((item) => item !== keyword) : [...prev, keyword]
    );
  }

  function addEmotionKeyword() {
    const keyword = emotionInput.trim();
    if (!keyword || selectedEmotions.includes(keyword)) return;
    setSelectedEmotions((prev) => [...prev, keyword]);
    setEmotionInput("");
  }

  // 레이블 없이 한줄 감상 + 본문만 합침
  function buildReviewContent() {
    const parts: string[] = [];
    if (oneLineReview.trim()) parts.push(oneLineReview.trim());
    if (content.trim()) parts.push(content.trim());
    return parts.join("\n\n");
  }

  async function searchBooks() {
    if (!query.trim()) return;
    setSearching(true);
    setHasSearched(false);
    setWebNovelCandidate(null);
    try {
      const endpoint = searchMode === "WEB_NOVEL"
        ? `${API_BASE}/api/books/web-novels/search?q=${encodeURIComponent(query.trim())}`
        : `${API_BASE}/api/books/search?q=${encodeURIComponent(query.trim())}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const json = await res.json();
        if (searchMode === "WEB_NOVEL") {
          setWebNovelResults(json.data ?? json);
          setResults([]);
        } else {
          setResults(json.data ?? json);
          setWebNovelResults([]);
        }
      } else {
        setResults([]);
        setWebNovelResults([]);
      }
    } catch {
      setResults([]);
      setWebNovelResults([]);
    } finally {
      setSearching(false);
      setHasSearched(true);
    }
  }

  function changeSearchMode(mode: SearchMode) {
    setSearchMode(mode);
    setQuery("");
    setResults([]);
    setWebNovelResults([]);
    setWebNovelCandidate(null);
    setShowDirectNaverRegister(false);
    setHasSearched(false);
    setError("");
  }

  function chooseWebNovelCandidate(candidate: WebNovelResult) {
    setWebNovelCandidate(candidate);
    setWebNovelTitle(candidate.title);
    setWebNovelAuthor(candidate.author);
    setError("");
  }

  async function registerWebNovel(
    candidate: WebNovelResult,
    title: string,
    author: string
  ): Promise<BookResult | null> {
    try {
      const res = await authFetch(`${API_BASE}/api/books/web-novels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim(),
          platform: candidate.platform,
          sourceUrl: candidate.sourceUrl,
        }),
      });
      if (res.status === 401) {
        router.push("/auth/login");
        return null;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(res.status === 400 && candidate.platform === "NAVER_SERIES"
          ? "네이버 웹소설 또는 네이버 시리즈의 작품 목록 주소인지 확인해주세요."
          : (data as { message?: string }).message ?? "웹소설을 등록하지 못했습니다.");
        return null;
      }
      const json = await res.json();
      const book = json.data ?? json;
      return {
        id: book.id,
        isbn13: book.isbn13 ?? null,
        title: book.title,
        author: book.author ?? "",
        publisher: book.publisher ?? candidate.platformLabel,
        thumbnail: book.thumbnail ?? null,
        source: book.source,
        contentType: book.contentType,
        externalId: book.externalId,
        sourceUrl: book.sourceUrl,
      };
    } catch {
      setError("웹소설을 등록하는 중 서버에 연결할 수 없습니다.");
      return null;
    }
  }

  async function requestFeedback() {
    const trimmedContent = content.trim();
    if (trimmedContent.length < feedbackConfig.minChars || trimmedContent.length > feedbackConfig.maxChars) return;

    setFeedbackLoading(true);
    setFeedbackError("");
    setFeedback(null);

    try {
      const res = await authFetch(`${API_BASE}/api/feedback/review-comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmedContent,
          sessionId: getSessionId(),
        }),
      });

      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }

      if (res.ok) {
        const json = await res.json().catch(() => null);
        const data = json?.data;
        if (data?.feedback) {
          setFeedback(data.feedback);
          setFeedbackConfig((prev) => ({
            ...prev,
            minChars: data.minChars ?? prev.minChars,
            maxChars: data.maxChars ?? prev.maxChars,
            boundaryMessage: data.boundaryMessage ?? prev.boundaryMessage,
            betaApplyUrl: data.betaApplyUrl ?? prev.betaApplyUrl,
          }));
          setFeedbackUsedForCurrentDraft(true);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setFeedbackError((data as { message?: string }).message ?? "도장 코멘트를 만들지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    } catch {
      setFeedbackError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setFeedbackLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const directCandidate = directNaverUrl.trim() && directNaverTitle.trim()
      ? {
          title: directNaverTitle.trim(),
          author: directNaverAuthor.trim(),
          platform: "NAVER_SERIES" as const,
          platformLabel: "네이버 웹소설",
          sourceUrl: directNaverUrl.trim(),
          externalId: directNaverUrl.trim(),
          description: "",
        }
      : null;
    const pendingWebNovel = webNovelCandidate ?? directCandidate;
    const pendingTitle = webNovelCandidate ? webNovelTitle : directNaverTitle;
    const pendingAuthor = webNovelCandidate ? webNovelAuthor : directNaverAuthor;
    if (!selectedBook && !pendingWebNovel) {
      setError(directNaverUrl.trim() || directNaverTitle.trim()
        ? "네이버 작품 URL과 작품명을 모두 입력해주세요."
        : "작품을 선택해주세요.");
      return;
    }
    if (rating === 0) { setError("별점을 선택해주세요."); return; }

    const composedContent = buildReviewContent();
    if (!composedContent) { setError("감상을 입력해주세요."); return; }
    setSubmitting(true);
    setError("");

    try {
      // ── 수정 모드 ──
      if (isEditMode && reviewId) {
        if (!selectedBook) {
          setError("기존 작품 정보를 불러오지 못했습니다.");
          return;
        }
        const res = await authFetch(`${API_BASE}/api/reviews/${reviewId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookId: selectedBook.id,
            content: composedContent,
            rating,
            hidden: !isPublic,
            generateAiSummary,
          }),
        });
        if (res.status === 401) { router.push("/auth/login"); return; }
        if (res.ok) {
          if (feedbackUsedForCurrentDraft) {
            trackMetric("revision_saved", "/write", 0, { reviewId: Number(reviewId), mode: "edit" });
          }
          router.push(`/reviews/${reviewId}`);
        } else {
          const data = await res.json().catch(() => ({}));
          setError((data as { message?: string }).message ?? "수정에 실패했습니다.");
        }
        return;
      }

      // ── 신규 작성 ──
      const reviewBook = selectedBook ?? (pendingWebNovel
        ? await registerWebNovel(pendingWebNovel, pendingTitle, pendingAuthor)
        : null);
      if (!reviewBook) return;

      const res = await authFetch(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: reviewBook.id, rating, content: composedContent, generateAiSummary, hidden: !isPublic }),
      });

      if (res.status === 401) { router.push("/auth/login"); return; }

      if (res.ok) {
        const json = await res.json().catch(() => null);
        const createdReview = json?.data ?? json;
        sessionStorage.removeItem(FEED_STATE_KEY);
        if (createdReview?.id && !createdReview.hidden) {
          sessionStorage.setItem(PENDING_REVIEW_KEY, JSON.stringify(createdReview));
        }
        if (feedbackUsedForCurrentDraft) {
          trackMetric("revision_saved", "/write", 0, { reviewId: createdReview?.id ?? null, mode: "create" });
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

  const feedbackCharCount = content.trim().length;
  const isFeedbackTooShort = feedbackCharCount < feedbackConfig.minChars;
  const isFeedbackTooLong = feedbackCharCount > feedbackConfig.maxChars;
  const canRequestFeedback = !feedbackLoading && !isFeedbackTooShort && !isFeedbackTooLong;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 pb-28 sm:pb-8">
      {submitting && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-xs rounded-2xl border border-cream-200 bg-white p-6 text-center shadow-lg">
            <div className="mx-auto mb-4 h-8 w-8 rounded-full border-2 border-brown-200 border-t-brown-600 animate-spin" />
            <p className="font-serif text-lg font-bold text-brown-800">독후감 등록 중</p>
            <p className="mt-2 text-sm text-brown-400">저장이 끝나면 피드로 이동해요. 잠시만 기다려 주세요.</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-5">
        {isEditMode ? (
          <button
            type="button"
            onClick={() => router.push(`/reviews/${reviewId}`)}
            className="text-sm text-brown-400 hover:text-brown-600 transition-colors"
          >
            ← 독후감으로
          </button>
        ) : (
          <Link href="/" className="text-sm text-brown-400 hover:text-brown-600 transition-colors">
            ← 피드로
          </Link>
        )}
        <h1 className="font-serif text-2xl font-bold text-brown-800">
          {isEditMode ? "독후감 수정" : "독후감 쓰기"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* 1. 작품 선택 */}
        <section className="bg-white rounded-lg border border-cream-200 p-5 sm:p-6 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-700 mb-4">1. 어떤 작품을 읽었나요?</h2>

          {selectedBook ? (
            <div className="flex items-center gap-3 bg-cream-50 rounded-xl px-4 py-3 border border-cream-200">
              {selectedBook.thumbnail ? (
                <img src={selectedBook.thumbnail} alt="" className="w-10 h-14 object-cover rounded flex-shrink-0 shadow-sm" />
              ) : (
                <div className="w-10 h-14 bg-brown-300 rounded flex flex-shrink-0 items-center justify-center text-xs font-bold text-white">
                  {selectedBook.contentType === "WEB_NOVEL" ? "웹" : "책"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-brown-800">{selectedBook.title}</p>
                  {selectedBook.contentType === "WEB_NOVEL" && (
                    <span className="rounded-full bg-cream-200 px-2 py-0.5 text-[11px] font-medium text-sage-600">웹소설</span>
                  )}
                </div>
                <p className="text-sm text-brown-400 mt-0.5">
                  {selectedBook.author || "작가 정보 없음"} · {selectedBook.publisher}
                </p>
                {selectedBook.sourceUrl && (
                  <a
                    href={selectedBook.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-brown-400 underline-offset-2 hover:text-brown-600 hover:underline"
                  >
                    원문 플랫폼에서 확인 →
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedBook(null);
                  setResults([]);
                  setWebNovelResults([]);
                  setQuery("");
                  setHasSearched(false);
                }}
                className="text-xs text-brown-400 hover:text-brown-600 transition-colors ml-2 flex-shrink-0"
              >
                변경
              </button>
            </div>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-2 rounded-xl bg-cream-100 p-1" role="tablist" aria-label="작품 종류">
                {(["BOOK", "WEB_NOVEL"] as SearchMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={searchMode === mode}
                    onClick={() => changeSearchMode(mode)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      searchMode === mode ? "bg-white text-brown-700 shadow-sm" : "text-brown-400 hover:text-brown-600"
                    }`}
                  >
                    {mode === "BOOK" ? "책" : "웹소설"}
                  </button>
                ))}
              </div>
              {searchMode === "WEB_NOVEL" && (
                <p className="mb-3 text-xs leading-5 text-brown-400">
                  네이버 웹소설·시리즈·카카오페이지·리디·문피아의 공식 작품 페이지를 한 번에 찾아요.
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setHasSearched(false); }}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchBooks())}
                  placeholder={searchMode === "BOOK" ? "책 제목 또는 저자 검색" : "웹소설 제목 검색"}
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
              {results.length > 0 && (
                <ul className="mt-2 border border-cream-200 rounded-xl overflow-hidden">
                  {results.map((book) => (
                    <li key={`${book.isbn13 ?? book.id}-${book.source}`} className="border-b border-cream-100 last:border-0">
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
              {searchMode === "WEB_NOVEL" && webNovelCandidate && (
                <div className="mt-3 rounded-xl border border-sage-300 bg-cream-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-sage-600">
                        {webNovelCandidate.platformLabel}
                      </span>
                      <p className="mt-2 text-xs text-brown-400">
                        작품 등록은 아래에서 독후감 올리기를 누를 때 함께 처리됩니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWebNovelCandidate(null)}
                      className="text-xs text-brown-400 hover:text-brown-600"
                    >
                      다른 결과
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    <label className="block text-xs font-medium text-brown-600">
                      작품명
                      <input
                        value={webNovelTitle}
                        onChange={(event) => setWebNovelTitle(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
                      />
                    </label>
                    <label className="block text-xs font-medium text-brown-600">
                      작가명 <span className="font-normal text-brown-400">(검색 결과에 없으면 비워도 돼요)</span>
                      <input
                        value={webNovelAuthor}
                        onChange={(event) => setWebNovelAuthor(event.target.value)}
                        placeholder="작가명"
                        className="mt-1 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-300 focus:border-brown-400 focus:outline-none"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <a
                      href={webNovelCandidate.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brown-400 hover:text-brown-600 hover:underline"
                    >
                      공식 페이지 확인 →
                    </a>
                  </div>
                </div>
              )}
              {searchMode === "WEB_NOVEL" && !webNovelCandidate && webNovelResults.length > 0 && (
                <ul className="mt-2 overflow-hidden rounded-xl border border-cream-200">
                  {webNovelResults.map((novel) => (
                    <li key={`${novel.platform}-${novel.externalId}`} className="border-b border-cream-100 last:border-0">
                      <button
                        type="button"
                        onClick={() => chooseWebNovelCandidate(novel)}
                        className="w-full px-4 py-3 text-left transition-colors hover:bg-cream-50"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-cream-200 px-2 py-0.5 text-[11px] font-medium text-sage-600">
                            {novel.platformLabel}
                          </span>
                          <p className="text-sm font-medium text-brown-800">{novel.title}</p>
                        </div>
                        <p className="mt-1 text-xs text-brown-400">{novel.author || "작가 정보는 선택 후 입력할 수 있어요"}</p>
                        {novel.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-brown-400">{novel.description}</p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searchMode === "WEB_NOVEL" && !webNovelCandidate && (
                <div className="mt-3 rounded-xl border border-cream-200 bg-cream-50 p-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDirectNaverRegister((visible) => !visible);
                      if (!directNaverTitle.trim()) setDirectNaverTitle(query.trim());
                    }}
                    className="text-sm font-medium text-brown-600 hover:text-brown-800"
                  >
                    검색 결과에 없나요? 네이버 웹소설·시리즈 URL 직접 입력 {showDirectNaverRegister ? "접기" : "→"}
                  </button>
                  {showDirectNaverRegister && (
                    <div className="mt-4 space-y-3 border-t border-cream-200 pt-4">
                      <p className="text-xs leading-5 text-brown-400">
                        URL·작품명·작가명을 입력하면 독후감 올리기 때 작품도 함께 등록됩니다.
                      </p>
                      <label className="block text-xs font-medium text-brown-600">
                        네이버 웹소설·시리즈 작품 URL
                        <input
                          type="url"
                          value={directNaverUrl}
                          onChange={(event) => setDirectNaverUrl(event.target.value)}
                          placeholder="https://novel.naver.com/best/list?novelId=..."
                          className="mt-1 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-300 focus:border-brown-400 focus:outline-none"
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-medium text-brown-600">
                          작품명
                          <input
                            value={directNaverTitle}
                            onChange={(event) => setDirectNaverTitle(event.target.value)}
                            placeholder="작품명"
                            className="mt-1 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-300 focus:border-brown-400 focus:outline-none"
                          />
                        </label>
                        <label className="block text-xs font-medium text-brown-600">
                          작가명 <span className="font-normal text-brown-400">(선택)</span>
                          <input
                            value={directNaverAuthor}
                            onChange={(event) => setDirectNaverAuthor(event.target.value)}
                            placeholder="작가명"
                            className="mt-1 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-300 focus:border-brown-400 focus:outline-none"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {hasSearched && !searching && results.length === 0 && webNovelResults.length === 0 && (
                <div className="mt-2 py-4 text-center text-sm text-brown-400">
                  <p>검색 결과가 없습니다.</p>
                  {searchMode === "WEB_NOVEL" && (
                    <p className="mt-1 text-xs">일반 웹 검색에 아직 등록되지 않은 작품 페이지는 찾지 못할 수 있어요.</p>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* 2. 감상 작성 */}
        <section className="bg-white rounded-lg border border-cream-200 p-5 sm:p-6 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-700 mb-4">2. 이 작품 어땠나요?</h2>
          <div className="space-y-5">

            <div>
              <label className="mb-2 block text-sm font-medium text-brown-600">
                짧은 감상 <span className="text-xs font-normal text-brown-400">(선택)</span>
              </label>
              <input
                value={oneLineReview}
                onChange={(event) => setOneLineReview(event.target.value)}
                placeholder="이 책을 한 마디로 표현하면?"
                className="w-full rounded-xl border border-cream-300 bg-cream-50 px-4 py-3 text-sm text-brown-800 placeholder:text-brown-300 focus:border-brown-400 focus:outline-none focus:ring-2 focus:ring-brown-100"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-brown-600">
                별점 <span className="text-red-400">*</span>
              </p>
              <StarPicker value={rating} onChange={setRating} />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-brown-600">
                읽고 난 감정 <span className="text-xs font-normal text-brown-400">(선택)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {["성장", "혼란", "위로", "성찰", "흥미", "먹먹함", "기쁨", "분노"].map((keyword) => (
                  <button
                    key={keyword}
                    type="button"
                    onClick={() => toggleEmotion(keyword)}
                    className={`rounded-full px-3 py-1.5 text-sm transition ${
                      selectedEmotions.includes(keyword)
                        ? "bg-brown-700 text-white"
                        : "bg-cream-100 text-brown-500 hover:bg-cream-200"
                    }`}
                  >
                    {keyword}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={emotionInput}
                  onChange={(event) => setEmotionInput(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addEmotionKeyword())}
                  placeholder="직접 입력"
                  className="min-w-0 flex-1 rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 placeholder:text-brown-300 focus:border-brown-400 focus:outline-none"
                />
                <button type="button" onClick={addEmotionKeyword} className="rounded-xl border border-cream-300 px-3 py-2 text-sm text-brown-500">
                  추가
                </button>
              </div>
            </div>

            <div className="space-y-2 border-t border-cream-100 pt-4">
              <label className="flex items-center justify-between gap-3 rounded-xl bg-cream-50 px-4 py-3">
                <span>
                  <span className="block text-sm font-medium text-brown-700">공개 여부</span>
                  <span className="mt-0.5 block text-xs text-brown-400">공개하면 책 상세와 피드에 표시됩니다.</span>
                </span>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(event) => setIsPublic(event.target.checked)}
                  className="h-5 w-5 rounded border-cream-300 text-brown-700 focus:ring-brown-300"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl bg-cream-50 px-4 py-3">
                <span>
                  <span className="block text-sm font-medium text-brown-700">
                    {isEditMode ? "AI 독서카드 다시 만들기" : "AI 독서카드 만들기"}
                  </span>
                  <span className="mt-0.5 block text-xs text-brown-400">
                    {isEditMode
                      ? "수정한 내용으로 감정 키워드·추천 독자·인상적인 구절을 다시 정리합니다."
                      : "저장 후 AI가 감정 키워드·추천 독자·인상적인 구절을 정리합니다."}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={generateAiSummary}
                  onChange={(event) => setGenerateAiSummary(event.target.checked)}
                  className="h-5 w-5 rounded border-cream-300 text-brown-700 focus:ring-brown-300"
                />
              </label>
            </div>
          </div>
        </section>

        {/* 3. 자세히 쓰기 (선택) */}
        <section className="bg-white rounded-lg border border-cream-200 p-5 sm:p-6 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-700 mb-1">
            3. 자세히 쓰기{" "}
            <span className="text-sm font-normal text-brown-400">(선택)</span>
          </h2>
          <p className="mb-4 text-xs text-brown-400">
            인상 깊었던 구절, 느낀 점, 추천 이유 등을 자유롭게 적어주세요.
          </p>
          <div className="mb-4 rounded-md border border-cream-200 bg-cream-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-brown-700">저장 전 도움 받기</p>
                <p className="mt-1 text-xs leading-5 text-brown-400">
                  본문을 {feedbackConfig.minChars}자 이상 쓰면 도장 코멘트를 받을 수 있어요.
                </p>
              </div>
              <button
                type="button"
                onClick={requestFeedback}
                disabled={!canRequestFeedback}
                className="rounded-xl bg-brown-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brown-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {feedbackLoading ? "코멘트 작성 중..." : "도장 코멘트 받기"}
              </button>
            </div>

            {isFeedbackTooShort && (
              <p className="mt-3 text-xs text-brown-400">
                {feedbackConfig.minChars - feedbackCharCount}자 더 쓰면 활성화돼요.
              </p>
            )}
            {isFeedbackTooLong && (
              <p className="mt-3 text-xs text-red-500">
                도장 코멘트는 최대 {feedbackConfig.maxChars}자까지 받을 수 있어요.
              </p>
            )}
            {feedbackError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{feedbackError}</p>
            )}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="더 깊은 감상이 있다면 자유롭게 적어주세요."
            rows={10}
            className="w-full min-h-[42vh] sm:min-h-0 px-4 py-3 rounded-xl border border-cream-300 text-base sm:text-sm text-brown-800 bg-cream-50 placeholder:text-brown-300 focus:outline-none focus:border-brown-400 focus:ring-2 focus:ring-brown-100 transition resize-none leading-relaxed"
          />
          <div className="mt-1.5 flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p className={isFeedbackTooShort || isFeedbackTooLong ? "text-amber-600" : "text-brown-300"}>
              도장 코멘트 기준: {feedbackCharCount}자 / {feedbackConfig.minChars}-{feedbackConfig.maxChars}자
            </p>
            <p className="text-brown-300 sm:text-right">{content.length}자</p>
          </div>

          {feedback && (
            <section className="mt-4 rounded-md border border-brown-100 bg-white p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-lg font-bold text-brown-800">도장 코멘트</h3>
                  <p className="mt-1 text-xs text-brown-400">코멘트를 참고해서 본문을 직접 다듬어보세요.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedback(null)}
                  className="rounded-lg px-2 py-1 text-xs text-brown-400 hover:bg-cream-50 hover:text-brown-600"
                >
                  닫기
                </button>
              </div>

              {feedback.notReview ? (
                <p className="rounded-lg bg-cream-50 px-3 py-3 text-sm text-brown-600">
                  {feedback.message ?? "독후감을 입력해주시면 코멘트를 드릴 수 있어요."}
                </p>
              ) : (
                <div className="space-y-4 text-sm text-brown-700">
                  {feedback.coreTheme && (
                    <div>
                      <h4 className="mb-1 font-semibold text-brown-800">핵심 주제</h4>
                      <p className="leading-6">{feedback.coreTheme}</p>
                    </div>
                  )}

                  {feedback.strengths && feedback.strengths.length > 0 && (
                    <div>
                      <h4 className="mb-1 font-semibold text-brown-800">좋은 점</h4>
                      <ul className="space-y-1">
                        {feedback.strengths.map((item, index) => (
                          <li key={`strength-${index}`} className="leading-6">- {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {feedback.improvements && feedback.improvements.length > 0 && (
                    <div>
                      <h4 className="mb-2 font-semibold text-brown-800">보완할 점</h4>
                      <div className="space-y-2">
                        {feedback.improvements.map((item, index) => {
                          const showRewrite = hasMeaningfulRewrite(item);
                          return (
                            <div key={`improvement-${index}`} className="rounded-lg border border-cream-100 bg-cream-50 px-3 py-3">
                              <p className="font-medium leading-6 text-brown-800">{item.point}</p>
                              {item.direction && (
                                <div className="mt-2 rounded-md bg-white px-3 py-2">
                                  <p className="text-xs font-medium text-brown-400">수정 방향</p>
                                  <p className="mt-1 leading-6">{item.direction}</p>
                                </div>
                              )}
                              {showRewrite && (
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                  <div className="rounded-md bg-white px-3 py-2">
                                    <p className="text-xs font-medium text-brown-400">기존 표현</p>
                                    <p className="mt-1 leading-6">{item.before}</p>
                                  </div>
                                  <div className="rounded-md bg-white px-3 py-2">
                                    <p className="text-xs font-medium text-brown-400">바꿔볼 표현</p>
                                    <p className="mt-1 leading-6">{item.after}</p>
                                  </div>
                                </div>
                              )}
                              <p className="mt-2 text-xs leading-5 text-brown-500">{item.reason}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {feedback.sentenceExamples && feedback.sentenceExamples.length > 0 && (
                    <div>
                      <h4 className="mb-2 font-semibold text-brown-800">문장 개선 예시</h4>
                      <div className="space-y-2">
                        {feedback.sentenceExamples.map((item, index) => (
                          <div key={`sentence-${index}`} className="rounded-lg bg-cream-50 px-3 py-2">
                            <p className="text-xs font-medium text-brown-400">before</p>
                            <p className="mt-1 leading-6">{item.before}</p>
                            <p className="mt-2 text-xs font-medium text-brown-400">after</p>
                            <p className="mt-1 leading-6">{item.after}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {feedback.titleSuggestions && feedback.titleSuggestions.length > 0 && (
                    <div>
                      <h4 className="mb-1 font-semibold text-brown-800">제목 추천</h4>
                      <div className="flex flex-wrap gap-2">
                        {feedback.titleSuggestions.map((item, index) => (
                          <span key={`title-${index}`} className="rounded-full bg-cream-100 px-3 py-1 text-xs text-brown-600">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {feedback.deepQuestion && (
                    <div>
                      <h4 className="mb-1 font-semibold text-brown-800">깊이 질문</h4>
                      <p className="leading-6">{feedback.deepQuestion}</p>
                    </div>
                  )}
                </div>
              )}

              {feedbackConfig.boundaryMessage && (
                <p className="mt-4 border-t border-cream-100 pt-3 text-xs leading-5 text-brown-400">
                  {feedbackConfig.boundaryMessage}
                </p>
              )}
              {feedbackConfig.betaApplyUrl && (
                <a
                  href={feedbackConfig.betaApplyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-xl border border-brown-200 px-4 py-2 text-sm font-medium text-brown-700 hover:bg-cream-50"
                >
                  1:1 독후감 첨삭 베타 신청
                </a>
              )}
            </section>
          )}
        </section>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="hidden sm:block w-full py-3 bg-brown-600 text-white rounded-xl font-medium hover:bg-brown-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "저장 중..." : isEditMode ? "수정 완료" : "독후감 올리기"}
        </button>

        <div className="fixed left-0 right-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-cream-200 px-4 py-3 sm:hidden">
          <div className="grid grid-cols-[0.9fr_1.1fr] gap-2">
            <button
              type="button"
              onClick={requestFeedback}
              disabled={!canRequestFeedback}
              className="py-3 rounded-xl border border-brown-200 bg-white text-sm font-medium text-brown-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {feedbackLoading ? "작성 중..." : "코멘트"}
            </button>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-brown-700 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "저장 중..." : isEditMode ? "수정 완료" : "독후감 올리기"}
          </button>
          </div>
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
