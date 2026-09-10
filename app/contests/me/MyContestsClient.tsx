"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../lib/api";
import { authFetch, getValidToken } from "../../lib/auth";
import {
  CONTEST_STATUS_LABEL,
  ENTRY_STATUS_LABEL,
  formatDateTime,
  type MyContestEntry,
} from "../types";

export default function MyContestsClient() {
  const router = useRouter();
  const [entries, setEntries] = useState<MyContestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authFetch(`${API_BASE}/api/contests/me/entries`);
    if (res.status === 401) {
      router.push(`/auth/login?returnTo=${encodeURIComponent("/contests/me")}`);
      return;
    }
    const json = await res.json().catch(() => null);
    setEntries(json?.data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (!getValidToken()) {
      router.push(`/auth/login?returnTo=${encodeURIComponent("/contests/me")}`);
      return;
    }
    void load();
  }, [load, router]);

  async function withdraw(entryId: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/contests/me/entries/${entryId}/withdraw`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? "응모를 취소하지 못했습니다.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-brown-400">
        불러오는 중…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-2xl font-bold text-brown-900">내 공모전 응모 현황</h1>
      <p className="mt-2 text-sm text-brown-500">
        응모한 공모전의 심사 단계와 수상 결과를 봅니다. 접수 기간 안에는 응모를 취소할 수 있습니다.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {entries.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-cream-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-brown-500">아직 응모한 공모전이 없습니다.</p>
          <Link
            href="/contests"
            className="mt-4 inline-flex rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800"
          >
            열려 있는 공모전 보기
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {entries.map((entry) => (
            <article
              key={entry.id}
              id={`contest-${entry.contestId}`}
              className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-semibold text-brown-600">
                  {CONTEST_STATUS_LABEL[entry.contestStatus]}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    entry.status === "AWARDED"
                      ? "bg-brown-700 text-white"
                      : "bg-cream-100 text-brown-600"
                  }`}
                >
                  {ENTRY_STATUS_LABEL[entry.status]}
                  {entry.awardName && ` · ${entry.awardName}`}
                </span>
                <span className="truncate text-xs text-brown-400">{entry.hostName}</span>
              </div>

              <Link
                href={`/contests/${entry.contestId}`}
                className="mt-1 block truncate font-serif text-lg font-bold text-brown-900 hover:underline"
              >
                {entry.contestTitle}
              </Link>
              {(entry.entryTitle || entry.bookTitle) && (
                <p className="truncate text-sm text-brown-500">
                  {entry.entryTitle ?? entry.bookTitle}
                </p>
              )}
              <p className="mt-1 text-xs text-brown-400">
                응모 {formatDateTime(entry.submittedAt)} · 접수 마감{" "}
                {formatDateTime(entry.submitEndAt)} · 발표 {formatDateTime(entry.announceAt)}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {entry.reviewId && (
                  <Link
                    href={`/reviews/${entry.reviewId}`}
                    className="rounded-full border border-cream-200 px-3 py-1.5 text-xs font-semibold text-brown-700 hover:bg-cream-50"
                  >
                    응모한 독후감 보기
                  </Link>
                )}
                {entry.status === "SUBMITTED" && entry.contestStatus === "OPEN" && (
                  <button
                    type="button"
                    onClick={() => withdraw(entry.id)}
                    disabled={busy}
                    className="rounded-full border border-cream-200 px-3 py-1.5 text-xs font-semibold text-brown-500 hover:bg-cream-50 disabled:opacity-60"
                  >
                    응모 취소
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
