"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE } from "../lib/api";

interface InquirySummary {
  id: number;
  title: string;
  authorName: string;
  createdAt: string;
}

export default function CustomerSupportPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"write" | "list">("write");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [myList, setMyList] = useState<InquirySummary[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const isLoggedIn = !!token && token !== "undefined" && token !== "null";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { setError("제목과 내용을 입력해주세요."); return; }
    if (!isLoggedIn && (!guestName.trim() || !guestEmail.trim())) {
      setError("비회원은 이름과 이메일을 입력해주세요."); return;
    }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/inquiries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(isLoggedIn ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ title, content, guestName: guestName || null, guestEmail: guestEmail || null }),
      });
      if (res.ok) {
        setSuccess(true);
        setTitle(""); setContent(""); setGuestName(""); setGuestEmail("");
      } else {
        setError("오류가 발생했어요. 다시 시도해주세요.");
      }
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMyList() {
    setListLoading(true);
    try {
      const url = isLoggedIn
        ? `${API_BASE}/api/inquiries/my`
        : `${API_BASE}/api/inquiries/my?email=${encodeURIComponent(guestEmail)}`;
      const res = await fetch(url, {
        headers: isLoggedIn ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setMyList(json.data ?? []);
      }
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "list") loadMyList();
  }, [tab]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brown-800">고객센터</h1>
        <p className="text-sm text-brown-400 mt-1">문의사항이나 건의사항을 남겨주세요</p>
      </div>

      <div className="flex gap-1 mb-6 bg-cream-200 rounded-xl p-1">
        {(["write", "list"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              tab === t ? "bg-white text-brown-800 shadow-sm" : "text-brown-400 hover:text-brown-600"
            }`}
          >
            {t === "write" ? "✏️ 문의 작성" : "📋 내 문의"}
          </button>
        ))}
      </div>

      {tab === "write" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-cream-200">
          {success ? (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-brown-800 font-medium">문의가 접수되었어요</p>
              <p className="text-sm text-brown-400 mt-1">답변은 이메일로 안내드려요</p>
              <button
                onClick={() => setSuccess(false)}
                className="mt-4 px-4 py-2 text-sm bg-brown-600 text-white rounded-xl hover:bg-brown-700"
              >
                새 문의 작성
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {!isLoggedIn && (
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="이름"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border border-cream-300 text-sm text-brown-800 placeholder-brown-300 focus:outline-none focus:border-brown-400"
                  />
                  <input
                    type="email"
                    placeholder="이메일"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border border-cream-300 text-sm text-brown-800 placeholder-brown-300 focus:outline-none focus:border-brown-400"
                  />
                </div>
              )}
              <input
                type="text"
                placeholder="제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="px-4 py-3 rounded-xl border border-cream-300 text-sm text-brown-800 placeholder-brown-300 focus:outline-none focus:border-brown-400"
              />
              <textarea
                placeholder="문의 내용을 입력해주세요"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="px-4 py-3 rounded-xl border border-cream-300 text-sm text-brown-800 placeholder-brown-300 focus:outline-none focus:border-brown-400 resize-none"
              />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <p className="text-xs text-brown-300">🔒 모든 문의는 비밀글로 처리됩니다</p>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brown-600 text-white rounded-xl text-sm font-medium hover:bg-brown-700 disabled:opacity-50"
              >
                {loading ? "전송 중..." : "문의 보내기"}
              </button>
            </form>
          )}
        </div>
      )}

      {tab === "list" && (
        <div>
          {!isLoggedIn && (
            <div className="mb-4 flex gap-2">
              <input
                type="email"
                placeholder="문의 시 입력한 이메일"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="flex-1 px-4 py-2 rounded-xl border border-cream-300 text-sm text-brown-800 placeholder-brown-300 focus:outline-none focus:border-brown-400"
              />
              <button
                onClick={loadMyList}
                className="px-4 py-2 text-sm bg-brown-600 text-white rounded-xl hover:bg-brown-700"
              >
                조회
              </button>
            </div>
          )}
          {listLoading ? (
            <p className="text-center text-brown-300 py-8">불러오는 중...</p>
          ) : myList.length === 0 ? (
            <p className="text-center text-brown-300 py-8">문의 내역이 없어요</p>
          ) : (
            <div className="flex flex-col gap-3">
              {myList.map((item) => (
                <Link
                  key={item.id}
                  href={`/cs/${item.id}${!isLoggedIn ? `?email=${encodeURIComponent(guestEmail)}` : ""}`}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-cream-200 hover:border-brown-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-brown-800">{item.title}</p>
                    <span className="text-xs text-brown-300">🔒</span>
                  </div>
                  <p className="text-xs text-brown-400 mt-1">{new Date(item.createdAt).toLocaleDateString("ko-KR")}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
