import Anthropic from "@anthropic-ai/sdk";

/**
 * 종합 운세 — Claude 프록시
 *
 * public/unse-8f3k2m 의 정적 사이트가 부르는 엔드포인트다.
 * API 키를 브라우저에 내려보낼 수 없으므로 서버를 한 번 거친다.
 *
 * 경로를 /api 아래에 두지 않은 이유: next.config.ts 의 rewrite 가
 * /api/:path* 를 전부 자바 백엔드로 넘긴다. image-proxy, system-health 와
 * 같은 최상위 라우트로 둬야 한다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MODEL = "claude-opus-5";
const MAX_TOKENS = 16000;

/** 명반 데이터가 아무리 커도 이 정도면 넉넉하다 */
const MAX_CONTEXT_CHARS = 24_000;
const MAX_MESSAGES = 40;
const MAX_QUESTION_CHARS = 2_000;

/**
 * 시스템 프롬프트.
 *
 * 가장 중요한 규칙은 첫 번째다. 사주 간지와 절기는 이미 검증된 엔진이
 * 계산해서 넘겨준다. 언어 모델이 날짜 산술을 다시 하면 거의 틀리므로,
 * 주어진 값을 그대로 쓰게 못박아야 한다. 이 한 줄이 이 구조 전체의 이유다.
 */
const SYSTEM = `당신은 동양 명리와 서양 점성술을 두루 아는 상담자입니다.
사주·자미두수·점성술·베딕·주역·육임·홍국기문·태을신수·구성학·숙요·토정비결·카발라·마하보테·태국 점성술·타로 — 열다섯 체계의 계산 결과를 받아 사람에게 풀어 설명합니다.

## 반드시 지킬 것

1. **직접 계산하지 마세요.** 간지, 절기, 음력, 행성 위치, 대운은 이미 천문 계산으로 구해 아래에 드립니다. 주어진 값을 그대로 쓰세요. 날짜를 세거나 간지를 추론하려 하면 틀립니다. 데이터에 없는 값이 필요하면 "그 부분은 계산되어 있지 않다"고 말하세요.

2. **근거를 밝히세요.** "재물운이 좋습니다"가 아니라 "사주에서 정재가 세운에 들어오고, 홍국기문의 생문이 겹칩니다"처럼 어느 체계의 무엇을 보고 하는 말인지 쓰세요.

3. **갈리면 갈린다고 하세요.** 열다섯 체계가 늘 같은 말을 하지는 않습니다. 어긋날 때 한쪽으로 뭉개지 말고 "사주는 이렇게 보는데 베딕은 반대로 봅니다"라고 그대로 전하세요. 어느 쪽이 더 무게가 있는지 의견을 덧붙이는 건 좋습니다.

4. **단정하지 마세요.** "반드시", "틀림없이", "~하게 됩니다" 대신 "~한 결이 있습니다", "~하기 쉽습니다", "~로 봅니다"를 쓰세요. 운세는 예언이 아니라 경향입니다.

5. **겁주지 마세요.** 나쁜 배치도 사실대로 전하되, 무엇을 조심하면 되는지 실용적으로 씁니다. 건강·재물에 대해 공포를 조장하지 않습니다.

## 하지 말아야 할 것

- 의료·법률·투자에 대한 구체적 조언 (증상이 있으면 병원에 가시라고 하세요)
- 수명, 사망, 중병에 대한 단정
- 특정 종목·부동산·코인 추천
- 타인의 사생활 추정 ("배우자가 바람을 피웁니다" 같은 것)

## 말투와 길이

- 한국어 존댓말. 담백하고 구체적으로. 미사여구 없이.
- 일반 질문에는 3~6문단. 짧은 질문에는 짧게.
- 전체 풀이를 요청받으면 소제목을 넣어 길게 써도 좋습니다.
- 면책 문구는 매번 붙이지 마세요. 사이트에 이미 적혀 있습니다.
- 상대가 물은 것에 답하세요. 묻지 않은 영역까지 훑지 마세요.`;

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

function line(obj: unknown) {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "서버에 ANTHROPIC_API_KEY 가 설정되어 있지 않습니다." },
      { status: 503 }
    );
  }

  // 같은 사이트에서 온 요청만 받는다. 떠돌이 스캐너가 크레딧을 태우는 걸 막는 정도의 장치다.
  const origin = req.headers.get("origin") ?? "";
  const host = req.headers.get("host") ?? "";
  if (origin && !origin.includes(host)) {
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

  let body: { context?: string; messages?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "본문을 읽지 못했습니다." }, { status: 400 });
  }

  const context = (body.context ?? "").slice(0, MAX_CONTEXT_CHARS);
  const raw = Array.isArray(body.messages) ? body.messages : [];
  if (!context || raw.length === 0) {
    return Response.json({ error: "명반 데이터와 질문이 필요합니다." }, { status: 400 });
  }

  const messages = raw
    .slice(-MAX_MESSAGES)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content).slice(0, MAX_QUESTION_CHARS),
    }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "마지막은 사용자 질문이어야 합니다." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    // 명반은 한 사람에 대해 고정이라, 질문을 여러 번 던져도 앞부분은 그대로다.
    // 캐시에 태워 두면 두 번째 질문부터 입력 비용이 크게 줄어든다.
    system: [
      { type: "text", text: SYSTEM },
      {
        type: "text",
        text: `# 이 사람의 명반\n\n아래는 천문 계산으로 구한 값입니다. 그대로 쓰세요.\n\n${context}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });

  const body$ = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(line({ t: event.delta.text }));
          }
        }
        const final = await stream.finalMessage();

        if (final.stop_reason === "refusal") {
          controller.enqueue(
            line({ error: "이 질문에는 답하기 어렵습니다. 다르게 물어봐 주세요." })
          );
        }
        controller.enqueue(
          line({
            done: true,
            usage: {
              input: final.usage.input_tokens,
              output: final.usage.output_tokens,
              cacheRead: final.usage.cache_read_input_tokens ?? 0,
              cacheWrite: final.usage.cache_creation_input_tokens ?? 0,
            },
          })
        );
      } catch (err) {
        const msg =
          err instanceof Anthropic.APIError
            ? `Claude API 오류 (${err.status}): ${err.message}`
            : err instanceof Error
              ? err.message
              : "알 수 없는 오류";
        controller.enqueue(line({ error: msg }));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
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
