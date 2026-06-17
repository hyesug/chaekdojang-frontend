"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE } from "../lib/api";

type LibraryItem = {
  id: number;
  book: { id: number; title: string; author: string; thumbnail: string | null };
  status: "READING" | "FINISHED" | "WISHLIST";
  completedAt: string | null;
  updatedAt: string;
};

type MyReview = {
  id: number;
  book: { id?: number; title: string; author: string; thumbnail: string | null } | null;
  rating: number;
  createdAt: string;
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${year}. ${Number(month)}.`;
}

function completedDay(item: LibraryItem) {
  return (item.completedAt ?? item.updatedAt).slice(0, 10);
}

function Cover({ item, compact = false }: { item: LibraryItem; compact?: boolean }) {
  const sizeClass = compact ? "w-8 h-11" : "w-12 h-16";

  if (item.book.thumbnail) {
    return (
      <Image
        src={item.book.thumbnail}
        alt={item.book.title}
        width={compact ? 32 : 48}
        height={compact ? 44 : 64}
        className={`${sizeClass} rounded-[2px] object-cover shadow-sm bg-cream-100`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-[2px] bg-brown-400 shadow-sm flex items-center justify-center px-1 text-center text-[9px] leading-tight text-white`}
    >
      {item.book.title.slice(0, 6)}
    </div>
  );
}

function RatingMark({ rating }: { rating: number | null }) {
  if (rating == null) {
    return (
      <div className="mt-0.5 text-[9px] leading-none text-brown-300 font-semibold">
        평점 없음
      </div>
    );
  }

  return (
    <div
      className="mt-0.5 text-[9px] leading-none text-amber-400 tracking-0"
      aria-label={`내 평점 ${rating}점`}
      title={`내 평점 ${rating}점`}
    >
      {"★".repeat(rating)}
      <span className="text-cream-300">{"★".repeat(5 - rating)}</span>
    </div>
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [reviewRatings, setReviewRatings] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeMonth, setActiveMonth] = useState(monthKey(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(dayKey(new Date()));

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    async function loadCalendar() {
      try {
        const [libraryRes, reviewsRes] = await Promise.all([
          fetch(`${API_BASE}/api/library`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/users/me/reviews?page=0&size=1000`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (libraryRes.status === 401 || reviewsRes.status === 401) {
          localStorage.removeItem("token");
          router.push("/auth/login");
          return;
        }

        if (libraryRes.ok) {
          const json = await libraryRes.json();
          setItems(json.data ?? []);
        }

        if (reviewsRes.ok) {
          const json = await reviewsRes.json();
          const reviews: MyReview[] = json.data?.content ?? [];
          const nextRatings = new Map<number, number>();
          reviews.forEach((review) => {
            if (review.book?.id && !nextRatings.has(review.book.id)) {
              nextRatings.set(review.book.id, review.rating);
            }
          });
          setReviewRatings(nextRatings);
        }
      } finally {
        setLoading(false);
      }
    }

    loadCalendar();
  }, [router]);

  const finishedByDay = useMemo(() => {
    const map = new Map<string, LibraryItem[]>();
    items
      .filter((item) => item.status === "FINISHED")
      .forEach((item) => {
        const day = completedDay(item);
        if (!map.has(day)) map.set(day, []);
        map.get(day)?.push(item);
      });
    return map;
  }, [items]);

  const days = useMemo(() => {
    const [year, month] = activeMonth.split("-").map(Number);
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    const mondayFirstOffset = (first.getDay() + 6) % 7;
    const blanks = Array.from({ length: mondayFirstOffset }, () => null);
    const dates = Array.from({ length: last.getDate() }, (_, index) => new Date(year, month - 1, index + 1));
    return [...blanks, ...dates];
  }, [activeMonth]);

  const monthFinishedEntries = useMemo(
    () =>
      Array.from(finishedByDay.entries())
        .filter(([day]) => day.startsWith(activeMonth))
        .sort(([a], [b]) => a.localeCompare(b)),
    [activeMonth, finishedByDay]
  );

  const monthFinishedBooks = useMemo(
    () => monthFinishedEntries.reduce((sum, [, books]) => sum + books.length, 0),
    [monthFinishedEntries]
  );

  const selectedBooks = selectedDay ? finishedByDay.get(selectedDay) ?? [] : [];

  function moveMonth(delta: number) {
    const [year, month] = activeMonth.split("-").map(Number);
    const next = monthKey(new Date(year, month - 1 + delta, 1));
    setActiveMonth(next);
    setSelectedDay(null);
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-brown-400">불러오는 중...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brown-800">독서 캘린더</h1>
          <p className="text-xs text-brown-400 mt-1">완독한 날마다 책 표지가 남아요</p>
        </div>
        <Link href="/stats" className="text-sm text-brown-500 hover:text-brown-700">통계</Link>
      </div>

      <div className="bg-[#fbf8f1] border border-cream-200 rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-white">
          <button onClick={() => moveMonth(-1)} className="text-xl leading-none text-brown-300 hover:text-brown-600" aria-label="이전 달">‹</button>
          <h2 className="font-serif text-2xl font-bold text-brown-700">{monthLabel(activeMonth)}</h2>
          <button onClick={() => moveMonth(1)} className="text-xl leading-none text-brown-300 hover:text-brown-600" aria-label="다음 달">›</button>
        </div>

        <div className="grid grid-cols-7 border-y border-cream-200 bg-white text-center text-xs text-brown-400">
          {["월", "화", "수", "목", "금", "토", "일"].map((day) => (
            <div key={day} className={`py-2 ${day === "일" ? "text-red-400" : ""}`}>
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((date, index) => {
            if (!date) return <div key={`blank-${index}`} className="min-h-[88px] border-r border-b border-cream-200 bg-[#fbf8f1]" />;
            const key = dayKey(date);
            const books = finishedByDay.get(key) ?? [];
            const previewBooks = books.slice(0, 2);
            const isSunday = date.getDay() === 0;
            const isSelected = selectedDay === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay(key)}
                className={`min-h-[88px] sm:min-h-[104px] border-r border-b border-cream-200 p-1.5 text-left bg-[#fbf8f1] hover:bg-white transition-colors ${
                  isSelected ? "ring-2 ring-brown-300 ring-inset" : ""
                }`}
              >
                <span className={`block text-sm leading-none ${isSunday ? "text-red-400" : "text-brown-600"}`}>
                  {date.getDate()}
                </span>
                {books.length > 0 && (
                  <div className="mt-1.5 flex flex-col items-center">
                    <div className="relative h-12 w-12">
                      {previewBooks.map((item, bookIndex) => (
                        <div
                          key={item.id}
                          className="absolute"
                          style={{
                            left: `${bookIndex * 14}px`,
                            top: `${bookIndex * 3}px`,
                            zIndex: bookIndex + 1,
                          }}
                        >
                          <Cover item={item} compact />
                        </div>
                      ))}
                      {books.length > 2 && (
                        <span className="absolute right-0 bottom-0 z-10 min-w-5 h-5 px-1 rounded-full bg-brown-700 text-white text-[10px] font-bold flex items-center justify-center">
                          +{books.length - 2}
                        </span>
                      )}
                    </div>
                    <RatingMark rating={reviewRatings.get(books[0].book.id) ?? null} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white border border-cream-200 py-3">
          <p className="text-lg font-bold text-brown-800">{monthFinishedBooks}</p>
          <p className="text-xs text-brown-400">완독한 책</p>
        </div>
        <div className="rounded-lg bg-white border border-cream-200 py-3">
          <p className="text-lg font-bold text-brown-800">{monthFinishedEntries.length}</p>
          <p className="text-xs text-brown-400">읽은 날</p>
        </div>
        <div className="rounded-lg bg-white border border-cream-200 py-3">
          <p className="text-lg font-bold text-brown-800">
            {new Date(Number(activeMonth.slice(0, 4)), Number(activeMonth.slice(5, 7)), 0).getDate() - monthFinishedEntries.length}
          </p>
          <p className="text-xs text-brown-400">비어있는 날</p>
        </div>
      </div>

      <div className="mt-4">
        {selectedDay && selectedBooks.length > 0 ? (
          <div className="bg-white border border-cream-200 rounded-lg p-4">
            <p className="text-xs text-brown-400 mb-3">{selectedDay}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedBooks.map((item) => (
                <Link
                  key={item.id}
                  href={`/books/${item.book.id}`}
                  className="flex gap-3 rounded-lg border border-cream-100 p-2 hover:bg-cream-50 transition-colors"
                >
                  <Cover item={item} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brown-800 line-clamp-2">{item.book.title}</p>
                    <p className="mt-0.5 text-xs text-brown-400 truncate">{item.book.author}</p>
                    <p className="mt-1 text-[11px] text-brown-300">완독일 {completedDay(item)}</p>
                    <RatingMark rating={reviewRatings.get(item.book.id) ?? null} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-cream-200 rounded-lg p-4 text-center text-sm text-brown-400">
            표지가 있는 날짜를 누르면 그날 완독한 책을 볼 수 있어요.
          </div>
        )}
      </div>
    </div>
  );
}
