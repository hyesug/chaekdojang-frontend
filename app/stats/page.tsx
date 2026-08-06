"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "../lib/auth";

type Reflection = {
  totalReviews: number;
  rereadCount: number;
  currentYearBookCount: number;
  averageWritingIntervalDays: number;
  monthlyReviews: Array<{ year: number; month: number; count: number }>;
  yearlyBooks: Array<{ year: number; count: number }>;
  genreTimeline: Array<{ year: number; genre: string; count: number }>;
  frequentKeywords: Array<{ keyword: string; count: number }>;
  rereadBooks: Array<{ bookId: number; title: string; recordCount: number; firstAt: string; latestAt: string }>;
  longestRecordedBook: { bookId: number; title: string; days: number; firstAt: string; latestAt: string } | null;
  memories: Array<{ reviewId: number; bookId: number | null; bookTitle: string; rating: number; createdAt: string }>;
  reflectionMessages: string[];
};

export default function StatsPage() {
  const router = useRouter();
  const [data, setData] = useState<Reflection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/users/me/reading-reflection", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.push("/auth/login");
          return;
        }
        const json = response.ok ? await response.json() : null;
        setData(json?.data ?? null);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const maxMonthly = useMemo(
    () => Math.max(1, ...(data?.monthlyReviews.map((item) => item.count) ?? [1])),
    [data],
  );

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-16 text-center text-brown-400">회고를 정리하는 중...</main>;
  if (!data) return <main className="mx-auto max-w-3xl px-4 py-16 text-center text-brown-400">회고 데이터를 불러오지 못했습니다.</main>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-sage-700">경쟁이 아닌 나의 흐름</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-brown-900">독서 인생 지도</h1>
          <p className="mt-2 text-sm text-brown-500">읽은 권수보다, 언제 무엇을 생각했는지 돌아봅니다.</p>
        </div>
        <Link href="/calendar" className="text-sm font-medium text-brown-600 hover:underline">독서 캘린더 보기 →</Link>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="전체 독후감" value={`${data.totalReviews}개`} />
        <Stat label="올해 기록한 책" value={`${data.currentYearBookCount}권`} />
        <Stat label="재독 기록" value={`${data.rereadCount}개`} />
        <Stat label="평균 작성 간격" value={data.averageWritingIntervalDays ? `${data.averageWritingIntervalDays}일` : "-"} />
      </section>

      <section className="mt-5 rounded-2xl border border-sage-200 bg-sage-50 p-5">
        <h2 className="font-serif text-lg font-bold text-brown-800">지금 돌아볼 흐름</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-brown-600">
          {data.reflectionMessages.map((message) => <li key={message}>· {message}</li>)}
        </ul>
      </section>

      {data.memories.length > 0 && (
        <section className="mt-7">
          <h2 className="font-serif text-xl font-bold text-brown-900">1년 전 이맘때</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {data.memories.map((memory) => (
              <Link key={memory.reviewId} href={`/reviews/${memory.reviewId}`} className="rounded-2xl border border-cream-200 bg-white p-4 hover:border-brown-300">
                <p className="font-semibold text-brown-800">{memory.bookTitle}</p>
                <p className="mt-1 text-xs text-brown-400">{memory.createdAt.slice(0, 10)} · {"★".repeat(memory.rating)}</p>
                <p className="mt-2 text-xs font-medium text-brown-600">당시 기록 다시 읽기 →</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-7 rounded-2xl border border-cream-200 bg-white p-5">
        <h2 className="font-serif text-xl font-bold text-brown-900">월별 독후감</h2>
        {data.monthlyReviews.length > 0 ? (
          <div className="mt-4 space-y-2">
            {data.monthlyReviews.slice(0, 12).map((item) => (
              <div key={`${item.year}-${item.month}`} className="grid grid-cols-[64px_1fr_30px] items-center gap-3 text-xs">
                <span className="text-brown-400">{item.year}.{String(item.month).padStart(2, "0")}</span>
                <div className="h-2 rounded-full bg-cream-100"><div className="h-2 rounded-full bg-brown-500" style={{ width: `${Math.max(8, item.count / maxMonthly * 100)}%` }} /></div>
                <span className="text-right font-semibold text-brown-600">{item.count}</span>
              </div>
            ))}
          </div>
        ) : <p className="mt-3 text-sm text-brown-400">독후감이 쌓이면 월별 흐름이 나타납니다.</p>}
      </section>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <section className="rounded-2xl border border-cream-200 bg-white p-5">
          <h2 className="font-serif text-lg font-bold text-brown-900">연도별 기록한 책</h2>
          {data.yearlyBooks.length > 0 ? (
            <div className="mt-3 space-y-2">
              {data.yearlyBooks.map((item) => (
                <div key={item.year} className="flex items-center justify-between rounded-xl bg-cream-50 px-3 py-2 text-sm">
                  <span className="text-brown-500">{item.year}년</span>
                  <span className="font-semibold text-brown-800">{item.count}권</span>
                </div>
              ))}
            </div>
          ) : <p className="mt-3 text-sm text-brown-400">연도별 흐름이 쌓이면 여기에 나타납니다.</p>}
        </section>

        <section className="rounded-2xl border border-cream-200 bg-white p-5">
          <h2 className="font-serif text-lg font-bold text-brown-900">해마다 머문 장르</h2>
          {data.genreTimeline.length > 0 ? (
            <div className="mt-3 space-y-3">
              {Array.from(new Set(data.genreTimeline.map((item) => item.year))).map((year) => (
                <div key={year}>
                  <p className="text-xs font-semibold text-brown-400">{year}년</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {data.genreTimeline.filter((item) => item.year === year).slice(0, 6).map((item) => (
                      <span key={`${year}-${item.genre}`} className="rounded-full bg-sage-50 px-2.5 py-1 text-xs text-sage-700">{item.genre} {item.count}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="mt-3 text-sm text-brown-400">책의 장르 정보가 쌓이면 연도별로 보여드려요.</p>}
        </section>
      </div>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <section className="rounded-2xl border border-cream-200 bg-white p-5">
          <h2 className="font-serif text-lg font-bold text-brown-900">자주 남긴 키워드</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.frequentKeywords.map((item) => <span key={item.keyword} className="rounded-full bg-cream-100 px-3 py-1 text-sm text-brown-600">#{item.keyword} {item.count}</span>)}
            {data.frequentKeywords.length === 0 && <p className="text-sm text-brown-400">다음 독후감에서 감정·주제 키워드를 남겨보세요.</p>}
          </div>
        </section>
        <section className="rounded-2xl border border-cream-200 bg-white p-5">
          <h2 className="font-serif text-lg font-bold text-brown-900">오래 이어진 책</h2>
          {data.longestRecordedBook ? (
            <Link href={`/books/${data.longestRecordedBook.bookId}`} className="mt-3 block">
              <p className="font-semibold text-brown-800">{data.longestRecordedBook.title}</p>
              <p className="mt-1 text-sm text-brown-500">첫 기록부터 최근 기록까지 {data.longestRecordedBook.days}일</p>
            </Link>
          ) : <p className="mt-3 text-sm text-brown-400">같은 책에 두 번 이상 기록하면 여기에 표시됩니다.</p>}
        </section>
      </div>

      {data.rereadBooks.length > 0 && (
        <section className="mt-7">
          <h2 className="font-serif text-xl font-bold text-brown-900">다시 읽고 기록한 책</h2>
          <div className="mt-3 space-y-2">
            {data.rereadBooks.map((book) => (
              <Link key={book.bookId} href={`/books/${book.bookId}/reviews`} className="flex items-center justify-between rounded-xl border border-cream-200 bg-white px-4 py-3 hover:bg-cream-50">
                <span className="font-medium text-brown-700">{book.title}</span>
                <span className="text-xs text-brown-400">기록 {book.recordCount}회</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-cream-200 bg-white p-4"><p className="text-xs text-brown-400">{label}</p><p className="mt-1 font-serif text-xl font-bold text-brown-900">{value}</p></div>;
}
