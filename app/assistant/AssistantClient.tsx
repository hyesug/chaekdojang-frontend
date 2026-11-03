"use client";

import { BookOpen, Power, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Alert } from "../components/ui/Alert";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { authFetch, getValidToken } from "../lib/auth";

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
};

type AssistantAnswer = {
  status: AnswerStatus;
  answer: string;
  sources: AnswerSource[];
  partialIndex: boolean;
  remainingToday: number;
};

const EXAMPLE_QUESTIONS = [
  "가장 인상 깊었다고 쓴 장면은 뭐였지?",
  "다시 읽고 싶다고 쓴 책이 있어?",
  "사랑이나 관계에 대해 쓴 독후감을 찾아줘",
];

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
      <a key={i} href={`#source-${match[1]}`} className="mx-0.5 align-super text-xs font-semibold text-brown-700 underline">
        {match[1]}
      </a>
    );
  });
}

export default function AssistantClient() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [consent, setConsent] = useState(false);
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
      setStatus(await readData<AssistantStatus>(res));
    } catch {
      setLoadError("도우미 상태를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }, []);

  useEffect(() => {
    const hasToken = Boolean(getValidToken());
    setLoggedIn(hasToken);
    if (hasToken) loadStatus();
  }, [loadStatus]);

  // 독후감을 정리하는 동안에는 진행 상황을 주기적으로 다시 읽는다
  useEffect(() => {
    if (!status?.activated || status.pendingReviews === 0) return;
    const timer = window.setTimeout(loadStatus, STATUS_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [status, loadStatus]);

  async function toggle(activate: boolean) {
    if (!activate && !window.confirm("도우미를 끄면 정리해 둔 독후감 사본이 바로 지워져요. 끌까요?")) return;
    setToggling(true);
    setAskError("");
    try {
      const res = await authFetch("/api/reading-assistant/activation", { method: activate ? "POST" : "DELETE" });
      if (!res.ok) {
        setLoadError(await readError(res, activate ? "도우미를 켜지 못했어요." : "도우미를 끄지 못했어요."));
        return;
      }
      setLoadError("");
      setStatus(await readData<AssistantStatus>(res));
      if (!activate) {
        setAnswer(null);
        setConsent(false);
      }
    } catch {
      setLoadError("요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setToggling(false);
    }
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || asking) return;
    setAsking(true);
    setAskError("");
    try {
      const res = await authFetch("/api/reading-assistant/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
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
          내 독후감에 질문하려면 로그인이 필요해요
        </EmptyState>
      </div>
    );
  }

  if (loggedIn === null || (!status && !loadError)) {
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

  return (
    <div className="cdj-page cdj-page--reading">
      <div className="mb-6">
        <h1 className="cdj-title">AI 독서 도우미</h1>
        <p className="cdj-lead mt-2">
          내가 쓴 독후감에 질문하면 관련 독후감을 찾아, 그 내용을 근거로 답해 드려요.
        </p>
      </div>

      {loadError && <div className="mb-4"><Alert tone="error">{loadError}</Alert></div>}

      {status && !status.available && (
        <div className="mb-4">
          <Alert tone="warning">지금은 AI 독서 도우미를 이용할 수 없어요. 잠시 후 다시 찾아 주세요.</Alert>
        </div>
      )}

      {status && !status.activated && (
        <section className="cdj-card p-5 sm:p-6">
          <h2 className="font-serif text-lg font-bold text-brown-800">도우미를 켜기 전에 확인해 주세요</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-brown-700">
            <li>
              켜면 내 독후감 {status.totalReviews}편(나만 보기 글 포함)을 검색할 수 있게 정리합니다. 이때 독후감 본문과 책
              제목이 AI 서비스(OpenAI, 미국)로 전송돼요.
            </li>
            <li>질문할 때마다 질문 내용과 관련 독후감 발췌가 같은 AI 서비스로 전송돼요.</li>
            <li>질문과 답변 본문은 책도장 서버에 저장하지 않아요. 횟수·처리 시간 같은 이용 기록만 남겨요.</li>
            <li>언제든 끌 수 있고, 끄면 정리해 둔 독후감 사본이 바로 지워져요.</li>
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
            {toggling ? "켜는 중…" : "도우미 켜기"}
          </button>
        </section>
      )}

      {status?.activated && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-brown-600">
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
              도우미 끄기
            </button>
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
              placeholder="예: 데미안을 읽고 어떤 장면이 남았다고 썼지?"
              onChange={(event) => setQuestion(event.target.value)}
              disabled={asking || !status.available}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((example) => (
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
                disabled={asking || !question.trim() || !status.available || remaining === 0}
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
                AI가 내 독후감만 보고 쓴 답이에요. 원문과 다를 수 있으니 근거 독후감을 함께 확인해 주세요.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SourceList({ title, sources }: { title: string; sources: AnswerSource[] }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold text-brown-700">{title}</h3>
      <ol className="mt-2 space-y-3">
        {sources.map((source) => (
          <li key={source.number} id={`source-${source.number}`} className="rounded-md border border-cream-300 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-brown-800">
                <span className="mr-1 tabular text-brown-500">[{source.number}]</span>
                {source.bookTitle ?? "책 정보 없음"}
                {source.bookAuthor && <span className="font-normal text-brown-500"> · {source.bookAuthor}</span>}
              </span>
              <span className="text-xs text-brown-500 tabular">{source.writtenOn}</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-brown-700">{source.excerpt}</p>
            <Link href={`/reviews/${source.reviewId}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brown-700 underline">
              <BookOpen size={13} aria-hidden="true" />
              독후감 보기
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
