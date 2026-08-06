"use client";

import { useEffect, useState } from "react";
import { authFetch } from "../lib/auth";

type FollowUp = {
  question: string;
  aiGenerated: boolean;
  userEdited: boolean;
  stale: boolean;
  model: string;
  promptVersion: string;
  updatedAt: string | null;
};

type Comparison = {
  previousReviewId: number;
  previousFocus: string;
  currentFocus: string;
  sharedThought: string;
  changedPerspective: string;
  newElement: string;
  reflectionQuestion: string;
  aiGenerated: boolean;
  userEdited: boolean;
  stale: boolean;
  model: string;
  promptVersion: string;
  updatedAt: string | null;
};

async function responseData<T>(response: Response): Promise<T | null> {
  if (!response.ok) return null;
  const json = await response.json().catch(() => null);
  return (json?.data ?? null) as T | null;
}

export default function ReviewReflectionPanel({
  reviewId,
  authorId,
  hasPreviousReview,
}: {
  reviewId: number;
  authorId: number | null;
  hasPreviousReview: boolean;
}) {
  const [isOwner, setIsOwner] = useState(false);
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [loadingType, setLoadingType] = useState<"follow" | "comparison" | null>(null);
  const [error, setError] = useState("");
  const [editingFollow, setEditingFollow] = useState(false);
  const [followDraft, setFollowDraft] = useState("");
  const [editingComparison, setEditingComparison] = useState(false);
  const [comparisonDraft, setComparisonDraft] = useState<Comparison | null>(null);

  useEffect(() => {
    if (authorId == null) return;
    let cancelled = false;
    async function load() {
      const meResponse = await authFetch("/api/users/me", { cache: "no-store" }).catch(() => null);
      const meJson = meResponse?.ok ? await meResponse.json().catch(() => null) : null;
      const owner = (meJson?.data ?? meJson)?.id === authorId;
      if (cancelled || !owner) return;
      setIsOwner(true);
      const requests: Promise<Response>[] = [
        authFetch(`/api/reviews/${reviewId}/reflection/follow-up`, { cache: "no-store" }),
      ];
      if (hasPreviousReview) {
        requests.push(authFetch(`/api/reviews/${reviewId}/reflection/change-comparison`, { cache: "no-store" }));
      }
      const responses = await Promise.all(requests);
      if (cancelled) return;
      setFollowUp(await responseData<FollowUp>(responses[0]));
      if (responses[1]) setComparison(await responseData<Comparison>(responses[1]));
    }
    load().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reviewId, authorId, hasPreviousReview]);

  async function generate(type: "follow" | "comparison") {
    setLoadingType(type);
    setError("");
    const endpoint = type === "follow" ? "follow-up" : "change-comparison";
    try {
      const existing = type === "follow" ? followUp : comparison;
      const regenerate = existing ? "?regenerate=true" : "";
      const response = await authFetch(`/api/reviews/${reviewId}/reflection/${endpoint}${regenerate}`, { method: "POST" });
      if (response.ok) {
        const data = await responseData<FollowUp | Comparison>(response);
        if (type === "follow") setFollowUp(data as FollowUp);
        else setComparison(data as Comparison);
      } else {
        const json = await response.json().catch(() => null);
        setError(json?.message ?? "AI 회고를 만들지 못했습니다. 독후감은 그대로 보관됩니다.");
      }
    } catch {
      setError("서버에 연결할 수 없습니다. 독후감은 그대로 보관됩니다.");
    } finally {
      setLoadingType(null);
    }
  }

  async function saveFollow() {
    if (!followDraft.trim()) return;
    const response = await authFetch(`/api/reviews/${reviewId}/reflection/follow-up`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: followDraft.trim() }),
    });
    const data = await responseData<FollowUp>(response);
    if (data) {
      setFollowUp(data);
      setEditingFollow(false);
    }
  }

  async function saveComparison() {
    if (!comparisonDraft) return;
    const response = await authFetch(`/api/reviews/${reviewId}/reflection/change-comparison`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(comparisonDraft),
    });
    const data = await responseData<Comparison>(response);
    if (data) {
      setComparison(data);
      setEditingComparison(false);
    }
  }

  async function remove(type: "follow" | "comparison") {
    const endpoint = type === "follow" ? "follow-up" : "change-comparison";
    const response = await authFetch(`/api/reviews/${reviewId}/reflection/${endpoint}`, { method: "DELETE" });
    if (!response.ok) return;
    if (type === "follow") setFollowUp(null);
    else setComparison(null);
  }

  if (!isOwner) return null;

  return (
    <section className="mt-7 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 sm:p-5">
      <div>
        <p className="text-xs font-semibold text-violet-600">AI 회고 도구 · 작성자에게만 표시</p>
        <h2 className="mt-1 font-serif text-lg font-bold text-brown-800">내 생각을 다시 살펴보기</h2>
        <p className="mt-1 text-xs leading-5 text-brown-400">
          자동으로 만들지 않으며, 버튼을 누를 때만 독후감 원문을 최소한으로 전달합니다.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <InsightBox
          title="생각을 이어갈 질문"
          actionLabel={followUp ? (followUp.stale ? "현재 글로 다시 만들기" : "다시 만들기") : "후속 질문 만들기"}
          loading={loadingType === "follow"}
          onGenerate={() => generate("follow")}
        >
          {followUp && (
            <>
              {editingFollow ? (
                <textarea
                  value={followDraft}
                  onChange={(event) => setFollowDraft(event.target.value)}
                  maxLength={600}
                  className="min-h-24 w-full rounded-xl border border-violet-200 bg-white p-3 text-sm leading-6 text-brown-700 focus:outline-none"
                />
              ) : (
                <p className="text-sm leading-7 text-brown-700">{followUp.question}</p>
              )}
              <InsightActions
                editing={editingFollow}
                onEdit={() => {
                  setFollowDraft(followUp.question);
                  setEditingFollow(true);
                }}
                onCancel={() => setEditingFollow(false)}
                onSave={saveFollow}
                onDelete={() => remove("follow")}
              />
            </>
          )}
        </InsightBox>

        {hasPreviousReview && (
          <InsightBox
            title="이전 기록과 생각 변화"
            actionLabel={comparison ? (comparison.stale ? "현재 글로 다시 비교" : "다시 비교") : "생각 변화 확인하기"}
            loading={loadingType === "comparison"}
            onGenerate={() => generate("comparison")}
          >
            {comparison && (
              <>
                {editingComparison && comparisonDraft ? (
                  <div className="space-y-2">
                    {comparisonFields.map(([key, label]) => (
                      <label key={key} className="block text-xs font-medium text-brown-500">
                        {label}
                        <textarea
                          value={comparisonDraft[key] as string}
                          onChange={(event) => setComparisonDraft({ ...comparisonDraft, [key]: event.target.value })}
                          maxLength={key === "reflectionQuestion" ? 600 : 800}
                          className="mt-1 min-h-20 w-full rounded-xl border border-violet-200 bg-white p-3 text-sm leading-6 text-brown-700 focus:outline-none"
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comparisonFields.map(([key, label]) => (
                      <div key={key}>
                        <p className="text-xs font-semibold text-violet-600">{label}</p>
                        <p className="mt-1 text-sm leading-6 text-brown-700">{comparison[key] as string}</p>
                      </div>
                    ))}
                  </div>
                )}
                <InsightActions
                  editing={editingComparison}
                  onEdit={() => {
                    setComparisonDraft({ ...comparison });
                    setEditingComparison(true);
                  }}
                  onCancel={() => setEditingComparison(false)}
                  onSave={saveComparison}
                  onDelete={() => remove("comparison")}
                />
              </>
            )}
          </InsightBox>
        )}
      </div>

      {error && <p className="mt-3 text-xs leading-5 text-red-500">{error}</p>}
    </section>
  );
}

const comparisonFields = [
  ["previousFocus", "이전 글에서 중요하게 본 주제"],
  ["currentFocus", "이번 글에서 중요하게 본 주제"],
  ["sharedThought", "두 기록에 공통으로 남은 생각"],
  ["changedPerspective", "달라진 것으로 보이는 관점"],
  ["newElement", "새롭게 등장한 경험이나 감정"],
  ["reflectionQuestion", "직접 확인해 볼 질문"],
] as const;

function InsightBox({
  title,
  actionLabel,
  loading,
  onGenerate,
  children,
}: {
  title: string;
  actionLabel: string;
  loading: boolean;
  onGenerate: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-brown-700">{title}</h3>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="rounded-full border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
        >
          {loading ? "AI가 살펴보는 중..." : actionLabel}
        </button>
      </div>
      {children && <div className="mt-3 border-t border-violet-100 pt-3">{children}</div>}
    </div>
  );
}

function InsightActions({
  editing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-xs">
      {editing ? (
        <>
          <button type="button" onClick={onSave} className="font-semibold text-violet-700">저장</button>
          <button type="button" onClick={onCancel} className="text-brown-400">취소</button>
        </>
      ) : (
        <button type="button" onClick={onEdit} className="text-brown-500">직접 수정</button>
      )}
      <button type="button" onClick={onDelete} className="text-red-400">삭제</button>
    </div>
  );
}
