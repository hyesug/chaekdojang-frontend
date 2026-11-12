"use client";

import { Star } from "lucide-react";
import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE } from "../lib/api";
import { authFetch } from "../lib/auth";
import { getSessionId } from "../components/AnalyticsTracker";
import { PRESET_EMOTIONS, customEmotionKeywords } from "./emotionKeywords";

const FEED_STATE_KEY = "chaekdojang:feed-state";
const PENDING_REVIEW_KEY = "chaekdojang:pending-review";
const LEGACY_REVIEW_DRAFT_KEY = "chaekdojang:review-draft";
const REVIEW_DRAFT_KEY_PREFIX = "chaekdojang:review-draft:v2";
// 로그인 전에 쓴 글을 로그인 화면 왕복 동안 보관한다. 접두사가 같아 복원 직후 일괄 삭제된다.
const GUEST_DRAFT_KEY = `${REVIEW_DRAFT_KEY_PREFIX}:guest`;
const GUEST_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
// 맞춤법·띄어쓰기 교정 — 서버(app.feedback.proofread-min-chars, max-chars)와 같은 기본값
const PROOFREAD_MIN_CHARS = 10;
const PROOFREAD_MAX_CHARS = 6000;

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

type RereadSource = {
  id: number;
  createdAt: string;
  book: BookResult;
};

type ContinuationSource = RereadSource & {
  authorNickname: string;
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
  thumbnail: string | null;
};

type DirectWebNovelPlatform = Pick<WebNovelResult, "platform" | "platformLabel">;

type GuestDraft = {
  savedAt: number;
  selectedBook: BookResult | null;
  searchMode: SearchMode;
  webNovelCandidate: WebNovelResult | null;
  webNovelTitle: string;
  webNovelAuthor: string;
  showDirectRegister: boolean;
  directWorkUrl: string;
  directWorkTitle: string;
  directWorkAuthor: string;
  rating: number;
  content: string;
  oneLineReview: string;
  selectedEmotions: string[];
  isPublic: boolean;
  hasSpoiler: boolean;
  generateAiSummary: boolean;
};

function readGuestDraft(): GuestDraft | null {
  try {
    const raw = localStorage.getItem(GUEST_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as GuestDraft;
    if (typeof draft?.savedAt !== "number" || Date.now() - draft.savedAt > GUEST_DRAFT_TTL_MS) return null;
    return draft;
  } catch {
    return null;
  }
}

function detectWebNovelPlatform(rawUrl: string): DirectWebNovelPlatform | null {
  try {
    const host = new URL(rawUrl.trim()).hostname.toLowerCase();
    if (["novel.naver.com", "m.novel.naver.com"].includes(host)) {
      return { platform: "NAVER_SERIES", platformLabel: "네이버 웹소설" };
    }
    if (["series.naver.com", "m.series.naver.com"].includes(host)) {
      return { platform: "NAVER_SERIES", platformLabel: "네이버 시리즈" };
    }
    if (host === "page.kakao.com") {
      return { platform: "KAKAO_PAGE", platformLabel: "카카오페이지" };
    }
    if (["ridibooks.com", "www.ridibooks.com"].includes(host)) {
      return { platform: "RIDI", platformLabel: "리디" };
    }
    if (["novel.munpia.com", "www.munpia.com", "m.munpia.com", "mm.munpia.com"].includes(host)) {
      return { platform: "MUNPIA", platformLabel: "문피아" };
    }
    return null;
  } catch {
    return null;
  }
}

type ProofreadCorrection = {
  before: string;
  after: string;
  kind: string;
};

/** 교정 구간을 본문에서 정확히 한 번 찾을 때만 바꾼다 — 여러 번 나오거나 이미 바뀌었으면 null */
function replaceOnce(text: string, c: ProofreadCorrection) {
  const first = text.indexOf(c.before);
  if (first < 0 || text.indexOf(c.before, first + 1) >= 0) return null;
  return text.slice(0, first) + c.after + text.slice(first + c.before.length);
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
            className="rounded p-0.5 transition-transform hover:scale-110"
            aria-label={`${star}점`}
          >
            <Star size={30} strokeWidth={1.5} aria-hidden="true" className={star <= (hover || value) ? "fill-star text-star" : "fill-cream-200 text-cream-300"} />
          </button>
        ))}
      </div>
      <p className="mt-1.5 h-5 text-sm font-medium text-sage-600">{LABELS[hover || value]}</p>
    </div>
  );
}

function WriteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 수정 모드: ?reviewId=123 이 있으면 기존 독후감 수정
  const reviewId = searchParams.get("reviewId");
  const isEditMode = !!reviewId;
  const rereadFrom = searchParams.get("rereadFrom");
  const isRereadMode = !isEditMode && !!rereadFrom;
  const continueFrom = searchParams.get("continueFrom");
  const isContinuationMode = !isEditMode && !isRereadMode && !!continueFrom;
  const isLinkedWriteMode = isRereadMode || isContinuationMode;

  const [query, setQuery] = useState(() => searchParams.get("title") ?? "");
  const [results, setResults] = useState<BookResult[]>([]);
  const [webNovelResults, setWebNovelResults] = useState<WebNovelResult[]>([]);
  const [searchMode, setSearchMode] = useState<SearchMode>(() =>
    searchParams.get("contentType") === "WEB_NOVEL" ? "WEB_NOVEL" : "BOOK"
  );
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookResult | null>(null);
  const [rereadSource, setRereadSource] = useState<RereadSource | null>(null);
  const [rereadLoading, setRereadLoading] = useState(isRereadMode);
  const [continuationSource, setContinuationSource] = useState<ContinuationSource | null>(null);
  const [continuationLoading, setContinuationLoading] = useState(isContinuationMode);
  const [webNovelCandidate, setWebNovelCandidate] = useState<WebNovelResult | null>(null);
  const [webNovelTitle, setWebNovelTitle] = useState("");
  const [webNovelAuthor, setWebNovelAuthor] = useState("");
  const [showDirectRegister, setShowDirectRegister] = useState(
    () => ["naver", "platform"].includes(searchParams.get("direct") ?? "")
  );
  const [directWorkUrl, setDirectWorkUrl] = useState("");
  const [directWorkTitle, setDirectWorkTitle] = useState(() => searchParams.get("title") ?? "");
  const [directWorkAuthor, setDirectWorkAuthor] = useState(() => searchParams.get("author") ?? "");

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
        setIsPublic(!data.hidden || Boolean(data.scheduledAt));
        if (data.scheduledAt) { setScheduleOn(true); setScheduleAt(String(data.scheduledAt).slice(0, 16)); }
        setSelectedEmotions(Array.isArray(data.keywords) ? data.keywords : []);
        setHasSpoiler(Boolean(data.spoiler));
        setGenerateAiSummary(false);
      })
      .catch(() => {});
  }, [reviewId]);

  useEffect(() => {
    if (!isRereadMode || !rereadFrom) return;
    const sourceId = Number(rereadFrom);
    if (!Number.isSafeInteger(sourceId) || sourceId <= 0) {
      setRereadLoading(false);
      setError("올바르지 않은 이전 독후감 주소입니다.");
      return;
    }
    let cancelled = false;
    async function loadRereadSource() {
      setRereadLoading(true);
      try {
        await authFetch(`${API_BASE}/api/users/me`, { cache: "no-store" });
        const response = await authFetch(`${API_BASE}/api/reviews/${sourceId}`, { cache: "no-store" });
        const json = response.ok ? await response.json() : null;
        const data = json?.data ?? json;
        if (!data?.book) {
          if (!cancelled) setError("이전 독후감의 책 정보를 불러오지 못했습니다.");
          return;
        }
        const book: BookResult = {
          id: data.book.id,
          isbn13: data.book.isbn13 ?? null,
          title: data.book.title ?? "",
          author: data.book.author ?? "",
          publisher: data.book.publisher ?? "",
          thumbnail: data.book.thumbnail ?? null,
          source: data.book.source ?? "reread",
          contentType: data.book.contentType === "WEB_NOVEL" ? "WEB_NOVEL" : "BOOK",
          sourceUrl: data.book.sourceUrl ?? null,
        };
        if (!cancelled) {
          setSelectedBook(book);
          setSearchMode(book.contentType === "WEB_NOVEL" ? "WEB_NOVEL" : "BOOK");
          setRereadSource({ id: data.id, createdAt: data.createdAt, book });
        }
      } catch {
        if (!cancelled) setError("이전 독후감을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setRereadLoading(false);
      }
    }
    loadRereadSource();
    return () => {
      cancelled = true;
    };
  }, [isRereadMode, rereadFrom]);

  useEffect(() => {
    if (!isContinuationMode || !continueFrom) return;
    const sourceId = Number(continueFrom);
    if (!Number.isSafeInteger(sourceId) || sourceId <= 0) {
      setContinuationLoading(false);
      setError("올바르지 않은 원문 독후감 주소입니다.");
      return;
    }
    let cancelled = false;
    async function loadContinuationSource() {
      setContinuationLoading(true);
      try {
        await authFetch(`${API_BASE}/api/users/me`, { cache: "no-store" });
        const response = await authFetch(`${API_BASE}/api/reviews/${sourceId}`, { cache: "no-store" });
        const json = response.ok ? await response.json() : null;
        const data = json?.data ?? json;
        if (!data?.book || data.hidden) {
          if (!cancelled) setError("공개된 원문 독후감의 책 정보를 불러오지 못했습니다.");
          return;
        }
        const book: BookResult = {
          id: data.book.id,
          isbn13: data.book.isbn13 ?? null,
          title: data.book.title ?? "",
          author: data.book.author ?? "",
          publisher: data.book.publisher ?? "",
          thumbnail: data.book.thumbnail ?? null,
          source: data.book.source ?? "continuation",
          contentType: data.book.contentType === "WEB_NOVEL" ? "WEB_NOVEL" : "BOOK",
          sourceUrl: data.book.sourceUrl ?? null,
        };
        if (!cancelled) {
          setSelectedBook(book);
          setSearchMode(book.contentType === "WEB_NOVEL" ? "WEB_NOVEL" : "BOOK");
          setContinuationSource({
            id: data.id,
            createdAt: data.createdAt,
            authorNickname: data.author?.nickname ?? "다른 독자",
            book,
          });
        }
      } catch {
        if (!cancelled) setError("원문 독후감을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setContinuationLoading(false);
      }
    }
    loadContinuationSource();
    return () => {
      cancelled = true;
    };
  }, [isContinuationMode, continueFrom]);

  useEffect(() => {
    if (isEditMode || isLinkedWriteMode) return; // 수정·연결 작성에서는 URL 책 자동선택 건너뜀
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
  }, [searchParams, isEditMode, isLinkedWriteMode]);

  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [oneLineReview, setOneLineReview] = useState("");
  const [emotionInput, setEmotionInput] = useState("");
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  // 예약 발송 — 공개일 때만. 값은 한국 시각 "YYYY-MM-DDTHH:mm"
  const [scheduleOn, setScheduleOn] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [hasSpoiler, setHasSpoiler] = useState(false);
  const [generateAiSummary, setGenerateAiSummary] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [corrections, setCorrections] = useState<ProofreadCorrection[] | null>(null);
  const [correctionState, setCorrectionState] = useState<Record<number, "applied" | "missing">>({});
  const [proofreadLoading, setProofreadLoading] = useState(false);
  const [proofreadError, setProofreadError] = useState("");

  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    const guestDraft = readGuestDraft();
    clearReviewDraftStorage();
    if (!guestDraft || isEditMode || isLinkedWriteMode) return;
    setSelectedBook(guestDraft.selectedBook);
    setSearchMode(guestDraft.searchMode);
    setWebNovelCandidate(guestDraft.webNovelCandidate);
    setWebNovelTitle(guestDraft.webNovelTitle);
    setWebNovelAuthor(guestDraft.webNovelAuthor);
    setShowDirectRegister(guestDraft.showDirectRegister);
    setDirectWorkUrl(guestDraft.directWorkUrl);
    setDirectWorkTitle(guestDraft.directWorkTitle);
    setDirectWorkAuthor(guestDraft.directWorkAuthor);
    setRating(guestDraft.rating);
    setContent(guestDraft.content);
    setOneLineReview(guestDraft.oneLineReview);
    setSelectedEmotions(guestDraft.selectedEmotions);
    setIsPublic(guestDraft.isPublic);
    setHasSpoiler(guestDraft.hasSpoiler);
    setGenerateAiSummary(guestDraft.generateAiSummary);
    setDraftRestored(true);
  }, [isEditMode, isLinkedWriteMode]);

  // 비로그인 작성자가 로그인 화면에 다녀와도 쓰던 글과 위치를 잃지 않게 한다.
  function redirectToLoginKeepingDraft() {
    if (!isEditMode && !isLinkedWriteMode) {
      const draft: GuestDraft = {
        savedAt: Date.now(),
        selectedBook,
        searchMode,
        webNovelCandidate,
        webNovelTitle,
        webNovelAuthor,
        showDirectRegister,
        directWorkUrl,
        directWorkTitle,
        directWorkAuthor,
        rating,
        content,
        oneLineReview,
        selectedEmotions,
        isPublic,
        hasSpoiler,
        generateAiSummary,
      };
      try {
        localStorage.setItem(GUEST_DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // 저장 공간 부족 등으로 보관하지 못해도 로그인 이동은 계속한다.
      }
    }
    const returnTo = `${window.location.pathname}${window.location.search}`;
    router.push(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

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
    setShowDirectRegister(false);
    setHasSearched(false);
    setError("");
  }

  function chooseWebNovelCandidate(candidate: WebNovelResult) {
    setWebNovelCandidate(candidate);
    setWebNovelTitle(candidate.title);
    setWebNovelAuthor(candidate.author);
    setShowDirectRegister(false);
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
          description: candidate.description,
        }),
      });
      if (res.status === 401) {
        redirectToLoginKeepingDraft();
        return null;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(res.status === 400
          ? "지원하는 플랫폼의 작품 상세 주소인지 확인해주세요."
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

  async function requestProofread() {
    const trimmed = content.trim();
    if (trimmed.length < PROOFREAD_MIN_CHARS || trimmed.length > PROOFREAD_MAX_CHARS) return;

    setProofreadLoading(true);
    setProofreadError("");
    setCorrections(null);
    setCorrectionState({});

    try {
      const res = await authFetch(`${API_BASE}/api/feedback/proofread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, sessionId: getSessionId() }),
      });

      if (res.status === 401) {
        redirectToLoginKeepingDraft();
        return;
      }

      const json = await res.json().catch(() => null);
      if (res.ok) {
        const list = json?.data?.corrections;
        setCorrections(Array.isArray(list) ? list : []);
      } else {
        setProofreadError((json as { message?: string } | null)?.message ?? "교정 결과를 만들지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    } catch {
      setProofreadError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setProofreadLoading(false);
    }
  }

  function applyCorrections(indexes: number[]) {
    if (!corrections) return;
    let next = content;
    const state = { ...correctionState };
    for (const index of indexes) {
      const replaced = replaceOnce(next, corrections[index]);
      if (replaced === null) {
        state[index] = "missing";
        continue;
      }
      next = replaced;
      state[index] = "applied";
    }
    setContent(next);
    setCorrectionState(state);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const directPlatform = detectWebNovelPlatform(directWorkUrl);
    const directCandidate = directPlatform && directWorkUrl.trim() && directWorkTitle.trim()
      ? {
          title: directWorkTitle.trim(),
          author: directWorkAuthor.trim(),
          platform: directPlatform.platform,
          platformLabel: directPlatform.platformLabel,
          sourceUrl: directWorkUrl.trim(),
          externalId: directWorkUrl.trim(),
          description: "",
          thumbnail: null,
        }
      : null;
    const pendingWebNovel = webNovelCandidate ?? directCandidate;
    const pendingTitle = webNovelCandidate ? webNovelTitle : directWorkTitle;
    const pendingAuthor = webNovelCandidate ? webNovelAuthor : directWorkAuthor;
    if (!selectedBook && !pendingWebNovel) {
      setError(directWorkUrl.trim() && !directPlatform
        ? "네이버·카카오페이지·리디·문피아의 작품 URL인지 확인해주세요."
        : directWorkUrl.trim() || directWorkTitle.trim()
        ? "작품 URL과 작품명을 모두 입력해주세요."
        : "작품을 선택해주세요.");
      return;
    }
    if (rating === 0) { setError("별점을 선택해주세요."); return; }

    const composedContent = buildReviewContent();
    if (!composedContent) { setError("감상을 입력해주세요."); return; }
    const scheduledAt = isPublic && scheduleOn ? scheduleAt : null;
    if (scheduledAt !== null) {
      // 한국 시각으로 받은 값을 지금(한국 시각)과 견준다 — 서버도 같은 범위를 다시 확인한다
      const at = new Date(`${scheduledAt}:00+09:00`).getTime();
      if (!scheduledAt || Number.isNaN(at) || at < Date.now() + 5 * 60_000) {
        setError("예약 시각은 지금부터 5분 뒤 이후로 골라주세요.");
        return;
      }
    }
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
            keywords: selectedEmotions,
            spoiler: hasSpoiler,
            scheduledAt,
          }),
        });
        if (res.status === 401) { router.push("/auth/login"); return; }
        if (res.ok) {
          router.push(`/reviews/${reviewId}`);
        } else {
          const data = await res.json().catch(() => ({}));
          setError((data as { message?: string }).message ?? "수정에 실패했습니다.");
        }
        return;
      }

      // ── 신규 작성 ──
      if (isRereadMode && !rereadSource) {
        setError("이전 독후감을 불러온 뒤 다시 시도해주세요.");
        return;
      }
      if (isContinuationMode && !continuationSource) {
        setError("원문 독후감을 불러온 뒤 다시 시도해주세요.");
        return;
      }
      const reviewBook = selectedBook ?? (pendingWebNovel
        ? await registerWebNovel(pendingWebNovel, pendingTitle, pendingAuthor)
        : null);
      if (!reviewBook) return;

      const res = await authFetch(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: reviewBook.id,
          rating,
          content: composedContent,
          generateAiSummary,
          hidden: !isPublic,
          previousReviewId: isRereadMode ? rereadSource?.id : null,
          sourceReviewId: isContinuationMode ? continuationSource?.id : null,
          keywords: selectedEmotions,
          spoiler: hasSpoiler,
          scheduledAt,
        }),
      });

      if (res.status === 401) { redirectToLoginKeepingDraft(); return; }

      if (res.ok) {
        const json = await res.json().catch(() => null);
        const createdReview = json?.data ?? json;
        sessionStorage.removeItem(FEED_STATE_KEY);
        if (createdReview?.id && !createdReview.hidden) {
          sessionStorage.setItem(PENDING_REVIEW_KEY, JSON.stringify(createdReview));
        }
        // 예약 글은 아직 피드에 없으니 내 글 화면으로 보낸다
        router.push((isLinkedWriteMode || scheduledAt) && createdReview?.id ? `/reviews/${createdReview.id}` : "/");
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

  const proofreadChars = content.trim().length;
  // 운세 AI 질문권 보상 기준 — 서버(AiCreditService.reviewTextLength)와 같게 공백을 한 칸으로 줄여 센다
  const AI_REWARD_MIN_CHARS = 100;
  const aiRewardChars = content.replace(/\s+/g, " ").trim().length;
  const proofreadTooLong = proofreadChars > PROOFREAD_MAX_CHARS;
  const canProofread = !proofreadLoading && proofreadChars >= PROOFREAD_MIN_CHARS && !proofreadTooLong;
  const pendingCorrections = (corrections ?? []).map((_, index) => index).filter((index) => !correctionState[index]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 pb-28 sm:pb-8">
      {submitting && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="cdj-card w-full max-w-xs p-6 text-center">
            <div className="mx-auto mb-4 h-8 w-8 rounded-full border-2 border-brown-200 border-t-brown-600 animate-spin" />
            <p className="font-serif text-lg font-bold text-brown-800">독후감 등록 중</p>
            <p className="mt-2 text-sm text-brown-400">저장이 끝나면 피드로 이동해요. 잠시만 기다려 주세요.</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-5">
        {isEditMode || isLinkedWriteMode ? (
          <button
            type="button"
            onClick={() => router.push(`/reviews/${isEditMode ? reviewId : isRereadMode ? rereadFrom : continueFrom}`)}
            className="text-sm text-brown-400 hover:text-brown-600 transition-colors"
          >
            ← 독후감으로
          </button>
        ) : (
          <Link href="/" className="text-sm text-brown-400 hover:text-brown-600 transition-colors">
            ← 피드로
          </Link>
        )}
        <h1 className="cdj-title">
          {isEditMode
            ? "독후감 수정"
            : isRereadMode
              ? "다시 읽고 기록하기"
              : isContinuationMode
                ? "이 글을 읽고 내 생각 남기기"
                : "독후감 쓰기"}
        </h1>
      </div>

      {isRereadMode && (
        <div className="mb-5 rounded-2xl border border-sage-300 bg-cream-50 px-4 py-3 text-sm text-brown-600">
          <p className="font-semibold text-brown-700">이전 독후감은 그대로 보관됩니다.</p>
          <p className="mt-1 text-xs leading-5 text-brown-400">
            {rereadSource
              ? `${new Date(rereadSource.createdAt).toLocaleDateString("ko-KR")} 기록에 이어 새로운 생각을 남깁니다.`
              : rereadLoading
                ? "이전 기록과 책 정보를 불러오는 중입니다."
                : "이전 기록을 불러오지 못했습니다."}
          </p>
        </div>
      )}

      {isContinuationMode && (
        <div className="mb-5 rounded-2xl border border-sage-300 bg-sage-50 px-4 py-3 text-sm text-brown-600">
          <p className="font-semibold text-brown-700">원문을 복사하지 않고 내 독후감을 새로 작성합니다.</p>
          <p className="mt-1 text-xs leading-5 text-brown-400">
            {continuationSource
              ? `${continuationSource.authorNickname}님의 독후감과 같은 책으로 생각을 이어갑니다.`
              : continuationLoading
                ? "원문 기록과 책 정보를 불러오는 중입니다."
                : "원문 기록을 불러오지 못했습니다."}
          </p>
        </div>
      )}

      {draftRestored && (
        <p className="mb-5 rounded-xl bg-sage-50 px-4 py-3 text-sm text-brown-600" role="status">
          로그인 전에 쓰던 독후감을 불러왔어요. 확인하고 올려주세요.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* 1. 작품 선택 */}
        <section className="cdj-card p-5 sm:p-6">
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
              {!isLinkedWriteMode && (
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
              )}
            </div>
          ) : isLinkedWriteMode ? (
            <div className="rounded-xl border border-cream-200 bg-cream-50 px-4 py-5 text-sm text-brown-400">
              {(isRereadMode ? rereadLoading : continuationLoading)
                ? "연결된 독후감의 책 정보를 불러오는 중입니다."
                : "책 정보를 불러올 수 없습니다."}
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
                  placeholder={searchMode === "BOOK" ? "책 제목, 저자 또는 ISBN 검색" : "웹소설 제목 검색"}
                  className="cdj-field text-sm flex-1"
                />
                <button
                  type="button"
                  onClick={searchBooks}
                  disabled={searching}
                  className="cdj-button cdj-button--primary"
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {webNovelCandidate.thumbnail ? (
                        <img
                          src={webNovelCandidate.thumbnail}
                          alt={`${webNovelCandidate.title} 표지`}
                          className="h-[88px] w-[60px] flex-shrink-0 rounded-lg object-cover shadow-sm"
                        />
                      ) : (
                        <div className="flex h-[88px] w-[60px] flex-shrink-0 items-center justify-center rounded-lg bg-brown-600 text-xs font-bold text-white">
                          웹소설
                        </div>
                      )}
                      <div>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-sage-600">
                        {webNovelCandidate.platformLabel}
                      </span>
                      <p className="mt-2 text-xs text-brown-400">
                        작품 등록은 아래에서 독후감 올리기를 누를 때 함께 처리됩니다.
                      </p>
                      </div>
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
                        className="cdj-field text-sm mt-1 w-full"
                      />
                    </label>
                    <label className="block text-xs font-medium text-brown-600">
                      작가명 <span className="font-normal text-brown-400">(검색 결과에 없으면 비워도 돼요)</span>
                      <input
                        value={webNovelAuthor}
                        onChange={(event) => setWebNovelAuthor(event.target.value)}
                        placeholder="작가명"
                        className="cdj-field text-sm mt-1 w-full"
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
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-cream-50"
                      >
                        {novel.thumbnail ? (
                          <img
                            src={novel.thumbnail}
                            alt={`${novel.title} 표지`}
                            className="h-16 w-11 flex-shrink-0 rounded object-cover shadow-sm"
                          />
                        ) : (
                          <div className="flex h-16 w-11 flex-shrink-0 items-center justify-center rounded bg-brown-600 text-[10px] font-bold text-white">
                            웹소설
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
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
                        </div>
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
                      setShowDirectRegister((visible) => !visible);
                      if (!directWorkTitle.trim()) setDirectWorkTitle(query.trim());
                    }}
                    className="text-sm font-medium text-brown-600 hover:text-brown-800"
                  >
                    {showDirectRegister
                      ? "작품 URL 직접 입력 닫기"
                      : "찾는 작품이 없나요? 작품 URL로 직접 입력 →"}
                  </button>
                  {showDirectRegister && (
                    <div className="mt-4 space-y-3 border-t border-cream-200 pt-4">
                      <p className="text-xs leading-5 text-brown-400">
                        URL·작품명·작가명을 입력하면 독후감 올리기 때 작품도 함께 등록됩니다.
                      </p>
                      <p className="text-xs leading-5 text-brown-400">
                        네이버 웹소설·시리즈, 카카오페이지, 리디, 문피아 주소를 지원해요.
                      </p>
                      <label className="block text-xs font-medium text-brown-600">
                        작품 URL
                        <input
                          type="url"
                          value={directWorkUrl}
                          onChange={(event) => setDirectWorkUrl(event.target.value)}
                          placeholder="https://..."
                          className="cdj-field text-sm mt-1 w-full"
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-medium text-brown-600">
                          작품명
                          <input
                            value={directWorkTitle}
                            onChange={(event) => setDirectWorkTitle(event.target.value)}
                            placeholder="작품명"
                            className="cdj-field text-sm mt-1 w-full"
                          />
                        </label>
                        <label className="block text-xs font-medium text-brown-600">
                          작가명 <span className="font-normal text-brown-400">(선택)</span>
                          <input
                            value={directWorkAuthor}
                            onChange={(event) => setDirectWorkAuthor(event.target.value)}
                            placeholder="작가명"
                            className="cdj-field text-sm mt-1 w-full"
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
        <section className="cdj-card p-5 sm:p-6">
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
                className="cdj-field text-sm w-full"
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
                {PRESET_EMOTIONS.map((keyword) => (
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
              {customEmotionKeywords(selectedEmotions).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {customEmotionKeywords(selectedEmotions).map((keyword) => (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => toggleEmotion(keyword)}
                      className="rounded-full bg-brown-700 px-3 py-1.5 text-sm text-white transition hover:bg-brown-800"
                      title="눌러서 제거"
                    >
                      {keyword} ×
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <input
                  value={emotionInput}
                  onChange={(event) => setEmotionInput(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addEmotionKeyword())}
                  placeholder="직접 입력"
                  className="cdj-field text-sm min-w-0 flex-1"
                />
                <button type="button" onClick={addEmotionKeyword} className="cdj-button cdj-button--secondary">
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
                  className="cdj-field text-sm h-5 w-5"
                />
              </label>
              {isPublic && (
                <div className="rounded-xl bg-cream-50 px-4 py-3">
                  <label className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm font-medium text-brown-700">예약 발송</span>
                      <span className="mt-0.5 block text-xs text-brown-400">정한 날짜·시간(한국 시간)에 공개됩니다. 그때까지는 나만 볼 수 있어요.</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={scheduleOn}
                      onChange={(event) => setScheduleOn(event.target.checked)}
                      className="cdj-field text-sm h-5 w-5"
                    />
                  </label>
                  {scheduleOn && (
                    <input
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(event) => setScheduleAt(event.target.value)}
                      aria-label="예약 발송 날짜와 시간"
                      className="cdj-field mt-3 w-full rounded-lg border border-cream-200 px-3 py-2 text-sm"
                    />
                  )}
                </div>
              )}
              <label className="flex items-center justify-between gap-3 rounded-xl bg-cream-50 px-4 py-3">
                <span>
                  <span className="block text-sm font-medium text-brown-700">스포일러 포함</span>
                  <span className="mt-0.5 block text-xs text-brown-400">독자가 직접 열기 전까지 목록과 상세에서 본문을 가립니다.</span>
                </span>
                <input
                  type="checkbox"
                  checked={hasSpoiler}
                  onChange={(event) => setHasSpoiler(event.target.checked)}
                  className="cdj-field text-sm h-5 w-5"
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
                  className="cdj-field text-sm h-5 w-5"
                />
              </label>
            </div>
          </div>
        </section>

        {/* 3. 자세히 쓰기 (선택) */}
        <section className="cdj-card p-5 sm:p-6">
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
                <p className="text-sm font-semibold text-brown-700">맞춤법·띄어쓰기 교정</p>
                <p className="mt-1 text-xs leading-5 text-brown-400">
                  본문에서 틀린 맞춤법과 띄어쓰기만 찾아 드려요. 표현과 내용은 바꾸지 않아요.
                </p>
              </div>
              <button
                type="button"
                onClick={requestProofread}
                disabled={!canProofread}
                className="cdj-button cdj-button--primary"
              >
                {proofreadLoading ? "교정하는 중..." : "교정하기"}
              </button>
            </div>
            {proofreadTooLong && (
              <p className="mt-3 text-xs text-red-500">교정은 최대 {PROOFREAD_MAX_CHARS}자까지 할 수 있어요.</p>
            )}
            {proofreadError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{proofreadError}</p>
            )}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="더 깊은 감상이 있다면 자유롭게 적어주세요."
            rows={10}
            className="cdj-field text-sm w-full min-h-[42vh] sm:min-h-0 resize-none"
          />
          <p className="mt-1.5 text-right text-xs text-brown-300">{content.length}자</p>
          <p className={`mt-1 text-xs ${aiRewardChars >= AI_REWARD_MIN_CHARS ? "text-sage-700" : "text-brown-400"}`}>
            독후감을 올리면 <Link href="/unse" className="underline underline-offset-2">운세 AI</Link> 질문권 1회를 받아요 · 책 한 권당 한 번 · {AI_REWARD_MIN_CHARS}자 이상
            {aiRewardChars >= AI_REWARD_MIN_CHARS ? " (충족)" : ` (지금 ${aiRewardChars}자)`}
          </p>

          {corrections && (
            <section className="mt-4 rounded-md border border-cream-200 bg-white p-4" aria-live="polite">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-serif text-lg font-bold text-brown-800">교정 결과</h3>
                {pendingCorrections.length > 1 && (
                  <button
                    type="button"
                    onClick={() => applyCorrections(pendingCorrections)}
                    className="cdj-button cdj-button--secondary"
                  >
                    모두 고치기
                  </button>
                )}
              </div>
              {corrections.length === 0 ? (
                <p className="mt-2 text-sm text-brown-500">고칠 곳을 찾지 못했어요.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {corrections.map((item, index) => (
                    <li key={`${item.before}-${index}`} className="rounded-lg bg-cream-50 px-3 py-2 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="mr-2 rounded-full bg-cream-100 px-2 py-0.5 text-[11px] text-brown-500">{item.kind}</span>
                          <span className="text-brown-400 line-through">{item.before}</span>
                          <span className="mx-1 text-brown-300">→</span>
                          <span className="font-medium text-brown-800">{item.after}</span>
                        </div>
                        {correctionState[index] === "applied" ? (
                          <span className="flex-none text-xs text-sage-700">고침</span>
                        ) : correctionState[index] === "missing" ? (
                          <span className="flex-none text-xs text-amber-600">본문이 바뀌어 직접 고쳐주세요</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => applyCorrections([index])}
                            className="flex-none text-xs font-semibold text-brown-700 underline underline-offset-2"
                          >
                            고치기
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
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
          {submitting ? "저장 중..." : isEditMode ? "수정 완료" : isRereadMode ? "재독 기록 남기기" : isContinuationMode ? "내 생각 남기기" : isPublic && scheduleOn ? "예약하기" : "독후감 올리기"}
        </button>

        <div className="fixed left-0 right-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-cream-200 px-4 py-3 sm:hidden">
          <div className="grid grid-cols-[0.9fr_1.1fr] gap-2">
            <button
              type="button"
              onClick={requestProofread}
              disabled={!canProofread}
              className="py-3 rounded-xl border border-brown-200 bg-white text-sm font-medium text-brown-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {proofreadLoading ? "교정 중..." : "교정하기"}
            </button>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-brown-700 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "저장 중..." : isEditMode ? "수정 완료" : isRereadMode ? "재독 기록 남기기" : isContinuationMode ? "내 생각 남기기" : isPublic && scheduleOn ? "예약하기" : "독후감 올리기"}
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
