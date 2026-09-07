"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { API_BASE } from "../../../lib/api";
import { authFetch, getValidToken } from "../../../lib/auth";
import {
  APPLICATION_STATUS_LABEL,
  type CampaignApplicationStatus,
  type ConsentDisplayNameType,
} from "../../types";

type Props = {
  campaignId: number;
  acceptingApplications: boolean;
  initialStatus: CampaignApplicationStatus | null;
};

export default function CampaignApplyPanel({
  campaignId,
  acceptingApplications,
  initialStatus,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [consentPromotional, setConsentPromotional] = useState(false);
  const [consentExcerpt, setConsentExcerpt] = useState(false);
  const [displayNameType, setDisplayNameType] =
    useState<ConsentDisplayNameType>("REAL_NICKNAME");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    if (!getValidToken()) {
      router.push(`/auth/login?returnTo=${encodeURIComponent(`/dojangdan/campaigns/${campaignId}`)}`);
      return;
    }
    if (!agreeTerms) {
      setError("서평단 참여 약관에 동의해야 신청할 수 있습니다.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/dojangdan/campaigns/${campaignId}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          agreeTerms,
          consentPromotional,
          consentExcerpt: consentPromotional ? consentExcerpt : false,
          displayNameType,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? "신청에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      setStatus("APPLIED");
      router.refresh();
    } catch {
      setError("신청에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status) {
    return (
      <section className="mt-6 rounded-2xl border border-brown-100 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg font-bold text-brown-900">내 신청 상태</h2>
        <p className="mt-2 text-sm text-brown-600">
          현재 상태: <strong className="text-brown-800">{APPLICATION_STATUS_LABEL[status]}</strong>
        </p>
        <Link
          href="/dojangdan/my"
          className="mt-4 inline-flex rounded-full border border-cream-200 px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-cream-50"
        >
          내 서평단 현황 · 활용 동의 관리
        </Link>
      </section>
    );
  }

  if (!acceptingApplications) {
    return (
      <section className="mt-6 rounded-2xl border border-cream-200 bg-cream-50 p-5 text-sm text-brown-500">
        지금은 신청을 받지 않는 캠페인입니다.
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-brown-100 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-lg font-bold text-brown-900">서평단 신청</h2>

      <label className="mt-4 block text-sm font-semibold text-brown-700" htmlFor="apply-message">
        신청 사유 (선택)
      </label>
      <textarea
        id="apply-message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        maxLength={2000}
        rows={4}
        placeholder="이 책을 왜 읽고 싶은지, 어떤 독후감을 남기고 싶은지 적어주세요."
        className="mt-2 w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800 outline-none focus:border-brown-300"
      />

      <div className="mt-5 space-y-3 rounded-2xl bg-cream-50 p-4">
        <label className="flex items-start gap-2.5 text-sm text-brown-700">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(event) => setAgreeTerms(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            <strong className="text-brown-800">(필수)</strong> 서평단 참여 및 독후감 작성{" "}
            <Link href="/terms" className="underline">
              약관
            </Link>
            에 동의합니다
          </span>
        </label>

        <label className="flex items-start gap-2.5 text-sm text-brown-700">
          <input
            type="checkbox"
            checked={consentPromotional}
            onChange={(event) => setConsentPromotional(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            <strong className="text-brown-800">(선택)</strong> 출판사·작가가 내 독후감을 상세페이지,
            SNS, 보도자료 등 홍보에 활용하는 것에 동의합니다
          </span>
        </label>

        {consentPromotional && (
          <div className="ml-6 space-y-3 border-l-2 border-cream-200 pl-4">
            <div>
              <p className="text-xs font-semibold text-brown-600">표기 방식</p>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm text-brown-700">
                  <input
                    type="radio"
                    name="displayNameType"
                    checked={displayNameType === "REAL_NICKNAME"}
                    onChange={() => setDisplayNameType("REAL_NICKNAME")}
                  />
                  닉네임 표기
                </label>
                <label className="flex items-center gap-2 text-sm text-brown-700">
                  <input
                    type="radio"
                    name="displayNameType"
                    checked={displayNameType === "ANONYMOUS"}
                    onChange={() => setDisplayNameType("ANONYMOUS")}
                  />
                  익명 처리
                </label>
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-sm text-brown-700">
              <input
                type="checkbox"
                checked={consentExcerpt}
                onChange={(event) => setConsentExcerpt(event.target.checked)}
                className="mt-0.5"
              />
              일부 발췌·편집을 허용합니다
            </label>
          </div>
        )}

        <p className="text-xs leading-5 text-brown-400">
          선택 항목에 동의하지 않아도 서평단에 참여할 수 있습니다. 동의는 나중에 &lsquo;내 서평단 현황&rsquo;에서 언제든 바꾸거나 철회할 수 있습니다.
        </p>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleApply}
        disabled={submitting || !agreeTerms}
        className="mt-4 w-full rounded-full bg-brown-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-60"
      >
        {submitting ? "신청 중…" : "서평단 신청하기"}
      </button>
    </section>
  );
}
