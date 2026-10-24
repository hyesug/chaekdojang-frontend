/**
 * 용신·희신 — 행운의 색을 고르기 전에 **무엇을 보태야 하는가**를 정한다.
 *
 * 예전에는 가장 약한 오행 하나로 색을 골랐다. 그런데 부족하다고 늘 보태야 하는 것은 아니다 —
 * 신강한 명반에 모자란 인성을 보태면 더 무거워진다. 그래서 순서대로 본다(사용자 지정 규칙 2026-10-24).
 *   1. 계절과 조후 — 여름생(巳午未)은 수, 겨울생(亥子丑)은 화가 필요하다. 그 오행이 고르게 나눈 몫(20%) 이상
 *      이미 있으면 급하지 않다.
 *   2. 신강·신약(억부) — bodyStrength. 신약이면 돕는 쪽(인성·비겁), 신강이면 덜어 내는 쪽(식상·재성·관성).
 *   3. 용신·희신·기신 — 억부로 고른 용신, 그다음 돕는 희신, 용신을 극하는 기신(피할 색).
 * 억부와 조후가 같은 쪽(용신이나 희신)을 가리킬 때만 용신을 '확정'으로 본다. 중화이거나 둘이 갈리면
 * 후보로만 말하고 평생의 행운색이라 하지 않는다.
 *
 * 유파 고지: 격국·통근·합충 변화까지 보는 용신법은 여기 없다. 이 판단은 억부와 조후 두 기준까지다.
 */
import { ELEMENTS, STEM_ELEMENT, elementDistribution, tenGodDistribution } from '../../core/ganzhi.js';
import { bodyStrength } from './saju.js';
import { j } from '../../core/josa.js';

export const ELEMENT_COLOR = ['초록·청색', '빨강·자주', '노랑·베이지', '흰색·은색', '검정·남색'];

/** '이고'·'이다'는 받침이 없으면 '이'가 빠진다 — "남색이고" / "베이지고" */
const copula = (w, tail) => (j(w, '이').endsWith('가') ? w + tail.slice(1) : w + tail);

/** 월지(子~亥) → 계절 */
const SEASON_OF = ['겨울', '겨울', '봄', '봄', '봄', '여름', '여름', '여름', '가을', '가을', '가을', '겨울'];

/** 일간 오행 기준으로 십신 무리가 어느 오행인가 */
const groupElement = (me) => ({ 비겁: me, 식상: (me + 1) % 5, 재성: (me + 2) % 5, 관성: (me + 3) % 5, 인성: (me + 4) % 5 });

function climate(chart, dist) {
  const season = SEASON_OF[chart.pillars.month.branch];
  const need = season === '여름' ? 4 : season === '겨울' ? 1 : null;
  if (need == null) return { season, need: null, urgent: false, why: `${season}에 태어나 덥거나 춥게 치우치지 않아 조후는 급하지 않다` };
  const urgent = dist.pct[need] < 20;
  return {
    season, need, urgent,
    why: urgent
      ? `${season}에 태어나 ${season === '여름' ? '더위를 식힐' : '추위를 녹일'} ${j(ELEMENTS[need], '이')} 필요한데 적다(조후)`
      : `${season}에 태어났지만 ${j(ELEMENTS[need], '이')} 이미 고르게 나눈 몫 이상 있어 조후는 급하지 않다`,
  };
}

function eokbu(chart, strength, gods) {
  const G = groupElement(STEM_ELEMENT[chart.dayStem]);
  const g = gods.groups;
  if (strength.level === '중화') return { yong: null, hee: null, why: '신강도 신약도 아닌 중화라 억부로는 한쪽을 고르지 않는다' };
  if (strength.level === '신약') {
    const heavy = ['재성', '관성', '식상'].sort((a, b) => g[b] - g[a])[0];
    return heavy === '재성'
      ? { yong: G.비겁, hee: G.인성, why: '신약한데 재성이 무거워 비겁으로 버틴다(재다신약)' }
      : { yong: G.인성, hee: G.비겁, why: `신약한데 ${j(heavy, '이')} 무거워 인성으로 받친다` };
  }
  if (g.인성 > g.비겁) return { yong: G.재성, hee: G.식상, why: '신강하고 인성이 무거워 재성으로 덜어 낸다' };
  // 관이 없으면 식상으로 힘을 빼는 것이 먼저다
  return g.관성 > 0
    ? { yong: G.관성, hee: G.재성, why: '신강하고 비겁이 무거워 관성으로 다잡는다' }
    : { yong: G.식상, hee: G.재성, why: '신강하고 비겁이 무거운데 관성이 없어 식상으로 힘을 뺀다' };
}

/**
 * @returns {{ season, climate, strength, eokbu, yong, hee, gi, status, settled, weak }}
 *   status: 'settled'(억부·조후 모임) | 'split'(갈림) | 'climateOnly'(중화라 조후만) | 'eokbuOnly'(조후 급하지 않음, 억부만) | 'none'
 */
export function usefulGod(chart) {
  const dist = elementDistribution(chart.pillars);
  const strength = bodyStrength(chart);
  const gods = tenGodDistribution(chart.pillars, chart.dayStem);
  const cl = climate(chart, dist);
  const eb = eokbu(chart, strength, gods);
  let yong = eb.yong; let hee = eb.hee; let status;
  if (eb.yong == null) {
    status = cl.urgent ? 'climateOnly' : 'none';
    if (cl.urgent) { yong = cl.need; hee = (cl.need + 4) % 5; }
  } else if (!cl.urgent) status = 'eokbuOnly';
  else status = (cl.need === eb.yong || cl.need === eb.hee) ? 'settled' : 'split';
  // 억부가 분명하고 조후가 급하지 않아도 확정으로 본다 — 조후가 따로 요구하는 것이 없다
  const settled = status === 'settled' || status === 'eokbuOnly';
  return { season: cl.season, climate: cl, strength, eokbu: eb, yong, hee,
    gi: yong == null ? null : (yong + 3) % 5, status, settled, weak: dist.weakest };
}

/** 색 이름 → 오행. 오방색에 뚜렷이 드는 것만 — 주황·보라처럼 유파마다 갈리는 색은 견주지 않는다 */
export function colorElement(color = '') {
  if (/초록|연두|청색|파랑/.test(color)) return 0;
  if (/빨강|분홍|자주/.test(color)) return 1;
  if (/노랑|베이지/.test(color)) return 2;
  if (/하양|흰색|은색/.test(color)) return 3;
  if (/검정|남색/.test(color)) return 4;
  return null;
}

/**
 * 행운의 색 — 문장까지. others 는 다른 체계가 권한 색 [{ system, color, basis }].
 * @returns {{ el, colors, avoid, lifetime, text, conflicts }}
 */
export function colorAdvice(chart, others = []) {
  const u = usefulGod(chart);
  const E = (i) => ELEMENTS[i];
  const steps = [`${u.climate.why}.`, `${u.eokbu.why}.`];
  let text;
  if (u.yong == null) {
    text = `${steps.join(' ')} 그래서 이 명반은 한 기운을 보태야 할 필요가 크지 않아 행운의 색을 하나로 정하지 않는다.`;
  } else if (u.settled) {
    text = `${steps.join(' ')} ${u.status === 'settled' ? '억부와 조후가 같은 쪽이라' : '조후가 따로 요구하는 것이 없어 억부대로'} 용신은 ${E(u.yong)}, 희신은 ${j(E(u.hee), '으로')} 본다. `
      + `오래 곁에 두기 좋은 색은 ${ELEMENT_COLOR[u.yong]}, 함께 쓰기 좋은 색은 ${copula(ELEMENT_COLOR[u.hee], '이고')}, `
      + `기신 ${E(u.gi)}의 ${j(ELEMENT_COLOR[u.gi], '은')} 덜 쓰는 편이 낫다.`;
  } else {
    const split = u.status === 'split'
      ? ` 억부는 ${j(E(u.eokbu.yong), '을')}, 조후는 ${j(E(u.climate.need), '을')} 가리켜 둘이 갈린다.` : ' 억부로는 한쪽을 고르지 않아 조후로만 본 후보다.';
    text = `${steps.join(' ')}${split} 용신이 확정되지 않아 평생의 행운색이라고 단정하지 않는다 — `
      + `지금 기준의 후보 색은 ${copula(ELEMENT_COLOR[u.yong], '이다')}.`;
  }
  if (u.weak !== u.yong && u.weak !== u.hee) {
    text += ` 가장 약한 오행(${E(u.weak)})만 보고 그 색을 고르지는 않았다 — 부족하다고 늘 보태야 하는 것은 아니다.`;
  }
  const conflicts = [];
  for (const o of others) {
    const el = colorElement(o.color);
    if (el == null || u.gi == null || el !== u.gi) continue;
    conflicts.push(`${j(o.system, '은')} ${j(o.color, '을')} 권하지만 사주로는 그 색이 기신 ${E(u.gi)}의 색이다 — `
      + `${j(o.system, '은')} ${j(o.basis, '으로')}, 사주는 오행 균형(조후·억부)으로 색을 정해 기준이 다르다.`);
  }
  return { el: u.yong, colors: u.yong == null ? [] : [ELEMENT_COLOR[u.yong]], avoid: u.gi == null ? [] : [ELEMENT_COLOR[u.gi]],
    lifetime: u.settled && u.yong != null, text: [text, ...conflicts].join(' '), conflicts, review: u };
}
