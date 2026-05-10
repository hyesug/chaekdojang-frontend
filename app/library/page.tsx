"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

type LibraryStatus = "READING" | "FINISHED" | "WISHLIST";

type LibraryItem = {
  id: number;
  book: {
    id: number;
    isbn13: string;
    title: string;
    author: string;
    thumbnail: string | null;
  };
  status: LibraryStatus;
  createdAt: string;
};

const TABS: { value: LibraryStatus | "ALL"; label: string; emoji: string }[] = [
  { value: "ALL", label: "전체", emoji: "📚" },
  { value: "READING", label: "읽는 중", emoji: "📖" },
  { value: "FINISHED", label: "완독", emoji: "✅" },
  { value: "WISHLIST", label: "읽고 싶어요", emoji: "🔖" },
];

const COVER_COLORS = ["#8B6048", "#6E7A4A", "#4A6E7A", "#7A4A6E", "#4A7A6E"];

export default function LibraryPage() {
  const router = useRouter();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<LibraryStatus | "ALL">("ALL");
  const [loggedIn, setLoggedIn] = useState(true);

  useEffect(() => {
    fetchLibrary();
  }, []);

  async function fetchLibrary() {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoggedIn(false);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("http://localhost:8080/api/library", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("token");
        router.push("/auth/login");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setItems(json.data ?? []);
      }
    } catch {
      /* 서버 미연결 시 빈 목록 */
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: number, status: LibraryStatus) {
    const token = localStorage.getItem("token");
    if (!token) return;

    const res = await fetch(`http://localhost:8080/api/library/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    if (res.status === 401) {
      localStorage.removeItem("token");
      router.push("/auth/login");
      return;
    }
    if (res.ok) {
      const json = await res.json();
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: json.data.status } : item))
      );
    }
  }

  async function removeItem(id: number) {
    const token = localStorage.getItem("token");
    if (!token) return;

    const res = await fetch(`http://localhost:8080/api/library/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      localStorage.removeItem("token");
      router.push("/auth/login");
      return;
    }
    if (res.ok) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  }

  const filtered =
    activeTab === "ALL" ? items : items.filter((item) => item.status === activeTab);

  /* 로그인 안 된 경우 */
  if (!loggedIn) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-5xl mb-4">📚</p>
        <p className="font-serif text-xl font-bold text-brown-800 mb-2">내 서재</p>
        <p className="text-brown-400 text-sm mb-6">서재를 보려면 로그인이 필요해요</p>
        <Link
          href="/auth/login"
          className="inline-block px-6 py-2.5 bg-brown-600 text-white rounded-full text-sm font-medium hover:bg-brown-700 transition-colors"
        >
          로그인하기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-brown-800">내 서재</h1>
        <Link
          href="/search"
          className="px-4 py-2 text-sm border border-brown-300 text-brown-600 rounded-full hover:bg-cream-200 transition-colors"
        >
          + 책 추가
        </Link>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-cream-200 rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              activeTab === tab.value
                ? "bg-white text-brown-800 shadow-sm"
                : "text-brown-400 hover:text-brown-600"
            }`}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="text-center py-12 text-brown-400">
          <p>불러오는 중...</p>
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-brown-400">
          <p className="text-5xl mb-3">📖</p>
          <p>아직 담긴 책이 없어요</p>
          <Link
            href="/search"
            className="inline-block mt-4 text-sm text-brown-500 underline underline-offset-2"
          >
            책 검색하러 가기
          </Link>
        </div>
      )}

      {/* 도서 목록 */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map((item, i) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-cream-200 p-4 flex gap-4 hover:shadow-sm transition-shadow"
            >
              {/* 책 표지 */}
              {item.book.thumbnail ? (
                <Image
                  src={item.book.thumbnail}
                  alt={item.book.title}
                  width={52}
                  height={74}
                  className="rounded shadow-sm object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-13 h-18 rounded shadow-sm flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                  style={{
                    width: 52,
                    height: 74,
                    backgroundColor: COVER_COLORS[i % COVER_COLORS.length],
                  }}
                >
                  {item.book.title[0]}
                </div>
              )}

              {/* 책 정보 */}
              <div className="flex-1 min-w-0">
                <p className="font-serif font-bold text-brown-800 leading-snug">{item.book.title}</p>
                <p className="text-sm text-brown-400 mt-0.5">{item.book.author}</p>

                {/* 상태 변경 셀렉터 */}
                <div className="flex items-center gap-2 mt-3">
                  <select
                    value={item.status}
                    onChange={(e) => updateStatus(item.id, e.target.value as LibraryStatus)}
                    className="text-xs px-2 py-1 rounded-lg border border-cream-300 text-brown-600 bg-cream-50 focus:outline-none focus:border-brown-400 cursor-pointer"
                  >
                    <option value="READING">📖 읽는 중</option>
                    <option value="FINISHED">✅ 완독</option>
                    <option value="WISHLIST">🔖 읽고 싶어요</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-brown-300 hover:text-red-400 transition-colors ml-auto"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 통계 요약 */}
      {!loading && items.length > 0 && (
        <div className="mt-8 bg-cream-200 rounded-2xl p-4 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "읽는 중", status: "READING", emoji: "📖" },
            { label: "완독", status: "FINISHED", emoji: "✅" },
            { label: "읽고 싶어요", status: "WISHLIST", emoji: "🔖" },
          ].map((s) => (
            <div key={s.status}>
              <p className="text-xl">{s.emoji}</p>
              <p className="font-bold text-brown-700 text-lg">
                {items.filter((i) => i.status === s.status).length}
              </p>
              <p className="text-xs text-brown-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
