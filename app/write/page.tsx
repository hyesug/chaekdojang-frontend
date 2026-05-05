"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type BookResult = {
  id: number;
  isbn13: string;
  title: string;
  author: string;
  publisher: string;
  thumbnail: string | null;
  source: string;
};

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

export default function WritePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /* 책 검색 상태 */
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookResult | null>(null);

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
  const [title, setTitle] = useState("");
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");

  /* 제출 상태 */
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function searchBooks() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `http://localhost:8080/api/books/search?q=${encodeURIComponent(query)}`
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
    if (!title.trim()) { setError("제목을 입력해주세요."); return; }
    if (rating === 0) { setError("별점을 선택해주세요."); return; }
    if (content.trim().length < 10) { setError("독후감을 10자 이상 작성해주세요."); return; }

    setSubmitting(true);
    setError("");

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    try {
      const res = await fetch("http://localhost:8080/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookId: selectedBook.id, title: title.trim(), rating, content }),
      });

      if (res.ok) {
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
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="text-sm text-brown-400 hover:text-brown-600 transition-colors">
          ← 피드로
        </Link>
        <h1 className="font-serif text-2xl font-bold text-brown-800">독후감 쓰기</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* STEP 1: 책 검색 */}
        <section className="bg-white rounded-2xl border border-cream-200 p-6 shadow-sm">
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
              <div className="flex gap-2">
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

        {/* STEP 2: 제목 */}
        <section className="bg-white rounded-2xl border border-cream-200 p-6 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-700 mb-4">
            2. 독후감 제목
          </h2>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="독후감 제목을 입력해주세요"
            className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm text-brown-800 bg-cream-50 placeholder:text-brown-300 focus:outline-none focus:border-brown-400 focus:ring-2 focus:ring-brown-100 transition"
          />
        </section>

        {/* STEP 3: 별점 */}
        <section className="bg-white rounded-2xl border border-cream-200 p-6 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-700 mb-4">
            3. 별점을 매겨주세요
          </h2>
          <StarPicker value={rating} onChange={setRating} />
        </section>

        {/* STEP 4: 독후감 본문 */}
        <section className="bg-white rounded-2xl border border-cream-200 p-6 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-700 mb-4">
            4. 독후감을 남겨주세요
          </h2>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="이 책을 읽고 어떤 생각이 드셨나요? 기억에 남는 문장, 감상, 추천 이유 등을 자유롭게 적어주세요."
            rows={8}
            className="w-full px-4 py-3 rounded-xl border border-cream-300 text-sm text-brown-800 bg-cream-50 placeholder:text-brown-300 focus:outline-none focus:border-brown-400 focus:ring-2 focus:ring-brown-100 transition resize-none leading-relaxed"
          />
          <p className="mt-1.5 text-xs text-brown-300 text-right">{content.length}자</p>
        </section>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-brown-600 text-white rounded-xl font-medium hover:bg-brown-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "저장 중..." : "독후감 올리기"}
        </button>
      </form>
    </div>
  );
}
