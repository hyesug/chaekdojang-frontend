/**
 * 운세 AI 대화 정리 — route.ts 가 모델에 보내기 전에 쓰는 순수 함수들
 *
 * 비싼 모델에 같은 글자를 반복해서 보내지 않기 위한 장치다. 모델 호출은
 * 하지 않는다 (요약도 코드가 원문에서 뽑는다). 그래서 결과가 늘 같고,
 * 같은 대화에서는 요약 글자가 바뀌지 않아 프롬프트 캐시가 깨지지 않는다.
 *
 * Node 의 타입 제거만으로 돌아가야 테스트(node --test)가 바로 불러 쓸 수 있다.
 * enum·매개변수 프로퍼티처럼 지워지지 않는 문법은 쓰지 않는다.
 */

export type Turn = { role: "user" | "assistant"; content: string };

/**
 * 몇 턴까지 원문을 그대로 보낼지.
 *
 * - 이전 턴이 FULL_UP_TO 개 이하면 요약하지 않는다.
 * - 넘으면 오래된 턴을 CHUNK 개씩 묶어 요약으로 접는다. 한 턴마다 한 칸씩
 *   밀어 접으면 요약 글자가 매 질문 바뀌어 캐시가 매번 깨진다. 묶어서 접으면
 *   요약은 세 턴에 한 번만 바뀐다.
 * - 원문으로 남는 최근 턴은 MIN_RECENT ~ MIN_RECENT+CHUNK-1 개다 (3~5턴).
 */
export const HISTORY = { FULL_UP_TO: 6, CHUNK: 3, MIN_RECENT: 3 } as const;

/** 요약에 싣는 질문·결론 길이. 결론 문단 하나면 충분하다 (시스템 프롬프트가 결론을 맨 앞에 쓰게 한다) */
const QUESTION_CAP = 400;
const CONCLUSION_CAP = 600;
const ANCHOR_CAP = 12;

/** 사용자·답 메시지를 (질문, 답) 턴으로 묶는다. 답이 없는 질문도 한 턴이다 */
export function toTurns(messages: Turn[]): Turn[][] {
  const turns: Turn[][] = [];
  for (const m of messages) {
    if (m.role === "user" || turns.length === 0) turns.push([m]);
    else turns[turns.length - 1].push(m);
  }
  return turns;
}

function clip(text: string, cap: number) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= cap) return t;
  // 문장 끝에서 자른다. 반쪽 문장은 뜻이 뒤집힐 수 있다
  const cut = t.slice(0, cap);
  const end = Math.max(cut.lastIndexOf("다. "), cut.lastIndexOf(". "), cut.lastIndexOf("요. "));
  return (end > cap * 0.5 ? cut.slice(0, end + 1) : cut) + " …";
}

/**
 * 답의 첫 결론 문단.
 *
 * 시스템 프롬프트가 "첫 문장이 곧 답, 결론 먼저"를 요구하므로 소제목을 건너뛴
 * 첫 문단들이 그 답의 결론이다. 200자가 안 되면 다음 문단까지 붙인다.
 */
export function conclusionOf(answer: string) {
  const paras = answer
    .split(/\n{2,}/)
    .map((p) => p.split("\n").filter((l) => !/^\s*#{1,6}\s/.test(l)).join(" ").trim())
    .filter((p) => p && !/^[-*_]{3,}$/.test(p));
  let out = "";
  for (const p of paras) {
    out = out ? `${out} ${p}` : p;
    if (out.length >= 200) break;
  }
  return clip(out.replace(/\*\*/g, ""), CONCLUSION_CAP);
}

/**
 * 답에 나온 시기. "아까 말한 시기"가 요약 너머로 사라지지 않게 따로 뽑는다.
 * 해(+상·하반기·달), 달 범위, 날짜를 원문 그대로 모은다.
 */
export function timeAnchorsOf(answer: string) {
  const re = /(?:19|20)\d{2}\s*년(?:\s*(?:상반기|하반기|초|말|봄|여름|가을|겨울|\d{1,2}\s*(?:~\s*\d{1,2}\s*)?월(?:\s*\d{1,2}\s*일)?))?|(?:19|20)\d{2}\s*~\s*(?:19|20)?\d{2,4}\s*년?|\d{1,2}\s*~\s*\d{1,2}\s*월|\d{1,2}\s*월\s*\d{1,2}\s*일(?:\s*\([월화수목금토일]\))?|\d{2}\s*대/g;
  const seen = new Set<string>();
  for (const m of answer.matchAll(re)) {
    const v = m[0].replace(/\s+/g, " ").trim();
    if (!seen.has(v)) seen.add(v);
    if (seen.size >= ANCHOR_CAP) break;
  }
  return [...seen];
}

/** 접힌 턴들을 요약 글로. 같은 입력이면 늘 같은 글자가 나온다 (캐시) */
export function summarize(turns: Turn[][]) {
  const lines = [
    "# 앞선 대화 요약",
    "",
    "아래는 이 상담에서 이미 오간 질문과, 각 답의 첫 결론 문단·그 답에 나온 시기를 코드가 원문에서 그대로 뽑은 것입니다.",
    "여기 결론과 시기는 이미 사용자에게 말한 내용입니다. 사용자가 \"아까\", \"그때\", \"그 사람\"이라고 하면 이 요약과 이어지는 대화에서 찾고, 앞서 한 결론과 어긋나게 말하려면 왜 달라졌는지 밝히세요.",
    "",
  ];
  turns.forEach((turn, i) => {
    const q = turn.find((m) => m.role === "user")?.content ?? "";
    const a = turn.filter((m) => m.role === "assistant").map((m) => m.content).join("\n\n");
    lines.push(`${i + 1}. 질문: ${clip(q, QUESTION_CAP)}`);
    if (a) {
      lines.push(`   결론: ${conclusionOf(a)}`);
      const anchors = timeAnchorsOf(a);
      if (anchors.length) lines.push(`   답에 나온 시기: ${anchors.join(", ")}`);
    }
  });
  return lines.join("\n");
}

/**
 * 이전 대화를 "요약 + 최근 몇 턴 원문 + 이번 질문"으로 나눈다.
 *
 * @param messages 마지막이 이번 질문(user)인 전체 대화
 */
export function compactHistory(messages: Turn[]) {
  const prior = toTurns(messages.slice(0, -1));
  const current = messages[messages.length - 1];
  const t = prior.length;
  const folded = t <= HISTORY.FULL_UP_TO
    ? 0
    : Math.floor((t - HISTORY.MIN_RECENT) / HISTORY.CHUNK) * HISTORY.CHUNK;
  const recent = [...prior.slice(folded).flat(), current];
  // 상한(40개)에서 잘려 답으로 시작하면 API 가 받지 않는다. 질문 없는 답은 뗀다
  while (recent.length > 1 && recent[0].role === "assistant") recent.shift();
  return {
    summary: folded ? summarize(prior.slice(0, folded)) : null,
    recent,
    summarizedTurns: folded,
  };
}

export type DetailLevel = "short" | "normal" | "long";

/**
 * 질문이 원하는 답 길이.
 *
 * 길이를 정하는 것은 사실상 지시문이다. max_tokens 는 생성된 만큼만 값을 내므로
 * 낮춘다고 돈이 줄지 않고, 닿으면 답이 잘릴 뿐이다. 그래서 짧은 답을 원할 때만
 * 짧게 쓰라고 말하고 상한도 같이 낮춘다. 나머지는 기존 규칙(넓게 물을 때만 길게)을 그대로 따른다.
 */
export function detailLevel(question: string): DetailLevel {
  const q = String(question ?? "");
  if (/한 ?줄|한 ?마디|한 ?문장|짧게|간단히|간단하게|간략|핵심만|요약해/.test(q)) return "short";
  if (/자세히|자세하게|상세|구체적으로|낱낱이|하나하나|연도별|해마다|비교|전체 ?풀이|평생|인생|일생|\d0대부터/.test(q)) return "long";
  return "normal";
}

/**
 * max_tokens — 응답 상한.
 *
 * 적응형 사고(adaptive thinking)의 사고 토큰도 이 안에 들어가므로 너무 낮추면
 * 생각하다 잘린다. short 도 넉넉히 둔다. long 은 기존 값 그대로다.
 */
export const OUTPUT_BUDGET: Record<DetailLevel, number> = {
  short: 8_000,
  normal: 16_000,
  long: 32_000,
};

/** 짧은 답을 원할 때만 붙이는 한 줄. 나머지 길이 규칙은 시스템 프롬프트가 이미 갖고 있다 */
export function lengthHint(level: DetailLevel) {
  return level === "short"
    ? "이번 질문은 짧은 답을 원합니다. 결론을 1~3문장으로 말하고 가장 강한 근거 하나만 괄호로 답니다. 소제목·목록 없이 끝내세요."
    : "";
}
