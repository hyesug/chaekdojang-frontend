"use client";

import { useEffect, useMemo, useState } from "react";
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
  bookAuthor,
  bookThumbnail,
  authorNickname,
}: {
  reviewId: number;
  authorId: number | null;
  bookTitle: string;
  bookAuthor?: string | null;
  bookThumbnail?: string | null;
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
  const currentKeywords = editing
    ? form.emotionKeywords
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 5)
    : summary?.emotionKeywords ?? [];
  const currentOneLineReview = editing ? form.oneLineReview.trim() : summary?.oneLineReview ?? "";
  const currentRecommendedFor = editing ? form.recommendedFor.trim() : summary?.recommendedFor ?? "";
  const currentImpressivePoint = editing ? form.impressivePoint.trim() : summary?.impressivePoint ?? "";
  const readingCard: AiReadingCardData | null =
    canShowSummary && currentOneLineReview
      ? {
          bookTitle,
          bookAuthor,
          bookThumbnail,
          authorName: authorNickname,
          authorNickname,
          oneLineReview: currentOneLineReview,
          emotionKeywords: currentKeywords,
          recommendedFor: currentRecommendedFor,
          impressivePoint: currentImpressivePoint,
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
      const nextSummary = Object.prototype.hasOwnProperty.call(json, "data") ? json.data : json;
      setSummary(nextSummary ?? null);
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
      const json = await readJson(res);
      if (!res.ok) {
        alert(json?.message || "AI 독서카드 수정 내용을 저장하지 못했어요.");
        return;
      }
      const nextSummary = Object.prototype.hasOwnProperty.call(json ?? {}, "data") ? json?.data : json;
      setSummary(toEditedSummary(payload, nextSummary));
      setEditing(false);
    } catch {
      alert("AI 독서카드 수정 내용을 저장하지 못했어요.");
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
        const nextSummary = Object.prototype.hasOwnProperty.call(json, "data") ? json.data : json;
        setSummary(nextSummary ?? null);
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

  async function readJson(res: Response) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  function toEditedSummary(payload: {
    oneLineReview: string;
    emotionKeywords: string[];
    recommendedFor: string;
    impressivePoint: string;
  }, nextSummary: ReviewAiSummary | null): ReviewAiSummary {
    const base = nextSummary ?? summary;
    const now = new Date().toISOString();
    return {
      reviewId,
      retryCount: base?.retryCount ?? 0,
      errorMessage: base?.errorMessage ?? null,
      createdAt: base?.createdAt ?? now,
      completedAt: base?.completedAt ?? now,
      ...base,
      oneLineReview: payload.oneLineReview,
      emotionKeywords: payload.emotionKeywords,
      recommendedFor: payload.recommendedFor,
      impressivePoint: payload.impressivePoint,
      status: "EDITED",
      summarySource: "USER_EDITED",
      userEdited: true,
      updatedAt: base?.updatedAt ?? now,
    };
  }

  const statusText = useMemo(() => {
    if (loading) return "AI 독서카드 확인 중";
    if (loadError && !summary) return "AI 독서카드 상태를 확인하지 못했어요.";
    if (isGenerating) return "AI 독서카드 생성 중";
    if (summary?.status === "FAILED") return "AI 독서카드 생성 실패";
    return null;
  }, [loading, loadError, isGenerating, summary, summary?.status]);

  if (loading && !summary) {
    return <StatusBox text="AI 독서카드 확인 중" />;
  }

  return (
    <section className="mt-4 rounded-lg border border-cream-200 bg-[#fbf7f0] p-3 shadow-sm sm:p-3.5">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brown-400">
            AI READING CARD
          </p>
        </div>
        {isOwner && canShowSummary && (
          <div className="flex flex-wrap justify-end gap-2 text-xs">
            {readingCard && <AiReadingCardDownload card={readingCard} />}
            {!editing && (
              <>
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
              </>
            )}
          </div>
        )}
      </div>

      {statusText && <StatusBox text={statusText} compact />}

      {!summary && !loading && (
        <div className="space-y-3">
          <p className="text-sm text-brown-500">
            아직 AI 독서카드가 없습니다.
          </p>
          {isOwner && (
            <button
              type="button"
              onClick={regenerate}
              disabled={saving}
              className="rounded-full bg-brown-700 px-3 py-1.5 text-xs text-white hover:bg-brown-800 disabled:opacity-50"
            >
              {saving ? "생성 요청 중" : "AI 독서카드 생성"}
            </button>
          )}
          {loadError && (
            <button
              type="button"
              onClick={loadSummary}
              className="ml-2 rounded-full border border-brown-300 px-3 py-1.5 text-xs text-brown-600 hover:border-brown-500"
            >
              다시 확인
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

      {canShowSummary && !editing && readingCard && (
        <div className="max-w-[520px]">
          <SummaryView card={readingCard} />
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

function SummaryView({ card }: { card: AiReadingCardData }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-[#ded2c4] bg-[#fffaf2] px-5 py-4 shadow-sm">
      <div className="pointer-events-none absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-[#e9dfd0]" />
      <div className="pointer-events-none absolute bottom-4 right-7 h-24 w-16 rotate-45 border-l border-[#a48c70]/45" />
      <div className="relative">
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brown-300">
          CHAEKDOJANG
        </p>
        <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-brown-300">
          AI READING CARD
        </p>
        <p className="mt-5 max-w-[390px] font-serif text-[21px] font-semibold leading-snug text-brown-900 sm:text-[24px]">
          {card.oneLineReview}
        </p>
        <div className="mt-4 h-px w-10 bg-brown-300" />
        <div className="mt-4 flex gap-3">
          {card.bookThumbnail ? (
            <img
              src={card.bookThumbnail}
              alt={card.bookTitle}
              className="h-[82px] w-[58px] shrink-0 rounded object-cover shadow"
            />
          ) : (
            <div className="flex h-[82px] w-[58px] shrink-0 items-end justify-center rounded bg-brown-200 pb-2 font-serif text-sm text-white shadow">
              책
            </div>
          )}
          <div className="min-w-0 pt-1">
            <p className="truncate text-sm font-semibold text-brown-900">{card.bookTitle}</p>
            <p className="mt-1 truncate text-[11px] text-brown-400">| {card.bookAuthor || "저자 미상"}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {card.emotionKeywords.slice(0, 4).map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full bg-[#eee5d8] px-2 py-0.5 text-[10px] text-brown-500"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
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
