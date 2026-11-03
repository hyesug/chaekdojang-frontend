import Anthropic from "@anthropic-ai/sdk";
import { compactHistory, detailLevel, lengthHint, slimFocus, THINKING_BUDGET, wantsThinking, type DetailLevel } from "./conversation";
import { planAnswer, planNote, SYSTEM, type AnswerPlan, type Intent } from "./prompt";
// 화면과 같은 검사 규칙을 쓴다(화면은 고친 글을 보여 주고, 여기서는 무엇이 걸렸는지 기록한다)
import { checkAnswer, evidenceIdsIn, issueSummary } from "../../public/unse/src/answerCheck.js";

/**
 * 종합 운세 — Claude 프록시
 *
 * public/unse 의 정적 사이트가 부르는 엔드포인트다.
 * API 키를 브라우저에 내려보낼 수 없으므로 서버를 한 번 거친다.
 *
 * 경로를 /api 아래에 두지 않은 이유: next.config.ts 의 rewrite 가
 * /api/:path* 를 전부 자바 백엔드로 넘긴다. image-proxy, system-health 와
 * 같은 최상위 라우트로 둬야 한다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 답이 길어질수록 여기가 먼저 걸린다. max_tokens 보다 이쪽이 진짜 천장이다.
// 300초는 Vercel 이 허용하는 최대치다.
export const maxDuration = 300;

const TIERS = {
  CLAUDE_SONNET: { provider: "ANTHROPIC", model: "claude-sonnet-5-5" },
  GPT_SOL: { provider: "OPENAI", model: "gpt-6.1-sol" },
  CLAUDE_OPUS: { provider: "ANTHROPIC", model: "claude-opus-5-5" },
  GPT_ASTRA: { provider: "OPENAI", model: "gpt-6-astra" },
} as const;
type Tier = keyof typeof TIERS;
// max_tokens 는 질문이 원하는 길이(conversation.ts 의 detailLevel)와 사고 여부에 따라
// OUTPUT_BUDGET(사고 없음) · THINKING_BUDGET(사고 켬)에서 고른다.

/**
 * 프롬프트 캐시 수명. 기본은 예전과 같은 5분이다.
 *
 * 수명은 요청 **시작**부터 잰다. 답을 만드는 1~3분에 읽고 다음 질문을 치는 시간까지
 * 더해 5분을 넘기면 명반 전체를 다시 쓴다(쓰기는 입력값의 1.25배). 그런 일이 잦으면
 * FORTUNE_AI_CACHE_TTL=1h 로 바꾼다 — 쓰기가 2배라 첫 질문은 비싸지지만 상담 내내 읽기로 버틴다.
 * 판단은 ai_usage_records 에서 한다: 같은 session_id 의 두 번째 질문부터 cache_write_tokens 가
 * 명반 크기만큼 자꾸 찍히면 5분이 모자란 것이다. 데이터 없이 미리 바꾸지 않는다.
 */
const CACHE_TTL: "5m" | "1h" = process.env.FORTUNE_AI_CACHE_TTL === "1h" ? "1h" : "5m";
const cached = { type: "ephemeral" as const, ttl: CACHE_TTL };
const BACKEND_URL = (
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:8080" : "https://api.chaekdojang.com")
).replace(/\/$/, "");

/**
 * 명반 데이터 상한.
 *
 * 예전에는 24,000자였다. 고해상도 계산(월운·유월·트랜싯·다샤 하위 구간)을
 * 실으면서 넉넉하게 올렸다. 모델이 감당 못 할 길이라서가 아니라, 실수로
 * 거대한 본문이 올라오는 것을 막는 방어선이다. 명반 본문은 캐시에 태우므로
 * 길어져도 두 번째 질문부터는 비용이 거의 들지 않는다.
 */
const MAX_CONTEXT_CHARS = 60_000;
/** 질문마다 다시 만드는 고해상도 구획. 이쪽은 캐시에 태우지 않는다 */
const MAX_FOCUS_CHARS = 40_000;
// 오래된 턴은 conversation.ts 가 요약으로 접으므로 원문으로 가는 것은 최근 몇 턴뿐이다.
// 이 상한은 요약할 대상의 한도다. 넘으면 맨 앞 턴부터 빠진다.
const MAX_MESSAGES = 80;
// 질문 길이. 막는 것이 목적이 아니라 실수로 책 한 권을 붙여넣는 걸 거르는
// 정도다. 넘으면 조용히 자르지 않고 알려준다 - 잘린 줄 모르고 엉뚱한 답을
// 받는 것이 제일 나쁘다.
const MAX_QUESTION_CHARS = 20_000;
/**
 * 한 번에 받는 전체 글자 상한(명반+고해상도+대화 원문 합계).
 * 대화의 지난 답(assistant)은 브라우저가 보내는 값이라 위조할 수 있다. 칸마다 상한만 있으면
 * 80개×2만 자를 실어 질문권 하나로 비싼 호출을 만들 수 있으므로 합계에도 천장을 둔다.
 * 정상 상담은 명반 6만 + 고해상도 4만 + 최근 몇 턴이라 이 값에 닿지 않는다.
 */
const MAX_TOTAL_CHARS = 200_000;
/** 장애 때 AI 풀이만 끄는 스위치. 질문권을 잡기 전에 막으므로 차감도 일어나지 않는다 */
const AI_DISABLED = process.env.FORTUNE_AI_DISABLED === "1";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");

/** 로그인·월 한도 검사를 켤지. 지금은 꺼 두고 누구나 쓸 수 있게 한다 */
// 질문권은 계정 원장에 귀속된다. 명시적으로 0을 설정한 개발 환경에서만 끈다.
const REQUIRE_LOGIN = process.env.FORTUNE_AI_REQUIRE_LOGIN !== "0";

/**
 * 시스템 프롬프트와 답의 설계는 prompt.ts 에 있다.
 *
 * 가장 중요한 규칙은 여전히 "직접 계산하지 말 것"이다. 사주 간지와 절기는 이미 검증된 엔진이
 * 계산해서 넘겨준다. 언어 모델이 날짜 산술을 다시 하면 거의 틀리므로, 주어진 값을 그대로
 * 쓰게 못박아야 한다. 이 한 줄이 이 구조 전체의 이유다.
 */

/** 아주 단순한 호출 제한. 서버리스라 완벽하지 않지만 없는 것보단 낫다 */
const hits = new Map<string, number[]>();
function rateLimited(ip: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 500) hits.clear(); // 메모리가 새지 않도록
  return list.length > limit;
}

/** 오류를 사람이 읽을 수 있는 한 줄로 */
function describe(err: unknown) {
  if (err instanceof Anthropic.APIError) {
    return `Claude API 오류 (${err.status ?? "?"}): ${err.message}`;
  }
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause;
    const tail = cause instanceof Error ? ` — ${cause.name}: ${cause.message}` : "";
    return `${err.name}: ${err.message}${tail}`;
  }
  return String(err);
}

/**
 * 사용자에게 보여줄 오류 문구.
 *
 * 제공자 원문(상태 코드·내부 메시지·요청 ID)은 사용자 화면에 내보내지 않고 서버 로그에만 남긴다.
 * 질문권 복구가 실제로 끝났을 때만 "복구됐다"고 말한다.
 */
function publicError(err: unknown, refunded: boolean) {
  const busy = err instanceof Anthropic.APIError && [429, 503, 529].includes(err.status ?? 0);
  const head = busy ? "AI 서버가 붐벼 답을 받지 못했습니다." : "AI 답을 받지 못했습니다.";
  return `${head} ${refunded ? "이 질문에 쓴 질문권은 복구했습니다. " : ""}잠시 뒤 다시 시도해 주세요.`;
}

/** 로그 한 줄. 질문·명반 본문은 싣지 않고 요청 식별자와 원인만 남긴다 */
function logFailure(stage: string, requestId: string | null, tier: Tier, err: unknown) {
  console.error(`[fortune-ai] ${stage} 실패 ` + JSON.stringify({ requestId, tier, error: describe(err).slice(0, 300) }));
}

/**
 * ⑤ 근거·일관성 검증 결과를 남긴다.
 *
 * 화면은 같은 규칙(answerCheck.js)으로 고친 글을 보여 준다. 여기서는 **무엇이 몇 번 걸렸는지만**
 * 기록해 지시문을 고칠 근거로 쓴다. 답 본문은 로그에 싣지 않는다(질문·명반을 싣지 않는 것과 같은 이유).
 * 검사가 터져도 답은 나가야 하므로 예외는 삼킨다.
 */
function logCheck(requestId: string | null, plan: AnswerPlan, answer: string, input: { sources: string; validIds: Set<string> }) {
  try {
    const { issues } = checkAnswer(answer, { ...input, asksMonth: plan.asksMonth, detail: plan.detail, shape: plan.shape, final: true });
    const summary = issueSummary(issues);
    console.info("[fortune-ai] check " + JSON.stringify({ requestId, shape: plan.shape, detail: plan.detail, modules: plan.modules, chars: answer.length, issues: summary }));
    return summary;
  } catch (err) {
    console.error(`[fortune-ai] check 실패 ${describe(err).slice(0, 200)}`);
    return null;
  }
}

/** 한국어 기준 대략 토큰 수. 연결이 끊겨 제공자 사용량을 못 받은 호출의 원가 추정에만 쓴다 */
const approxTokens = (chars: number) => Math.ceil(chars / 1.5);

function line(obj: unknown) {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

/** 사용자가 연결을 끊은 뒤에는 enqueue/close 가 던진다. 정산 로직이 그 예외에 끊기지 않게 감싼다 */
function safeEnqueue(controller: ReadableStreamDefaultController, obj: unknown) {
  try { controller.enqueue(line(obj)); } catch { /* 이미 닫힌 스트림 */ }
}
function safeClose(controller: ReadableStreamDefaultController) {
  try { controller.close(); } catch { /* 이미 닫힌 스트림 */ }
}

/**
 * 이번 달 이용분을 잡아둔다.
 *
 * 백엔드가 내려가 있으면 fetch 가 그대로 던진다. 감싸지 않으면 함수가 죽어
 * 본문 없는 500 이 나가고, 사용자는 아무 안내도 못 받는다. 로그에도 원인이
 * 백엔드 타임아웃으로만 남아서 운세 쪽 문제로 보이기 쉽다. 실제로 한 번
 * 그렇게 헤맸다.
 *
 * 연결 대기도 10초는 너무 길다. 백엔드가 죽었으면 빨리 알려주는 편이 낫다.
 */
async function reserveCredit(req: Request, requestId: string, tier: Tier) {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/fortune-ai/reservations`, {
      method: "POST",
      headers: {
        Cookie: req.headers.get("cookie") ?? "",
        Accept: "application/json",
        "X-Idempotency-Key": requestId,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({ tier }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("[fortune-ai] 이용 한도 확인 실패", err);
    return {
      error: "지금은 이용 확인이 어렵습니다. 잠시 뒤에 다시 시도해 주세요.",
      status: 503,
    };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    return {
      error: payload?.message ?? (response.status === 401 ? "AI 풀이는 로그인 후 이용할 수 있습니다." : "AI 이용 한도를 확인하지 못했습니다."),
      status: response.status || 502,
    };
  }
  return { data: payload.data as { requestId: string; totalBalance: number; freeRemaining: number } };
}

async function settleCredit(req: Request, requestId: string, path: "complete" | "refund", body: unknown) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/fortune-ai/reservations/${requestId}/${path}`, {
      method: "POST",
      headers: { Cookie: req.headers.get("cookie") ?? "", Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    // 예전에는 응답 코드를 보지 않아 백엔드가 500 을 돌려줘도 아무 흔적이 없었다
    // (실제로 환불이 전부 실패하고 있었는데 로그에 남지 않았다)
    if (!res.ok) {
      console.error(`[fortune-ai] 질문권 정산 실패 ${JSON.stringify({ requestId, path, status: res.status })}`);
      return false;
    }
    // 환불은 백엔드가 거절할 수 있다(답 중간 끊김의 하루 한도) — data:false 면 돌려주지 않은 것이다
    if (path === "refund") {
      const json = await res.json().catch(() => null);
      return json?.data !== false;
    }
    return true;
  } catch (err) {
    // 원장 확정 실패는 사용자 응답을 망치지 않는다. 동일 requestId 재전송은 백엔드에서 안전하다.
    console.error(`[fortune-ai] 질문권 정산 실패 ${JSON.stringify({ requestId, path, error: describe(err).slice(0, 200) })}`);
    return false;
  }
}

/**
 * 오류로 끝난 호출을 정산한다.
 *
 * 질문권 1회는 **질문과 그 답변 한 벌**이다. 답을 받다 연결이 끊기면(다 받지 못했으면) 돌려준다.
 * 다만 무한히 돌려주면 답을 거의 다 받은 뒤 탭을 닫는 식으로 공짜 호출을 만들 수 있어,
 * 하루 두 번까지만 돌려주고(백엔드 MID_ANSWER_REFUNDS_PER_DAY) 넘으면 사용으로 확정한다.
 * 제공자 오류처럼 사용자가 만들 수 없는 실패는 늘 환불한다.
 * @returns 환불했으면 true
 */
async function settleFailure(req: Request, requestId: string | null, tier: Tier, meta: CallMeta, err: unknown,
  clientGone: boolean, deliveredChars: number, usage: CallUsage, requestedAt: Date) {
  if (!requestId) return false;
  if (clientGone && deliveredChars > 0) {
    const refunded = await settleCredit(req, requestId, "refund", { errorType: "CLIENT_ABORTED_MID_ANSWER" });
    if (refunded) return true;
    console.info(`[fortune-ai] 연결 끊김 — 오늘 돌려줄 한도를 넘어 사용 확정 ${JSON.stringify({ requestId, tier, deliveredChars })}`);
    await finishCall(req, requestId, tier, meta, usage, requestedAt);
    return false;
  }
  logFailure(clientGone ? "연결 끊김(답 전)" : "AI 호출", requestId, tier, err);
  return settleCredit(req, requestId, "refund", { errorType: (clientGone ? "CLIENT_ABORTED_BEFORE_ANSWER" : describe(err)).slice(0, 120) });
}

/** 호출 한 번을 설명하는 값. 사용량 로그에 같이 남겨 나중에 원가를 질문 유형별로 본다 */
type CallMeta = {
  sessionId: string | null;
  questionCategory: string | null;
  detailLevel: DetailLevel;
  contextChars: number;
  focusChars: number;
  historyMessageCount: number;
  summarizedTurns: number;
};
type CallUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; cacheWrite1hTokens: number };
const ZERO_USAGE: CallUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cacheWrite1hTokens: 0 };

/**
 * 호출이 끝나면 사용량을 남긴다.
 *
 * - 서버 로그 한 줄은 로그인 검사를 꺼 둔 환경에서도 남는다.
 * - 원가(달러)는 여기서 계산하지 않는다. 백엔드 AiCostCalculator 한 곳에서만 계산해
 *   ai_usage_records 에 저장한다. 가격이 바뀌면 거기만 고친다.
 */
async function finishCall(req: Request, requestId: string | null, tier: Tier, meta: CallMeta, usage: CallUsage, requestedAt: Date) {
  const { provider, model } = TIERS[tier];
  const durationMs = Date.now() - requestedAt.getTime();
  console.info("[fortune-ai] usage " + JSON.stringify({
    tier, provider, model, ...meta, ...usage,
    totalTokens: usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens,
    durationMs,
  }));
  if (requestId) {
    await settleCredit(req, requestId, "complete", {
      model, ...usage, ...meta,
      requestedAt: requestedAt.toISOString().slice(0, 19), durationMs,
    });
  }
}

async function streamOpenAi(req: Request, apiKey: string, tier: Tier, messages: { role: "user" | "assistant" | "system"; content: string }[], system: string, requestId: string | null, requestedAt: Date, remaining: number | null, meta: CallMeta) {
  const model = TIERS[tier].model;
  // 사용자가 연결을 끊으면 제공자 호출도 끊는다(비용 절감). 끊긴 것은 정산에서 따로 다룬다
  const upstream = new AbortController();
  let clientGone = false;
  const onClientAbort = () => { clientGone = true; upstream.abort(); };
  req.signal?.addEventListener("abort", onClientAbort);
  let response: Response;
  try {
    response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true, stream_options: { include_usage: true }, max_completion_tokens: 4000, messages: [{ role: "system", content: system }, ...messages] }),
      signal: AbortSignal.any([upstream.signal, AbortSignal.timeout(300_000)]),
    });
  } catch (err) {
    const refunded = await settleFailure(req, requestId, tier, meta, err, clientGone, 0, ZERO_USAGE, requestedAt);
    return Response.json({ error: publicError(err, refunded) }, { status: 502 });
  }
  if (!response.ok || !response.body) {
    const error = new Error(`OpenAI ${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`);
    const refunded = await settleFailure(req, requestId, tier, meta, error, false, 0, ZERO_USAGE, requestedAt);
    return Response.json({ error: publicError(error, refunded) }, { status: 502 });
  }
  const inputChars = system.length + messages.reduce((n, m) => n + m.content.length, 0);
  const body = new ReadableStream({ async start(controller) {
    const reader = response.body!.getReader(); const decoder = new TextDecoder(); let buffer = ""; let usage: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } | null = null;
    let delivered = 0;
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const sseLine of lines) { if (!sseLine.startsWith("data: ")) continue; const data = sseLine.slice(6); if (data === "[DONE]") continue; try { const event = JSON.parse(data); const text = event.choices?.[0]?.delta?.content; if (text) { safeEnqueue(controller, { t: text }); delivered += text.length; } if (event.usage) usage = event.usage; } catch { /* partial provider event */ } }
      }
      if (clientGone) throw new Error("client aborted");
      if (!usage) throw new Error("OpenAI 사용량 정보를 받지 못했습니다.");
      // OpenAI 의 prompt_tokens 는 캐시에서 읽은 것까지 포함한다. Anthropic 과 같은 뜻(캐시 밖 입력)으로 맞춰 저장한다
      const cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
      await finishCall(req, requestId, tier, meta, { inputTokens: Math.max(0, (usage.prompt_tokens ?? 0) - cachedTokens), outputTokens: usage.completion_tokens ?? 0, cacheReadTokens: cachedTokens, cacheWriteTokens: 0, cacheWrite1hTokens: 0 }, requestedAt);
      safeEnqueue(controller, { done: true, usage: { input: Math.max(0, (usage.prompt_tokens ?? 0) - cachedTokens), output: usage.completion_tokens ?? 0, cacheRead: cachedTokens, cacheWrite: 0, ...(remaining === null ? {} : { remaining }) } });
    } catch (err) {
      // 끊긴 호출은 제공자 사용량을 못 받는다. 원가 기록용으로 글자 수에서 어림한다
      const refunded = await settleFailure(req, requestId, tier, meta, err, clientGone, delivered,
        { inputTokens: approxTokens(inputChars), outputTokens: approxTokens(delivered), cacheReadTokens: 0, cacheWriteTokens: 0, cacheWrite1hTokens: 0 }, requestedAt);
      safeEnqueue(controller, { error: publicError(err, refunded) });
    }
    finally { req.signal?.removeEventListener("abort", onClientAbort); safeClose(controller); }
  }, cancel() { onClientAbort(); } });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (AI_DISABLED || !apiKey) {
    if (!apiKey) console.error("[fortune-ai] ANTHROPIC_API_KEY 미설정");
    return Response.json(
      { error: "AI 풀이를 잠시 쉬고 있습니다. 명반 계산은 그대로 쓸 수 있고, 질문권은 차감되지 않았습니다." },
      { status: 503 }
    );
  }

  // 같은 사이트에서 온 요청만 받는다. host 부분 문자열 비교는 evil-example.com도 통과시키므로
  // URL의 origin을 정확히 비교한다.
  const origin = req.headers.get("origin") ?? "";
  const host = req.headers.get("host") ?? "";
  const expectedOrigin = host ? `https://${host}` : "";
  if (origin && origin !== expectedOrigin && !(host.startsWith("localhost") && origin === `http://${host}`)) {
    return Response.json({ error: "허용되지 않은 출처입니다." }, { status: 403 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return Response.json(
      { error: "요청이 너무 잦습니다. 잠시 뒤에 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  // intent — 화면(router.js)이 읽은 질문 분석. 브라우저 값이라 prompt.ts 가 허용 목록으로 거른다
  let body: { context?: string; focus?: string | null; messages?: { role: string; content: string }[]; tier?: Tier; sessionId?: string; category?: string; intent?: Intent };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "본문을 읽지 못했습니다." }, { status: 400 });
  }

  const context = String(body.context ?? "");
  // 운세 AI 는 Claude 심층(Opus) 하나로 고정한다 — 고르는 칸을 없앴고, 무엇을 보내도 이 모델로 답한다
  const tier = "CLAUDE_OPUS" as Tier;
  const tierConfig = TIERS[tier];
  const focus = body.focus ? String(body.focus) : "";
  const raw = Array.isArray(body.messages) ? body.messages : [];
  if (!context || raw.length === 0) {
    return Response.json({ error: "명반 데이터와 질문이 필요합니다." }, { status: 400 });
  }
  if (context.length > MAX_CONTEXT_CHARS) {
    return Response.json({ error: "명반 데이터가 너무 큽니다." }, { status: 413 });
  }
  if (focus.length > MAX_FOCUS_CHARS) {
    return Response.json({ error: "고해상도 계산 데이터가 너무 큽니다." }, { status: 413 });
  }

  const messages = raw
    .slice(-MAX_MESSAGES)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content),
    }));

  const tooLong = messages.find((m) => m.content.length > MAX_QUESTION_CHARS);
  if (tooLong) {
    return Response.json(
      { error: `질문이 너무 깁니다. ${MAX_QUESTION_CHARS.toLocaleString()}자 안으로 줄여 주세요 (지금 ${tooLong.content.length.toLocaleString()}자).` },
      { status: 400 }
    );
  }

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "마지막은 사용자 질문이어야 합니다." }, { status: 400 });
  }

  if (context.length + focus.length + messages.reduce((n, m) => n + m.content.length, 0) > MAX_TOTAL_CHARS) {
    return Response.json({ error: "대화가 너무 길어졌습니다. 새 상담으로 이어서 물어봐 주세요." }, { status: 413 });
  }

  // 계산은 비회원도 무료지만, 외부 모델 호출은 로그인 계정의 월 한도에서만 쓸 수 있다.
  // 지금은 꺼 둔다. 켜려면 Vercel 환경변수 FORTUNE_AI_REQUIRE_LOGIN 을 1 로 두면 된다.
  // (자바 쪽 POST /api/fortune-ai/reservations 는 그대로 살아 있다.)
  let remaining: number | null = null;
  let creditRequestId: string | null = null;
  const requestedAt = new Date();
  if (REQUIRE_LOGIN) {
    creditRequestId = crypto.randomUUID();
    const reservation = await reserveCredit(req, creditRequestId, tier);
    if ("error" in reservation) {
      return Response.json({ error: reservation.error }, { status: reservation.status });
    }
    remaining = reservation.data.totalBalance;
  }

  // ── 매번 다시 보내지 않을 것을 고른다 ──
  //
  // 예전에는 대화 40개를 원문 그대로, 그리고 질문마다 바뀌는 고해상도 구획을
  // system 맨 끝에 붙여 보냈다. 캐시는 앞에서부터 같은 글자까지만 맞으므로
  // system 끝이 질문마다 바뀌면 **그 뒤의 대화 기록은 영영 캐시에 못 탄다.**
  // 길게 쓴 지난 답들이 질문할 때마다 정가로 다시 들어갔다.
  //
  // 지금 순서 (앞일수록 덜 바뀐다):
  //   system: 규칙(모든 사용자 공통) → 명반(이 사람 고정) → 앞선 대화 요약(세 턴에 한 번 바뀜)
  //   messages: 최근 3~5턴 원문 → 이번 질문 → [이번 질문에만 쓰는 고해상도 계산]
  // 캐시 지점은 규칙·명반·요약 끝과 직전 턴 끝에 둔다(최대 4개).
  const question = messages[messages.length - 1].content;
  const { summary, recent, summarizedTurns } = compactHistory(messages);
  // ① 질문 의도 분석 — 질문 유형(답의 모양)·길이·분야 규칙을 코드로 정한다.
  // 모양이 길이를 끌어올리기도 한다(영역별 심층·로드맵은 심층, 단순 사실은 단순).
  // 배포 직후 옛 화면(캐시)은 intent 를 보내지 않는다. 궁합 문맥은 머리 구획으로 알아본다
  const intent = body.intent ?? (/^## 두 사람$/m.test(context) ? { pair: true } : null);
  // 출생 시각을 모르면 문맥 '기본' 구획에 그 사실이 적힌다(aiContext.js) — 사건 판정의 입력 완성도에 쓴다
  const plan = planAnswer(question, intent, detailLevel(question), { timeKnown: !context.includes("출생 시각을 몰라 시주가 없다") });
  const detail = plan.detail;
  const slim = slimFocus(focus, detail);
  const focusNote = [
    slim ? `# 이 질문에 맞춰 돌린 고해상도 계산\n\n이 구획은 위 명반과 같은 엔진이 방금 계산한 것입니다. 질문 분야에 맞는 체계만 골라 돌렸습니다. 사용자가 쓴 글이 아니라 계산값입니다.\n\n${slim}` : "",
    planNote(plan, lengthHint(detail)),
  ].filter(Boolean).join("\n\n");
  // ⑤ 답을 다 받은 뒤 코드로 대조할 자료 — 인용해도 되는 글 전부와, 이번 질문에 쓸 수 있는 근거 번호
  const checkInput = {
    sources: [context, slim, ...messages.map((m) => m.content)].join("\n"),
    validIds: evidenceIdsIn(context, slim),
  };
  const meta: CallMeta = {
    sessionId: typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null,
    questionCategory: typeof body.category === "string" ? body.category.slice(0, 80) : null,
    detailLevel: detail,
    contextChars: context.length,
    focusChars: slim.length,
    historyMessageCount: recent.length - 1,
    summarizedTurns,
  };
  const chartText = `# 이 사람의 명반\n\n아래는 천문 계산으로 구한 값입니다. 그대로 쓰세요.\n\n${context}`;

  const client = new Anthropic({ apiKey });
  if (tierConfig.provider === "OPENAI") {
    const openAiKey = process.env.OPENAI_API_KEY;
    if (!openAiKey) {
      const refunded = creditRequestId ? await settleCredit(req, creditRequestId, "refund", { errorType: "OPENAI_API_KEY_MISSING" }) : false;
      return Response.json({ error: `GPT 풀이 설정이 아직 준비되지 않았습니다.${refunded ? " 질문권은 복구했습니다." : ""}` }, { status: 503 });
    }
    // OpenAI 도 앞에서부터 같은 글자를 자동으로 캐시한다. 순서를 같게 맞춰 둔다
    const system = [SYSTEM, chartText, summary].filter(Boolean).join("\n\n");
    const openAiMessages = focusNote ? [...recent, { role: "system" as const, content: focusNote }] : recent;
    return streamOpenAi(req, openAiKey, tier, openAiMessages, system, creditRequestId, requestedAt, remaining, meta);
  }

  // 직전 턴 끝에 캐시 지점을 단다. 다음 질문 때 여기까지가 그대로 읽힌다
  const anthropicMessages: Anthropic.MessageParam[] = recent.map((m, i) =>
    i === recent.length - 2
      ? { role: m.role, content: [{ type: "text" as const, text: m.content, cache_control: cached }] }
      : m
  );
  // 고해상도 계산과 길이 지시는 질문 **뒤의** system 메시지로 붙인다.
  // 운영자 쪽 자료라는 것이 분명하고, 캐시되는 앞부분을 건드리지 않는다.
  if (focusNote) anthropicMessages.push({ role: "system", content: focusNote });

  // stream() 은 요청을 바로 띄운다. 그 약속이 for-await 에 붙기 전에
  // 거절되면 처리되지 않은 거절이 되어 함수가 통째로 죽고, 단서 없는 500 이
  // 나간다 (그러면 Vercel 이 오류 페이지를 렌더하다 백엔드를 부르는 바람에
  // 로그에는 엉뚱하게 백엔드 타임아웃만 남는다). 그래서 만들자마자 잡아둔다.
  let stream: ReturnType<typeof client.messages.stream>;
  try {
    stream = client.messages.stream({
      model: tierConfig.model,
      // 사고는 심층 풀이와 "자세히"에만 — 균형 풀이의 짧은 답에는 사고 토큰(출력 단가)이 비용만 늘렸다
      // Opus 5.5 는 사고를 끌 수 없다({type:"disabled"}는 400). 깊이(effort)만 낮출 수 있고,
      // 사고 토큰도 max_tokens 안에 들어가므로 상한은 사고 몫까지 넉넉히 잡는다.
      // 예전에 상한을 답 길이만큼(4천)만 두었더니 사고가 다 써 버려 45초 뒤 빈 답이 났다(스테이징 2026-10-13).
      max_tokens: THINKING_BUDGET[detail],
      output_config: { effort: wantsThinking(tier, detail) ? "medium" as const : "low" as const },
      system: [
        // 규칙은 모든 사용자가 같다. 따로 캐시 지점을 두면 처음 묻는 사람도
        // 다른 사람이 데워 둔 규칙을 읽어 간다 (예전에는 명반과 한 덩이라 사람마다 새로 썼다)
        { type: "text", text: SYSTEM, cache_control: cached },
        // 명반은 한 사람에 대해 고정이라, 질문을 여러 번 던져도 앞부분은 그대로다.
        { type: "text", text: chartText, cache_control: cached },
        ...(summary ? [{ type: "text" as const, text: summary, cache_control: cached }] : []),
      ],
      messages: anthropicMessages,
    });
  } catch (err) {
    const refunded = await settleFailure(req, creditRequestId, tier, meta, err, false, 0, ZERO_USAGE, requestedAt);
    return Response.json({ error: publicError(err, refunded) }, { status: 502 });
  }

  // 사용자가 연결을 끊었는지. 정산(환불이냐 사용 확정이냐)을 가르는 데 쓴다
  let clientGone = false;
  let delivered = 0;
  let answer = "";
  const onClientAbort = () => { clientGone = true; stream.abort(); };
  req.signal?.addEventListener("abort", onClientAbort);

  // 소비하기 전에 거절되어도 처리되지 않은 거절이 되지 않도록 미리 붙인다.
  // 실제 오류는 아래 for-await 에서 다시 잡혀 사용자에게 전달된다.
  let early: unknown = null;
  stream.on("error", (e: unknown) => { early = e; });

  const body$ = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            safeEnqueue(controller, { t: event.delta.text });
            delivered += event.delta.text.length;
            answer += event.delta.text;
          }
        }
        if (clientGone) throw new Error("client aborted");
        const final = await stream.finalMessage();
        const check = logCheck(creditRequestId, plan, answer, checkInput);
        // 글이 한 자도 나오지 않았으면(사고만 하다 상한에 걸린 경우 등) 실패로 보고 질문권을 돌려준다 —
        // 예전에는 "답이 길어 끊겼다"는 안내 한 줄만 나가고 질문권은 쓰인 것으로 처리됐다
        if (delivered === 0 && final.stop_reason !== "refusal") throw new Error(`EMPTY_ANSWER (${final.stop_reason})`);
        await finishCall(req, creditRequestId, tier, meta, {
          inputTokens: final.usage.input_tokens,
          outputTokens: final.usage.output_tokens,
          cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: final.usage.cache_creation_input_tokens ?? 0,
          // 1시간 캐시 쓰기는 5분 캐시보다 비싸다(2배 vs 1.25배). 원가를 맞게 내려면 따로 넘겨야 한다
          cacheWrite1hTokens: final.usage.cache_creation?.ephemeral_1h_input_tokens ?? 0,
        }, requestedAt);

        if (final.stop_reason === "refusal") {
          safeEnqueue(controller, { error: "이 질문에는 답하기 어렵습니다. 다르게 물어봐 주세요." });
        }
        // 길이에 걸려 잘리면 조용히 끊기지 않게 알려준다. 문장 중간에서
        // 멈춘 글을 아무 말 없이 보여주면 고장난 것처럼 보인다.
        if (final.stop_reason === "max_tokens") {
          safeEnqueue(controller, { t: "\n\n…(답이 길어 여기서 끊겼습니다. 나눠서 물어보시면 끝까지 답해 드립니다.)" });
        }
        safeEnqueue(controller, {
          done: true,
          usage: {
            input: final.usage.input_tokens,
            output: final.usage.output_tokens,
            cacheRead: final.usage.cache_read_input_tokens ?? 0,
            cacheWrite: final.usage.cache_creation_input_tokens ?? 0,
            ...(remaining === null ? {} : { remaining }),
          },
          // 이번 답의 설계와 코드 검증에 걸린 것(종류별 개수). 화면은 같은 규칙으로 이미 고쳐 그렸다
          plan: { shape: plan.shape, detail: plan.detail },
          check,
        });
      } catch (err) {
        // 끊긴 호출은 최종 사용량이 없다. 시작 때 받은 입력·캐시 토큰은 그대로 쓰고 출력은 받아 간 글자로 어림한다
        const u = stream.currentMessage?.usage;
        const refunded = await settleFailure(req, creditRequestId, tier, meta, early ?? err, clientGone, delivered, {
          inputTokens: u?.input_tokens ?? 0,
          outputTokens: Math.max(u?.output_tokens ?? 0, approxTokens(delivered)),
          cacheReadTokens: u?.cache_read_input_tokens ?? 0,
          cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
          cacheWrite1hTokens: u?.cache_creation?.ephemeral_1h_input_tokens ?? 0,
        }, requestedAt);
        safeEnqueue(controller, { error: publicError(early ?? err, refunded) });
      } finally {
        req.signal?.removeEventListener("abort", onClientAbort);
        safeClose(controller);
      }
    },
    cancel() {
      onClientAbort();
    },
  });

  return new Response(body$, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
