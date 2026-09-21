/**
 * extract.js — LEVEL 1 → LEVEL 2. **기호를 집는 자리**
 *
 * 계산은 하지 않는다. `readFortune` 과 `hires/` 가 이미 구한 값에서
 * 그 전통이 직업을 보라고 지정한 자리의 기호를 꺼낼 뿐이다.
 *
 * ── 지표를 골라 쓰지 않는다 ────────────────────────────────
 * 역산에서 확인된 것: 베딕 일곱 지표 중 최고가 4/8 이었고, 일곱을 전부
 * 동원해도 6/8 이며 그마저 **사람마다 다른 지표를 골라야** 나왔다.
 * 사후에 고르는 것은 규칙이 아니다. 그래서 표준 독법이 쓰는 지표를
 * **전부 함께** 싣고, 무게는 증거 등급과 전통 강도로만 가른다.
 *
 * ── 없으면 없다고 한다 ────────────────────────────────────
 *   unavailable      시각 미상처럼 재료가 없다
 *   empty            자리는 섰는데 비었다 (공궁 등)
 * 둘을 뭉뚱그리면 나중에 침묵이 오답으로 세어진다.
 */

import * as ZE from '../hires/ziweiExt.js';
import * as VEX from '../hires/vedicExt.js';
import * as WS from '../hires/western.js';
import * as IN from '../hires/interpret.js';
import { DOMICILE } from '../hires/classical.js';
import { houseOf } from '../core/planets.js';
import { tenGod, elementDistribution, STEM_ELEMENT } from '../core/ganzhi.js';
import { QUALITY_NAME } from './tables/western.js';
import { CAREER as ZI_CAREER } from './tables/ziwei.js';

export const SYSTEM_IDS = [
  'saju', 'jamidusu', 'astrology', 'vedic',
  'juyeok', 'yukim', 'hongguk', 'taeeul',
  'gujeong', 'sukyo', 'tojeong',
  'kabbalah', 'mahabote', 'thai', 'tarot',
];

export const SYSTEM_NAME = {
  saju: '사주', jamidusu: '자미두수', astrology: '점성술', vedic: '베딕',
  juyeok: '주역', yukim: '육임', hongguk: '홍국기문', taeeul: '태을신수',
  gujeong: '구성학', sukyo: '숙요', tojeong: '토정비결',
  kabbalah: '카발라', mahabote: '마하보테', thai: '태국 점성술', tarot: '타로',
};

const safe = (fn) => { try { return fn(); } catch { return null; } };
const signOf = (lon) => Math.floor((((lon % 360) + 360) % 360) / 30);

/** 한 체계가 낸 조건 하나 */
const hit = (condition, basis, weight = 1) => ({ condition, basis, weight });

// ─────────────────────────────────────────────────────────────
// 사주
// ─────────────────────────────────────────────────────────────

/**
 * 십성을 **열 가지 그대로** 센다.
 *
 * 전에는 다섯 무리로 묶어 썼더니 열한 명 중 서로 다른 벡터가 5개뿐이었다.
 * 명리는 원래 정재/편재, 정관/편관, 정인/편인을 다른 것으로 읽는다.
 */
export function sajuCareer(chart) {
  if (!chart?.pillars?.month) return { status: 'unavailable', why: '월주를 세우지 못했다' };
  const out = [];
  const count = {};
  // 일간은 나 자신이라 십성이 아니다. 나머지 세 천간만 센다
  for (const k of ['year', 'month', 'hour']) {
    const p = chart.pillars[k];
    if (!p) continue;
    const g = tenGod(chart.dayStem, p.stem);
    if (g) count[g] = (count[g] ?? 0) + 1;
  }
  // 월지 본기 십성 — 격을 세우는 자리라 무게를 더 준다
  const monthGod = tenGod(chart.dayStem, chart.pillars.month.stem);
  for (const [god, n] of Object.entries(count)) {
    const w = god === monthGod ? 1.3 : 1;
    out.push(hit(`god:${god}`, `천간 ${god} ${n}개${god === monthGod ? ' (월간 — 격의 자리)' : ''}`,
      Math.min(1, (n / 3) * w + 0.35)));
  }
  const el = STEM_ELEMENT?.[chart.pillars.day.stem];
  if (el != null) out.push(hit(`dayElement:${el}`, `일간 ${chart.pillars.day.stem}`, 0.7));

  const dist = elementDistribution(chart.pillars);
  return {
    status: out.length ? 'ok' : 'empty', hits: out,
    facts: { count, monthGod, dayElement: el, elementSpread: dist ? Math.max(...dist.pct) - Math.min(...dist.pct) : null },
  };
}

// ─────────────────────────────────────────────────────────────
// 자미두수
// ─────────────────────────────────────────────────────────────

/** 십사주성. 공궁일 때 대궁에서 빌려 올 것을 가리는 데도 쓴다 */
const MAIN_STARS = new Set(Object.keys(ZI_CAREER));

function palaceRow(input, stack, domain, name) {
  const rows = ZE.domainPalaces(input, domain, stack.layers).find((x) => x.palace === name)?.rows ?? [];
  const row = rows.find((r) => /원국/.test(r.layer ?? '')) ?? null;
  if (!row) return null;
  let main = (row.main ?? []).filter((s) => MAIN_STARS.has(s));
  let borrowed = false;
  // 공궁이면 대궁(마주 보는 궁)을 빌린다 — 두수 표준 독법이다
  if (!main.length && row.branch != null) {
    const board = stack.board?.board ?? null;
    const opp = ZE.trineSquare(row.branch).opposite;
    if (board?.[opp]) { main = board[opp].filter((s) => MAIN_STARS.has(s)); borrowed = main.length > 0; }
  }
  return { ...row, main, borrowed };
}

export function ziweiCareer(input, stack) {
  if (!stack) return { status: 'unavailable', why: '출생 시각을 알아야 판을 세운다' };
  const row = safe(() => palaceRow(input, stack, '직업', '관록궁'));
  if (!row) return { status: 'unavailable', why: '관록궁을 세우지 못했다' };

  const out = [];
  const stars = row.main ?? [];
  for (const s of stars) {
    out.push(hit(`career:${s}`, row.borrowed ? `관록궁 공궁 → 대궁 ${s}` : `원국 관록궁 ${s}`, 1));
  }
  // 삼방사정의 보조성·사화 — 세기를 조절한다
  for (const s of row.lucky ?? []) out.push(hit(`aux:${s}`, `관록궁 ${s}`, 0.6));
  for (const s of row.evil ?? []) out.push(hit(`aux:${s}`, `관록궁 ${s}`, 0.6));
  for (const s of row.sihwa ?? []) {
    const kind = ['화록', '화권', '화과', '화기'].find((k) => String(s).endsWith(k));
    if (kind) out.push(hit(`sihwa:${kind}`, `관록궁 ${s}`, 0.7));
  }
  if (!out.length) return { status: 'empty', why: '관록궁이 비었고 대궁도 비었다' };
  return { status: 'ok', hits: out, facts: { stars, borrowed: row.borrowed } };
}

// ─────────────────────────────────────────────────────────────
// 서양 점성술
// ─────────────────────────────────────────────────────────────

export function westernCareer(input) {
  if (!input?.timeKnown) return { status: 'unavailable', why: '출생 시각을 알아야 하우스를 세운다' };
  const N = safe(() => WS.natalPack(input));
  if (!N?.cusps) return { status: 'unavailable', why: '하우스를 세우지 못했다' };

  const out = [];
  const mc = signOf(N.cusps[10]);
  out.push(hit(`mcSign:${mc}`, `10하우스 ${IN.SIGN_NAME[mc]}`, 1));
  out.push(hit(`mcQuality:${QUALITY_NAME[mc % 3]}`, `10하우스 ${IN.SIGN_NAME[mc]}(${QUALITY_NAME[mc % 3]})`, 0.7));

  const inHouse = (n) => Object.entries(N.pos)
    .filter(([, v]) => houseOf(v.lon, N.cusps) === n).map(([k]) => k);

  for (const p of inHouse(10)) out.push(hit(`tenth:${p}`, `10하우스에 ${p}`, 1));
  for (const p of inHouse(6)) out.push(hit(`sixth:${p}`, `6하우스에 ${p}`, 0.7));

  // MC 주인 — 표준 독법의 1순위 지표
  const lord = DOMICILE[mc];
  if (lord && N.pos?.[lord]) {
    out.push(hit(`mcLord:${lord}`, `MC 주인 ${lord}`, 1));
    const h = houseOf(N.pos[lord].lon, N.cusps);
    if (h) out.push(hit(`mcLordHouse:${h}`, `MC 주인 ${lord}가 ${h}하우스`, 0.8));
  }
  return { status: 'ok', hits: out, facts: { mcSign: mc, mcLord: lord, tenth: inHouse(10), sixth: inHouse(6) } };
}

// ─────────────────────────────────────────────────────────────
// 베딕
// ─────────────────────────────────────────────────────────────

export function vedicCareer(input) {
  const wp = safe(() => VEX.wealthPack(input));
  const k = safe(() => VEX.charaKarakas(input));
  if (!wp) return { status: 'unavailable', why: '차트를 세우지 못했다' };

  const out = [];
  const dig = (x) => VE_DIGNITY(x);
  if (wp.d10_1?.lord) out.push(hit(`d10Lagnesh:${wp.d10_1.lord}`, `D10 라그나주 ${wp.d10_1.lord}`, dig(wp.d10_1.lordDignity)));
  if (wp.d10_10?.lord) out.push(hit(`d10TenthLord:${wp.d10_10.lord}`, `D10 10궁주 ${wp.d10_10.lord}`, dig(wp.d10_10.lordDignity)));
  for (const p of wp.d10_10?.occupants ?? []) out.push(hit(`d10TenthIn:${p}`, `D10 10궁에 ${p}`, 0.8));
  if (wp.d1_10?.lord) out.push(hit(`d1TenthLord:${wp.d1_10.lord}`, `D1 10궁주 ${wp.d1_10.lord}`, dig(wp.d1_10.lordDignity)));
  if (k?.atmakaraka?.planet) out.push(hit(`atmakaraka:${k.atmakaraka.planet}`, `아트마카라카 ${k.atmakaraka.planet}`, 0.8));
  // D10 라그나 라시. `d10Lagna` 는 이름이라 지수는 1궁 정보에서 가져온다
  const lagnaIdx = wp.d10_1?.signIndex;
  if (Number.isInteger(lagnaIdx)) {
    out.push(hit(`d10Lagna:${lagnaIdx}`, `D10 라그나 ${wp.d10Lagna ?? lagnaIdx}`, 0.7));
  }
  if (!out.length) return { status: 'empty', why: 'D10 을 세우지 못했다' };
  return { status: 'ok', hits: out, facts: { d10Lagnesh: wp.d10_1?.lord, d10TenthLord: wp.d10_10?.lord, ak: k?.atmakaraka?.planet } };
}

/** 행성 상태가 강하면 그 뜻이 진하게 나온다 */
const DIGNITY = { 고양: 1, 정위: 1, 무랄라트리코나: 1, 우호: 0.9, 중립: 0.85, 적대: 0.7, 쇠약: 0.6 };
const VE_DIGNITY = (d) => DIGNITY[d] ?? 0.85;

// ─────────────────────────────────────────────────────────────
// 나머지 열한 체계
// ─────────────────────────────────────────────────────────────

export function auxCareer(results) {
  const symbols = safe(() => IN.auxSymbols(results ?? [])) ?? [];
  const out = {};
  for (const s of symbols) {
    out[s.id] = s.unavailable
      ? { status: 'unavailable', why: s.unavailable }
      : { status: 'ok', hits: [hit(`symbol:${s.symbol}`, s.basis, 1)], facts: { symbol: s.symbol } };
  }
  return out;
}

// ─────────────────────────────────────────────────────────────

/**
 * 한 사람의 직업 기호를 체계마다 꺼낸다.
 *
 * @param {object} fortune `readFortune` 결과
 * @param {object|null} stack `ZW.stackAt` 결과
 * @returns {Record<string, {status, hits?, facts?, why?}>}
 */
export function extractCareer(fortune, stack) {
  const { input, chart, results } = fortune;
  const out = {
    saju: safe(() => sajuCareer(chart)) ?? { status: 'unavailable', why: '계산 중 오류' },
    jamidusu: safe(() => ziweiCareer(input, stack)) ?? { status: 'unavailable', why: '계산 중 오류' },
    astrology: safe(() => westernCareer(input)) ?? { status: 'unavailable', why: '계산 중 오류' },
    vedic: safe(() => vedicCareer(input)) ?? { status: 'unavailable', why: '계산 중 오류' },
    ...auxCareer(results),
  };
  for (const id of SYSTEM_IDS) {
    if (!out[id]) out[id] = { status: 'unavailable', why: '이번 계산에서 값이 나오지 않았다' };
  }
  return out;
}
