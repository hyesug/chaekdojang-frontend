"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { API_BASE } from "../../../lib/api";
import { authFetch, getValidToken } from "../../../lib/auth";
import { APPLICATION_STATUS_LABEL, type CampaignApplicationStatus } from "../../types";

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    if (!getValidToken()) {
      router.push(`/auth/login?returnTo=${encodeURIComponent(`/dojangdan/campaigns/${campaignId}`)}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/dojangdan/campaigns/${campaignId}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
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
        <a
          href="/dojangdan/my"
          className="mt-4 inline-flex rounded-full border border-cream-200 px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-cream-50"
        >
          내 서평단 현황 보기
        </a>
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

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleApply}
        disabled={submitting}
        className="mt-4 w-full rounded-full bg-brown-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-60"
      >
        {submitting ? "신청 중…" : "서평단 신청하기"}
      </button>
    </section>
  );
}
