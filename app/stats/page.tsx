"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE } from "../lib/api";

type ReadingStats = {
  totalFinished: number;
  monthly: { year: number; month: number; count: number }[];
  genres: { genre: string; count: number }[];
};

export default function StatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    fetch(`${API_BASE}/api/users/me/stats`, {
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
        if (json) setStats(json.data ?? json);
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-brown-400">불러오는 중...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brown-800">내 독서 통계</h1>
          <p className="text-xs text-brown-400 mt-1">완독 기록을 기준으로 정리했어요</p>
        </div>
        <Link href="/calendar" className="px-4 py-2 text-sm border border-brown-300 text-brown-600 rounded-full hover:bg-cream-200">
          월별 캘린더
        </Link>
      </div>

      {!stats || stats.totalFinished === 0 ? (
        <div className="text-center py-20 text-brown-400 bg-white border border-cream-200 rounded-lg">
          <p className="text-4xl mb-3">📚</p>
          <p>아직 완독 기록이 없어요.</p>
          <Link href="/library" className="inline-block mt-4 text-sm text-brown-600 underline">
            서재에서 완독 표시하기
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <section className="bg-white border border-cream-200 rounded-lg p-5">
            <p className="text-sm text-brown-400">총 완독</p>
            <p className="mt-1 text-4xl font-bold text-brown-800">{stats.totalFinished}권</p>
          </section>

          <section className="bg-white border border-cream-200 rounded-lg p-5">
            <h2 className="font-serif text-lg font-bold text-brown-800 mb-3">최근 월별 기록</h2>
            <div className="divide-y divide-cream-100">
              {stats.monthly.map((item) => (
                <div key={`${item.year}-${item.month}`} className="py-3 flex items-center justify-between">
                  <span className="text-brown-600">{item.year}년 {item.month}월</span>
                  <span className="font-semibold text-brown-800">{item.count}권</span>
                </div>
              ))}
            </div>
          </section>

          {stats.genres.length > 0 && (
            <section className="bg-white border border-cream-200 rounded-lg p-5">
              <h2 className="font-serif text-lg font-bold text-brown-800 mb-3">자주 읽은 분야</h2>
              <div className="flex flex-wrap gap-2">
                {stats.genres.map((genre) => (
                  <span key={genre.genre} className="px-3 py-1.5 rounded-full bg-cream-100 text-sm text-brown-600">
                    {genre.genre} {genre.count}권
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
