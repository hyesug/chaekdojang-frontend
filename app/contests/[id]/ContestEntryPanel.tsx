"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../lib/api";
import { authFetch, getValidToken } from "../../lib/auth";
import {
  ENTRY_STATUS_LABEL,
  formatDateTime,
  type ContestBook,
  type ContestEntryType,
  type ContestStatus,
  type ContestSubmittableReview,
  type MyContestEntry,
} from "../types";

type Props = {
  contestId: number;
  entryType: ContestEntryType;
  contestStatus: ContestStatus;
  books: ContestBook[];
  acceptingEntries: boolean;
  submitStartAt: string;
  submitEndAt: string;
  initialEntry: MyContestEntry | null;
};

export default function ContestEntryPanel({
  contestId,
  entryType,
  contestStatus,
  books,
  acceptingEntries,
  submitStartAt,
  submitEndAt,
  initialEntry,
}: Props) {
  const router = useRouter();
  const [entry, setEntry] = useState(initialEntry);
  const [reviews, setReviews] = useState<ContestSubmittableReview[]>([]);
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [bookId, setBookId] = useState<number | null>(books[0]?.bookId ?? null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyEntered = entry !== null && entry.status !== "WITHDRAWN";
  const needsReviewList = entryType === "REVIEW" && acceptingEntries && !alreadyEntered;

  const loadReviews = useCallback(async () => {
    if (!getValidToken()) return;
    const res = await authFetch(`${API_BASE}/api/contests/${contestId}/submittable-reviews`);
    const json = await res.json().catch(() => null);
    setReviews(json?.data ?? []);
  }, [contestId]);

  useEffect(() => {
    if (needsReviewList) void loadReviews();
  }, [needsReviewList, loadReviews]);

  async function submit() {
    if (!getValidToken()) {
      router.push(`/auth/login?returnTo=${encodeURIComponent(`/contests/${contestId}`)}`);
      return;
    }
    if (!agreeTerms) {
      setError("공모전 참여 약관에 동의해야 응모할 수 있습니다.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/contests/${contestId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: entryType === "REVIEW" ? reviewId : null,
          bookId: entryType === "TEXT" ? bookId : null,
          title: entryType === "TEXT" ? title : null,
          content: entryType === "TEXT" ? content : null,
          agreeTerms,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? "응모에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      setEntry(json.data);
      router.refresh();
    } catch {
      setError("응모에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function withdraw() {
    if (!entry) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(
        `${API_BASE}/api/contests/me/entries/${entry.id}/withdraw`,
        { method: "POST" }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? "응모를 취소하지 못했습니다.");
        return;
      }
      setEntry(json.data);
      setAgreeTerms(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (alreadyEntered && entry) {
    return (
      <section className="mt-6 rounded-2xl border border-brown-100 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg font-bold text-brown-900">내 응모 상태</h2>
        <p className="mt-2 text-sm text-brown-600">
          현재 상태: <strong className="text-brown-800">{ENTRY_STATUS_LABEL[entry.status]}</strong>
          {entry.awardName && ` · ${entry.awardName}`}
        </p>
        {entry.entryTitle && (
          <p className="mt-1 text-sm text-brown-500">응모작: {entry.entryTitle}</p>
        )}
        {entry.reviewId && (
          <Link
            href={`/reviews/${entry.reviewId}`}
            className="mt-1 inline-flex text-xs font-semibold text-brown-600 underline"
          >
            응모한 독후감 보기
          </Link>
        )}
        <p className="mt-2 text-xs text-brown-400">
          응모 {formatDateTime(entry.submittedAt)} · 발표 {formatDateTime(entry.announceAt)}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/contests/me"
            className="rounded-full border border-cream-200 px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-cream-50"
          >
            내 응모 현황
          </Link>
          {acceptingEntries && entry.status === "SUBMITTED" && (
            <button
              type="button"
              onClick={withdraw}
              disabled={submitting}
              className="rounded-full border border-cream-200 px-4 py-2 text-sm font-semibold text-brown-500 hover:bg-cream-50 disabled:opacity-60"
            >
              응모 취소
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>
    );
  }

  if (!acceptingEntries) {
    let message = "지금은 응모를 받지 않는 공모전입니다.";
    if (contestStatus === "OPEN") {
      message = `접수 기간에만 응모할 수 있습니다. 접수 기간은 ${formatDateTime(
        submitStartAt
      )} ~ ${formatDateTime(submitEndAt)}입니다.`;
    } else if (contestStatus === "CLOSED") {
      message = "접수가 마감되어 심사 중입니다.";
    } else if (contestStatus === "ANNOUNCED") {
      message = "수상 발표가 끝난 공모전입니다.";
    }
    return (
      <section className="mt-6 rounded-2xl border border-cream-200 bg-cream-50 p-5 text-sm text-brown-500">
        {message}
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-brown-100 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-lg font-bold text-brown-900">공모전 응모</h2>
      {entry?.status === "WITHDRAWN" && (
        <p className="mt-3 rounded-xl bg-cream-50 px-4 py-2.5 text-sm text-brown-600">
          이전에 취소한 응모가 있습니다. 다시 제출하면 그 자리를 새 응모작으로 채웁니다.
        </p>
      )}

      {entryType === "REVIEW" ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-brown-700">응모할 독후감</p>
          {reviews.length === 0 ? (
            <div className="mt-2 rounded-xl bg-cream-50 px-4 py-3 text-sm leading-6 text-brown-500">
              {books.length > 0
                ? "지정 도서로 쓴 독후감이 아직 없습니다. 먼저 독후감을 쓰면 이곳에서 골라 응모할 수 있습니다."
                : "아직 쓴 독후감이 없습니다. 먼저 독후감을 쓰면 이곳에서 골라 응모할 수 있습니다."}
              <Link href="/write" className="ml-1 font-semibold text-brown-700 underline">
                독후감 쓰기
              </Link>
            </div>
          ) : (
            <ul className="mt-2 space-y-2">
              {reviews.map((review) => (
                <li key={review.reviewId}>
                  <label
                    className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${
                      reviewId === review.reviewId
                        ? "border-brown-300 bg-cream-50"
                        : "border-cream-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="contestReview"
                      className="mt-1"
                      checked={reviewId === review.reviewId}
                      onChange={() => setReviewId(review.reviewId)}
                    />
                    <span className="min-w-0">
                      {review.bookTitle && (
                        <span className="block font-semibold text-brown-800">{review.bookTitle}</span>
                      )}
                      <span className="mt-0.5 block text-brown-600">{review.excerpt}</span>
                      <span className="mt-1 block text-xs text-brown-400">
                        {review.length.toLocaleString()}자 · {formatDateTime(review.createdAt)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          {books.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-brown-700">어느 지정 도서로 쓴 글인가요</p>
              <select
                value={bookId ?? ""}
                onChange={(event) => setBookId(Number(event.target.value))}
                className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800"
              >
                {books.map((book) => (
                  <option key={book.bookId} value={book.bookId}>
                    {book.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-4">
            <label className="mb-2 block text-sm font-semibold text-brown-700" htmlFor="entry-title">
              응모작 제목
            </label>
            <input
              id="entry-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800 outline-none focus:border-brown-300"
            />
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-semibold text-brown-700" htmlFor="entry-content">
              본문
            </label>
            <textarea
              id="entry-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={12}
              maxLength={30000}
              placeholder="공모 요강을 확인하고 응모작을 작성해주세요."
              className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm leading-7 text-brown-800 outline-none focus:border-brown-300"
            />
            <p className="mt-1 text-right text-xs text-brown-400">
              {content.length.toLocaleString()}자
            </p>
          </div>
        </>
      )}

      <div className="mt-5 rounded-2xl bg-cream-50 p-4">
        <label className="flex items-start gap-2.5 text-sm text-brown-700">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(event) => setAgreeTerms(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            <strong className="text-brown-800">(필수)</strong> 공모전 참여 및 수상작 공개{" "}
            <Link href="/terms" className="underline">
              약관
            </Link>
            에 동의합니다
          </span>
        </label>
        <p className="mt-2 text-xs leading-5 text-brown-400">
          수상작으로 선정되면 닉네임과 응모작이 공모전 페이지에 공개됩니다. 접수 기간 안에는 &lsquo;내 응모
          현황&rsquo;에서 응모를 취소할 수 있습니다.
        </p>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={
          submitting ||
          !agreeTerms ||
          (entryType === "REVIEW" ? reviewId === null : !title.trim() || !content.trim())
        }
        className="mt-4 w-full rounded-full bg-brown-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-60"
      >
        {submitting ? "응모 중…" : "공모전에 응모하기"}
      </button>
    </section>
  );
}
