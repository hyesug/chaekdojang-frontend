"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE } from "../lib/api";

interface User { id: number; nickname: string; email: string; role: string; createdAt: string; }
interface Review { id: number; authorNickname: string; bookTitle: string; content: string; rating: number; hidden: boolean; createdAt: string; }
interface BookStat { bookId: number; title: string; author: string; reviewCount: number; }
interface Inquiry { id: number; title: string; authorName: string; createdAt: string; }

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "reviews" | "inquiries">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [bookStats, setBookStats] = useState<BookStat[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  function getToken() {
    if (typeof window === "undefined") return null;
    const t = localStorage.getItem("token");
    return !t || t === "undefined" || t === "null" ? null : t;
  }

  async function load() {
    const token = getToken();
    if (!token) { router.replace("/auth/login"); return; }
    const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    setLoading(true);
    try {
      if (tab === "users") {
        const r = await fetch(`${API_BASE}/api/admin/users?size=50`, { headers: h });
        if (r.status === 403) { setUnauthorized(true); return; }
        const j = await r.json();
        setUsers(j.data?.content ?? []);
      } else if (tab === "reviews") {
        const [rv, st] = await Promise.all([
          fetch(`${API_BASE}/api/admin/reviews?size=50`, { headers: h }).then((r) => r.json()),
          fetch(`${API_BASE}/api/admin/reviews/stats`, { headers: h }).then((r) => r.json()),
        ]);
        setReviews(rv.data?.content ?? []);
        setBookStats(st.data ?? []);
      } else {
        const r = await fetch(`${API_BASE}/api/admin/inquiries?size=50`, { headers: h });
        if (r.status === 403) { setUnauthorized(true); return; }
        const j = await r.json();
        setInquiries(j.data?.content ?? []);
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [tab]);

  async function setRole(userId: number, role: string) {
    const token = getToken();
    if (!token) return;
    const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    await fetch(`${API_BASE}/api/admin/users/${userId}/role`, {
      method: "PATCH", headers: h, body: JSON.stringify({ role }),
    });
    load();
  }

  async function toggleHidden(reviewId: number, hidden: boolean) {
    const token = getToken();
    if (!token) return;
    const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    await fetch(`${API_BASE}/api/admin/reviews/${reviewId}/hidden`, {
      method: "PATCH", headers: h, body: JSON.stringify({ hidden }),
    });
    load();
  }

  if (unauthorized) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p className="text-2xl mb-2">🔒</p>
      <p className="text-brown-600 font-medium">관리자만 접근할 수 있어요</p>
      <button onClick={() => router.back()} className="mt-4 text-sm text-brown-400 underline">돌아가기</button>
    </div>
  );

  const tabs = [
    { key: "users", label: "👥 회원 관리" },
    { key: "reviews", label: "📖 독후감 관리" },
    { key: "inquiries", label: "💬 문의 관리" },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-brown-800 mb-6">관리자 페이지</h1>

      <div className="flex gap-1 mb-6 bg-cream-200 rounded-xl p-1">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${tab === key ? "bg-white text-brown-800 shadow-sm" : "text-brown-400 hover:text-brown-600"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-brown-300 py-8">불러오는 중...</p>}

      {/* 회원 관리 */}
      {!loading && tab === "users" && (
        <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-100">
              <tr>
                <th className="text-left px-4 py-3 text-brown-600 font-medium">닉네임</th>
                <th className="text-left px-4 py-3 text-brown-600 font-medium">이메일</th>
                <th className="text-left px-4 py-3 text-brown-600 font-medium">역할</th>
                <th className="text-left px-4 py-3 text-brown-600 font-medium">가입일</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-cream-100">
                  <td className="px-4 py-3 text-brown-800">{u.nickname}</td>
                  <td className="px-4 py-3 text-brown-500">{u.email ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.role === "SUPER_ADMIN" ? "bg-red-100 text-red-600" :
                      u.role === "ADMIN" ? "bg-blue-100 text-blue-600" : "bg-cream-200 text-brown-500"}`}>
                      {u.role === "SUPER_ADMIN" ? "슈퍼관리자" : u.role === "ADMIN" ? "관리자" : "일반"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-brown-400">{new Date(u.createdAt).toLocaleDateString("ko-KR")}</td>
                  <td className="px-4 py-3">
                    {u.role !== "SUPER_ADMIN" && (
                      <button
                        onClick={() => setRole(u.id, u.role === "ADMIN" ? "USER" : "ADMIN")}
                        className={`px-3 py-1 text-xs rounded-lg ${u.role === "ADMIN" ? "bg-cream-200 text-brown-500 hover:bg-cream-300" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}>
                        {u.role === "ADMIN" ? "권한 해제" : "관리자 지정"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 독후감 관리 */}
      {!loading && tab === "reviews" && (
        <div className="flex flex-col gap-6">
          {bookStats.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-cream-200">
              <h2 className="text-sm font-bold text-brown-700 mb-4">📊 책별 독후감 통계 (Top 10)</h2>
              <div className="flex flex-col gap-2">
                {bookStats.slice(0, 10).map((s, i) => (
                  <div key={s.bookId} className="flex items-center gap-3">
                    <span className="text-xs text-brown-400 w-4">{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm text-brown-800">{s.title}</p>
                      <p className="text-xs text-brown-400">{s.author}</p>
                    </div>
                    <span className="text-sm font-bold text-brown-600">{s.reviewCount}개</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream-100">
                <tr>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">작성자</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">책</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">내용</th>
                  <th className="px-4 py-3 text-brown-600 font-medium">상태</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id} className={`border-t border-cream-100 ${r.hidden ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 text-brown-800">{r.authorNickname}</td>
                    <td className="px-4 py-3 text-brown-500">{r.bookTitle ?? "-"}</td>
                    <td className="px-4 py-3 text-brown-600 max-w-xs truncate">{r.content}</td>
                    <td className="px-4 py-3 text-center">
                      {r.hidden ? <span className="text-xs text-red-400">비공개</span> : <span className="text-xs text-green-500">공개</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleHidden(r.id, !r.hidden)}
                        className={`px-3 py-1 text-xs rounded-lg ${r.hidden ? "bg-green-50 text-green-600 hover:bg-green-100" : "bg-red-50 text-red-500 hover:bg-red-100"}`}>
                        {r.hidden ? "공개" : "비공개"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 문의 관리 */}
      {!loading && tab === "inquiries" && (
        <div className="flex flex-col gap-3">
          {inquiries.map((q) => (
            <Link key={q.id} href={`/admin/inquiries/${q.id}`}
              className="bg-white rounded-2xl p-4 shadow-sm border border-cream-200 hover:border-brown-300 transition-colors flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brown-800">{q.title}</p>
                <p className="text-xs text-brown-400 mt-0.5">{q.authorName} · {new Date(q.createdAt).toLocaleDateString("ko-KR")}</p>
              </div>
              <span className="text-xs text-brown-400">→</span>
            </Link>
          ))}
          {inquiries.length === 0 && <p className="text-center text-brown-300 py-8">문의가 없어요</p>}
        </div>
      )}
    </div>
  );
}
