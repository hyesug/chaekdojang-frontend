"use client";

import { useState } from "react";
import { API_BASE } from "../../../../../lib/api";
import { authFetch } from "../../../../../lib/auth";

export type GroupAnalysis = {
  summary: string;
  commonThoughts: string[];
  differentInterpretations: string[];
  keyThemes: string[];
  emotions: string[];
  discussionQuestions: string[];
  analyzedReviewCount: number;
  stale: boolean;
  model: string;
  promptVersion: string;
  updatedAt: string;
};

async function errorMessage(response: Response) {
  try {
    const json = await response.json();
    return json.message ?? json.error?.message ?? "AI 분석을 만들지 못했어요.";
  } catch {
    return "AI 분석을 만들지 못했어요.";
  }
}

export default function GroupAnalysisPanel({
  slug,
  groupBookId,
  reviewCount,
  canManage,
  initialAnalysis,
}: {
  slug: string;
  groupBookId: string;
  reviewCount: number;
  canManage: boolean;
  initialAnalysis: GroupAnalysis | null;
}) {
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function generate() {
    if (analysis && !window.confirm("현재 모임 결과를 최신 독후감으로 다시 분석할까요?")) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await authFetch(
        `${API_BASE}/api/groups/${encodeURIComponent(slug)}/books/${encodeURIComponent(groupBookId)}/result/analysis`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(await errorMessage(response));
      const json = await response.json();
      setAnalysis((json.data ?? json) as GroupAnalysis);
      setMessage("최신 독후감으로 모임 전체 분석을 만들었어요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 분석을 만들지 못했어요.");
    } finally {
      setWorking(false);
    }
  }

  if (!analysis) {
    return (
      <section className="mb-8 rounded-2xl border border-cream-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">모임 전체 AI 분석</p>
        <h2 className="mt-2 font-serif text-2xl font-bold text-brown-900">함께 읽은 생각을 한눈에</h2>
        <p className="mt-3 text-sm leading-6 text-brown-500">
          연결된 독후감에서 공통 생각과 서로 다른 해석, 핵심 주제와 대화 질문을 정리합니다.
        </p>
        {reviewCount < 2 ? (
          <p className="mt-5 rounded-xl bg-cream-50 px-4 py-3 text-sm text-brown-500">독후감이 2개 이상 연결되면 분석할 수 있어요.</p>
        ) : canManage ? (
          <button onClick={generate} disabled={working} className="mt-5 rounded-full bg-purple-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50">
            {working ? "모임 결과 분석 중…" : "모임 전체 AI 분석 만들기"}
          </button>
        ) : (
          <p className="mt-5 rounded-xl bg-cream-50 px-4 py-3 text-sm text-brown-500">모임 관리자가 전체 분석을 만들면 이곳에서 함께 볼 수 있어요.</p>
        )}
        {canManage && <p className="mt-2 text-xs text-brown-400">버튼을 누를 때만 AI를 사용하며 결과는 저장됩니다.</p>}
        {message && <p className="mt-4 text-sm text-red-500">{message}</p>}
      </section>
    );
  }

  return (
    <section className="mb-8 rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">모임 전체 AI 분석</p>
          <h2 className="mt-2 font-serif text-2xl font-bold text-brown-900">함께 읽은 생각을 한눈에</h2>
        </div>
        {canManage && (
          <button onClick={generate} disabled={working} className="rounded-full border border-purple-200 px-4 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-50">
            {working ? "분석 중…" : "최신 독후감으로 다시 분석"}
          </button>
        )}
      </div>

      {analysis.stale && <p className="mt-4 rounded-xl bg-yellow-50 px-4 py-3 text-sm text-yellow-800">분석 후 독후감이 추가되거나 수정됐어요. 최신 결과로 다시 분석할 수 있습니다.</p>}
      {message && <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

      <p className="mt-5 rounded-xl bg-purple-50/60 px-4 py-4 text-sm font-medium leading-7 text-brown-800">{analysis.summary}</p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <ResultList title="여러 독후감에서 공통으로 나타난 생각" items={analysis.commonThoughts} tone="green" />
        <ResultList title="독자마다 다르게 해석한 부분" items={analysis.differentInterpretations} tone="orange" />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <KeywordBox title="핵심 주제" items={analysis.keyThemes} />
        <KeywordBox title="주요 감정" items={analysis.emotions} />
      </div>

      <div className="mt-6 rounded-xl border border-cream-200 p-5">
        <h3 className="font-serif text-lg font-bold text-brown-900">함께 이야기해 볼 질문</h3>
        <ol className="mt-3 space-y-3">
          {analysis.discussionQuestions.map((question, index) => (
            <li key={question} className="flex gap-3 text-sm leading-6 text-brown-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brown-800 text-xs font-bold text-white">{index + 1}</span>
              <span>{question}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-4 text-xs text-brown-400">독후감 {analysis.analyzedReviewCount}개를 분석한 결과 · 독후감 원문에 없는 책 내용은 포함하지 않습니다.</p>
    </section>
  );
}

function ResultList({ title, items, tone }: { title: string; items: string[]; tone: "green" | "orange" }) {
  return (
    <div className={`rounded-xl p-5 ${tone === "green" ? "bg-green-50" : "bg-orange-50"}`}>
      <h3 className="font-serif text-lg font-bold text-brown-900">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {items.map((item) => <li key={item} className="text-sm leading-6 text-brown-700">• {item}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-brown-500">여러 독후감에서 뚜렷하게 확인된 내용이 없어요.</p>
      )}
    </div>
  );
}

function KeywordBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-cream-200 p-5">
      <h3 className="text-sm font-semibold text-brown-800">{title}</h3>
      {items.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => <span key={item} className="rounded-full bg-cream-100 px-3 py-1.5 text-sm text-brown-700">#{item}</span>)}
        </div>
      ) : (
        <p className="mt-3 text-sm text-brown-500">뚜렷하게 확인된 항목이 없어요.</p>
      )}
    </div>
  );
}
