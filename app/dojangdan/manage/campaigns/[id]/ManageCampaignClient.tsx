"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../../../lib/api";
import { authFetch, getValidToken } from "../../../../lib/auth";
import {
  APPLICATION_STATUS_LABEL,
  DELIVERY_TYPE_LABEL,
  STATUS_LABEL,
  formatDate,
  type CampaignApplicant,
  type CampaignStatus,
  type ManageCampaignDetail,
} from "../../../types";
import EbookUploadPanel from "./EbookUploadPanel";
import ExportPanel from "./ExportPanel";

const NEXT_STATUS: Partial<Record<CampaignStatus, { status: CampaignStatus; label: string }>> = {
  DRAFT: { status: "RECRUITING", label: "모집 시작" },
  RECRUITING: { status: "CLOSED", label: "모집 마감" },
  SELECTED: { status: "COMPLETED", label: "캠페인 종료" },
};

export default function ManageCampaignClient({ campaignId }: { campaignId: number }) {
  const router = useRouter();
  const [detail, setDetail] = useState<ManageCampaignDetail | null>(null);
  const [applicants, setApplicants] = useState<CampaignApplicant[]>([]);
  const [checked, setChecked] = useState<number[]>([]);
  const [rejectOthers, setRejectOthers] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [detailRes, applicantsRes] = await Promise.all([
      authFetch(`${API_BASE}/api/dojangdan/manage/campaigns/${campaignId}`),
      authFetch(`${API_BASE}/api/dojangdan/manage/campaigns/${campaignId}/applications`),
    ]);

    if (detailRes.status === 401) {
      router.push("/auth/login");
      return;
    }
    if (detailRes.status === 403) {
      setError("이 캠페인을 관리할 권한이 없습니다.");
      setLoading(false);
      return;
    }

    const detailJson = await detailRes.json().catch(() => null);
    const applicantsJson = await applicantsRes.json().catch(() => null);
    setDetail(detailJson?.data ?? null);
    setApplicants(applicantsJson?.data ?? []);
    setLoading(false);
  }, [campaignId, router]);

  useEffect(() => {
    if (!getValidToken()) {
      router.push("/auth/login");
      return;
    }
    void load();
  }, [load, router]);

  async function changeStatus(status: CampaignStatus) {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(
        `${API_BASE}/api/dojangdan/manage/campaigns/${campaignId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? "상태를 바꾸지 못했습니다.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function confirmSelection() {
    if (checked.length === 0) {
      setError("선정할 신청자를 선택해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(
        `${API_BASE}/api/dojangdan/manage/campaigns/${campaignId}/select`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationIds: checked, rejectOthers }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? "선정 처리에 실패했습니다.");
        return;
      }
      setChecked([]);
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

  if (!detail) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-brown-500">
        {error ?? "캠페인을 찾을 수 없습니다."}
      </main>
    );
  }

  const { campaign } = detail;
  const nextStatus = NEXT_STATUS[campaign.status];
  const canSelect = campaign.status === "CLOSED" || campaign.status === "SELECTED";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/dojangdan/manage" className="text-sm text-brown-400 hover:text-brown-600">
        ← 운영실
      </Link>

      <section className="mt-4 rounded-3xl border border-cream-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-cream-100 px-2.5 py-0.5 text-xs font-semibold text-brown-600">
            {STATUS_LABEL[campaign.status]}
          </span>
          <span className="rounded-full bg-cream-100 px-2.5 py-0.5 text-xs font-semibold text-brown-600">
            {DELIVERY_TYPE_LABEL[campaign.deliveryType]}
          </span>
          <span className="text-xs text-brown-400">{campaign.profileName}</span>
        </div>
        <h1 className="mt-3 font-serif text-2xl font-bold text-brown-900">{campaign.title}</h1>
        <p className="mt-1 text-sm text-brown-500">
          {campaign.bookTitle} · {campaign.bookAuthor}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="신청" value={`${detail.appliedCount}명`} />
          <Metric label="선정" value={`${detail.selectedCount}명`} />
          <Metric label="제출" value={`${detail.submittedCount}명`} />
          <Metric
            label="완주율"
            value={detail.completionRate === null ? "-" : `${detail.completionRate}%`}
          />
        </dl>

        <p className="mt-4 text-xs text-brown-400">
          모집 {formatDate(campaign.recruitStartAt)} ~ {formatDate(campaign.recruitEndAt)} · 독후감 마감{" "}
          {formatDate(campaign.reviewDueAt)}
        </p>

        {campaign.priorityInviteHours > 0 && (
          <p className="mt-1 text-xs text-brown-400">
            {campaign.priorityInviteUntil
              ? `관심 독자 우선 신청 ~ ${new Date(campaign.priorityInviteUntil).toLocaleString("ko-KR")}`
              : `모집 시작일부터 관심 독자에게 ${campaign.priorityInviteHours}시간 먼저 열립니다`}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {nextStatus && (
            <button
              type="button"
              onClick={() => changeStatus(nextStatus.status)}
              disabled={busy}
              className="rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-60"
            >
              {nextStatus.label}
            </button>
          )}
          <Link
            href={`/dojangdan/campaigns/${campaign.id}`}
            className="rounded-full border border-cream-200 px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-cream-50"
          >
            독자 화면으로 보기
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-brown-900">신청자</h2>
          <span className="text-xs text-brown-400">
            이메일·연락처는 제공되지 않습니다. 연락은 책도장이 대신합니다.
          </span>
        </div>

        {applicants.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-cream-200 bg-white p-6 text-center text-sm text-brown-500">
            아직 신청자가 없습니다.
          </p>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              {applicants.map((applicant) => (
                <ApplicantCard
                  key={applicant.applicationId}
                  applicant={applicant}
                  selectable={canSelect && applicant.status === "APPLIED"}
                  checked={checked.includes(applicant.applicationId)}
                  onToggle={() =>
                    setChecked((previous) =>
                      previous.includes(applicant.applicationId)
                        ? previous.filter((id) => id !== applicant.applicationId)
                        : [...previous, applicant.applicationId]
                    )
                  }
                />
              ))}
            </div>

            {canSelect && (
              <div className="mt-5 rounded-2xl border border-brown-100 bg-white p-4 shadow-sm">
                <label className="flex items-center gap-2 text-sm text-brown-700">
                  <input
                    type="checkbox"
                    checked={rejectOthers}
                    onChange={(event) => setRejectOthers(event.target.checked)}
                  />
                  선택하지 않은 신청자를 미선정으로 확정합니다
                </label>
                <button
                  type="button"
                  onClick={confirmSelection}
                  disabled={busy}
                  className="mt-3 w-full rounded-full bg-brown-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-60"
                >
                  {checked.length}명 선정 확정
                </button>
              </div>
            )}
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      {campaign.deliveryType !== "PHYSICAL" && <EbookUploadPanel campaignId={campaign.id} />}

      {detail.submittedCount > 0 && (
        <ExportPanel
          campaignId={campaign.id}
          submittedCount={detail.submittedCount}
          consentedReviewCount={detail.consentedReviewCount}
        />
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-cream-50 px-3 py-2">
      <dt className="text-xs text-brown-400">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold text-brown-800">{value}</dd>
    </div>
  );
}

function ApplicantCard({
  applicant,
  selectable,
  checked,
  onToggle,
}: {
  applicant: CampaignApplicant;
  selectable: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  const record = applicant.trackRecord;

  return (
    <article className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {selectable && (
          <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1.5" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-brown-800">{applicant.nickname}</span>
            <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-semibold text-brown-600">
              {APPLICATION_STATUS_LABEL[applicant.status]}
            </span>
          </div>

          <p className="mt-1 text-xs text-brown-400">
            서평단 {record.selectedCount}회 선정 · 완주율{" "}
            {record.completionRate === null ? "이력 없음" : `${record.completionRate}%`}
            {record.averageReviewLength !== null &&
              ` · 평균 ${record.averageReviewLength.toLocaleString()}자`}
          </p>

          {applicant.ebookOpenCount !== null && (
            <p className="mt-1 text-xs text-brown-400">
              전자책 열람 {applicant.ebookOpenCount}회
              {applicant.ebookFirstOpenedAt
                ? ` · 첫 열람 ${formatDate(applicant.ebookFirstOpenedAt)}`
                : " · 아직 열지 않음"}
              {applicant.ebookExpiresAt && ` · 열람 만료 ${formatDate(applicant.ebookExpiresAt)}`}
            </p>
          )}

          {applicant.message && (
            <p className="mt-2 whitespace-pre-wrap rounded-xl bg-cream-50 px-3 py-2 text-sm text-brown-600">
              {applicant.message}
            </p>
          )}

          {applicant.reviewId && (
            <Link
              href={`/reviews/${applicant.reviewId}`}
              className="mt-2 inline-flex text-xs font-semibold text-brown-600 underline"
            >
              제출한 독후감 보기
              {applicant.reviewLength !== null && ` (${applicant.reviewLength.toLocaleString()}자)`}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
