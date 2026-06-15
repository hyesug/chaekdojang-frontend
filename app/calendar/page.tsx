"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE } from "../lib/api";

type LibraryItem = {
  id: number;
  book: { id: number; title: string; author: string; thumbnail: string | null };
  status: "READING" | "FINISHED" | "WISHLIST";
  updatedAt: string;
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const router = useRouter();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMonth, setActiveMonth] = useState(monthKey(new Date()));

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    fetch(`${API_BASE}/api/library`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 401) {
          localStorage.removeItem("token");
          router.push("/auth/login");
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((json) => {
        if (json) setItems(json.data ?? []);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const finishedByDay = useMemo(() => {
    const map = new Map<string, LibraryItem[]>();
    items
      .filter((item) => item.status === "FINISHED")
      .forEach((item) => {
        const day = item.updatedAt.slice(0, 10);
        if (!map.has(day)) map.set(day, []);
        map.get(day)?.push(item);
      });
    return map;
  }, [items]);

  const days = useMemo(() => {
    const [year, month] = activeMonth.split("-").map(Number);
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    const blanks = Array.from({ length: first.getDay() }, () => null);
    const dates = Array.from({ length: last.getDate() }, (_, index) => new Date(year, month - 1, index + 1));
    return [...blanks, ...dates];
  }, [activeMonth]);

  function moveMonth(delta: number) {
    const [year, month] = activeMonth.split("-").map(Number);
    setActiveMonth(monthKey(new Date(year, month - 1 + delta, 1)));
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-brown-400">불러오는 중...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brown-800">월별 책도장 캘린더</h1>
          <p className="text-xs text-brown-400 mt-1">완독으로 바꾼 날에 도장이 찍혀요</p>
        </div>
        <Link href="/stats" className="text-sm text-brown-500 hover:text-brown-700">통계</Link>
      </div>

      <div className="bg-white border border-cream-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => moveMonth(-1)} className="px-3 py-1.5 text-sm rounded-full border border-cream-300 text-brown-500">이전</button>
          <h2 className="font-serif text-lg font-bold text-brown-800">{activeMonth.replace("-", "년 ")}월</h2>
          <button onClick={() => moveMonth(1)} className="px-3 py-1.5 text-sm rounded-full border border-cream-300 text-brown-500">다음</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-brown-300 mb-2">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => <div key={day}>{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            if (!date) return <div key={`blank-${index}`} className="aspect-square" />;
            const key = date.toISOString().slice(0, 10);
            const books = finishedByDay.get(key) ?? [];
            return (
              <div key={key} className="aspect-square rounded-lg border border-cream-200 bg-cream-50 p-1.5 flex flex-col">
                <span className="text-xs text-brown-400">{date.getDate()}</span>
                {books.length > 0 && (
                  <span className="mt-auto self-center w-8 h-8 rounded-full border-2 border-red-700 text-red-700 text-[10px] font-bold flex items-center justify-center rotate-[-8deg]">
                    완독
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {Array.from(finishedByDay.entries())
          .filter(([day]) => day.startsWith(activeMonth))
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([day, books]) => (
            <div key={day} className="bg-white border border-cream-200 rounded-lg p-3">
              <p className="text-xs text-brown-400 mb-2">{day}</p>
              <div className="flex flex-col gap-1">
                {books.map((item) => (
                  <Link key={item.id} href={`/books/${item.book.id}`} className="text-sm text-brown-700 hover:underline">
                    {item.book.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
