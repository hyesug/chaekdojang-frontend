/**
 * answerCheck.js — AI 답을 보여 주기 전에 코드로 확인한다 (근거·일관성 검증)
 *
 * "검증하라"고 지시만 하면 모델은 검증한 척만 한다. 확인할 수 있는 것은 코드가 확인한다.
 * 답마다 검증용 AI 호출을 더하지 않는다 — 문맥(명반·질문별 계산·질문·대화)과 대조하는
 * 규칙 검사만 하고, 바로잡을 수 있는 것은 바로잡고 나머지는 기록만 한다.
 *
 * 바로잡는 것 (화면·저장 모두 고친 글을 쓴다)
 *   - 문맥에 없는 근거 번호([ZW99])를 지운다. 모델이 이름표 꼴(⟦…⟧)을 직접 쓰면 평문으로 푼다.
 *   - 문맥 어디에도 없는 연도·확률(%)·분할도(D번호)를 쓴 문장을 뺀다 — 계산 없는 날짜·확률은 창작이다.
 *   - 질병·사고·이혼·파산·합격·복권 당첨·자녀 성별을 확정하는 문장을 뺀다.
 *   - "반드시·무조건·틀림없이"를 지우고, 똑같은 문장이 되풀이되면 뒤엣것을 뺀다.
 * 기록만 하는 것 (서버 로그로 모아 지시문을 고칠 근거로 쓴다)
 *   - 서론으로 시작, 결론이 맨 앞에 없음, 긴 문단, 길이 벗어남, 내부 용어 노출,
 *     묻지 않은 달, 조심 문구 반복, [이어서 물어보기] 빠짐.
 *
 * 화면(ai.js, 흘러오는 동안에도)과 서버(route.ts, 기록)가 같은 함수를 쓴다. DOM 없음.
 */
import { CHIP } from './evidence.js';

const ID = /\[([A-Z]{2}\d{1,3})\]/g;
const FOLLOW = '[이어서 물어보기]';

/** 문맥 글에 실린 근거 번호 */
export function evidenceIdsIn(...texts) {
  const ids = new Set();
  for (const t of texts) for (const m of String(t ?? '').matchAll(ID)) ids.add(m[1]);
  return ids;
}

// ── 문장을 통째로 빼는 규칙 ──
// 끝말이 단정인 것만 잡는다. "~할 수 있어요", "~일 가능성" 같은 말은 해당하지 않는다.
const MEDICAL = /(병|암|당뇨|고혈압|뇌졸중|심근경색|치매|우울증|디스크|질환|불임|난임)(에|이|을|를|가)?\s*(걸립니다|걸려요|걸릴 거예요|걸리게 돼요|걸리게 됩니다|생깁니다|생겨요|생길 거예요|옵니다|와요|올 거예요|발병합니다|발병해요)/;
const DEFINITE_EVENT = /(이혼|파산|사망|사고|부도)(을|를|이|가)?\s*(합니다|해요|할 거예요|하게 돼요|하게 됩니다|당합니다|당해요|당할 거예요|납니다|나요|날 거예요|겪습니다|겪어요|겪게 돼요|겪게 됩니다)/;
const DEFINITE_OUTCOME = /(합격|불합격|탈락|낙방)(합니다|해요|할 거예요|하게 돼요|하게 됩니다|입니다|이에요|예요|됩니다|돼요|할 겁니다)/;
const LOTTERY = /(로또|복권|1등).{0,20}(당첨(됩니다|돼요|될 거예요|될 겁니다|이에요|입니다)|됩니다|돼요|될 거예요)/;
const CHILD_GENDER = /(아들|딸)(을|를)?\s*(낳(습니다|아요|을 거예요|게 돼요|게 됩니다)|가지(게 돼요|게 됩니다|실 거예요))|(첫째|둘째|셋째|아이|자녀|태아)(는|가)\s*(아들|딸)(이에요|입니다|일 거예요|일 겁니다)/;
/**
 * 어느 결과에도 맞는 문장 — 사건 판정 지시(2026-11-03)의 금지 문장. 정보가 없어 빼도 뜻이 줄지 않는다.
 * "결혼하거나 헤어질 수 있다", "이직하거나 남을 수 있다", "좋은 변화가 온다", "돈 관리가 중요하다", "스트레스를 조심하라"
 */
// 양쪽을 다 열어 두는 "~거나 ~할 수 있다" 꼴만 잡는다 — "남는다면 ○○, 옮긴다면 ○○" 같은 조건부 판단은 그대로 둔다
const FILLER = [
  /(결혼|약혼|동거)(하거나|할 수도).{0,15}(헤어|이별|결별).{0,12}수\s?(있|도)/, /(헤어지거나|이별하거나).{0,15}(결혼|이어질).{0,12}수\s?(있|도)/,
  /(이직하거나|옮기거나|떠나거나).{0,15}(남|머무|유지).{0,12}수\s?(있|도)/, /(남거나|머물거나).{0,15}(이직|옮기|떠나).{0,12}수\s?(있|도)/,
  /좋은 변화가 (와요|옵니다|올 거예요|올 겁니다|찾아와요|찾아옵니다|생겨요|생깁니다|있을 거예요)/,
  /돈 관리가 (중요|필요|관건)/, /스트레스(를|에)?\s*(조심|주의)(하세요|하십시오|해야|하는 게)/,
];
const NEGATED = /않|아니|없|말아|마세요|말고|금물|단정할 수|알 수 없/;

// ── 지우기만 하는 낱말 ──
const ABSOLUTE = /(반드시|무조건|틀림없이|100\s?%\s?)\s*/g;

// ── 기록만 하는 것 ──
const JARGON = /Tier ?[SABC]\b|단언 등급|점유율|담당 체계|고해상도|문맥(에|의|상|에서)|구획|사건 후보|영역 활성도|계산되어 있지 않|판이 없/;
const PREAMBLE = /^(좋은 질문|명반을 (살펴|보면|보니)|살펴보겠|안녕하세요|네[,!.]|물론이)/;
const LEAD = /^#{2,3}\s*(핵심 결론|한 줄 결론|한마디로|결론)/;
const COMPLETENESS = /^\s*(\*\*)?입력 완성도(\*\*)?\s*[:：]/;
const DISCLAIMER = /확정된 미래|운세로 본 흐름|결과 보장|보장(하|되)지|의료진|진료가 우선|참고로만/g;
const MONTH = /(?<![\d.])\d{1,2}\s*월(?!\s*\d{1,2}\s*일)/;

/** 답 길이(이어서 물어보기 앞까지) 기대 범위 — conversation.ts 의 세 단계와 같은 눈금 */
const LENGTH = { short: [40, 700], normal: [400, 1900], long: [800, 3600] };

/** 줄 하나를 문장으로. 소수점(1.2°)에서 자르지 않게 마침표 뒤에 빈칸·끝이 올 때만 자른다 */
function sentences(s) {
  return String(s).split(/(?<=[.!?])(?=\s|$)/).filter((x) => x !== '');
}

/**
 * @param {string} text 모델이 쓴 답(흘러오는 중이어도 된다)
 * @param {object} o
 * @param {string} o.sources 답이 인용해도 되는 글 전부 — 명반 문맥·질문별 계산·질문·앞선 대화
 * @param {Set<string>} [o.validIds] 쓸 수 있는 근거 번호(없으면 sources 에서 뽑는다)
 * @param {boolean} [o.asksMonth] 질문이 달을 물었는가
 * @param {'short'|'normal'|'long'} [o.detail]
 * @param {string} [o.shape] 답의 모양(prompt.ts planAnswer) — 'fact' 는 소제목 없이 쓴다
 * @param {boolean} [o.final] 다 받은 답인가 — 빠진 블록·길이는 이때만 본다
 * @returns {{text: string, issues: {kind: string, fixed: boolean}[]}}
 */
export function checkAnswer(text, o = {}) {
  const sources = String(o.sources ?? '');
  const valid = o.validIds ?? evidenceIdsIn(sources);
  const issues = [];
  const note = (kind, fixed) => issues.push({ kind, fixed });
  const known = (token) => sources.includes(token);

  let t = String(text ?? '');
  // 모델이 이름표 꼴을 흉내 내면 확인되지 않은 근거가 확인된 것처럼 보인다 — 평문으로 푼다
  t = t.replace(CHIP, (_, label) => { note('forgedChip', true); return label; });
  t = t.replace(ID, (all, id) => { if (valid.has(id)) return all; note('unknownEvidence', true); return ''; });
  t = t.replace(ABSOLUTE, () => { note('absolute', true); return ''; });

  const at = t.lastIndexOf(FOLLOW);
  const body = at >= 0 ? t.slice(0, at) : t;
  const tail = at >= 0 ? t.slice(at) : '';

  const seen = new Set();
  const lines = body.split('\n').map((line) => {
    if (/^\s*#{1,6}\s/.test(line) || /^\s*\|?\s*:?-{3,}/.test(line)) return line;
    const table = /^\s*\|/.test(line);
    const m = line.match(/^(\s*(?:[-*•]|\d+[.)])\s+)?(.*)$/);
    const lead = m?.[1] ?? '';
    const kept = [];
    for (const s of sentences(m?.[2] ?? line)) {
      const why = dropReason(s, known);
      if (why && table) { note(why, true); return null; }        // 표는 그 행을 뺀다
      if (why) { note(why, true); continue; }
      const key = s.replace(/\s+/g, ' ').trim();
      if (!table && key.length >= 20 && seen.has(key)) { note('repeat', true); continue; }
      if (key.length >= 20) seen.add(key);
      kept.push(s);
    }
    let out = kept.join('').trim();
    if (!out && (m?.[2] ?? '').trim()) return null;               // 문장이 다 빠진 줄은 줄째 뺀다
    if ((out.match(/\*\*/g)?.length ?? 0) % 2) out = out.replace(/\*\*/g, '');
    return out ? lead + out : line.trim() ? null : '';
  }).filter((l) => l !== null);

  const clean = lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, '');
  audit(clean, tail, o, note);
  return { text: clean + (tail ? `${clean.endsWith('\n') ? '' : '\n\n'}${tail}` : ''), issues };
}

/** 문장을 빼야 하면 그 이유 */
function dropReason(s, known) {
  for (const m of s.matchAll(/(?<![\d.])(\d{1,3}(?:\.\d+)?)\s?(%|퍼센트|프로)/g)) {
    if (!known(`${m[1]}%`) && !known(`${m[1]} %`)) return 'unknownPercent';
  }
  if (/확률/.test(s) && /\d/.test(s) && !NEGATED.test(s)) return 'unknownPercent';
  for (const m of s.matchAll(/(?<!\d)((?:19|20)\d{2})(?!\d)/g)) if (!known(m[1])) return 'unknownYear';
  for (const m of s.matchAll(/(?<![A-Za-z])D-?(\d{1,2})(?!\d)/g)) if (!known(`D${m[1]}`)) return 'unknownChart';
  if (NEGATED.test(s)) return null;
  if (MEDICAL.test(s)) return 'medicalClaim';
  if (DEFINITE_EVENT.test(s)) return 'definiteEvent';
  if (DEFINITE_OUTCOME.test(s)) return 'definiteOutcome';
  if (LOTTERY.test(s)) return 'lottery';
  if (CHILD_GENDER.test(s)) return 'childGender';
  if (FILLER.some((re) => re.test(s))) return 'filler';
  return null;
}

/** 고치지 않고 기록만 하는 모양 검사 */
function audit(body, tail, o, note) {
  const lines = body.split('\n').filter((l) => l.trim());
  // 사건 판정은 첫 줄에 입력 완성도가 오고 그다음이 결론이다
  const event = o.shape === 'event';
  const first = (event && COMPLETENESS.test(lines[0] ?? '') ? lines[1] : lines[0]) ?? '';
  if (PREAMBLE.test(first.replace(/^#+\s*/, ''))) note('preamble', false);
  // 단순 사실 답은 소제목 없이 결론부터라 이 검사에서 뺀다
  if ((o.detail ?? 'normal') !== 'short' && o.shape !== 'fact' && first && !LEAD.test(first.trim())) note('noLead', false);
  if (event && o.final) {
    if (!COMPLETENESS.test(lines[0] ?? '')) note('noCompleteness', false);
    if (!/리딩 신뢰도/.test(body)) note('noConfidence', false);
    if (!/^\s*\|.*\|\s*$/m.test(body)) note('noTable', false);
    if (/(\d{1,3})\s?%\s*(확률|가능성)|확률(은|이)?\s*\d/.test(body)) note('percentConfidence', false);
  }
  if (JARGON.test(body)) note('jargon', false);
  if (!o.asksMonth && MONTH.test(body)) note('monthNotAsked', false);
  if ((body.match(DISCLAIMER)?.length ?? 0) > 2) note('disclaimers', false);
  const paras = body.split(/\n{2,}/).filter((p) => !/^\s*(\||[-*•]|\d+[.)]|#)/.test(p));
  if (paras.some((p) => p.replace(/\s+/g, '').length > 400)) note('longParagraph', false);
  if (!o.final) return;
  if (!tail) note('noFollowUps', false);
  const [lo, hi] = LENGTH[o.detail ?? 'normal'] ?? LENGTH.normal;
  const len = body.replace(/\s+/g, '').length;
  if (len < lo || len > hi) note('length', false);
}

/** 기록용 — 종류별 개수 */
export function issueSummary(issues) {
  const out = {};
  for (const i of issues ?? []) out[i.kind] = (out[i.kind] ?? 0) + 1;
  return out;
}
