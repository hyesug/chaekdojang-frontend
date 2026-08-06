"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "../lib/auth";

type ConnectionData = {
  sourceReview: {
    id: number;
    authorId: number;
    authorNickname: string;
    createdAt: string;
  } | null;
  sourceUnavailable: boolean;
  continuations: Array<{
    id: number;
    authorId: number;
    authorNickname: string;
    excerpt: string;
    createdAt: string;
  }>;
  totalCount: number;
  canContinue: boolean;
};

export default function ReviewContinuations({ reviewId }: { reviewId: number }) {
  const [data, setData] = useState<ConnectionData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await authFetch("/api/users/me", { cache: "no-store" });
        const response = await authFetch(`/api/reviews/${reviewId}/continuations`, { cache: "no-store" });
        const json = response.ok ? await response.json() : null;
        if (!cancelled) setData(json?.data ?? null);
      } catch {
        if (!cancelled) setData(null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  if (!data) return null;
  if (!data.sourceReview && !data.sourceUnavailable && data.totalCount === 0 && !data.canContinue) return null;

  return (
    <section className="mt-7 space-y-3">
      {data.sourceReview && (
        <Link
          href={`/reviews/${data.sourceReview.id}`}
          className="block rounded-2xl border border-sage-300 bg-sage-50 px-4 py-3 hover:border-sage-400"
        >
          <p className="text-xs font-semibold text-sage-700">이 글을 읽고 이어서 작성한 독후감입니다</p>
          <p className="mt-1 text-sm text-brown-600">
            {data.sourceReview.authorNickname}님의 원문 보기 · {data.sourceReview.createdAt.slice(0, 10)}
          </p>
        </Link>
      )}

      {data.sourceUnavailable && (
        <div className="rounded-2xl border border-cream-200 bg-cream-50 px-4 py-3 text-xs text-brown-400">
          원문 독후감이 비공개 또는 삭제되어 연결 정보만 남아 있습니다.
        </div>
      )}

      {(data.totalCount > 0 || data.canContinue) && (
        <div className="rounded-2xl border border-cream-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-serif text-lg font-bold text-brown-800">이 독후감에서 이어진 생각</h2>
              <p className="mt-1 text-xs text-brown-400">
                {data.totalCount > 0 ? `${data.totalCount}명이 자신의 독후감으로 생각을 이어갔습니다.` : "긴 댓글 대신 내 독후감으로 생각을 이어갈 수 있어요."}
              </p>
            </div>
            {data.canContinue && (
              <Link
                href={`/write?continueFrom=${reviewId}`}
                className="shrink-0 rounded-full border border-brown-300 px-4 py-2 text-center text-sm font-semibold text-brown-700 hover:bg-cream-50"
              >
                이 글을 읽고 내 생각 남기기
              </Link>
            )}
          </div>

          {data.continuations.length > 0 && (
            <div className="mt-4 space-y-2">
              {data.continuations.map((item) => (
                <Link
                  key={item.id}
                  href={`/reviews/${item.id}`}
                  className="block rounded-xl bg-cream-50 px-4 py-3 hover:bg-cream-100"
                >
                  <p className="text-sm font-semibold text-brown-700">{item.authorNickname}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-brown-500">{item.excerpt}</p>
                  <p className="mt-1 text-xs text-brown-300">{item.createdAt.slice(0, 10)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
