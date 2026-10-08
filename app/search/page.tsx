"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, ChevronRight, Search, SearchX } from "lucide-react";
import ProfileAvatar from "../components/ProfileAvatar";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { API_BASE } from "../lib/api";
import { authFetch } from "../lib/auth";
import { buildSearchLinks } from "../lib/purchaseLinks";
import { trackMetric } from "../components/AnalyticsTracker";

type SearchTab = "books" | "webNovels" | "users";

type BookResult = {
  id: number;
  isbn13: string | null;
  title: string;
  author: string;
  publisher: string;
  thumbnail: string | null;
  source: string;
  contentType?: "BOOK" | "WEB_NOVEL";
  sourceUrl?: string | null;
  category?: string | null;
  reviewCount: number;
};

type UserResult = {
  id: number;
  nickname: string;
  profileImage: string | null;
};

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

type AddingState = Record<string, "idle" | "loading" | "done" | "error">;
type RegisteringState = Record<string, "idle" | "loading" | "error">;
type BookGroup = {
  key: string;
  workTitle: string;
  workAuthor: string;
  editions: BookResult[];
};

const COVER_COLORS = ["#8B6048", "#6E7A4A", "#4A6E7A", "#7A4A6E", "#4A7A6E"];

const BASE = API_BASE;
const EDITION_KEYWORDS = "초판|개정|양장|표지|오리지널|리커버|특별|한정|무선|반양장";
const EDITION_NOTE = new RegExp(`\\((?=[^)]*(${EDITION_KEYWORDS}))[^)]*\\)|\\[(?=[^\\]]*(${EDITION_KEYWORDS}))[^\\]]*\\]`, "g");
const EDITION_COLON_NOTE = new RegExp(`[:：]\\s*(?=.*(${EDITION_KEYWORDS})).*$`, "g");
const EDITION_SUFFIX = /\s+(더클래식\s*)?세계문학.*$/;

function normalizeWorkTitle(title: string) {
  return title
    .replace(/\(([^)]*)\)|\[([^\]]*)\]/g, (match, round, square) => isVolumeNote(round ?? square) ? ` ${match} ` : " ")
    .replace(EDITION_NOTE, " ")
    .replace(EDITION_COLON_NOTE, " ")
    .replace(/\s+\/\s+[A-Za-z][A-Za-z\s.'-]*$/g, " ")
    .replace(EDITION_SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isVolumeNote(note: string) {
  const value = note.replace(/\s+/g, "");
  return /^(상|중|하)$/.test(value) || /^(제)?\d{1,2}(권|부|편|집|권째)?$/.test(value);
}

function normalizeAuthor(author: string) {
  return author.split(/[,;/·]/)[0]?.replace(/\s+/g, " ").trim() ?? author.trim();
}

function normalizeAuthorKey(author: string) {
  return normalizeAuthor(author).replace(/\s+/g, "").toLowerCase();
}

function stripAuthorSuffixFromTitle(title: string, author: string) {
  const plusIndex = title.lastIndexOf("+");
  if (plusIndex < 0) return title;
  const suffix = title.slice(plusIndex + 1);
  if (normalizeAuthorKey(suffix) !== normalizeAuthorKey(author)) return title;
  return title.slice(0, plusIndex).trim();
}

function groupBooks(books: BookResult[]): BookGroup[] {
  const groups = new Map<string, BookGroup>();
  const groupsByTitle = new Map<string, BookGroup>();
  for (const book of books) {
    const workTitle = normalizeWorkTitle(stripAuthorSuffixFromTitle(book.title, book.author)) || book.title;
    const workAuthor = normalizeAuthor(book.author) || book.author;
    const titleKey = workTitle.toLowerCase();
    const authorKey = normalizeAuthorKey(book.author);
    const key = `${titleKey}::${authorKey}`;
    const titleGroup = groupsByTitle.get(titleKey);
    const canMergeByTitle = titleGroup && (!authorKey || !normalizeAuthorKey(titleGroup.workAuthor));
    const group = groups.get(key) ?? (canMergeByTitle ? titleGroup : undefined);
    if (group) {
      group.editions.push(book);
      if (authorKey && !normalizeAuthorKey(group.workAuthor)) {
        group.workAuthor = workAuthor;
        groups.set(key, group);
      }
    } else {
      const newGroup = { key, workTitle, workAuthor, editions: [book] };
      groups.set(key, newGroup);
      groupsByTitle.set(titleKey, newGroup);
    }
  }
  return Array.from(new Set(groups.values()));
}

function representativeEdition(editions: BookResult[]): BookResult {
  return [...editions].sort((a, b) => editionScore(b) - editionScore(a))[0] ?? editions[0]!;
}

function editionScore(book: BookResult) {
  let score = (book.reviewCount ?? 0) * 1000;
  if (book.isbn13 && /^\d{13}$/.test(book.isbn13)) score += 100;
  if (book.thumbnail) score += 20;
  if (book.publisher?.trim()) score += 10;
  if (book.source === "KAKAO") score += 5;
  return score;
}


export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <LoadingState label="불러오는 중" />
      }
    >
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<SearchTab>("books");
  const [query, setQuery] = useState("");
  const [authorQuery, setAuthorQuery] = useState("");
  const [publisherQuery, setPublisherQuery] = useState("");
  const [results, setResults] = useState<BookResult[]>([]);
  const [webNovelResults, setWebNovelResults] = useState<WebNovelResult[]>([]);
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [adding, setAdding] = useState<AddingState>({});
  const [registering, setRegistering] = useState<RegisteringState>({});
  const [webNovelError, setWebNovelError] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const author = searchParams.get("author") ?? "";
    const publisher = searchParams.get("publisher") ?? "";
    const requestedTab = searchParams.get("tab");
    const nextTab: SearchTab = requestedTab === "users"
      ? "users"
      : requestedTab === "webNovels"
      ? "webNovels"
      : "books";
    if (!q && !author && !publisher) {
      setTab(nextTab);
      setQuery("");
      setAuthorQuery("");
      setPublisherQuery("");
      setResults([]);
      setWebNovelResults([]);
      setUserResults([]);
      setSearching(false);
      setSearched(false);
      setAdding({});
      setRegistering({});
      setWebNovelError("");
      setExpandedGroups({});
      return;
    }
    setTab(nextTab);
    setQuery(q);
    setAuthorQuery(author);
    setPublisherQuery(publisher);
    runSearch(q, nextTab, false, author, publisher);
  }, [searchParams]);

  async function runSearch(rawQuery: string, targetTab: SearchTab, updateUrl: boolean, rawAuthor = "", rawPublisher = "") {
    const trimmed = rawQuery.trim();
    const trimmedAuthor = rawAuthor.trim();
    const trimmedPublisher = rawPublisher.trim();
    if ((targetTab === "users" || targetTab === "webNovels") && !trimmed) return;
    if (targetTab === "books" && !trimmed && !trimmedAuthor && !trimmedPublisher) return;
    if (updateUrl) {
      const params = new URLSearchParams({ tab: targetTab });
      if (trimmed) params.set("q", trimmed);
      if (targetTab === "books" && trimmedAuthor) params.set("author", trimmedAuthor);
      if (targetTab === "books" && trimmedPublisher) params.set("publisher", trimmedPublisher);
      router.replace(`/search?${params.toString()}`, { scroll: false });
    }
    setSearching(true);
    setSearched(true);
    setWebNovelError("");

    try {
      if (targetTab === "users") {
        const res = await fetch(
          `${BASE}/api/users/search?q=${encodeURIComponent(trimmed)}`
        );
        if (res.ok) {
          const json = await res.json();
          setUserResults(json.data ?? []);
        } else {
          setUserResults([]);
        }
      } else if (targetTab === "webNovels") {
        trackMetric("web_novel_search", `/search?q=${encodeURIComponent(trimmed)}`);
        const res = await fetch(
          `${BASE}/api/books/web-novels/search?q=${encodeURIComponent(trimmed)}`
        );
        if (res.ok) {
          const json = await res.json();
          setWebNovelResults(json.data ?? []);
        } else {
          setWebNovelResults([]);
        }
      } else {
        const params = new URLSearchParams();
        if (trimmed) params.set("q", trimmed);
        if (trimmedAuthor) params.set("author", trimmedAuthor);
        if (trimmedPublisher) params.set("publisher", trimmedPublisher);
        trackMetric("book_search", `/search?${params.toString()}`);
        const res = await fetch(
          `${BASE}/api/books/search?${params.toString()}`
        );
        if (res.ok) {
          const json = await res.json();
          setResults(json.data ?? []);
        } else {
          setResults([]);
        }
      }
    } catch {
      if (targetTab === "users") setUserResults([]);
      else if (targetTab === "webNovels") setWebNovelResults([]);
      else setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    runSearch(query, tab, true, authorQuery, publisherQuery);
  }

  const groupedResults = groupBooks(results);

  async function startWebNovelReview(novel: WebNovelResult) {
    const key = `${novel.platform}:${novel.externalId}`;
    setRegistering((prev) => ({ ...prev, [key]: "loading" }));
    setWebNovelError("");
    try {
      const res = await authFetch(`${BASE}/api/books/web-novels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: novel.title,
          author: novel.author,
          platform: novel.platform,
          sourceUrl: novel.sourceUrl,
          description: novel.description,
        }),
      });
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      if (!res.ok) {
        setRegistering((prev) => ({ ...prev, [key]: "error" }));
        setWebNovelError("작품을 등록하지 못했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      const json = await res.json();
      const book = json.data ?? json;
      const params = new URLSearchParams({
        bookId: String(book.id),
        title: book.title,
        author: book.author ?? "",
        publisher: book.publisher ?? novel.platformLabel,
        source: book.source ?? novel.platform,
        contentType: "WEB_NOVEL",
        sourceUrl: book.sourceUrl ?? novel.sourceUrl,
      });
      if (book.thumbnail) params.set("thumbnail", book.thumbnail);
      router.push(`/write?${params.toString()}`);
    } catch {
      setRegistering((prev) => ({ ...prev, [key]: "error" }));
      setWebNovelError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    }
  }

  async function addToLibrary(book: BookResult) {
    const key = book.isbn13 || String(book.id);
    const token: string | null = "cookie-session";
    if (!token) {
      router.push("/auth/login");
      return;
    }

    setAdding((prev) => ({ ...prev, [key]: "loading" }));
    try {
      const res = await fetch(`${BASE}/api/library`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookId: book.id, status: "WISHLIST" }),
      });

      if (res.ok) {
        setAdding((prev) => ({ ...prev, [key]: "done" }));
      } else {
        const json = await res.json().catch(() => ({}));
        console.error(`서재 담기 실패 [${res.status}]:`, json);
        if (res.status === 401) {
          
          router.push("/auth/login");
          return;
        }
        setAdding((prev) => ({ ...prev, [key]: "error" }));
        setTimeout(() => setAdding((prev) => ({ ...prev, [key]: "idle" })), 3000);
      }
    } catch (err) {
      console.error("서재 담기 네트워크 오류:", err);
      setAdding((prev) => ({ ...prev, [key]: "error" }));
      setTimeout(() => setAdding((prev) => ({ ...prev, [key]: "idle" })), 3000);
    }
  }

  return (
    <div className="cdj-page cdj-page--reading">
      <h1 className="cdj-title mb-6">검색</h1>

      {/* 탭 */}
      <div className="cdj-tabs mb-5" role="tablist" aria-label="검색 대상">
        {(
          [
            { value: "books", label: "책" },
            { value: "webNovels", label: "웹소설" },
            { value: "users", label: "사람" },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => {
              setTab(value);
              setSearched(false);
              setResults([]);
              setWebNovelResults([]);
              setUserResults([]);
              setWebNovelError("");
              setAuthorQuery("");
              setPublisherQuery("");
              router.replace("/search", { scroll: false });
            }}
            role="tab"
            aria-selected={tab === value}
            className="cdj-tab"
          >
            {label}
          </button>
        ))}
      </div>

      {/* 검색 폼 */}
      <form onSubmit={handleSearch} className="mb-6 flex flex-col gap-2">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sage-500" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "users" ? "닉네임으로 검색" : tab === "webNovels" ? "웹소설 제목" : "책 제목 또는 ISBN"}
            aria-label="검색어"
            className="cdj-field h-[52px] pl-11 pr-24 text-[15px]"
          />
          <button
            type="submit"
            disabled={searching}
            className="cdj-button cdj-button--primary cdj-button--sm absolute right-1.5 top-1/2 -translate-y-1/2"
          >
            {searching ? "검색 중" : "검색"}
          </button>
        </div>
        {tab === "books" && (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={authorQuery}
              onChange={(e) => setAuthorQuery(e.target.value)}
              placeholder="저자명 (선택)"
              aria-label="저자명"
              className="cdj-field text-sm"
            />
            <input
              type="text"
              value={publisherQuery}
              onChange={(e) => setPublisherQuery(e.target.value)}
              placeholder="출판사 (선택)"
              aria-label="출판사"
              className="cdj-field text-sm"
            />
          </div>
        )}
      </form>

      {tab === "webNovels" && (
        <div className="mb-5 text-[13px] leading-5 text-sage-600">
          <p>네이버 웹소설·시리즈·카카오페이지·리디·문피아의 공식 작품 페이지를 찾아요.</p>
          <Link
            href={`/write?contentType=WEB_NOVEL&direct=platform${query.trim() ? `&title=${encodeURIComponent(query.trim())}` : ""}`}
            className="mt-1 inline-flex items-center font-medium text-brown-700 hover:underline"
          >
            검색 결과에 없나요? 작품 URL 직접 입력
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* 검색 중 */}
      {searching && <LoadingState label="검색하는 중" />}

      {/* 결과 없음 */}
      {!searching && searched && (
        (tab === "books" && results.length === 0) ||
        (tab === "webNovels" && webNovelResults.length === 0) ||
        (tab === "users" && userResults.length === 0)
      ) && (
        <EmptyState title="검색 결과가 없어요" icon={<SearchX size={22} aria-hidden="true" />}>
          {tab === "webNovels" ? "작품명을 정확히 입력해도 일반 웹에 색인되지 않은 작품은 찾지 못할 수 있어요." : "다른 키워드로 검색해보세요."}
        </EmptyState>
      )}

      {webNovelError && (
        <p className="cdj-alert cdj-alert--error mb-4">{webNovelError}</p>
      )}

      {/* 사람 검색 결과 */}
      {!searching && tab === "users" && userResults.length > 0 && (
        <div>
          <p className="mb-3 text-[13px] text-sage-600">{userResults.length}명을 찾았어요</p>
          <div className="cdj-card divide-y divide-cream-200 overflow-hidden">
            {userResults.map((user) => (
              <Link
                key={user.id}
                href={`/users/${user.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-cream-100"
              >
                <ProfileAvatar src={user.profileImage} name={user.nickname} size="md" />
                <p className="min-w-0 flex-1 truncate font-semibold text-brown-800">{user.nickname}</p>
                <ChevronRight size={18} className="text-sage-500" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 웹소설 검색 결과 */}
      {!searching && tab === "webNovels" && webNovelResults.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="mb-1 text-[13px] text-sage-600">공식 작품 {webNovelResults.length}개를 찾았어요</p>
          {webNovelResults.map((novel) => {
            const key = `${novel.platform}:${novel.externalId}`;
            const state = registering[key] ?? "idle";
            return (
              <article key={key} className="cdj-card p-4">
                <div className="flex items-start gap-4">
                  {novel.thumbnail ? (
                    <Image
                      src={novel.thumbnail}
                      alt={`${novel.title} 표지`}
                      width={60}
                      height={88}
                      className="h-[88px] w-[60px] flex-shrink-0 rounded-[3px] object-cover shadow-[0_4px_12px_-4px_rgb(16_42_44/22%)]"
                    />
                  ) : (
                    <div className="flex h-[88px] w-[60px] flex-shrink-0 items-center justify-center rounded-lg bg-brown-600 text-sm font-bold text-white">
                      웹소설
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="cdj-tag">
                        {novel.platformLabel}
                      </span>
                      <h2 className="font-serif font-bold leading-snug text-brown-800">{novel.title}</h2>
                    </div>
                    <p className="mt-1 text-[13px] text-sage-600">{novel.author || "작가 정보 없음"}</p>
                    {novel.description && (
                      <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-sage-600">{novel.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startWebNovelReview(novel)}
                        disabled={state === "loading"}
                        className="cdj-button cdj-button--primary cdj-button--sm"
                      >
                        {state === "loading" ? "작품 등록 중..." : state === "error" ? "다시 시도" : "독후감 쓰기"}
                      </button>
                      <a
                        href={novel.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cdj-button cdj-button--secondary cdj-button--sm"
                      >
                        공식 페이지 확인
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 책 검색 결과 */}
      {!searching && tab === "books" && results.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="mb-1 text-[13px] text-sage-600">
            {groupedResults.length}개의 작품을 찾았어요
            {results.length !== groupedResults.length && (
              <span className="ml-1">({results.length}개 판본)</span>
            )}
          </p>
          {groupedResults.map((group, i) => {
            const book = representativeEdition(group.editions);
            const workHref = `/books/work?title=${encodeURIComponent(group.workTitle)}&author=${encodeURIComponent(group.workAuthor)}`;
            const expanded = expandedGroups[group.key] ?? false;
            const representativeWriteHref = `/write?bookId=${book.id}&title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}&publisher=${encodeURIComponent(book.publisher)}${book.thumbnail ? `&thumbnail=${encodeURIComponent(book.thumbnail)}` : ""}`;
            const representativeKey = book.isbn13 || String(book.id);
            const representativeAddState = adding[representativeKey] ?? "idle";

            return (
              <div
                key={group.key}
                className="cdj-card p-4"
              >
                <div className="flex gap-4">
                  {/* 대표 표지 */}
                  {book.thumbnail ? (
                    <Link href={`/books/${book.id}`} className="flex-shrink-0">
                      <Image
                        src={book.thumbnail}
                        alt={book.title}
                        width={72}
                        height={108}
                        className="h-[108px] w-[72px] rounded-[3px] bg-white object-contain shadow-[0_4px_12px_-4px_rgb(16_42_44/22%)]"
                      />
                    </Link>
                  ) : (
                    <Link href={`/books/${book.id}`} className="flex-shrink-0">
                      <div
                        className="flex h-[108px] w-[72px] items-center justify-center rounded-[3px] font-serif text-sm font-bold text-white/85"
                        style={{ backgroundColor: COVER_COLORS[i % COVER_COLORS.length] }}
                      >
                        {book.title[0]}
                      </div>
                    </Link>
                  )}

                  {/* 작품 정보 */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/books/${book.id}`}
                      className="font-serif text-[17px] font-bold leading-snug text-brown-800 hover:text-brown-600"
                    >
                      {group.workTitle}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <p className="text-[13px] text-sage-600">{group.workAuthor}</p>
                      {book.category && (
                        <span className="rounded bg-cream-200 px-1.5 py-0.5 text-[11px] font-medium text-sage-700">
                          #{book.category}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-2 text-xs text-sage-600">
                      대표 판본: {book.publisher}
                      <span className="rounded bg-cream-200 px-1.5 py-0.5 text-[11px] font-medium text-sage-700">
                        {group.editions.length}개 판본
                      </span>
                    </p>

                    {/* 작품 액션 */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Link
                        href={workHref}
                        onClick={() => trackMetric("book_click_search", workHref)}
                        className="cdj-button cdj-button--secondary cdj-button--sm"
                      >
                        독후감 모아보기
                      </Link>
                      <Link
                        href={representativeWriteHref}
                        className="cdj-button cdj-button--primary cdj-button--sm"
                      >
                        독후감 쓰기
                      </Link>
                      <button
                        type="button"
                        onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.key]: !expanded }))}
                        className="cdj-button cdj-button--ghost cdj-button--sm"
                      >
                        {expanded ? "판본 접기" : "판본 보기"}
                      </button>
                      <button
                        type="button"
                        onClick={() => addToLibrary(book)}
                        disabled={representativeAddState === "loading" || representativeAddState === "done"}
                        className={`cdj-button cdj-button--sm border ${
                          representativeAddState === "done"
                            ? "border-transparent bg-brown-100 text-brown-700 cursor-default"
                            : representativeAddState === "error"
                            ? "border-wine-500/40 text-wine-500"
                            : "border-cream-300 bg-cream-50 text-brown-800 hover:border-brown-200"
                        }`}
                      >
                        {representativeAddState === "done"
                          ? "서재에 담음"
                          : representativeAddState === "loading"
                          ? "추가 중..."
                          : representativeAddState === "error"
                          ? "실패 (다시)"
                          : "서재에 담기"}
                      </button>
                    </div>

                    {/* 구매 링크 */}
                    <div className="flex gap-2 mt-2">
                      {buildSearchLinks(group.workTitle, book.source, book.sourceUrl).map((link, idx) => (
                        <span key={link.provider} className="contents">
                          {idx > 0 && <span className="text-xs text-cream-300" aria-hidden="true">·</span>}
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-sage-600 transition-colors hover:text-brown-800 hover:underline"
                          >
                            {link.label}
                          </a>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div className="mt-4 flex flex-col gap-2 border-t border-cream-200 pt-4">
                    {group.editions.map((edition) => {
                      const editionKey = edition.isbn13 || String(edition.id);
                      const addState = adding[editionKey] ?? "idle";
                      const encodedTitle = encodeURIComponent(edition.title);
                      return (
                        <div key={editionKey} className="flex gap-3 rounded-lg bg-cream-100 p-3">
                          {edition.thumbnail ? (
                            <Image
                              src={edition.thumbnail}
                              alt={edition.title}
                              width={40}
                              height={58}
                              className="w-10 h-[58px] rounded object-contain flex-shrink-0 bg-white"
                            />
                          ) : (
                            <div
                              className="w-10 h-[58px] rounded flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: COVER_COLORS[i % COVER_COLORS.length] }}
                            >
                              {edition.title[0]}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/books/${edition.id}`}
                              className="text-sm font-semibold leading-snug text-brown-800 hover:underline"
                            >
                              {edition.title}
                            </Link>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                              <p className="text-xs text-sage-600">{edition.publisher}</p>
                              {edition.category && (
                                <span className="rounded bg-cream-200 px-1.5 py-0.5 text-[11px] font-medium text-sage-700">
                                  #{edition.category}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Link
                                href={`/write?bookId=${edition.id}&title=${encodedTitle}&author=${encodeURIComponent(edition.author)}&publisher=${encodeURIComponent(edition.publisher)}${edition.thumbnail ? `&thumbnail=${encodeURIComponent(edition.thumbnail)}` : ""}`}
                                className="cdj-button cdj-button--primary cdj-button--sm"
                              >
                                이 판본으로 독후감 쓰기
                              </Link>
                              <button
                                type="button"
                                onClick={() => addToLibrary(edition)}
                                disabled={addState === "loading" || addState === "done"}
                                className={`cdj-button cdj-button--sm border ${
                                  addState === "done"
                                    ? "border-transparent bg-brown-100 text-brown-700 cursor-default"
                                    : addState === "error"
                                    ? "border-wine-500/40 text-wine-500"
                                    : "border-cream-300 bg-cream-50 text-brown-800 hover:border-brown-200"
                                }`}
                              >
                                {addState === "done"
                                  ? "서재에 담음"
                                  : addState === "loading"
                                  ? "추가 중..."
                                  : addState === "error"
                                  ? "실패 (재시도)"
                                  : "서재에 담기"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 초기 상태 */}
      {!searched && (
        <EmptyState title="읽은 책, 읽고 싶은 책을 찾아보세요" icon={<BookOpen size={22} aria-hidden="true" />}>
          카카오 · Google Books에서 통합 검색합니다
        </EmptyState>
      )}
    </div>
  );
}
