"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { API_BASE } from "../../lib/api";

type GroupBook = { id: number; title: string; bookId: number };

function getToken() {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("token");
  return !token || token === "undefined" || token === "null" ? null : token;
}

export default function GroupManageClient({
  slug,
  manager,
  member,
  books,
}: {
  slug: string;
  manager: boolean;
  member: boolean;
  books: GroupBook[];
}) {
  const router = useRouter();
  const [bookId, setBookId] = useState("");
  const [note, setNote] = useState("");
  const [groupBookId, setGroupBookId] = useState(books[0]?.id ? String(books[0].id) : "");
  const [reviewId, setReviewId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function addBook(event: React.FormEvent) {
    event.preventDefault();
    const token = getToken();
    if (!token) {
      router.push("/auth/login");
      return;
    }
    if (!bookId.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/groups/${slug}/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookId: Number(bookId), note: note.trim() || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      setBookId("");
      setNote("");
      setMessage("선정 책을 추가했어요.");
      router.refresh();
    } catch {
      setMessage("책을 추가하지 못했어요. 책 ID와 권한을 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function attachReview(event: React.FormEvent) {
    event.preventDefault();
    const token = getToken();
    if (!token) {
      router.push("/auth/login");
      return;
    }
    if (!groupBookId || !reviewId.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/groups/${slug}/books/${groupBookId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reviewId: Number(reviewId) }),
      });
      if (!res.ok) throw new Error(await res.text());
      setReviewId("");
      setMessage("독후감을 모임에 연결했어요.");
      router.refresh();
    } catch {
      setMessage("독후감을 연결하지 못했어요. 내 공개 독후감이고 같은 책인지 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  if (!manager && !member) return null;

  return (
    <section className="mt-8 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-lg font-bold text-brown-900">모임 관리</h2>
      <p className="mt-1 text-sm text-brown-400">초기 버전은 책 ID와 독후감 ID로 연결합니다. 검색형 연결은 다음 단계에서 붙이면 됩니다.</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {manager && (
          <form onSubmit={addBook} className="space-y-3 rounded-2xl bg-cream-50 p-4">
            <p className="text-sm font-semibold text-brown-700">선정 책 추가</p>
            <input
              value={bookId}
              onChange={(event) => setBookId(event.target.value)}
              inputMode="numeric"
              placeholder="책 ID"
              className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
            />
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="회차/기간 메모"
              className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
            />
            <button disabled={loading} className="w-full rounded-xl bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-50">
              책 추가
            </button>
          </form>
        )}

        {member && books.length > 0 && (
          <form onSubmit={attachReview} className="space-y-3 rounded-2xl bg-cream-50 p-4">
            <p className="text-sm font-semibold text-brown-700">내 독후감 연결</p>
            <select
              value={groupBookId}
              onChange={(event) => setGroupBookId(event.target.value)}
              className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-700 focus:border-brown-400 focus:outline-none"
            >
              {books.map((book) => (
                <option key={book.id} value={book.id}>{book.title}</option>
              ))}
            </select>
            <input
              value={reviewId}
              onChange={(event) => setReviewId(event.target.value)}
              inputMode="numeric"
              placeholder="내 공개 독후감 ID"
              className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
            />
            <button disabled={loading} className="w-full rounded-xl bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-50">
              독후감 연결
            </button>
          </form>
        )}
      </div>

      {message && <p className="mt-3 text-sm text-brown-500">{message}</p>}
    </section>
  );
}
