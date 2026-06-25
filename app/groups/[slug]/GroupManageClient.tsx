"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../lib/api";
import BookSearchSelect from "./BookSearchSelect";

type GroupBook = { id: number; title: string; bookId: number };
type GroupMember = {
  id: number;
  userId: number;
  nickname: string;
  profileImage: string | null;
  role: "OWNER" | "MANAGER" | "MEMBER";
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
};

function getToken() {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("token");
  return !token || token === "undefined" || token === "null" ? null : token;
}

export default function GroupManageClient({ slug, manager, member, books }: { slug: string; manager: boolean; member: boolean; books: GroupBook[] }) {
  const router = useRouter();
  const [bookId, setBookId] = useState("");
  const [note, setNote] = useState("");
  const [groupBookId, setGroupBookId] = useState(books[0]?.id ? String(books[0].id) : "");
  const [reviewId, setReviewId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingMembers, setPendingMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const loadPendingMembers = useCallback(async () => {
    if (!manager) return;
    const token = getToken();
    if (!token) return;
    setMembersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/groups/${slug}/members?status=PENDING`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setPendingMembers((json.data ?? json) as GroupMember[]);
    } catch {
      setPendingMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [manager, slug]);

  useEffect(() => {
    loadPendingMembers();
  }, [loadPendingMembers]);

  async function addBook(event: React.FormEvent) {
    event.preventDefault();
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }
    if (!bookId.trim()) { setMessage("검색 결과에서 책을 선택해주세요."); return; }
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
      setMessage("책을 추가하지 못했어요. 권한이나 중복 등록 여부를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function attachReview(event: React.FormEvent) {
    event.preventDefault();
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }
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

  async function updateMember(memberId: number, action: "approve" | "reject") {
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/groups/${slug}/members/${memberId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setPendingMembers((members) => members.filter((member) => member.id !== memberId));
      setMessage(action === "approve" ? "가입 요청을 승인했어요." : "가입 요청을 거절했어요.");
      router.refresh();
    } catch {
      setMessage("멤버 상태를 변경하지 못했어요. 권한을 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  if (!manager && !member) return null;

  return (
    <section className="mt-8 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-lg font-bold text-brown-900">모임 관리</h2>
      <p className="mt-1 text-sm text-brown-400">모임장이 선정 책을 검색해서 추가하고, 멤버는 자신의 공개 독후감을 연결할 수 있습니다.</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {manager && (
          <div className="space-y-3 rounded-2xl bg-cream-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-brown-700">가입 승인 대기</p>
              <button type="button" onClick={loadPendingMembers} className="text-xs font-medium text-brown-500 hover:text-brown-800">
                새로고침
              </button>
            </div>
            {membersLoading && <p className="text-sm text-brown-400">불러오는 중...</p>}
            {!membersLoading && pendingMembers.length === 0 && (
              <p className="rounded-xl bg-white px-3 py-4 text-sm text-brown-400">승인 대기 중인 멤버가 없어요.</p>
            )}
            {!membersLoading && pendingMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-brown-800">{member.nickname}</p>
                  <p className="text-xs text-brown-400">요청일 {new Date(member.createdAt).toLocaleDateString("ko-KR")}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" disabled={loading} onClick={() => updateMember(member.id, "approve")} className="rounded-lg bg-brown-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brown-800 disabled:opacity-50">
                    승인
                  </button>
                  <button type="button" disabled={loading} onClick={() => updateMember(member.id, "reject")} className="rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-semibold text-brown-500 hover:bg-cream-100 disabled:opacity-50">
                    거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {manager && (
          <form onSubmit={addBook} className="space-y-3 rounded-2xl bg-cream-50 p-4">
            <p className="text-sm font-semibold text-brown-700">선정 책 추가</p>
            <BookSearchSelect value={bookId} onChange={(id) => setBookId(id)} />
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="회차/기간 메모" className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none" />
            <button disabled={loading} className="w-full rounded-xl bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-50">책 추가</button>
          </form>
        )}
        {member && books.length > 0 && (
          <form onSubmit={attachReview} className="space-y-3 rounded-2xl bg-cream-50 p-4">
            <p className="text-sm font-semibold text-brown-700">내 독후감 연결</p>
            <select value={groupBookId} onChange={(event) => setGroupBookId(event.target.value)} className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-700 focus:border-brown-400 focus:outline-none">
              {books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
            </select>
            <input value={reviewId} onChange={(event) => setReviewId(event.target.value)} inputMode="numeric" placeholder="내 공개 독후감 ID" className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none" />
            <button disabled={loading} className="w-full rounded-xl bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-50">독후감 연결</button>
          </form>
        )}
      </div>
      {message && <p className="mt-3 text-sm text-brown-500">{message}</p>}
    </section>
  );
}
