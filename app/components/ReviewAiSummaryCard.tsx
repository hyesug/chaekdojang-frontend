"use client";

import { useEffect, useMemo, useState } from "react";
import AiReadingCard from "./AiReadingCard";
import AiReadingCardDownload from "./AiReadingCardDownload";
import type { AiReadingCardData } from "../lib/aiReadingCard";
import { authFetch } from "../lib/auth";

type SummaryStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "EDITED";
type SummarySource = "AI" | "USER_EDITED" | "MANUAL";

export type ReviewAiSummary = {
  reviewId: number;
  oneLineReview: string | null;
  emotionKeywords: string[];
  recommendedFor: string | null;
  impressivePoint: string | null;
  status: SummaryStatus;
  retryCount: number;
  errorMessage: string | null;
  summarySource: SummarySource;
  userEdited: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type Me = { id: number };

type FormState = {
  oneLineReview: string;
  emotionKeywords: string;
  recommendedFor: string;
  impressivePoint: string;
};

const EMPTY_FORM: FormState = {
  oneLineReview: "",
  emotionKeywords: "",
  recommendedFor: "",
  impressivePoint: "",
};

export default function ReviewAiSummaryCard({
  reviewId,
  authorId,
  bookTitle,
  authorNickname,
}: {
  reviewId: number;
  authorId: number | null;
  bookTitle: string;
  authorNickname: string;
}) {
  const [summary, setSummary] = useState<ReviewAiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const isOwner = authorId != null && currentUserId === authorId;
  const isGenerating = summary?.status === "PENDING" || summary?.status === "PROCESSING";
  const canShowSummary = summary?.status === "COMPLETED" || summary?.status === "EDITED";
  const readingCard: AiReadingCardData | null =
    canShowSummary && summary?.oneLineReview && summary.recommendedFor
      ? {
          bookTitle,
          authorNickname,
          oneLineReview: summary.oneLineReview,
          emotionKeywords: summary.emotionKeywords,
          recommendedFor: summary.recommendedFor,
          impressivePoint: summary.impressivePoint,
        }
      : null;

  useEffect(() => {
    loadSummary();
    authFetch("/api/users/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const me = (json?.data ?? json) as Me | null;
        setCurrentUserId(me?.id ?? null);
      })
      .catch(() => setCurrentUserId(null));
  }, [reviewId]);

  useEffect(() => {
    if (!isGenerating) return;
    const timer = window.setInterval(loadSummary, 4000);
    return () => window.clearInterval(timer);
  }, [isGenerating, reviewId]);

  useEffect(() => {
    if (!summary) return;
    setForm({
      oneLineReview: summary.oneLineReview ?? "",
      emotionKeywords: summary.emotionKeywords.join(", "),
      recommendedFor: summary.recommendedFor ?? "",
      impressivePoint: summary.impressivePoint ?? "",
    });
  }, [summary?.updatedAt, summary?.status]);

  async function loadSummary() {
    try {
      const res = await fetch(`/api/reviews/${reviewId}/ai-summary/status`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const json = await res.json();
      setSummary(json.data ?? json);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit() {
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    try {
      const res = await authFetch(`/api/reviews/${reviewId}/ai-summary`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        setSummary(json.data ?? json);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    if (summary?.userEdited) {
      const ok = window.confirm("직접 수정한 요약카드가 AI 생성 결과로 덮어써질 수 있어요. 다시 생성할까요?");
      if (!ok) return;
    }
    setSaving(true);
    try {
      const res = await authFetch(`/api/reviews/${reviewId}/ai-summary/regenerate`, {
        method: "POST",
      });
      if (res.ok) {
        const json = await res.json();
        setSummary(json.data ?? json);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  function buildPayload() {
    const keywords = form.emotionKeywords
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5);
    if (
      !form.oneLineReview.trim() ||
      !form.recommendedFor.trim() ||
      !form.impressivePoint.trim() ||
      keywords.length < 3
    ) {
      alert("한 줄 감상, 추천 대상, 인상 깊은 지점과 감정 키워드 3개 이상을 입력해주세요.");
      return null;
    }
    return {
      oneLineReview: form.oneLineReview.trim(),
      emotionKeywords: keywords,
      recommendedFor: form.recommendedFor.trim(),
      impressivePoint: form.impressivePoint.trim(),
    };
  }

  const statusText = useMemo(() => {
    if (loading) return "AI 요약카드 확인 중";
    if (loadError && !summary) return "AI 요약카드 상태를 확인하지 못했어요.";
    if (isGenerating) return "AI 요약카드 생성 중";
    if (summary?.status === "FAILED") return "요약카드 생성 실패";
    return null;
  }, [loading, loadError, isGenerating, summary, summary?.status]);

  if (loading && !summary) {
    return <StatusBox text="AI 요약카드 확인 중" />;
  }

  return (
    <section className="mt-5 rounded-lg border border-cream-200 bg-cream-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-bold text-brown-800">AI 요약카드</h2>
        {isOwner && canShowSummary && !editing && (
          <div className="flex flex-wrap justify-end gap-2">
            {readingCard && <AiReadingCardDownload card={readingCard} />}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-brown-500 hover:text-brown-800"
            >
              수정하기
            </button>
            <button
              type="button"
              onClick={regenerate}
              disabled={saving}
              className="text-xs text-brown-500 hover:text-brown-800 disabled:opacity-50"
            >
              AI로 다시 생성
            </button>
          </div>
        )}
      </div>

      {statusText && <StatusBox text={statusText} compact />}

      {!summary && !loading && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadSummary}
            className="rounded-full border border-brown-300 px-3 py-1.5 text-xs text-brown-600 hover:border-brown-500"
          >
            다시 확인
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={regenerate}
              disabled={saving}
              className="rounded-full bg-brown-700 px-3 py-1.5 text-xs text-white hover:bg-brown-800 disabled:opacity-50"
            >
              AI로 다시 생성
            </button>
          )}
        </div>
      )}

      {summary?.status === "FAILED" && (
        <div className="flex flex-wrap gap-2">
          {isOwner && (
            <>
              <button
                type="button"
                onClick={regenerate}
                disabled={saving}
                className="rounded-full bg-brown-700 px-3 py-1.5 text-xs text-white hover:bg-brown-800 disabled:opacity-50"
              >
                다시 생성
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-full border border-brown-300 px-3 py-1.5 text-xs text-brown-600 hover:border-brown-500"
              >
                직접 입력
              </button>
            </>
          )}
        </div>
      )}

      {canShowSummary && !editing && summary && readingCard && (
        <div className="space-y-4">
          <AiReadingCard card={readingCard} />
          <SummaryView summary={summary} />
        </div>
      )}

      {isOwner && editing && (
        <div className="space-y-3">
          <SummaryInput
            label="한 줄 감상"
            value={form.oneLineReview}
            maxLength={60}
            onChange={(value) => setForm((prev) => ({ ...prev, oneLineReview: value }))}
          />
          <SummaryInput
            label="감정 키워드"
            value={form.emotionKeywords}
            placeholder="잔잔함, 그리움, 위로"
            onChange={(value) => setForm((prev) => ({ ...prev, emotionKeywords: value }))}
          />
          <SummaryInput
            label="추천 대상"
            value={form.recommendedFor}
            placeholder="자기만의 속도를 찾고 싶은 사람"
            maxLength={120}
            onChange={(value) => setForm((prev) => ({ ...prev, recommendedFor: value }))}
          />
          <SummaryInput
            label="인상 깊은 지점"
            value={form.impressivePoint}
            maxLength={100}
            onChange={(value) => setForm((prev) => ({ ...prev, impressivePoint: value }))}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full px-3 py-1.5 text-xs text-brown-500 hover:bg-white"
            >
              취소
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={saving}
              className="rounded-full bg-brown-700 px-3 py-1.5 text-xs text-white hover:bg-brown-800 disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function StatusBox({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <p className={`text-sm text-brown-500 ${compact ? "mb-3" : ""}`}>
      {text}
    </p>
  );
}

function SummaryView({ summary }: { summary: ReviewAiSummary }) {
  return (
    <div className="space-y-3">
      <p className="text-base font-semibold text-brown-800">{summary.oneLineReview}</p>
      <div className="flex flex-wrap gap-1.5">
        {summary.emotionKeywords.map((keyword) => (
          <span key={keyword} className="rounded-full bg-white px-2.5 py-1 text-xs text-brown-500">
            {keyword}
          </span>
        ))}
      </div>
      <dl className="grid gap-2 text-sm text-brown-600 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-brown-300">추천 대상</dt>
          <dd>{summary.recommendedFor}</dd>
        </div>
        <div>
          <dt className="text-xs text-brown-300">인상 깊은 지점</dt>
          <dd>{summary.impressivePoint}</dd>
        </div>
      </dl>
    </div>
  );
}

function SummaryInput({
  label,
  value,
  placeholder,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-brown-500">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-brown-700 placeholder:text-brown-300 focus:border-brown-400 focus:outline-none"
      />
    </label>
  );
}
