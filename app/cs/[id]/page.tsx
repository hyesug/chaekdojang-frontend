"use client";

import { useState, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE } from "../../lib/api";

interface Comment { id: number; authorName: string; content: string; createdAt: string; }
interface InquiryDetail { id: number; title: string; content: string; authorName: string; createdAt: string; comments: Comment[]; }

export default function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: inquiryId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const guestEmail = searchParams.get("email") ?? "";
  const token: string | null = typeof window !== "undefined" ? "cookie-session" : null;
  const isLoggedIn = !!token && token !== "undefined" && token !== "null";

  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [error, setError] = useState("");

  const url = (path: string) => `${API_BASE}/api/inquiries/${path}${!isLoggedIn && guestEmail ? `?email=${encodeURIComponent(guestEmail)}` : ""}`;
  const headers = () => ({
    "Content-Type": "application/json",
    ...(isLoggedIn ? { Authorization: `Bearer ${token}` } : {}),
  });

  useEffect(() => {
    fetch(url(inquiryId), { headers: headers() })
      .then((r) => r.json())
      .then((j) => { setInquiry(j.data); setEditTitle(j.data?.title ?? ""); setEditContent(j.data?.content ?? ""); })
      .catch(() => setError("조회 권한이 없거나 존재하지 않는 문의입니다."))
      .finally(() => setLoading(false));
  }, [inquiryId]);

  async function handleUpdate() {
    const res = await fetch(url(inquiryId), {
      method: "PATCH", headers: headers(),
      body: JSON.stringify({ title: editTitle, content: editContent }),
    });
    if (res.ok) { const j = await res.json(); setInquiry(j.data); setEditing(false); }
  }

  async function handleDelete() {
    if (!confirm("문의를 삭제할까요?")) return;
    const res = await fetch(url(inquiryId), { method: "DELETE", headers: headers() });
    if (res.ok) router.replace("/cs");
  }

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-8 text-center text-brown-300">불러오는 중...</div>;
  if (error || !inquiry) return (
    <div className="max-w-2xl mx-auto px-4 py-8 text-center">
      <p className="text-brown-400">{error || "문의를 찾을 수 없어요"}</p>
      <button onClick={() => router.back()} className="mt-4 text-sm text-brown-600 underline">돌아가기</button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => router.back()} className="text-sm text-brown-400 hover:text-brown-600 mb-4">← 목록으로</button>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-cream-200 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {editing ? (
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-cream-300 text-sm font-medium text-brown-800 focus:outline-none focus:border-brown-400 mb-2" />
            ) : (
              <h2 className="text-lg font-bold text-brown-800">{inquiry.title}</h2>
            )}
            <p className="text-xs text-brown-400">{new Date(inquiry.createdAt).toLocaleDateString("ko-KR")} · 🔒 비밀글</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {editing ? (
              <>
                <button onClick={handleUpdate} className="px-3 py-1 text-xs bg-brown-600 text-white rounded-lg hover:bg-brown-700">저장</button>
                <button onClick={() => setEditing(false)} className="px-3 py-1 text-xs text-brown-400 hover:text-brown-600">취소</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="px-3 py-1 text-xs text-brown-400 hover:text-brown-600">수정</button>
                <button onClick={handleDelete} className="px-3 py-1 text-xs text-red-400 hover:text-red-600">삭제</button>
              </>
            )}
          </div>
        </div>
        <div className="mt-4 text-sm text-brown-700 leading-relaxed">
          {editing ? (
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
              rows={6} className="w-full px-3 py-2 rounded-xl border border-cream-300 text-sm text-brown-800 focus:outline-none focus:border-brown-400 resize-none" />
          ) : (
            <p className="whitespace-pre-wrap">{inquiry.content}</p>
          )}
        </div>
      </div>

      {inquiry.comments.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-brown-600">💬 답변</p>
          {inquiry.comments.map((c) => (
            <div key={c.id} className="bg-cream-100 rounded-2xl p-4 border border-cream-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-brown-600">📚 관리자</span>
                <span className="text-xs text-brown-300">{new Date(c.createdAt).toLocaleDateString("ko-KR")}</span>
              </div>
              <p className="text-sm text-brown-700 whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
        </div>
      )}

      {inquiry.comments.length === 0 && (
        <div className="text-center py-6 text-brown-300 text-sm">아직 답변이 없어요. 빠르게 답변드릴게요 😊</div>
      )}
    </div>
  );
}
