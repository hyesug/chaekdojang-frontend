"use client";

import { BookOpen, CalendarDays, Library, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE } from "../lib/api";
import { EmptyState } from "../components/ui/EmptyState";

type LibraryStatus = "READING" | "FINISHED" | "WISHLIST";

type LibraryItem = {
  id: number;
  book: {
    id: number;
    isbn13: string;
    title: string;
    author: string;
    thumbnail: string | null;
    category: string | null;
  };
  status: LibraryStatus;
  createdAt: string;
};

const TABS: { value: LibraryStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "READING", label: "읽는 중" },
  { value: "FINISHED", label: "완독" },
  { value: "WISHLIST", label: "읽고 싶어요" },
];

const STATUS_STYLE: Record<LibraryStatus, string> = {
  READING: "bg-brown-700 text-white",
  FINISHED: "bg-cream-50/95 text-brown-800",
  WISHLIST: "bg-cream-50/95 text-sage-700",
};
const STATUS_LABEL: Record<LibraryStatus, string> = {
  READING: "읽는 중",
  FINISHED: "완독",
  WISHLIST: "읽고 싶어요",
};

const COVER_COLORS = ["#8B6048", "#6E7A4A", "#4A6E7A", "#7A4A6E", "#4A7A6E"];

export default function LibraryPage() {
  const router = useRouter();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<LibraryStatus | "ALL">("ALL");
  const [loggedIn, setLoggedIn] = useState(true);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status") as LibraryStatus | null;
    if (status === "READING" || status === "FINISHED" || status === "WISHLIST") {
      setActiveTab(status);
    }
    fetchLibrary();
  }, []);

  async function fetchLibrary() {
    const token: string | null = "cookie-session";
    if (!token) {
      setLoggedIn(false);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/library`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        
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
    const token: string | null = "cookie-session";
    if (!token) return;

    const res = await fetch(`${API_BASE}/api/library/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    if (res.status === 401) {
      
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
    const token: string | null = "cookie-session";
    if (!token) return;

    const res = await fetch(`${API_BASE}/api/library/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      
      router.push("/auth/login");
      return;
    }
    if (res.ok) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  }

  const filtered =
    activeTab === "ALL" ? items : items.filter((item) => item.status === activeTab);
  const countOf = (value: LibraryStatus | "ALL") =>
    value === "ALL" ? items.length : items.filter((item) => item.status === value).length;

  /* 로그인 안 된 경우 */
  if (!loggedIn) {
    return (
      <div className="cdj-page cdj-page--reading">
        <EmptyState
          title="내 서재"
          icon={<Library size={22} aria-hidden="true" />}
          action={<Link href="/auth/login" className="cdj-button cdj-button--primary">로그인하기</Link>}
        >
          서재를 보려면 로그인이 필요해요
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="cdj-page">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="cdj-title">내 서재</h1>
          {!loading && items.length > 0 && (
            <p className="cdj-lead mt-2">
              지금까지 <strong className="font-semibold text-brown-800 tabular">{countOf("FINISHED")}권</strong>을 완독했고,{" "}
              <strong className="font-semibold text-brown-800 tabular">{countOf("READING")}권</strong>을 읽고 있어요.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/calendar" className="cdj-button cdj-button--secondary cdj-button--sm">
            <CalendarDays size={15} aria-hidden="true" />
            월별 캘린더
          </Link>
          <Link href="/search" className="cdj-button cdj-button--primary cdj-button--sm">
            <Plus size={15} aria-hidden="true" />
            책 추가
          </Link>
        </div>
      </div>

      {/* 탭 */}
      <div className="cdj-tabs mb-6" role="tablist" aria-label="서재 분류">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            role="tab"
            aria-selected={activeTab === tab.value}
            className="cdj-tab"
          >
            {tab.label}
            {!loading && <span className="text-xs font-medium text-sage-500 tabular">{countOf(tab.value)}</span>}
          </button>
        ))}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i}>
              <div className="cdj-skeleton aspect-[2/3] w-full" />
              <div className="cdj-skeleton mt-3 h-3 w-4/5" />
              <div className="cdj-skeleton mt-2 h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && filtered.length === 0 && (
        <EmptyState
          title="아직 담긴 책이 없어요"
          icon={<BookOpen size={22} aria-hidden="true" />}
          action={<Link href="/search" className="cdj-button cdj-button--primary">책 검색하러 가기</Link>}
        >
          읽은 책, 읽고 있는 책, 읽고 싶은 책을 서재에 모아보세요.
        </EmptyState>
      )}

      {/* 도서 목록: 표지 책장 */}
      {!loading && filtered.length > 0 && (
        <ul className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {filtered.map((item, i) => (
            <li key={item.id} className="group relative flex flex-col">
              <Link href={`/books/${item.book.id}`} className="cdj-cover block w-full transition-transform duration-200 group-hover:-translate-y-1">
                {item.book.thumbnail ? (
                  <img src={item.book.thumbnail} alt={item.book.title} loading="lazy" />
                ) : (
                  <span
                    className="flex h-full items-end p-2.5 font-serif text-sm font-bold leading-snug text-white/90"
                    style={{ backgroundColor: COVER_COLORS[i % COVER_COLORS.length] }}
                  >
                    {item.book.title}
                  </span>
                )}
                <span className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold shadow-sm ${STATUS_STYLE[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
              </Link>

              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-brown-800/70 text-white opacity-0 transition-opacity hover:bg-wine-500 focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100 max-sm:bg-brown-800/50"
                aria-label={`${item.book.title} 서재에서 삭제`}
              >
                <X size={14} aria-hidden="true" />
              </button>

              <Link href={`/books/${item.book.id}`} className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-brown-800 hover:underline">
                {item.book.title}
              </Link>
              <p className="mt-0.5 truncate text-xs text-sage-600">{item.book.author}</p>

              {/* 상태 변경 셀렉터 */}
              <label className="mt-2">
                <span className="sr-only">{item.book.title} 읽기 상태</span>
                <select
                  value={item.status}
                  onChange={(e) => updateStatus(item.id, e.target.value as LibraryStatus)}
                  className="cdj-field text-sm w-full"
                >
                  <option value="READING">읽는 중</option>
                  <option value="FINISHED">완독</option>
                  <option value="WISHLIST">읽고 싶어요</option>
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}