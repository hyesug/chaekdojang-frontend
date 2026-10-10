/**
 * dict.js — **17체계 해석 사전**을 불러오고, 한 사람의 명반에서 사전의 항목을 고른다
 *
 * 사전 본문(public/unse/dict/*.json)은 체계마다 그 사람의 특징(일간×태어난 달, 일주, 명궁 별,
 * 태양·달·상승, 27수, 괘, 수, 카드, 요일 행성 …) 하나에 대해 생활 언어로 쓴 다섯 칸이다.
 *   p 성격 · w 일할 때 · m 돈 · r 관계 · c 조심할 점
 * 한 사람은 20개 안팎의 항목을 받고, 그 조합이 사람마다 거의 다 다르다.
 *
 * 사전은 크기 때문에 번들에 넣지 않고 리포트를 그리기 직전에 한 번 불러온다(loadDicts).
 */
import { STEMS_KR, BRANCHES_KR, ELEMENTS, STEM_ELEMENT, isStemCombine, branchRelations } from '../core/ganzhi.js';
import { buildBoard } from '../hires/ziwei.js';
import { planetPositions, toSidereal } from '../core/planets.js';
import { SIGNS } from '../systems/astrology.js';
import { chart as vedicChart } from '../hires/vedicExt.js';
import { nakshatraOf } from '../systems/sukyo.js';
import { starOfYear, getsumeiOf } from '../systems/gujeong.js';
import { hexOf } from '../systems/juyeok.js';
import { DICT_SHARE } from './data/rarity.js';
import { DICT_FILES } from './dictFiles.js';

// 사전 파일 목록은 관리자 화면(운세 피드백 출처 찾기)도 함께 쓴다 — 무거운 계산 모듈 없이 불러오게 따로 둔다
export { DICT_FILES };
/** 파일 → 사전 묶음 이름 */
const GROUP = (file) => file.replace(/-\d+$/, '');

let DICT = null;

/** 사전을 한 번만 불러온다. 브라우저는 fetch, 노드(테스트·스크립트)는 파일에서 읽는다 */
export async function loadDicts() {
  if (DICT) return DICT;
  const out = {};
  if (typeof window === 'undefined') {
    // 모듈 이름을 변수로 둬서 브라우저 번들러가 노드 모듈을 끌어들이지 않게 한다
    const nodeFs = 'node:fs', nodeUrl = 'node:url';
    const { readFileSync } = await import(nodeFs);
    const { fileURLToPath } = await import(nodeUrl);
    for (const f of DICT_FILES) {
      const path = fileURLToPath(new URL(`../../dict/${f}.json`, import.meta.url));
      Object.assign(out[GROUP(f)] ??= {}, JSON.parse(readFileSync(path, 'utf8')));
    }
  } else {
    const all = await Promise.all(DICT_FILES.map((f) => fetch(`dict/${f}.json`).then((res) => (res.ok ? res.json() : {})).catch(() => ({}))));
    DICT_FILES.forEach((f, i) => Object.assign(out[GROUP(f)] ??= {}, all[i]));
  }
  DICT = out;
  return DICT;
}

/** 이미 불러온 사전 (없으면 null — 리포트는 사전 없이도 그려진다) */
export const dictLoaded = () => DICT;

/**
 * 앞으로 마주할 중요한 일의 사전 — {t 제목, w 어떤 모양으로 오는가, p 대비}
 *   seat|기둥|충·형·합|그 10년의 십신 무리 · domain|직업·재물·이사|그 10년의 십신 무리 · health|가장 옅은 오행
 */
export const eventEntry = (key) => DICT?.event?.[key] ?? null;

const MAIN = ['자미', '천기', '태양', '무곡', '천동', '염정', '천부', '태음', '탐랑', '거문', '천상', '천량', '칠살', '파군'];
const PALACE_KR = { 乾: '건', 離: '리', 艮: '간', 震: '진', 巽: '손', 坤: '곤', 兌: '태', 坎: '감' };
const titleOf = (r, sys, re) => (r.results ?? []).find((s) => s.name === sys)?.readings?.find((x) => re.test(String(x.title)))?.title ?? '';

/**
 * 그 사람의 사전 열쇠들 — [묶음, 열쇠, 화면에 쓸 이름]
 * 열쇠를 계산하지 못하는 체계(출생 시각 없음 등)는 빠진다.
 */
export function dictKeys(r) {
  const { input, chart } = r;
  const keys = [];
  const add = (group, key, label) => { if (key != null && key !== '') keys.push([group, String(key), label]); };
  const safe = (fn) => { try { fn(); } catch { /* 그 체계만 빠진다 */ } };

  safe(() => add('saju-stem-month', `${STEMS_KR[chart.dayStem]}-${BRANCHES_KR[chart.pillars.month.branch]}`, '사주'));
  safe(() => add('saju-ilju', chart.pillars.day.kr, '사주 일주'));
  safe(() => {
    if (!input.timeKnown) return;
    const b = buildBoard(input);
    add('ziwei-ming', MAIN.filter((s) => b.board[b.myeong].includes(s)).join('·') || '공궁', '자미두수');
  });
  safe(() => {
    const pos = planetPositions(input.jdUT);
    add('western', `태양|${SIGNS[Math.floor(pos.태양.lon / 30) % 12].name}`, '서양 점성(태양)');
    add('western', `달|${SIGNS[Math.floor(pos.달.lon / 30) % 12].name}`, '서양 점성(달)');
    add('vedic', `달|${Math.floor(toSidereal(pos.달.lon, input.jdUT) / 30) % 12}`, '베딕(달)');
    // 금성(사랑·즐거움)·화성(추진·갈등)·수성(말·생각)·목성(기회)·토성(책임·두려움)
    for (const p of ['금성', '화성', '수성', '목성', '토성']) {
      add('western-planets', `${p}|${SIGNS[Math.floor(pos[p].lon / 30) % 12].name}`, `서양 점성(${p})`);
    }
  });
  safe(() => {
    if (!input.timeKnown) return;
    const asc = titleOf(r, '점성술', /^상승점 — /).replace(/^상승점 — /, '');
    if (asc) add('western', `상승|${asc}`, '서양 점성(상승)');
    const d1 = vedicChart(input, 'D1');
    if (d1?.lagna != null) add('vedic', `라그나|${d1.lagna}`, '베딕(라그나)');
  });
  safe(() => add('mansion', nakshatraOf(input.jdUT).index, '숙요'));
  safe(() => {
    const hon = starOfYear(chart.sajuYear);
    add('gujeong', `본명|${hon}`, '구성학');
    add('gujeong', `월명|${getsumeiOf(hon, chart.sector?.index ?? 0)}`, '구성학(달)');
  });
  safe(() => {
    // 주역 체계(systems/juyeok.js)와 같은 셈 — 매화역수, 음력 해 기준
    add('juyeok', hexOf(input).num, '주역');
  });
  safe(() => {
    const lp = titleOf(r, '카발라', /라이프 패스/).match(/라이프 패스 (\d+)/)?.[1];
    add('kabbalah', lp ? `인생|${lp}` : null, '카발라');
    add('kabbalah', `생일|${input.day}`, '카발라(생일)');
  });
  safe(() => {
    let s = input.month + input.day + input.year;
    while (s > 22) s = String(s).split('').reduce((a, c) => a + Number(c), 0);
    add('tarot', s === 22 ? 0 : s, '타로');
  });
  safe(() => {
    const planet = titleOf(r, '마하보테', /^내 행성은/).match(/내 행성은 (\S+)/)?.[1];
    add('weekday', planet ? `행성|${planet}` : null, '태어난 요일');
    const house = titleOf(r, '마하보테', / — .*자리$/).split(' ')[0];
    add('weekday', house ? `자리|${house}` : null, '마하보테');
  });
  safe(() => {
    const gen = titleOf(r, '육임', /^초전의 천장 — /).replace(/^초전의 천장 — /, '');
    add('boards', gen && gen !== '없음' ? `천장|${gen}` : null, '육임');
    const gate = titleOf(r, '홍국기문', /문 \(/).split(' ')[0];
    add('boards', gate ? `문|${gate}` : null, '홍국기문');
    const hanja = titleOf(r, '태을신수', /^태을이 .궁에 있습니다/).match(/^태을이 (.)궁/)?.[1];
    add('boards', PALACE_KR[hanja] ? `궁|${PALACE_KR[hanja]}` : null, '태을신수');
    const last = titleOf(r, '육임', /^말전의 천장 — /).replace(/^말전의 천장 — /, '');
    add('boards', last && last !== '없음' ? `말전|${last}` : null, '육임(결말)');
    const star = titleOf(r, '홍국기문', /이 지키는 자리$/).match(/^(천.)\(/)?.[1];
    add('boards', star ? `별|${star}` : null, '홍국기문(별)');
    const tGate = titleOf(r, '태을신수', /붙었습니다$/).match(/^(\S+문)/)?.[1];
    add('boards', tGate ? `문|${tGate}` : null, '태을신수(문)');
    const jk = titleOf(r, '태을신수', /주산|객산/);
    add('boards', /같습니다/.test(jk) ? '주객|대등' : /^주산이 큽니다/.test(jk) ? '주객|주산' : /^객산이 큽니다/.test(jk) ? '주객|객산' : null, '태을신수(주객)');
  });
  return keys;
}

/**
 * 태어난 해 하나로만 정해지는 열쇠 — 같은 해에 난 사람은 모두 같은 글을 받는다.
 * 리포트는 "그 사람 명반"만 말해야 하므로 고르지 않는다(드문 정도 표에는 남겨 둔다).
 *   구성학 본명성 · 태을신수(궁·문·주객) · 목성·토성 별자리(한 별자리에 1~2.5년 머문다)
 */
export const PEER_ONLY = /^(gujeong\|본명\||boards\|(궁|주객)\||western-planets\|(목성|토성)\|)/;
const TAEEUL_GATE = '태을신수(문)';

/**
 * 그 사람의 사전 항목들 — 드문 것부터.
 * share 는 무작위 2천 명에서 그 열쇠가 나온 비율(data/rarity.js). 없으면 중간값으로 둔다.
 * @returns {Array<{group, key, label, entry, share}>}
 */
export function dictEntries(r) {
  if (!DICT) return [];
  return dictKeys(r)
    .filter(([group, key, label]) => !PEER_ONLY.test(`${group}|${key}|`) && label !== TAEEUL_GATE)
    .map(([group, key, label]) => ({ group, key, label, entry: DICT[group]?.[key] ?? null, share: DICT_SHARE?.[`${group}|${key}`] ?? 0.1 }))
    .filter((x) => x.entry)
    .sort((a, b) => a.share - b.share);
}

/**
 * "그 사람이 어떤 사람인가"를 말할 때의 체계 순서 — 드문 것보다 **성격의 뼈대인 체계**가 먼저다.
 *   0: 사주(일간·태어난 달, 일주) · 자미두수 명궁
 *   1: 상승궁 · 달 · 태양 · 인도식 달·라그나
 *   2: 나머지 타고난 자리(숙요·금성·화성·수성·카발라·주역·타로·요일 등)
 * 육임·홍국기문은 그 순간의 사건과 결말을 점치는 판이라 성격 칸에 쓰지 않는다.
 */
const CORE_TIER = {
  사주: 0, '사주 일주': 0, 자미두수: 0,
  '서양 점성(상승)': 1, '서양 점성(달)': 1, '서양 점성(태양)': 1, '베딕(달)': 1, '베딕(라그나)': 1,
};
export const EVENT_BOARD = /^(육임|홍국기문)/;

/** 문장의 결 — 두 체계 이상이 같은 결을 말하면 앞으로, 이미 고른 문장과 반대 결이면 뺀다 */
export const THEMES = {
  fast: /빠르|급하|추진|직진|실행력|행동이 앞/,
  slow: /신중|차분|천천|느긋|느리|멈출 때|조심스럽/,
  firm: /고집|물러서지|굽히지|끈기|버티|잘 바꾸지 않/,
  soft: /유연|맞춰|흐름을 읽|양보/,
  out: /사교|어울리|활발|드러내|표현력|주목/,
  in: /혼자|조용|내성|속을 잘 안|드러내지 않/,
  care: /배려|돌봄|보살|챙기|헌신/,
  free: /자유|독립|얽매이|틀에 갇/,
};
export const OPPOSITE = { fast: 'slow', slow: 'fast', firm: 'soft', soft: 'firm', out: 'in', in: 'out' };
export const themesOf = (t) => Object.keys(THEMES).filter((k) => THEMES[k].test(t));
/** 두 체계가 거의 같은 문장을 가진 경우("겉으로는 자유로워 보이지만…"/"자유로워 보이지만…") — 글자 두 개 묶음이 절반 넘게 겹치면 같은 말로 본다 */
export const bigrams = (t) => { const s = t.replace(/\s|[.,]/g, ''); const out = new Set(); for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2)); return out; };
export const nearSame = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / Math.min(a.size, b.size) > 0.5; };

/**
 * 성격·일·돈·관계·조심 한 칸을 뼈대 체계 순으로 고른다.
 * 같은 단계 안에서는 다른 체계와 결이 겹치는 문장 → 드문 문장 순, 앞서 고른 문장과 반대 결이면 건너뛴다.
 */
export function coreField(entries, field, max = 4, skip = 0, keep = null) {
  // keep — 그 칸 안에서도 한 갈래만 고를 때(예: 일할 때 칸에서 "맞는 분야" 문장만)
  const cand = [];
  const seen = new Set();
  for (const e of entries) {
    if (EVENT_BOARD.test(e.label)) continue;
    const t = e.entry[field];
    if (!t || seen.has(t) || (keep && !keep(t))) continue;
    seen.add(t);
    cand.push({ text: t, label: e.label, share: e.share, tier: CORE_TIER[e.label] ?? 2, themes: themesOf(t), grams: bigrams(t) });
  }
  for (const c of cand) c.agree = cand.filter((o) => o !== c && o.themes.some((k) => c.themes.includes(k))).length;
  cand.sort((a, b) => a.tier - b.tier || b.agree - a.agree || a.share - b.share);
  const out = [];
  for (const c of cand) {
    if (out.some((o) => o.themes.some((k) => c.themes.includes(OPPOSITE[k])) || nearSame(o.grams, c.grams))) continue;
    out.push(c);
    if (out.length >= max + skip) break;
  }
  return out.slice(skip);
}

/**
 * 한 칸(성격·일·돈·관계·조심)을 여러 체계에서 모은다 — 드문 것부터, 같은 문장은 한 번만.
 * @param {'p'|'w'|'m'|'r'|'c'} field
 */
export function dictField(entries, field, max = 4, skip = 0) {
  // skip — 앞 칸이 이미 쓴 문장 수. 같은 칸을 두 곳에서 쓸 때 겹치지 않게 그다음 문장부터 준다
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const t = e.entry[field];
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push({ text: t, label: e.label, share: e.share });
    if (out.length >= max + skip) break;
  }
  return out.slice(skip);
}

/**
 * 10년 운(대운) 한 칸의 해석 — 전통대로 천간은 앞 다섯 해, 지지는 뒤 다섯 해를 맡는다.
 * 일간 × 대운 천간(100) · 일간 × 대운 지지(120) 사전에서 고른다.
 * @returns {{front: {h,g,c}|null, back: {h,g,c}|null}}
 */
export function daeunEntry(dayStem, stem, branch) {
  if (!DICT) return { front: null, back: null };
  const me = STEMS_KR[dayStem];
  return {
    front: DICT['daeun-stem']?.[`${me}|${STEMS_KR[stem]}`] ?? null,
    back: DICT['daeun-branch']?.[`${me}|${BRANCHES_KR[branch]}`] ?? null,
  };
}

/**
 * 자미두수 궁 하나의 해석 — 그 궁에 든 주성 조합(39가지)으로 고른다. 출생 시각이 없으면 null.
 * @param {'career'|'money'|'spouse'|'children'} which 관록궁·재백궁·부처궁·자녀궁
 * @returns {{h,g,c}|null}
 */
const PALACE_INDEX = { career: 8, money: 4, spouse: 2, children: 3 };
export function ziweiPalaceEntry(r, which) {
  if (!DICT || !r.input?.timeKnown) return null;
  try {
    const b = buildBoard(r.input);
    const branch = (((b.myeong - PALACE_INDEX[which]) % 12) + 12) % 12;
    const key = MAIN.filter((s) => b.board[branch].includes(s)).join('·') || '공궁';
    return DICT[`ziwei-${which}`]?.[key] ?? null;
  } catch { return null; }
}

/* ── 궁합 ─────────────────────────────────────────────────── */

/**
 * 두 사람 사이의 관계 해석 — 두 사람의 명반을 맞대어서만 정해지는 것(띠처럼 태어난 해로만 정해지는 것은 쓰지 않는다).
 *   stem: 두 일간의 기운 짝(5×5, 누가 누구를 살리고 누르는가) · hap: 일간끼리 끌어당기는 짝이면
 *   seat: 두 사람의 배우자 자리(일지)끼리 맞물리는가·부딪치는가
 * 문장의 {A}·{B} 자리에 이름을 넣는다. 각 항목은 {h 어떤 관계인가, g 잘 되려면, c 조심할 점}.
 */
const SEAT_ORDER = ['충', '형', '육합', '반합', '해', '파', '원진'];
export function pairReading(rA, rB, nameA, nameB) {
  if (!DICT) return null;
  const fill = (e) => e && Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v.replaceAll('{A}', nameA).replaceAll('{B}', nameB)]));
  try {
    const sa = rA.chart.dayStem, sb = rB.chart.dayStem;
    const stem = fill(DICT['pair-stem']?.[`${ELEMENTS[STEM_ELEMENT[sa]]}|${ELEMENTS[STEM_ELEMENT[sb]]}`]);
    const hap = isStemCombine(sa, sb) ? fill(DICT['pair-bond']?.[`합|${STEMS_KR[Math.min(sa, sb)]}${STEMS_KR[Math.max(sa, sb)]}`]) : null;
    const da = rA.chart.pillars.day.branch, db = rB.chart.pillars.day.branch;
    let kind = '없음';
    if (da === db) kind = '같음';
    else {
      const kinds = branchRelations(da, db).map((x) => (x.kind.includes('형') ? '형' : x.kind));
      kind = SEAT_ORDER.find((k) => kinds.includes(k)) ?? '없음';
    }
    const seat = fill(DICT['pair-bond']?.[`자리|${kind}`]);
    return { stem, hap, seat, seatKind: kind };
  } catch { return null; }
}

/**
 * 두 사람의 문장을 결(THEMES)로 맞대어 닮은 점과 부딪치는 점을 찾는다.
 * @returns {{same: Array<[a, b]>, clash: Array<[a, b]>}} 각 짝은 두 사람의 원문 문장
 */
export function themeContrast(textsA, textsB) {
  const same = [], clash = [];
  const usedA = new Set(), usedB = new Set();
  for (const a of textsA) {
    const ta = themesOf(a);
    for (const b of textsB) {
      if (usedA.has(a) || usedB.has(b) || a === b) continue;
      const tb = themesOf(b);
      if (ta.some((k) => tb.includes(OPPOSITE[k]))) { clash.push([a, b]); usedA.add(a); usedB.add(b); }
      else if (ta.some((k) => tb.includes(k))) { same.push([a, b]); usedA.add(a); usedB.add(b); }
    }
  }
  return { same, clash };
}
