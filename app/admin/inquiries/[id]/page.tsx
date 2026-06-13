"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../../../lib/api";

interface Comment { id: number; authorName: string; content: string; createdAt: string; }
interface InquiryDetail { id: number; title: string; content: string; authorName: string; createdAt: string; comments: Comment[]; }

export default function AdminInquiryDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const r = await fetch(`${API_BASE}/api/admin/inquiries/${params.id}`, { headers: h });
    if (r.status === 403) { router.replace("/admin"); return; }
    const j = await r.json();
    setInquiry(j.data);
    setLoading(false);
  }

  useEffect(() => { if (!token) { router.replace("/auth/login"); return; } load(); }, []);

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    const r = await fetch(`${API_BASE}/api/admin/inquiries/${params.id}/comments`, {
      method: "POST", headers: h, body: JSON.stringify({ content: comment }),
    });
    if (r.ok) { setComment(""); load(); }
    setSubmitting(false);
  }

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-8 text-center text-brown-300">불러오는 중...</div>;
  if (!inquiry) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => router.back()} className="text-sm text-brown-400 hover:text-brown-600 mb-4">← 문의 목록</button>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-cream-200 mb-4">
        <h2 className="text-lg font-bold text-brown-800 mb-1">{inquiry.title}</h2>
        <p className="text-xs text-brown-400 mb-4">{inquiry.authorName} · {new Date(inquiry.createdAt).toLocaleDateString("ko-KR")}</p>
        <p className="text-sm text-brown-700 whitespace-pre-wrap leading-relaxed">{inquiry.content}</p>
      </div>

      {/* 기존 답변 */}
      {inquiry.comments.length > 0 && (
        <div className="flex flex-col gap-3 mb-4">
          <p className="text-sm font-medium text-brown-600">💬 답변 ({inquiry.comments.length})</p>
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

      {/* 답변 작성 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
        <p className="text-sm font-medium text-brown-700 mb-3">✏️ 답변 달기</p>
        <form onSubmit={handleComment} className="flex flex-col gap-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="답변 내용을 입력해주세요"
            rows={4}
            className="px-4 py-3 rounded-xl border border-cream-300 text-sm text-brown-800 placeholder-brown-300 focus:outline-none focus:border-brown-400 resize-none"
          />
          <button
            type="submit"
            disabled={submitting || !comment.trim()}
            className="self-end px-5 py-2 text-sm bg-brown-600 text-white rounded-xl hover:bg-brown-700 disabled:opacity-50"
          >
            {submitting ? "전송 중..." : "답변 보내기"}
          </button>
        </form>
      </div>
    </div>
  );
}
