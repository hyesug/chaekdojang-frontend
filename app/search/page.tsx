"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

type BookResult = {
  id: number;
  isbn13: string;
  title: string;
  author: string;
  publisher: string;
  thumbnail: string | null;
  source: string;
  category?: string;
};

type AddingState = Record<string, "idle" | "loading" | "done" | "error">;

const COVER_COLORS = ["#8B6048", "#6E7A4A", "#4A6E7A", "#7A4A6E", "#4A7A6E"];

const CATEGORIES = [
  "소설", "에세이", "자기계발", "인문", "경제경영", "과학", "역사", "사회",
];

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [adding, setAdding] = useState<AddingState>({});

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);

    try {
      const res = await fetch(
        `http://localhost:8080/api/books/search?q=${encodeURIComponent(query.trim())}`
      );
      if (res.ok) {
        const json = await res.json();
        setResults(json.data ?? []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleCategorySearch(category: string) {
    setQuery(category);
    setSearching(true);
    setSearched(true);

    try {
      const res = await fetch(
        `http://localhost:8080/api/books/category?name=${encodeURIComponent(category)}`
      );
      if (res.ok) {
        const json = await res.json();
        setResults(json.data ?? []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function addToLibrary(book: BookResult) {
    const key = book.isbn13 || String(book.id);
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    setAdding((prev) => ({ ...prev, [key]: "loading" }));
    try {
      const res = await fetch("http://localhost:8080/api/library", {
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
          localStorage.removeItem("token");
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
      <h1 className="font-serif text-2xl font-bold text-brown-800 mb-6">책 검색</h1>

      {/* 검색 폼 */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="책 제목, 저자, ISBN으로 검색"
          className="flex-1 px-4 py-3 rounded-xl border border-cream-300 text-sm text-brown-800 bg-white placeholder:text-brown-300 focus:outline-none focus:border-brown-400 focus:ring-2 focus:ring-brown-100 transition"
        />
        <button
          type="submit"
          disabled={searching}
          className="px-6 py-3 bg-brown-600 text-white rounded-xl text-sm font-medium hover:bg-brown-700 transition-colors disabled:opacity-50"
        >
          {searching ? "검색 중..." : "검색"}
        </button>
      </form>

      {/* 카테고리 필터 */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategorySearch(cat)}
            disabled={searching}
            className="px-3 py-1.5 text-xs rounded-full border border-brown-200 text-brown-500 hover:border-brown-400 hover:text-brown-700 hover:bg-cream-100 transition-colors disabled:opacity-50"
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 검색 중 */}
      {searching && (
        <div className="text-center py-12 text-brown-400">
          <p>검색 중...</p>
        </div>
      )}

      {/* 결과 없음 */}
      {!searching && searched && results.length === 0 && (
        <div className="text-center py-12 text-brown-400">
          <p className="text-4xl mb-3">🔍</p>
          <p>검색 결과가 없습니다.</p>
          <p className="text-sm mt-1">다른 키워드로 검색해보세요.</p>
        </div>
      )}

      {/* 검색 결과 */}
      {!searching && results.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-brown-400 mb-1">{results.length}권의 책을 찾았어요</p>
          {results.map((book, i) => {
            const key = book.isbn13 || String(book.id);
            const addState = adding[key] ?? "idle";
            const encodedTitle = encodeURIComponent(book.title);

            return (
              <div
                key={key}
                className="bg-white rounded-2xl border border-cream-200 p-4 flex gap-4 hover:shadow-sm transition-shadow"
              >
                {/* 책 표지 */}
                {book.thumbnail ? (
                  <Image
                    src={book.thumbnail}
                    alt={book.title}
                    width={56}
                    height={80}
                    className="rounded shadow-sm object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-14 h-20 rounded shadow-sm flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: COVER_COLORS[i % COVER_COLORS.length] }}
                  >
                    {book.title[0]}
                  </div>
                )}

                {/* 책 정보 */}
                <div className="flex-1 min-w-0">
                  <p className="font-serif font-bold text-brown-800 leading-snug">{book.title}</p>
                  <p className="text-sm text-brown-400 mt-0.5">{book.author}</p>
                  <p className="text-xs text-brown-300 mt-0.5">
                    {book.publisher}
                    {book.category && (
                      <span className="ml-2 px-1.5 py-0.5 bg-cream-200 text-brown-500 rounded text-xs">
                        {book.category}
                      </span>
                    )}
                  </p>

                  {/* 액션 버튼 */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Link
                      href={`/write?bookId=${book.id}&title=${encodedTitle}&author=${encodeURIComponent(book.author)}&publisher=${encodeURIComponent(book.publisher)}${book.thumbnail ? `&thumbnail=${encodeURIComponent(book.thumbnail)}` : ""}`}
                      className="px-3 py-1.5 text-xs bg-brown-600 text-white rounded-full hover:bg-brown-700 transition-colors"
                    >
                      독후감 쓰기
                    </Link>
                    <button
                      type="button"
                      onClick={() => addToLibrary(book)}
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

                  {/* 구매 링크 */}
                  <div className="flex gap-2 mt-2">
                    <a
                      href={`https://www.coupang.com/np/search?q=${encodedTitle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brown-400 hover:text-brown-600 hover:underline transition-colors"
                    >
                      쿠팡에서 보기 →
                    </a>
                    <span className="text-brown-200 text-xs">|</span>
                    <a
                      href={`https://search.kyobobook.co.kr/search?keyword=${encodedTitle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brown-400 hover:text-brown-600 hover:underline transition-colors"
                    >
                      교보문고에서 보기 →
                    </a>
                  </div>
                </div>
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
