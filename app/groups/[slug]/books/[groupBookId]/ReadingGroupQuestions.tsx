"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../../../lib/api";
import { authFetch } from "../../../../lib/auth";

type Answer = {
  id: number;
  userId: number;
  nickname: string;
  profileImage: string | null;
  content: string;
  mine: boolean;
  createdAt: string;
  updatedAt: string;
};

type Question = {
  id: number;
  question: string;
  aiSuggested: boolean;
  published: boolean;
  model: string | null;
  promptVersion: string | null;
  createdAt: string;
  updatedAt: string;
  responses: Answer[];
};

type QuestionList = {
  canManage: boolean;
  canRespond: boolean;
  canAddQuestions: boolean;
  questions: Question[];
};

async function errorMessage(response: Response, fallback: string) {
  try {
    const json = await response.json();
    return json.message ?? json.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export default function ReadingGroupQuestions({ slug, groupBookId }: { slug: string; groupBookId: string }) {
  const [data, setData] = useState<QuestionList | null>(null);
  const [questionDrafts, setQuestionDrafts] = useState<Record<number, string>>({});
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  const [newQuestion, setNewQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const endpoint = `${API_BASE}/api/groups/${encodeURIComponent(slug)}/books/${encodeURIComponent(groupBookId)}/questions`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch(endpoint);
      if (!response.ok) throw new Error();
      const json = await response.json();
      const next = (json.data ?? json) as QuestionList;
      setData(next);
      setQuestionDrafts(Object.fromEntries(next.questions.map((item) => [item.id, item.question])));
      setAnswerDrafts(Object.fromEntries(next.questions.map((item) => [
        item.id,
        item.responses.find((answer) => answer.mine)?.content ?? "",
      ])));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  async function request(path: string, init: RequestInit, success: string) {
    setWorking(true);
    setMessage("");
    try {
      const response = await authFetch(`${endpoint}${path}`, init);
      if (!response.ok) throw new Error(await errorMessage(response, "요청을 처리하지 못했어요."));
      await load();
      setMessage(success);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "요청을 처리하지 못했어요.");
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function createQuestion(event: React.FormEvent) {
    event.preventDefault();
    if (!newQuestion.trim()) return;
    const saved = await request("", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: newQuestion.trim() }),
    }, "질문을 멤버들에게 공개했어요.");
    if (saved) setNewQuestion("");
  }

  async function generateAiDraft() {
    await request("/ai-draft", { method: "POST" }, "AI 제안을 비공개 초안으로 저장했어요. 검토한 뒤 공개해주세요.");
  }

  async function updateQuestion(questionId: number) {
    const question = questionDrafts[questionId]?.trim();
    if (!question) return;
    await request(`/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }, "질문을 수정했어요.");
  }

  async function publishQuestion(questionId: number) {
    await request(`/${questionId}/publish`, { method: "POST" }, "질문을 멤버들에게 공개했어요.");
  }

  async function deleteQuestion(questionId: number) {
    if (!window.confirm("이 질문과 모든 중간 응답을 삭제할까요?")) return;
    await request(`/${questionId}`, { method: "DELETE" }, "질문을 삭제했어요.");
  }

  async function saveAnswer(questionId: number) {
    const content = answerDrafts[questionId]?.trim();
    if (!content) return;
    await request(`/${questionId}/response`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }, "중간 생각을 저장했어요. 언제든 다시 고칠 수 있어요.");
  }

  async function deleteAnswer(questionId: number) {
    if (!window.confirm("내 중간 생각을 삭제할까요?")) return;
    await request(`/${questionId}/response`, { method: "DELETE" }, "중간 생각을 삭제했어요.");
  }

  if (loading) {
    return <section className="mt-6 rounded-2xl border border-cream-200 bg-white p-5 text-sm text-brown-400">질문을 불러오는 중이에요…</section>;
  }
  if (!data) return null;

  return (
    <section id="questions" className="mt-6 scroll-mt-24 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">함께 읽는 중</p>
        <h2 className="mt-1 font-serif text-xl font-bold text-brown-900">모임 질문과 중간 생각</h2>
        <p className="mt-2 text-sm leading-6 text-brown-500">
          완독 전에도 지금 떠오른 생각을 남겨보세요. 중간 응답은 언제든 수정하거나 삭제할 수 있어요.
        </p>
      </div>

      {data.canAddQuestions && (
        <div className="mt-5 rounded-xl bg-cream-50 p-4">
          <p className="text-sm font-semibold text-brown-800">운영자 질문 추가</p>
          <form onSubmit={createQuestion} className="mt-3 space-y-2">
            <textarea
              value={newQuestion}
              onChange={(event) => setNewQuestion(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="예: 지금까지 읽으며 가장 오래 머문 생각은 무엇인가요?"
              className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-800 outline-none focus:border-green-500"
            />
            <div className="flex flex-wrap gap-2">
              <button disabled={working || !newQuestion.trim()} className="rounded-full bg-brown-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                직접 작성해 공개
              </button>
              <button type="button" disabled={working} onClick={generateAiDraft} className="rounded-full border border-green-300 bg-white px-4 py-2 text-sm font-semibold text-green-700 disabled:opacity-40">
                AI 질문 초안 제안받기
              </button>
            </div>
          </form>
          <p className="mt-2 text-xs leading-5 text-brown-400">AI는 책 제목과 저자만 보고 제안하며, 자동 공개하지 않습니다. 운영자가 검토·수정한 뒤 공개합니다.</p>
        </div>
      )}

      {data.canManage && !data.canAddQuestions && (
        <p className="mt-4 rounded-xl bg-cream-50 px-3 py-2 text-xs leading-5 text-brown-500">
          함께 읽기가 완료되어 질문과 응답이 보관 모드로 전환됐어요. 기존 질문은 정리할 수 있지만 새 질문은 추가되지 않습니다.
        </p>
      )}

      {message && <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}

      <div className="mt-5 space-y-4">
        {data.questions.map((question, index) => {
          const mine = question.responses.find((answer) => answer.mine);
          return (
            <article key={question.id} className={`rounded-xl border p-4 ${question.published ? "border-cream-200" : "border-dashed border-yellow-300 bg-yellow-50/50"}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="text-brown-400">질문 {index + 1}</span>
                {question.aiSuggested && <span className="rounded-full bg-purple-50 px-2 py-1 text-purple-700">AI 제안</span>}
                {!question.published && <span className="rounded-full bg-yellow-100 px-2 py-1 text-yellow-800">비공개 초안</span>}
              </div>

              {data.canManage ? (
                <div className="mt-3">
                  <textarea
                    value={questionDrafts[question.id] ?? question.question}
                    onChange={(event) => setQuestionDrafts((current) => ({ ...current, [question.id]: event.target.value }))}
                    maxLength={1000}
                    rows={3}
                    className="w-full rounded-xl border border-cream-300 px-3 py-2 text-sm font-medium leading-6 text-brown-900 outline-none focus:border-green-500"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" disabled={working} onClick={() => updateQuestion(question.id)} className="rounded-full border border-cream-300 px-3 py-1.5 text-xs font-semibold text-brown-700 disabled:opacity-40">수정 저장</button>
                    {!question.published && data.canAddQuestions && <button type="button" disabled={working} onClick={() => publishQuestion(question.id)} className="rounded-full bg-green-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">검토 후 공개</button>}
                    <button type="button" disabled={working} onClick={() => deleteQuestion(question.id)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-500 disabled:opacity-40">질문 삭제</button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 font-medium leading-7 text-brown-900">{question.question}</p>
              )}

              {question.published && (
                <div className="mt-4 border-t border-cream-100 pt-4">
                  {question.responses.filter((answer) => !answer.mine).map((answer) => (
                    <div key={answer.id} className="mb-3 rounded-xl bg-cream-50 p-3">
                      <p className="text-xs font-semibold text-brown-500">{answer.nickname}</p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-brown-700">{answer.content}</p>
                    </div>
                  ))}
                  {data.canRespond ? (
                    <div className="mt-3">
                      <label className="text-xs font-semibold text-brown-600">내 중간 생각</label>
                      <textarea
                        value={answerDrafts[question.id] ?? ""}
                        onChange={(event) => setAnswerDrafts((current) => ({ ...current, [question.id]: event.target.value }))}
                        maxLength={2000}
                        rows={3}
                        placeholder="아직 정리되지 않은 생각이어도 괜찮아요."
                        className="mt-2 w-full rounded-xl border border-cream-300 px-3 py-2 text-sm leading-6 text-brown-800 outline-none focus:border-green-500"
                      />
                      <div className="mt-2 flex gap-2">
                        <button type="button" disabled={working || !answerDrafts[question.id]?.trim()} onClick={() => saveAnswer(question.id)} className="rounded-full bg-brown-800 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{mine ? "내 생각 수정" : "중간 생각 저장"}</button>
                        {mine && <button type="button" disabled={working} onClick={() => deleteAnswer(question.id)} className="rounded-full px-3 py-2 text-xs font-semibold text-red-500 disabled:opacity-40">삭제</button>}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-brown-400">승인된 모임 멤버만 중간 생각을 남길 수 있어요.</p>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {data.questions.length === 0 && <p className="py-8 text-center text-sm text-brown-400">아직 등록된 모임 질문이 없어요.</p>}
      </div>
    </section>
  );
}
