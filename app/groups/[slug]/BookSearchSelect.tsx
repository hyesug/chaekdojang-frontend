"use client";

import { useState } from "react";
import { API_BASE } from "../../lib/api";

type BookItem = {
  id: number;
  title: string;
  author: string;
  publisher?: string | null;
};

export default function BookSearchSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (bookId: string, label: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");

  async function searchBooks() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/books/search?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error("book search failed");
      const json = await res.json();
      setResults((json.data ?? json) as BookItem[]);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              searchBooks();
            }
          }}
          placeholder="책 제목 검색"
          className="min-w-0 flex-1 rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={searchBooks}
          disabled={loading}
          className="rounded-xl border border-cream-300 px-3 py-2 text-sm text-brown-600 hover:bg-white disabled:opacity-50"
        >
          {loading ? "검색 중" : "검색"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="max-h-60 overflow-y-auto rounded-xl border border-cream-200 bg-white">
          {results.slice(0, 10).map((book) => {
            const label = `${book.title} · ${book.author}`;
            return (
              <button
                key={`${book.id}-${book.title}`}
                type="button"
                onClick={() => {
                  setSelectedLabel(label);
                  onChange(String(book.id), label);
                }}
                className={`block w-full border-b border-cream-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-cream-50 ${value === String(book.id) ? "bg-cream-100" : ""}`}
              >
                <span className="font-medium text-brown-800">{book.title}</span>
                <span className="mt-0.5 block text-xs text-brown-400">
                  {book.author}{book.publisher ? ` · ${book.publisher}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selectedLabel && <p className="rounded-xl bg-white px-3 py-2 text-xs text-brown-500">선택한 책: {selectedLabel}</p>}
    </div>
  );
}
