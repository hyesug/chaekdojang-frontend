"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import ProfileAvatar from "../components/ProfileAvatar";
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
        <div className="max-w-2xl mx-auto px-4 py-16 text-center text-brown-400">
          불러오는 중...
        </div>
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
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-serif text-2xl font-bold text-brown-800 mb-6">검색</h1>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 bg-cream-200 rounded-xl p-1">
        {(
          [
            { value: "books", label: "📚 책" },
            { value: "webNovels", label: "📱 웹소설" },
            { value: "users", label: "👤 사람" },
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
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              tab === value ? "bg-white text-brown-800 shadow-sm" : "text-brown-400 hover:text-brown-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 검색 폼 */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className={`flex-1 grid grid-cols-1 gap-2 ${tab === "books" ? "sm:grid-cols-3" : ""}`}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "users" ? "닉네임으로 검색" : tab === "webNovels" ? "웹소설 제목" : "책 제목 또는 ISBN"}
            className="w-full px-4 py-3 rounded-xl border border-cream-300 text-sm text-brown-800 bg-white placeholder:text-brown-300 focus:outline-none focus:border-brown-400 focus:ring-2 focus:ring-brown-100 transition"
          />
          {tab === "books" && (
            <>
              <input
                type="text"
                value={authorQuery}
                onChange={(e) => setAuthorQuery(e.target.value)}
                placeholder="저자명"
                className="w-full px-4 py-3 rounded-xl border border-cream-300 text-sm text-brown-800 bg-white placeholder:text-brown-300 focus:outline-none focus:border-brown-400 focus:ring-2 focus:ring-brown-100 transition"
              />
              <input
                type="text"
                value={publisherQuery}
                onChange={(e) => setPublisherQuery(e.target.value)}
                placeholder="출판사"
                className="w-full px-4 py-3 rounded-xl border border-cream-300 text-sm text-brown-800 bg-white placeholder:text-brown-300 focus:outline-none focus:border-brown-400 focus:ring-2 focus:ring-brown-100 transition"
              />
            </>
          )}
        </div>
        <button
          type="submit"
          disabled={searching}
          className="px-6 py-3 bg-brown-600 text-white rounded-xl text-sm font-medium hover:bg-brown-700 transition-colors disabled:opacity-50 sm:w-auto"
        >
          {searching ? "검색 중..." : "검색"}
        </button>
      </form>

      {tab === "webNovels" && (
        <div className="mb-4 text-xs leading-5 text-brown-400">
          <p>네이버 웹소설·시리즈·카카오페이지·리디·문피아의 공식 작품 페이지를 찾아요.</p>
          <Link
            href={`/write?contentType=WEB_NOVEL&direct=platform${query.trim() ? `&title=${encodeURIComponent(query.trim())}` : ""}`}
            className="mt-1 inline-block font-medium text-brown-600 hover:text-brown-800 hover:underline"
          >
            검색 결과에 없나요? 작품 URL 직접 입력 →
          </Link>
        </div>
      )}

      {/* 검색 중 */}
      {searching && (
        <div className="text-center py-12 text-brown-400">
          <p>검색 중...</p>
        </div>
      )}

      {/* 결과 없음 */}
      {!searching && searched && (
        (tab === "books" && results.length === 0) ||
        (tab === "webNovels" && webNovelResults.length === 0) ||
        (tab === "users" && userResults.length === 0)
      ) && (
        <div className="text-center py-12 text-brown-400">
          <p className="text-4xl mb-3">🔍</p>
          <p>검색 결과가 없습니다.</p>
          <p className="text-sm mt-1">
            {tab === "webNovels" ? "작품명을 정확히 입력해도 일반 웹에 색인되지 않은 작품은 찾지 못할 수 있어요." : "다른 키워드로 검색해보세요."}
          </p>
        </div>
      )}

      {webNovelError && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-500">{webNovelError}</p>
      )}

      {/* 사람 검색 결과 */}
      {!searching && tab === "users" && userResults.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-brown-400 mb-1">{userResults.length}명을 찾았어요</p>
          {userResults.map((user) => (
            <Link
              key={user.id}
              href={`/users/${user.id}`}
              className="bg-white rounded-2xl border border-cream-200 p-4 flex items-center gap-3 hover:shadow-sm transition-shadow"
            >
              <ProfileAvatar src={user.profileImage} name={user.nickname} size="xl" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-brown-800 truncate">{user.nickname}</p>
              </div>
              <span className="text-brown-300 text-sm">›</span>
            </Link>
          ))}
        </div>
      )}

      {/* 웹소설 검색 결과 */}
      {!searching && tab === "webNovels" && webNovelResults.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="mb-1 text-sm text-brown-400">공식 작품 {webNovelResults.length}개를 찾았어요</p>
          {webNovelResults.map((novel) => {
            const key = `${novel.platform}:${novel.externalId}`;
            const state = registering[key] ?? "idle";
            return (
              <article key={key} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  {novel.thumbnail ? (
                    <Image
                      src={novel.thumbnail}
                      alt={`${novel.title} 표지`}
                      width={60}
                      height={88}
                      className="h-[88px] w-[60px] flex-shrink-0 rounded-lg object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex h-[88px] w-[60px] flex-shrink-0 items-center justify-center rounded-lg bg-brown-600 text-sm font-bold text-white">
                      웹소설
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-cream-200 px-2 py-0.5 text-[11px] font-medium text-sage-600">
                        {novel.platformLabel}
                      </span>
                      <h2 className="font-serif font-bold leading-snug text-brown-800">{novel.title}</h2>
                    </div>
                    <p className="mt-1 text-sm text-brown-400">{novel.author || "작가 정보 없음"}</p>
                    {novel.description && (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-brown-400">{novel.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startWebNovelReview(novel)}
                        disabled={state === "loading"}
                        className="rounded-full bg-brown-600 px-3 py-1.5 text-xs text-white hover:bg-brown-700 disabled:opacity-50"
                      >
                        {state === "loading" ? "작품 등록 중..." : state === "error" ? "다시 시도" : "독후감 쓰기"}
                      </button>
                      <a
                        href={novel.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-brown-300 px-3 py-1.5 text-xs text-brown-600 hover:border-brown-500"
                      >
                        공식 페이지 확인 →
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
          <p className="text-sm text-brown-400 mb-1">
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
                className="bg-white rounded-2xl border border-cream-200 p-4 hover:shadow-sm transition-shadow"
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
                        className="w-[72px] h-[108px] rounded shadow-sm object-contain bg-white"
                      />
                    </Link>
                  ) : (
                    <Link href={`/books/${book.id}`} className="flex-shrink-0">
                      <div
                        className="w-[72px] h-[108px] rounded shadow-sm flex items-center justify-center text-white text-xs font-bold"
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
                      className="font-serif font-bold text-brown-800 leading-snug hover:text-brown-600 hover:underline"
                    >
                      {group.workTitle}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-brown-400">{group.workAuthor}</p>
                      {book.category && (
                        <span className="rounded-full bg-cream-200 px-2 py-0.5 text-[11px] font-medium text-brown-500">
                          #{book.category}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-brown-300 mt-0.5">
                      대표 판본: {book.publisher}
                      <span className="ml-2 px-1.5 py-0.5 bg-cream-200 text-brown-500 rounded text-xs">
                        {group.editions.length}개 판본
                      </span>
                    </p>

                    {/* 작품 액션 */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Link
                        href={workHref}
                        onClick={() => trackMetric("book_click_search", workHref)}
                        className="px-3 py-1.5 text-xs border border-brown-500 text-brown-700 rounded-full hover:bg-cream-100 transition-colors"
                      >
                        독후감 모아보기
                      </Link>
                      <Link
                        href={representativeWriteHref}
                        className="px-3 py-1.5 text-xs bg-brown-600 text-white rounded-full hover:bg-brown-700 transition-colors"
                      >
                        독후감 쓰기
                      </Link>
                      <button
                        type="button"
                        onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.key]: !expanded }))}
                        className="px-3 py-1.5 text-xs border border-brown-300 text-brown-600 rounded-full hover:border-brown-500 transition-colors"
                      >
                        {expanded ? "판본 접기" : "판본 보기"}
                      </button>
                      <button
                        type="button"
                        onClick={() => addToLibrary(book)}
                        disabled={representativeAddState === "loading" || representativeAddState === "done"}
                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                          representativeAddState === "done"
                            ? "border-sage-500 text-sage-600 cursor-default"
                            : representativeAddState === "error"
                            ? "border-red-300 text-red-400"
                            : "border-brown-300 text-brown-500 hover:border-brown-500 hover:text-brown-700"
                        }`}
                      >
                        {representativeAddState === "done"
                          ? "✓ 서재 추가됨"
                          : representativeAddState === "loading"
                          ? "추가 중..."
                          : representativeAddState === "error"
                          ? "실패 (다시)"
                          : "+ 내 서재에 담기"}
                      </button>
                    </div>

                    {/* 구매 링크 */}
                    <div className="flex gap-2 mt-2">
                      {buildSearchLinks(group.workTitle, book.source, book.sourceUrl).map((link, idx) => (
                        <span key={link.provider} className="contents">
                          {idx > 0 && <span className="text-brown-200 text-xs">|</span>}
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brown-400 hover:text-brown-600 hover:underline transition-colors"
                          >
                            {link.label} →
                          </a>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div className="mt-4 pt-4 border-t border-cream-100 flex flex-col gap-3">
                    {group.editions.map((edition) => {
                      const editionKey = edition.isbn13 || String(edition.id);
                      const addState = adding[editionKey] ?? "idle";
                      const encodedTitle = encodeURIComponent(edition.title);
                      return (
                        <div key={editionKey} className="flex gap-3 rounded-xl bg-cream-50 border border-cream-200 p-3">
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
                              className="text-sm font-semibold text-brown-800 leading-snug hover:text-brown-600 hover:underline"
                            >
                              {edition.title}
                            </Link>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                              <p className="text-xs text-brown-400">{edition.publisher}</p>
                              {edition.category && (
                                <span className="rounded-full bg-cream-200 px-2 py-0.5 text-[11px] font-medium text-brown-500">
                                  #{edition.category}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Link
                                href={`/write?bookId=${edition.id}&title=${encodedTitle}&author=${encodeURIComponent(edition.author)}&publisher=${encodeURIComponent(edition.publisher)}${edition.thumbnail ? `&thumbnail=${encodeURIComponent(edition.thumbnail)}` : ""}`}
                                className="px-3 py-1.5 text-xs bg-brown-600 text-white rounded-full hover:bg-brown-700 transition-colors"
                              >
                                이 판본으로 독후감 쓰기
                              </Link>
                              <button
                                type="button"
                                onClick={() => addToLibrary(edition)}
                                disabled={addState === "loading" || addState === "done"}
                                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                  addState === "done"
                                    ? "border-sage-500 text-sage-600 cursor-default"
                                    : addState === "error"
                                    ? "border-red-300 text-red-400"
                                    : "border-brown-300 text-brown-500 hover:border-brown-500 hover:text-brown-700"
                                }`}
                              >
                                {addState === "done"
                                  ? "✓ 서재 추가됨"
                                  : addState === "loading"
                                  ? "추가 중..."
                                  : addState === "error"
                                  ? "실패 (재시도)"
                                  : "+ 서재에 담기"}
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
        <div className="text-center py-16 text-brown-300">
          <p className="text-5xl mb-4">📚</p>
          <p className="text-brown-400">읽고 싶은 책을 검색해보세요</p>
          <p className="text-sm mt-1">카카오 · Google Books에서 통합 검색합니다</p>
        </div>
      )}
    </div>
  );
}
