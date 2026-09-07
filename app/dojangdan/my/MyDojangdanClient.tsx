"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../lib/api";
import { authFetch, getValidToken } from "../../lib/auth";
import {
  APPLICATION_STATUS_LABEL,
  formatDate,
  type MyCampaignApplication,
  type ReaderTrackRecord,
  type SubmittableReview,
} from "../types";
import ConsentPanel from "./ConsentPanel";

export default function MyDojangdanClient() {
  const router = useRouter();
  const [applications, setApplications] = useState<MyCampaignApplication[]>([]);
  const [trackRecord, setTrackRecord] = useState<ReaderTrackRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [applicationsRes, trackRecordRes] = await Promise.all([
      authFetch(`${API_BASE}/api/dojangdan/applications/me`),
      authFetch(`${API_BASE}/api/dojangdan/track-record/me`),
    ]);

    if (applicationsRes.status === 401) {
      router.push(`/auth/login?returnTo=${encodeURIComponent("/dojangdan/my")}`);
      return;
    }

    const applicationsJson = await applicationsRes.json().catch(() => null);
    const trackRecordJson = await trackRecordRes.json().catch(() => null);
    setApplications(applicationsJson?.data ?? []);
    setTrackRecord(trackRecordJson?.data ?? null);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (!getValidToken()) {
      router.push(`/auth/login?returnTo=${encodeURIComponent("/dojangdan/my")}`);
      return;
    }
    void load();
  }, [load, router]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-brown-400">
        불러오는 중…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-2xl font-bold text-brown-900">내 서평단 현황</h1>

      {trackRecord && <TrackRecordCard record={trackRecord} />}

      <section className="mt-8">
        <h2 className="font-serif text-lg font-bold text-brown-900">신청 내역</h2>
        {applications.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-cream-200 bg-white p-6 text-center text-sm text-brown-500">
            아직 신청한 서평단이 없습니다.{" "}
            <Link href="/dojangdan/campaigns" className="font-semibold underline">
              모집 중인 서평단 보기
            </Link>
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {applications.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                onSubmitted={load}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function TrackRecordCard({ record }: { record: ReaderTrackRecord }) {
  return (
    <section className="mt-5 rounded-2xl border border-brown-100 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-lg font-bold text-brown-900">내 서평단 이력</h2>
      <p className="mt-1 text-xs text-brown-400">
        완주 이력은 서평단을 모집하는 출판사·작가에게 닉네임과 함께 보입니다. 이메일·연락처는 공개되지 않습니다.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="신청" value={`${record.appliedCount}회`} />
        <Metric label="선정" value={`${record.selectedCount}회`} />
        <Metric label="독후감 제출" value={`${record.submittedCount}회`} />
        <Metric
          label="완주율"
          value={record.completionRate === null ? "-" : `${record.completionRate}%`}
        />
        <Metric
          label="평균 글자수"
          value={
            record.averageReviewLength === null
              ? "-"
              : `${record.averageReviewLength.toLocaleString()}자`
          }
        />
        <Metric
          label="마감 준수율"
          value={record.onTimeRate === null ? "-" : `${record.onTimeRate}%`}
        />
      </dl>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-cream-50 px-3 py-2.5">
      <dt className="text-xs text-brown-400">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold text-brown-800">{value}</dd>
    </div>
  );
}

function ApplicationCard({
  application,
  onSubmitted,
}: {
  application: MyCampaignApplication;
  onSubmitted: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<SubmittableReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  async function openPicker() {
    setOpen(true);
    setError(null);
    const res = await authFetch(
      `${API_BASE}/api/dojangdan/applications/${application.id}/submittable-reviews`
    );
    const json = await res.json().catch(() => null);
    setCandidates(json?.data ?? []);
  }

  async function submit(reviewId: number) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(
        `${API_BASE}/api/dojangdan/applications/${application.id}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewId }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? "제출에 실패했습니다.");
        return;
      }
      setOpen(false);
      await onSubmitted();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
      <div className="flex gap-4">
        {application.bookThumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={application.bookThumbnail}
            alt={application.bookTitle}
            className="h-20 w-14 flex-shrink-0 rounded object-cover"
          />
        ) : (
          <div className="h-20 w-14 flex-shrink-0 rounded bg-cream-100" />
        )}
        <div className="min-w-0 flex-1">
          <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-semibold text-brown-600">
            {APPLICATION_STATUS_LABEL[application.status]}
          </span>
          <Link
            href={`/dojangdan/campaigns/${application.campaignId}`}
            className="mt-1 block truncate font-serif text-base font-bold text-brown-900 hover:underline"
          >
            {application.campaignTitle}
          </Link>
          <p className="truncate text-sm text-brown-500">
            {application.bookTitle} · {application.profileName}
          </p>
          <p className="mt-1 text-xs text-brown-400">
            신청 {formatDate(application.appliedAt)} · 독후감 마감{" "}
            {formatDate(application.reviewDueAt)}
          </p>
        </div>
      </div>

      {application.status === "SELECTED" && (
        <div className="mt-3 border-t border-cream-100 pt-3">
          {!open ? (
            <button
              type="button"
              onClick={openPicker}
              className="rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800"
            >
              독후감 제출하기
            </button>
          ) : candidates === null ? (
            <p className="text-sm text-brown-400">독후감 목록을 불러오는 중…</p>
          ) : candidates.length === 0 ? (
            <div className="text-sm text-brown-500">
              아직 이 책으로 쓴 독후감이 없습니다.{" "}
              <Link
                href={`/write?bookId=${application.bookId}&title=${encodeURIComponent(
                  application.bookTitle
                )}`}
                className="font-semibold underline"
              >
                독후감 쓰러 가기
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {candidates.map((candidate) => (
                <li
                  key={candidate.id}
                  className="rounded-xl border border-cream-200 bg-cream-50 p-3"
                >
                  <p className="text-sm text-brown-700">{candidate.excerpt}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-brown-400">
                      {formatDate(candidate.createdAt)} · {candidate.length.toLocaleString()}자
                    </span>
                    <button
                      type="button"
                      onClick={() => submit(candidate.id)}
                      disabled={submitting}
                      className="rounded-full bg-brown-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brown-800 disabled:opacity-60"
                    >
                      이 독후감 제출
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {application.status === "SUBMITTED" && application.reviewId && (
        <div className="mt-3 border-t border-cream-100 pt-3">
          <Link
            href={`/reviews/${application.reviewId}`}
            className="text-sm font-semibold text-brown-600 underline"
          >
            제출한 독후감 보기
          </Link>
        </div>
      )}

      <div className="mt-3 border-t border-cream-100 pt-3">
        <button
          type="button"
          onClick={() => setShowConsent((previous) => !previous)}
          className="text-sm font-semibold text-brown-600 underline"
        >
          {showConsent ? "활용 동의 닫기" : "독후감 활용 동의 관리"}
        </button>
        {showConsent && (
          <div className="mt-3">
            <ConsentPanel applicationId={application.id} />
          </div>
        )}
      </div>
    </article>
  );
}
