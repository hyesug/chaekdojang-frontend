"use client";

import { BookOpen, Power, Send, Sparkles, Users, User } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Alert } from "../components/ui/Alert";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { authFetch, getValidToken } from "../lib/auth";

type Scope = "ALL" | "MINE";

type AssistantStatus = {
  available: boolean;
  activated: boolean;
  totalReviews: number;
  indexedReviews: number;
  pendingReviews: number;
  failedReviews: number;
  dailyLimit: number;
  usedToday: number;
  maxQuestionChars: number;
  // 전체 독자 검색 — 서버가 아직 모르면 undefined 라 false 로 본다
  globalAvailable?: boolean;
  noticeAcknowledged?: boolean;
  globalIndexedReviews?: number;
  aiSearchOptOut?: boolean;
};

type AnswerStatus = "ANSWERED" | "NO_ANSWER" | "NO_RELEVANT_REVIEWS" | "NO_REVIEWS" | "INDEXING" | "FAILED";

type AnswerSource = {
  number: number;
  reviewId: number;
  bookTitle: string | null;
  bookAuthor: string | null;
  rating: number;
  writtenOn: string;
  excerpt: string;
  similarity: number;
  cited: boolean;
  authorNickname?: string | null;
  mine?: boolean;
};

type AssistantAnswer = {
  status: AnswerStatus;
  answer: string;
  sources: AnswerSource[];
  partialIndex: boolean;
  remainingToday: number;
};

const EXAMPLE_QUESTIONS: Record<Scope, string[]> = {
  ALL: [
    "마음이 지칠 때 위로가 됐다는 소설을 추천해 줘",
    "데미안을 읽은 사람들은 어떤 장면을 꼽았어?",
    "처음 읽기 좋은 고전이 있을까?",
  ],
  MINE: [
    "가장 인상 깊었다고 쓴 장면은 뭐였지?",
    "다시 읽고 싶다고 쓴 책이 있어?",
    "사랑이나 관계에 대해 쓴 독후감을 찾아줘",
  ],
};

const STATUS_POLL_MS = 5000;

async function readData<T>(res: Response): Promise<T> {
  const json = await res.json();
  return (json.data ?? json) as T;
}

async function readError(res: Response, fallback: string) {
  try {
    const json = await res.json();
    return typeof json?.message === "string" && json.message ? json.message : fallback;
  } catch {
    return fallback;
  }
}

/** 답변 속 [1] 같은 근거 번호를 아래 근거 목록으로 가는 링크로 바꾼다. */
function renderAnswer(text: string): ReactNode[] {
  return text.split(/(\[\d{1,3}\])/g).map((part, i) => {
    const match = part.match(/^\[(\d{1,3})\]$/);
    if (!match) return <span key={i}>{part}</span>;
    return (
      <a key={i} href={`#source-${match[1]}`} className="mx-0.5 align-super text-xs font-semibold text-brand underline">
        {match[1]}
      </a>
    );
  });
}

export default function AssistantClient() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [scope, setScope] = useState<Scope | null>(null);
  const [consent, setConsent] = useState(false);
  const [noticeConsent, setNoticeConsent] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [askError, setAskError] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const res = await authFetch("/api/reading-assistant/status", { cache: "no-store" });
      if (res.status === 401) {
        setLoggedIn(false);
        return;
      }
      if (!res.ok) {
        setLoadError(await readError(res, "도우미 상태를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."));
        return;
      }
      setLoadError("");
      const next = await readData<AssistantStatus>(res);
      setStatus(next);
      // 처음 한 번만 기본 범위를 정한다 — 전체 독자 검색을 쓸 수 있으면 그쪽이 기본
      setScope((current) => current ?? (next.globalAvailable ? "ALL" : "MINE"));
    } catch {
      setLoadError("도우미 상태를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }, []);

  useEffect(() => {
    const hasToken = Boolean(getValidToken());
    setLoggedIn(hasToken);
    if (hasToken) loadStatus();
  }, [loadStatus]);

  // 내 독후감을 정리하는 동안에는 진행 상황을 주기적으로 다시 읽는다
  useEffect(() => {
    if (scope !== "MINE" || !status?.activated || status.pendingReviews === 0) return;
    const timer = window.setTimeout(loadStatus, STATUS_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [scope, status, loadStatus]);

  /** 상태를 바꾸는 요청(켜기·끄기·안내 확인·제외 설정) 공통 처리 — 응답으로 새 상태를 받는다. */
  async function update(path: string, init: RequestInit, failMessage: string) {
    setToggling(true);
    setAskError("");
    try {
      const res = await authFetch(path, init);
      if (!res.ok) {
        setLoadError(await readError(res, failMessage));
        return false;
      }
      setLoadError("");
      setStatus(await readData<AssistantStatus>(res));
      return true;
    } catch {
      setLoadError("요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
      return false;
    } finally {
      setToggling(false);
    }
  }

  async function toggle(activate: boolean) {
    if (!activate && !window.confirm("내 독후감 검색을 끄면 정리해 둔 비공개 독후감 사본이 바로 지워져요. 끌까요?")) return;
    const ok = await update(
      "/api/reading-assistant/activation",
      { method: activate ? "POST" : "DELETE" },
      activate ? "도우미를 켜지 못했어요." : "도우미를 끄지 못했어요.",
    );
    if (ok && !activate) {
      setAnswer(null);
      setConsent(false);
    }
  }

  async function setOptOut(optOut: boolean) {
    await update(
      "/api/reading-assistant/ai-search",
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optOut }) },
      "설정을 바꾸지 못했어요.",
    );
  }

  function switchScope(next: Scope) {
    if (next === scope) return;
    setScope(next);
    setAnswer(null);
    setAskError("");
    setQuestion("");
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || asking || !scope) return;
    setAsking(true);
    setAskError("");
    try {
      const res = await authFetch("/api/reading-assistant/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, scope }),
      });
      if (!res.ok) {
        setAskError(await readError(res, "답변을 만들지 못했어요. 잠시 후 다시 물어봐 주세요."));
        return;
      }
      setAnswer(await readData<AssistantAnswer>(res));
      loadStatus();
    } catch {
      setAskError("답변을 만들지 못했어요. 잠시 후 다시 물어봐 주세요.");
    } finally {
      setAsking(false);
    }
  }

  if (loggedIn === false) {
    return (
      <div className="cdj-page cdj-page--reading">
        <EmptyState
          title="AI 독서 도우미"
          icon={<Sparkles size={22} aria-hidden="true" />}
          action={<Link href="/auth/login" className="cdj-button cdj-button--primary">로그인하기</Link>}
        >
          책도장 독자들의 독후감에 질문하려면 로그인이 필요해요
        </EmptyState>
      </div>
    );
  }

  if (loggedIn === null || ((!status || !scope) && !loadError)) {
    return (
      <div className="cdj-page cdj-page--reading">
        <LoadingState label="도우미를 준비하는 중입니다" />
      </div>
    );
  }

  const maxChars = status?.maxQuestionChars ?? 500;
  const remaining = status && status.dailyLimit > 0 ? Math.max(0, status.dailyLimit - status.usedToday) : null;
  const citedSources = answer?.sources.filter((source) => source.cited) ?? [];
  const relatedSources = answer?.sources.filter((source) => !source.cited) ?? [];
  const globalAvailable = Boolean(status?.globalAvailable);
  const scopeAvailable = scope === "ALL" ? globalAvailable : Boolean(status?.available);
  const readyToAsk =
    scope === "ALL" ? globalAvailable && Boolean(status?.noticeAcknowledged) : Boolean(status?.activated);

  return (
    <div className="cdj-page cdj-page--reading">
      <div className="mb-6">
        <h1 className="cdj-title">AI 독서 도우미</h1>
        <p className="cdj-lead mt-2">
          {scope === "ALL"
            ? "책도장 독자들이 쓴 공개 독후감에서 질문과 관련된 글을 찾아, 그 내용을 근거로 답해 드려요."
            : "내가 쓴 독후감에 질문하면 관련 독후감을 찾아, 그 내용을 근거로 답해 드려요."}
        </p>
      </div>

      {globalAvailable && (
        <div className="cdj-tabs mb-5" role="tablist" aria-label="검색 범위">
          <button
            type="button"
            role="tab"
            className="cdj-tab"
            aria-selected={scope === "ALL"}
            onClick={() => switchScope("ALL")}
          >
            <Users size={15} aria-hidden="true" />
            책도장 독자들
          </button>
          <button
            type="button"
            role="tab"
            className="cdj-tab"
            aria-selected={scope === "MINE"}
            onClick={() => switchScope("MINE")}
          >
            <User size={15} aria-hidden="true" />
            내 독후감
          </button>
        </div>
      )}

      {loadError && <div className="mb-4"><Alert tone="error">{loadError}</Alert></div>}

      {status && !scopeAvailable && (
        <div className="mb-4">
          <Alert tone="warning">지금은 AI 독서 도우미를 이용할 수 없어요. 잠시 후 다시 찾아 주세요.</Alert>
        </div>
      )}

      {status && scope === "ALL" && globalAvailable && !status.noticeAcknowledged && (
        <section className="cdj-card p-5 sm:p-6">
          <h2 className="font-serif text-lg font-bold text-brown-800">시작하기 전에 확인해 주세요</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-brown-600">
            <li>
              질문할 때마다 질문 내용과, 관련된 공개 독후감 발췌가 AI 서비스(OpenAI, 미국)로 전송돼요. 작성자 닉네임은 보내지 않아요.
            </li>
            <li>검색 대상은 공개 독후감뿐이에요. 나만 보기·스포일러 글과 AI 검색 제외를 설정한 독자의 글은 찾지 않아요.</li>
            <li>질문과 답변 본문은 책도장 서버에 저장하지 않아요. 횟수·처리 시간 같은 이용 기록만 남겨요.</li>
          </ul>
          <p className="mt-3 text-xs text-brown-500">
            자세한 내용은 <Link href="/privacy" className="underline">개인정보처리방침</Link>의 독후감 AI 기능 항목에서 볼 수 있어요.
          </p>
          <label className="mt-4 flex items-start gap-2 text-sm text-brown-800">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={noticeConsent}
              onChange={(event) => setNoticeConsent(event.target.checked)}
            />
            위 내용을 확인했고, 질문과 관련 독후감 발췌를 AI 서비스로 보내는 데 동의해요.
          </label>
          <button
            type="button"
            className="cdj-button cdj-button--primary mt-4"
            disabled={!noticeConsent || toggling}
            onClick={() => update("/api/reading-assistant/notice", { method: "POST" }, "확인을 저장하지 못했어요.")}
          >
            <Sparkles size={16} aria-hidden="true" />
            {toggling ? "준비하는 중…" : "도우미 시작하기"}
          </button>
        </section>
      )}

      {status && scope === "MINE" && !status.activated && (
        <section className="cdj-card p-5 sm:p-6">
          <h2 className="font-serif text-lg font-bold text-brown-800">내 독후감 검색을 켜기 전에 확인해 주세요</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-brown-600">
            <li>
              켜면 내 독후감 {status.totalReviews}편(나만 보기 글 포함)을 검색할 수 있게 정리합니다. 이때 독후감 본문과 책
              제목이 AI 서비스(OpenAI, 미국)로 전송돼요.
            </li>
            <li>질문할 때마다 질문 내용과 관련 독후감 발췌가 같은 AI 서비스로 전송돼요.</li>
            <li>질문과 답변 본문은 책도장 서버에 저장하지 않아요. 횟수·처리 시간 같은 이용 기록만 남겨요.</li>
            <li>언제든 끌 수 있고, 끄면 정리해 둔 비공개 독후감 사본이 바로 지워져요.</li>
          </ul>
          <p className="mt-3 text-xs text-brown-500">
            자세한 내용은 <Link href="/privacy" className="underline">개인정보처리방침</Link>의 독후감 AI 기능 항목에서 볼 수 있어요.
          </p>
          <label className="mt-4 flex items-start gap-2 text-sm text-brown-800">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            위 내용을 확인했고, 내 독후감과 질문을 AI 서비스로 보내는 데 동의해요.
          </label>
          <button
            type="button"
            className="cdj-button cdj-button--primary mt-4"
            disabled={!consent || toggling || !status.available}
            onClick={() => toggle(true)}
          >
            <Sparkles size={16} aria-hidden="true" />
            {toggling ? "켜는 중…" : "내 독후감 검색 켜기"}
          </button>
        </section>
      )}

      {status && scope && readyToAsk && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-brown-600">
            {scope === "ALL" ? (
              <p>
                {(status.globalIndexedReviews ?? 0) > 0
                  ? `책도장 독자들의 공개 독후감 ${status.globalIndexedReviews}편에서 찾아 드려요.`
                  : "독자들의 독후감을 정리하는 중이에요. 잠시 후 다시 물어봐 주세요."}
              </p>
            ) : (
              <>
                <p>
                  {status.totalReviews === 0
                    ? "아직 쓴 독후감이 없어요."
                    : status.pendingReviews > 0
                      ? `독후감 ${status.totalReviews}편 중 ${status.indexedReviews}편을 정리했어요. 나머지는 정리하는 중이에요.`
                      : `독후감 ${status.indexedReviews}편을 바탕으로 답해 드려요.`}
                  {status.failedReviews > 0 && ` (${status.failedReviews}편은 정리하지 못했어요. 글을 수정하면 다시 시도해요.)`}
                </p>
                <button
                  type="button"
                  className="cdj-button cdj-button--secondary cdj-button--sm"
                  disabled={toggling}
                  onClick={() => toggle(false)}
                >
                  <Power size={14} aria-hidden="true" />
                  내 독후감 검색 끄기
                </button>
              </>
            )}
          </div>

          <form onSubmit={ask} className="cdj-card p-5 sm:p-6">
            <label htmlFor="assistant-question" className="font-serif text-lg font-bold text-brown-800">
              무엇이 궁금하세요?
            </label>
            <textarea
              id="assistant-question"
              className="cdj-field mt-3 min-h-28 resize-y"
              maxLength={maxChars}
              value={question}
              placeholder={
                scope === "ALL"
                  ? "예: 데미안을 읽은 사람들은 어떤 장면이 좋았대?"
                  : "예: 데미안을 읽고 어떤 장면이 남았다고 썼지?"
              }
              onChange={(event) => setQuestion(event.target.value)}
              disabled={asking || !scopeAvailable}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS[scope].map((example) => (
                <button
                  key={example}
                  type="button"
                  className="cdj-chip"
                  onClick={() => setQuestion(example)}
                  disabled={asking}
                >
                  {example}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-brown-500 tabular">
                {question.trim().length}/{maxChars}자
                {remaining !== null && ` · 오늘 ${remaining}번 더 물어볼 수 있어요`}
              </p>
              <button
                type="submit"
                className="cdj-button cdj-button--primary"
                disabled={asking || !question.trim() || !scopeAvailable || remaining === 0}
              >
                <Send size={16} aria-hidden="true" />
                {asking ? "독후감을 찾는 중…" : "물어보기"}
              </button>
            </div>
          </form>

          {askError && <div className="mt-4"><Alert tone="error">{askError}</Alert></div>}

          {answer && (
            <section className="cdj-card mt-6 p-5 sm:p-6" aria-live="polite">
              <h2 className="font-serif text-lg font-bold text-brown-800">
                {answer.status === "ANSWERED" ? "도우미의 답" : "도우미의 안내"}
              </h2>
              <p className="mt-3 whitespace-pre-line leading-7 text-brown-800">{renderAnswer(answer.answer)}</p>
              {answer.partialIndex && (
                <p className="mt-3 text-xs text-brown-500">아직 정리 중인 독후감이 있어 일부만 찾아본 결과예요.</p>
              )}

              {citedSources.length > 0 && <SourceList title="답변의 근거" sources={citedSources} />}
              {relatedSources.length > 0 && (
                <SourceList title={citedSources.length > 0 ? "함께 찾은 독후감" : "가까워 보이는 독후감"} sources={relatedSources} />
              )}
              <p className="mt-5 text-xs text-brown-500">
                {scope === "ALL"
                  ? "AI가 독자들의 공개 독후감 일부만 보고 쓴 답이에요. 원문과 다를 수 있으니 근거 독후감을 함께 확인해 주세요."
                  : "AI가 내 독후감만 보고 쓴 답이에요. 원문과 다를 수 있으니 근거 독후감을 함께 확인해 주세요."}
              </p>
            </section>
          )}
        </>
      )}

      {status && globalAvailable && (
        <label className="mt-8 flex items-start gap-2 border-t border-cream-300 pt-4 text-xs leading-5 text-brown-500">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={!status.aiSearchOptOut}
            disabled={toggling}
            onChange={(event) => setOptOut(!event.target.checked)}
          />
          내 공개 독후감을 다른 독자의 AI 도우미 검색에 포함해요. 끄면 내 글은 다른 사람의 답변 근거로 쓰이지 않아요.
        </label>
      )}
    </div>
  );
}

function SourceList({ title, sources }: { title: string; sources: AnswerSource[] }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold text-brown-800">{title}</h3>
      <ol className="mt-2 space-y-3">
        {sources.map((source) => (
          <li key={source.number} id={`source-${source.number}`} className="rounded-md border border-cream-300 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-brown-800">
                <span className="mr-1 tabular text-brown-500">[{source.number}]</span>
                {source.bookTitle ?? "책 정보 없음"}
                {source.bookAuthor && <span className="font-normal text-brown-500"> · {source.bookAuthor}</span>}
              </span>
              <span className="text-xs text-brown-500 tabular">
                {source.mine ? "내 독후감" : source.authorNickname ? `${source.authorNickname} 님` : ""}
                {(source.mine || source.authorNickname) && " · "}
                {source.writtenOn}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-brown-600">{source.excerpt}</p>
            <Link href={`/reviews/${source.reviewId}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand underline">
              <BookOpen size={13} aria-hidden="true" />
              독후감 보기
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
