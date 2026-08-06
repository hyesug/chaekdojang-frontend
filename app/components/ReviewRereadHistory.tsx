"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "../lib/auth";

type HistoryItem = {
  id: number;
  sequence: number;
  rating: number;
  hidden: boolean;
  current: boolean;
  createdAt: string;
};

type RereadHistory = {
  records: HistoryItem[];
  latestReviewId: number;
  canCreateReread: boolean;
};

function recordDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ReviewRereadHistory({ reviewId }: { reviewId: number }) {
  const [history, setHistory] = useState<RereadHistory | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      try {
        // 공개 API는 만료된 액세스 토큰도 익명 요청으로 처리하므로, 먼저 세션 갱신을 시도한다.
        await authFetch("/api/users/me", { cache: "no-store" });
        const response = await authFetch(`/api/reviews/${reviewId}/reread-history`, {
          cache: "no-store",
        });
        const json = response.ok ? await response.json() : null;
        if (!cancelled) setHistory(json?.data ?? null);
      } catch {
        if (!cancelled) setHistory(null);
      }
    }
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  if (!history) return null;
  if (!history.canCreateReread && history.records.length < 2) return null;

  return (
    <section className="mt-7 rounded-2xl border border-cream-200 bg-cream-50 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-serif text-lg font-bold text-brown-800">이 책에 남긴 생각의 변화</h2>
          <p className="mt-1 text-xs leading-5 text-brown-400">
            같은 책을 다시 읽고 남긴 기록입니다. 공개 기록의 날짜를 누르면 당시 독후감으로 이동합니다.
          </p>
        </div>
        {history.canCreateReread && (
          <Link
            href={`/write?rereadFrom=${history.latestReviewId}`}
            className="shrink-0 rounded-full bg-brown-700 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brown-800"
          >
            다시 읽고 기록하기
          </Link>
        )}
      </div>

      <ol className="mt-4 space-y-2">
        {history.records.map((record) => {
          const content = (
            <>
              <span className="font-medium text-brown-700">
                {record.sequence}번째 기록 · {recordDate(record.createdAt)}
              </span>
              <span className="text-xs text-brown-400">
                <span className="text-amber-500">{"★".repeat(record.rating)}</span>
                {record.hidden && " · 비공개"}
                {record.current && " · 지금 보는 기록"}
              </span>
            </>
          );
          return (
            <li key={record.id}>
              {record.current || record.hidden ? (
                <div className="flex flex-col gap-1 rounded-xl border border-brown-200 bg-white px-4 py-3 text-sm">
                  {content}
                </div>
              ) : (
                <Link
                  href={`/reviews/${record.id}`}
                  className="flex flex-col gap-1 rounded-xl border border-cream-200 bg-white px-4 py-3 text-sm hover:border-brown-200 hover:bg-cream-50"
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
