/**
 * curate.js — 결과 문장 후처리기 (LLM 없이, 로컬 규칙만)
 *
 * 해석 사전·사건 사전이 고른 문장을 화면에 내기 전에 한 번 더 거른다.
 *   1. 같은 의미 반복           — 글자 두 개 묶음이 절반 넘게 겹치면 같은 말(dict.js nearSame)
 *   2. 서로 반대되는 문장       — 결(THEMES)이 반대(OPPOSITE)면 우선순위가 낮은 쪽을 뺀다
 *   3. 무책임한 양면화          — "A이지만 B이기도 합니다" 꼴
 *   4. 누구에게나 맞는 문장     — 일반론 목록
 *   5. 지나치게 추상적인 문장   — 구체성 점수가 낮은 문장
 *   6. 같은 결 여러 개          — 같은 주제·같은 방향이면 우선순위가 가장 높은 하나만
 *   7. 한 화면의 같은 조언 반복 — PageMemo 가 화면 전체에서 이미 낸 문장을 기억한다
 *
 * 문장마다 메타데이터를 붙인다:
 *   { text, topics, polarity, specificity(0~5), generic, hedge, priority(0~1) }
 * 우선순위는 화면 안에서 고르는 데만 쓰고 사용자에게 숫자로 보이지 않는다.
 *
 * 결(THEMES)·반대 결(OPPOSITE)·같은 말 판정(nearSame)은 dict.js 의 것을 그대로 쓴다 —
 * 리포트의 "나는 어떤 사람인가" 칸(coreField)과 같은 기준이어야 화면끼리 말이 엇갈리지 않는다.
 */
import { THEMES, OPPOSITE, themesOf, bigrams, nearSame } from './dict.js';

/** 결의 방향 — 같은 주제 안에서 높은 쪽/낮은 쪽 */
const POLARITY = { fast: 'high', slow: 'low', firm: 'high', soft: 'low', out: 'high', in: 'low', care: 'high', free: 'high' };
/** 결을 묶는 큰 주제 — 같은 주제·같은 방향 문장은 하나만 */
const TOPIC = { fast: 'pace', slow: 'pace', firm: 'stance', soft: 'stance', out: 'social', in: 'social', care: 'care', free: 'freedom' };

/** 누구에게나 들어맞는 문장 */
const GENERIC = /특별히 좋지도|평소대로|큰 변화가 없|노력하면|좋은 일이 생|무난한|무난합니다|조심하면 됩니다|좋은 결과가 있|운이 따릅니다|잘 될 것입니다|최선을 다하/;
/** 양면화 — 한 문장에서 정반대 두 가지를 다 말해 틀릴 수가 없는 문장 */
const HEDGE = /지만[^.]*(기도|도) (합니다|있습니다|한)|하면서도[^.]*하기도|양면이 있|둘 다 있습니다/;
/** 구체성 — 장면·대상·행동이 있는가 */
const CONCRETE = /\d|회의|계약|이직|정리|저축|대화|연락|일정|약속|결정|역할|팀|가족|아이|배우자|동료|윗사람|문서|공부|운동|잠|식사|끼니|말투|돈을|집|사람 앞|마감|기한|끝까지|먼저|결국|혼자|부탁/;
const SCENE = /때|면 |일수록|보다|대신|처음|오래|자주|되풀이/;
const ABSTRACT = /기운|흐름이|결입니다|운이|좋은 편|대체로|전반적으로|평범|다양한/;

/** 문장 하나의 메타데이터 */
export function meta(text, { base = 0.5, rare = 0 } = {}) {
  const t = String(text ?? '').trim();
  const themes = themesOf(t);
  const concrete = (t.match(new RegExp(CONCRETE.source, 'g')) ?? []).length;
  const specificity = Math.max(0, Math.min(5,
    Math.min(concrete, 3) + (SCENE.test(t) ? 1 : 0) + (t.length >= 25 ? 1 : 0)
    - (t.match(new RegExp(ABSTRACT.source, 'g')) ?? []).length - (t.length < 15 ? 1 : 0)));
  const generic = GENERIC.test(t);
  const hedge = HEDGE.test(t);
  const priority = Math.max(0, Math.min(1,
    base + specificity * 0.06 + rare * 0.2 - (generic ? 0.5 : 0) - (hedge ? 0.3 : 0)));
  return {
    text: t,
    themes,
    topics: [...new Set(themes.map((k) => TOPIC[k]))],
    polarity: themes.length ? POLARITY[themes[0]] : null,
    specificity, generic, hedge, priority,
    grams: bigrams(t),
  };
}

/** 두 문장이 서로 반대 결인가 */
export const opposes = (a, b) => a.themes.some((k) => OPPOSITE[k] && b.themes.includes(OPPOSITE[k]));

/**
 * 화면 하나 전체에서 이미 낸 문장을 기억한다 — 다른 칸에서 같은 조언·같은 말이 다시 나오지 않게.
 */
export class PageMemo {
  constructor() { this.items = []; }
  has(text) {
    const g = bigrams(String(text ?? ''));
    return this.items.some((x) => x.text === text || nearSame(x.grams, g));
  }
  add(text) { if (text) this.items.push({ text, grams: bigrams(String(text)) }); return text; }
  /** 반대 결 문장이 이미 화면에 있는가 */
  contradicts(m) { return this.items.some((x) => opposes(meta(x.text), m)); }
}

/**
 * 후보 문장들을 거른다.
 * @param {Array<string|{text, base?, rare?}>} items
 * @param {{max?, memo?, minSpecificity?, keepTopics?}} opts
 *   memo — PageMemo. 이미 화면에 낸 문장·반대 결 문장은 건너뛰고, 고른 문장을 기억시킨다
 *   minSpecificity — 이보다 추상적인 문장은 뺀다(다른 문장이 하나도 없으면 가장 나은 것 하나는 남긴다)
 * @returns {Array<ReturnType<typeof meta>>}
 */
export function curate(items, { max = 3, memo = null, minSpecificity = 1 } = {}) {
  const cands = items
    .map((x) => (typeof x === 'string' ? meta(x) : { ...meta(x.text, x), ...x, ...meta(x.text, x) }))
    .filter((m) => m.text && !m.generic && !m.hedge)
    .sort((a, b) => b.priority - a.priority);
  const out = [];
  const topicTaken = new Set();
  for (const m of cands) {
    if (out.length >= max) break;
    if (m.specificity < minSpecificity) continue;
    if (memo?.has(m.text) || memo?.contradicts(m)) continue;
    if (out.some((o) => nearSame(o.grams, m.grams) || opposes(o, m))) continue;
    // 같은 주제·같은 방향은 하나만
    const tk = m.topics.length ? `${m.topics[0]}:${m.polarity}` : null;
    if (tk && topicTaken.has(tk)) continue;
    if (tk) topicTaken.add(tk);
    out.push(m);
  }
  // 모두 추상적이라 하나도 못 골랐으면 가장 나은 하나는 남긴다
  if (!out.length) {
    const best = cands.find((m) => !memo?.has(m.text) && !memo?.contradicts(m));
    if (best) out.push(best);
  }
  for (const m of out) memo?.add(m.text);
  return out;
}

export { THEMES };
