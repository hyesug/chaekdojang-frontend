/**
 * scenario/question.js — **묻는 말을 공통 구조로 바꾼다**
 *
 * 낱말 몇 개의 if 문으로 끝내지 않으려고 의도(intent)를 표로 둔다. 표에 한
 * 줄을 더하는 것이 곧 새 의도를 지원하는 일이고, 그것 말고 고칠 곳이 없다.
 *
 * **바깥을 부르지 않는다.** 언어 모델에 물으면 같은 질문에 다른 구조가
 * 나오고, 그러면 아래 층 전부가 흔들린다. 여기서는 규칙으로만 읽는다.
 *
 * 못 읽으면 `intent: 'unknown'` 이고 그것이 **정상 결과**다. 억지로 하나를
 * 고르면 엉뚱한 분야에 물어보게 되고, 이 저장소는 그 실수를 이미 한 번 했다
 * (취직하며 한 이사를 '주거'에 물어 150/228 이었다).
 */

import { DOMAINS } from '../domains.js';

/** 사용자가 어디까지 내려달라고 한 것인가 */
const NO_REQUEST = {
  timing: 'quarter', event: true, role: false,
  industry: false, location: false, company: false,
};

/**
 * 의도 표. 위에서부터 맞는 첫 줄을 쓴다 — 좁은 것을 위에 둔다.
 *
 *   domain    열두 분야 중 하나
 *   patterns  하나라도 맞으면 그 의도
 *   requests  그 의도가 기본으로 요구하는 구체성 (질문의 낱말이 더 얹는다)
 *   events    이 의도가 겨냥하는 사건 후보 (events.js 의 key)
 */
export const INTENTS = [
  // ── 분야 전체를 묻는 말은 특정 사건 질문보다 먼저 가른다 ──
  // "내년에 직장운 어때"를 '이직'으로 읽으면, 묻지도 않은 사건을 앞세우게 된다
  { key: 'domain_overview', domain: 'career', label: '직업 전반',
    patterns: [/직장운/, /직업운/, /커리어 ?운/, /일 ?운[^가-힣]/],
    requests: {}, events: null, overview: true },
  { key: 'domain_overview', domain: 'wealth', label: '재물 전반',
    patterns: [/재물운/, /금전운/, /돈 ?운/], requests: {}, events: null, overview: true },
  { key: 'domain_overview', domain: 'relationship', label: '관계 전반',
    patterns: [/애정운/, /연애운/], requests: {}, events: null, overview: true },
  { key: 'domain_overview', domain: 'marriage', label: '결혼 전반',
    patterns: [/결혼운/, /혼인운/], requests: {}, events: null, overview: true },
  { key: 'domain_overview', domain: 'health', label: '건강 전반',
    patterns: [/건강운/], requests: {}, events: null, overview: true },
  { key: 'domain_overview', domain: 'education', label: '학업 전반',
    patterns: [/학업운/, /시험운/], requests: {}, events: null, overview: true },

  // 지금 자리를 지킬 수 있는지는 '이직'과 다른 질문이다
  { key: 'employment_stability', domain: 'career', label: '자리 유지',
    patterns: [/오래 다닐/, /계속 다닐/, /계속 다녀/, /버틸 수/, /잘리/, /정년/, /안정적으로 다닐/],
    requests: {}, events: ['resignation', 'job_change', 'role_change'], stability: true },

  { key: 'job_change', domain: 'career', label: '이직',
    patterns: [/이직/, /직장[^.]{0,4}(옮|바꾸|바뀌|이동)/, /회사[^.]{0,4}(옮|바꾸|나가|그만)/],
    requests: { role: true, industry: true }, events: ['job_change', 'role_change'] },
  { key: 'first_job', domain: 'career', label: '취업',
    patterns: [/취업/, /취직/, /첫 ?직장/, /입사/],
    requests: { role: true, industry: true }, events: ['first_job'] },
  { key: 'promotion', domain: 'career', label: '승진',
    patterns: [/승진/, /진급/, /연봉[^.]{0,4}(오|올|인상)/],
    requests: { role: true }, events: ['promotion'] },
  { key: 'independence', domain: 'career', label: '독립·창업',
    patterns: [/창업/, /독립/, /프리랜/, /사업[^.]{0,3}(시작|할|하면)/, /내 ?가게/],
    requests: { industry: true }, events: ['business_start', 'freelance'] },
  { key: 'resignation', domain: 'career', label: '퇴사',
    patterns: [/퇴사/, /그만둘/, /사표/, /쉬어야/],
    requests: {}, events: ['resignation', 'career_break'] },
  { key: 'career_change', domain: 'career', label: '직업 변화',
    patterns: [/직업/, /직장/, /커리어/, /일[^.]{0,3}(바뀔|바뀌|달라)/, /직무/],
    requests: { role: true }, events: null },

  { key: 'marriage', domain: 'marriage', label: '결혼',
    patterns: [/결혼/, /혼인/, /시집/, /장가/, /배우자[^.]{0,4}(만나|생기)/],
    requests: {}, events: ['marriage', 'marriage_preparation', 'engagement_like_transition'] },
  { key: 'new_relationship', domain: 'relationship', label: '새 만남',
    patterns: [/연애[^.]{0,4}(언제|할|하게|시작)/, /애인/, /만남/, /소개팅/, /사귀/],
    requests: {}, events: ['new_relationship'] },
  { key: 'relationship_status', domain: 'relationship', label: '관계',
    patterns: [/연애/, /관계/, /헤어/, /이별/, /재회/, /갈등/],
    requests: {}, events: null },

  { key: 'children', domain: 'children', label: '자녀',
    patterns: [/자녀/, /아이/, /임신/, /출산/, /둘째/],
    requests: {}, events: null },
  { key: 'education', domain: 'education', label: '학업',
    patterns: [/시험/, /합격/, /공부/, /학업/, /진학/, /자격증/, /유학/],
    requests: {}, events: null },
  { key: 'wealth', domain: 'wealth', label: '재물',
    patterns: [/돈/, /재물/, /수입/, /재테크/, /투자/, /빚/, /대출/],
    requests: {}, events: null },
  { key: 'home_purchase', domain: 'residence', label: '집',
    patterns: [/집[^.]{0,4}(사|살|구입|매매)/, /내 ?집/, /전세/, /월세/, /분양/],
    requests: { location: true }, events: ['home_purchase_related', 'rental_change'] },
  { key: 'move', domain: 'movement', label: '이동',
    patterns: [/이사/, /이주/, /해외/, /이민/, /옮겨/, /생활권/],
    requests: { location: true }, events: null },
  { key: 'health', domain: 'health', label: '건강',
    patterns: [/건강/, /몸[^.]{0,3}(어때|괜찮|아프)/, /체력/],
    requests: {}, events: null },
  { key: 'major_change', domain: 'majorChange', label: '큰 전환',
    patterns: [/큰 ?변화/, /전환점/, /인생[^.]{0,4}(바뀌|전환)/, /앞으로 ?어떻게/],
    requests: {}, events: null },
];

/** 질문의 낱말이 구체성을 더 요구하는가 */
const ASK = [
  { key: 'location', patterns: [/어디/, /어느 ?(지역|도시|동네)/, /지역/, /타지/, /수도권/] },
  { key: 'company', patterns: [/어느 ?회사/, /무슨 ?회사/, /어떤 ?회사/, /회사 ?이름/] },
  { key: 'role', patterns: [/무슨 ?일/, /어떤 ?일/, /직무/, /무슨 ?직종/, /어떤 ?역할/] },
  { key: 'industry', patterns: [/업종/, /분야/, /어떤 ?업계/, /산업/] },
];

/**
 * 시기를 얼마나 잘게 물었나.
 *
 * **반기를 분기로 읽지 않는다.** "상반기에 될까"는 여섯 달을 묻는 말이고
 * 석 달을 묻는 말이 아니다. 좁은 눈금부터 본다 — "2028 상반기 몇 월"이면
 * 달을 물은 것이다.
 */
const TIMING_ASK = [
  { grain: 'month', patterns: [/몇 ?월/, /어느 ?달/, /며칠/, /언제쯤.*월/] },
  { grain: 'quarter', patterns: [/분기/] },
  { grain: 'halfyear', patterns: [/상반기/, /하반기/, /반기/] },
  { grain: 'year', patterns: [/몇 ?년/, /어느 ?해/, /몇 ?살/] },
  { grain: 'quarter', patterns: [/언제/, /시기/, /타이밍/] },
];

/** 연도를 가리키는 상대말 — 좁은 것을 먼저 본다 */
const REL_YEAR = [
  { re: /내후년/, off: 2 },
  { re: /내년|다음 ?해/, off: 1 },
  { re: /올해|금년|이번 ?해/, off: 0 },
];
const HALF = [
  { re: /상반기/, months: [1, 6], label: '상반기' },
  { re: /하반기/, months: [7, 12], label: '하반기' },
];
const QUARTER_N = /([1-4])\s*분기/;

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * 질문에서 볼 기간을 읽는다. **못 읽으면 지어내지 않고 기본 창을 쓴다.**
 *
 * ── 연도와 반기를 **같이** 읽는다 ──────────────────────────
 * 전에는 절대연도를 먼저 잡아 버려서 "2028년 상반기"가 2028년 열두 달이
 * 됐고, 상·하반기는 올해로만 읽혀 "내년 하반기"가 올해가 됐다. 연도
 * 부분(절대·상대)과 반기·분기 부분을 먼저 각각 뽑아 **조합한 뒤**에야
 * 단순 연도로 물러선다.
 *
 * @returns {{from, to, source}}
 */
export function readHorizon(text, now = new Date(), defaultYears = 3) {
  const y = now.getFullYear();
  const t = String(text ?? '');

  // ① 연도 부분 — 절대가 상대보다 세다
  const abs = [...t.matchAll(/(20\d{2})\s*년/g)].map((m) => Number(m[1]));
  const rel = REL_YEAR.find((r) => r.re.test(t));
  const baseYear = abs.length ? Math.min(...abs) : rel ? y + rel.off : null;
  const yearLabel = abs.length ? `${Math.min(...abs)}년` : rel ? t.match(rel.re)[0] : null;

  // ② 반기·분기를 연도와 **조합해서** 먼저 읽는다
  const half = HALF.find((h) => h.re.test(t));
  if (half) {
    const yy = baseYear ?? y;
    return {
      from: `${yy}-${pad2(half.months[0])}`, to: `${yy}-${pad2(half.months[1])}`,
      source: [yearLabel, half.label].filter(Boolean).join(' '),
    };
  }
  const q = t.match(QUARTER_N);
  if (q) {
    const yy = baseYear ?? y;
    const n = Number(q[1]);
    return {
      from: `${yy}-${pad2(n * 3 - 2)}`, to: `${yy}-${pad2(n * 3)}`,
      source: [yearLabel, `${n}분기`].filter(Boolean).join(' '),
    };
  }

  // ③ 연도만
  if (abs.length) {
    return { from: `${Math.min(...abs)}-01`, to: `${Math.max(...abs)}-12`, source: '질문에 적힌 연도' };
  }
  const span = t.match(/(\d+)\s*년\s*(안|이내|내에)/);
  if (span) return { from: `${y}-01`, to: `${y + Number(span[1])}-12`, source: span[0] };
  const later = t.match(/(\d+)\s*년\s*(뒤|후)/);
  if (later) return { from: `${y + Number(later[1])}-01`, to: `${y + Number(later[1])}-12`, source: later[0] };
  if (rel) return { from: `${y + rel.off}-01`, to: `${y + rel.off}-12`, source: t.match(rel.re)[0] };

  return { from: `${y}-01`, to: `${y + defaultYears - 1}-12`, source: '기본 창 (질문에 기간이 없다)' };
}

/**
 * 묻는 말 → 공통 구조.
 *
 * @param {string} text
 * @param {{now?:Date, defaultYears?:number}} opts
 */
export function interpretQuestion(text, opts = {}) {
  const t = String(text ?? '').trim();
  const now = opts.now ?? new Date();

  const matched = INTENTS.filter((i) => i.patterns.some((p) => p.test(t)));
  const best = matched[0] ?? null;

  const requestedSpecificity = { ...NO_REQUEST, ...(best?.requests ?? {}) };
  // 의도가 기본으로 켜는 칸과 **사용자가 직접 물은 칸**을 갈라 둔다.
  // "언제 이직해?"는 이직 의도가 역할·업종을 기본으로 켜지만, 사용자가
  // 그것까지 물은 것은 아니다 — 그 차이가 답의 구체성을 정한다
  const askedExplicit = [];
  for (const a of ASK) {
    if (!a.patterns.some((p) => p.test(t))) continue;
    requestedSpecificity[a.key] = true;
    askedExplicit.push(a.key);
  }
  const grain = TIMING_ASK.find((g) => g.patterns.some((p) => p.test(t)));
  if (grain) requestedSpecificity.timing = grain.grain;

  const horizon = readHorizon(t, now, opts.defaultYears ?? 3);

  // ── 어디까지 물었나 ────────────────────────────────────────
  // "내년 운세 어때"에 구 단위까지 말할 필요가 없고, "어디쯤 어떤 회사"라고
  // 물으면 근거가 닿는 데까지 내려가야 한다. 그 차이를 여기서 적어 둔다.
  const narrow = ['role', 'industry', 'location', 'company'].filter((k) => askedExplicit.includes(k));
  const level = best?.overview ? 'low' : narrow.length ? 'high' : 'normal';
  requestedSpecificity.level = level;

  const requestedAttributes = ['timing',
    ...(best?.overview ? [] : ['event']), ...narrow];

  return {
    raw: t,
    /** 스키마 이름 그대로 쓰는 쪽을 위해 함께 둔다 */
    rawQuestion: t,
    domain: best?.domain ?? null,
    intent: best?.key ?? 'unknown',
    label: best?.label ?? null,
    /** 이 의도가 겨냥하는 사건 후보. null 이면 그 분야 전체를 본다 */
    targetEvents: best?.events ?? null,
    /** 전반을 묻는 질문인가 (사건 하나를 앞세우지 않는다) */
    overview: best?.overview === true,
    horizon,
    timeRange: { from: horizon.from, to: horizon.to },
    requestedSpecificity,
    requestedAttributes,
    /** 현재 상태를 모르면 갈 수 없는 길을 지우지 못하는 질문인가 */
    requiresCurrentState: REQUIRES_STATE.has(best?.key ?? '') || !!best?.stability,
    /** 실제 자료(채용·지역)를 맞대야 답할 수 있는 질문인가 */
    requiresRealityContext: !!(requestedSpecificity.location || requestedSpecificity.company),
    /** 두 번째로 맞은 의도들 — 질문이 겹치면 버리지 않고 남긴다 */
    alsoMatched: matched.slice(1).map((i) => ({ intent: i.key, domain: i.domain, label: i.label })),
    ...(best ? {} : { note: '어느 분야를 묻는지 읽지 못했다 — 분야를 골라 다시 물어야 한다' }),
  };
}

/** 현재 상태가 있어야 갈 수 없는 길을 지울 수 있는 의도 */
const REQUIRES_STATE = new Set([
  'job_change', 'first_job', 'promotion', 'resignation', 'independence',
  'employment_stability', 'marriage', 'new_relationship', 'relationship_status',
  'children', 'home_purchase', 'move',
]);

/** 분야 이름이 실제로 있는 것인지 (오타로 조용히 빈 결과가 나오지 않게) */
export const isDomain = (d) => DOMAINS.includes(d);
export { pad2 };
