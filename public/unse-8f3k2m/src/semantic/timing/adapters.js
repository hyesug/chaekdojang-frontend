/**
 * timing/adapters.js — 체계마다 **자기 방식대로** 시기를 보고, 모양만 맞춘다
 *
 * ── 감사 결과 ─────────────────────────────────────────────
 * 열다섯이 전부 이미 `forecast(input, chart, period)` 로 시기 점수를 낸다.
 * 그리고 `hires/grid.js` 가 네 체계의 시기 재료를 절기월 축 위에 나란히
 * 놓아 둔다. **새로 천문 계산을 만들 필요가 없다.**
 *
 *   사주   세운·월운 간지 · 원국과의 합충형 · 십성 · 대운
 *   자미   대한·유년·유월 궁이 원국 궁과 겹치는가 · 사화
 *   점성   트랜싯이 하우스·주인·앵글에 각을 맺는가
 *   베딕   마하다샤·안타르다샤 주인 · 고차라
 *   나머지 열하나  각자의 주기 (개인년·구성 연반·태을궁·괘 …)
 *
 * ── activation 과 featureShift 를 따로 만든다 ───────────────
 * **activation** — 그 분야의 *자리*가 건드려졌는가. 궁이 겹쳤나, 십성이
 *   그 자리에 왔나, 트랜싯이 그 하우스 주인을 쳤나.
 * **featureShift** — 그 시기의 *기호*를 **정적 해석과 같은 규칙표**에
 *   통과시킨다. 원국의 편재가 '상업·독립'이면 세운의 편재도 그 방향을
 *   켠다. 사전이 하나라 근거 사슬이 이어진다.
 */

import { AXES } from '../axes.js';
import { RULES, TABLE_MEAN } from '../rules.js';
import { DOMAIN_RULES, DOMAIN_TABLE_MEAN, DOMAINS } from '../domains.js';
import { lineageOf } from '../lineage.js';
import { SYSTEM_IDS, SYSTEM_NAME } from '../extract.js';
import { signal, unavailable, zeroActivations, clamp01, clampShift } from './schema.js';
import * as NA from '../tables/nature.js';

const safe = (fn) => { try { return fn(); } catch { return null; } };

/** 그 분야 규칙을 찾는다 — 직업은 rules.js, 나머지는 domains.js */
const ruleOf = (system, domain, condition) => {
  const pool = domain === 'career' ? RULES : DOMAIN_RULES;
  return pool.find((r) => r.system === system && r.domain === domain && r.condition === condition) ?? null;
};
const tableMeanOf = (system, domain) =>
  (domain === 'career' ? TABLE_MEAN[system] : DOMAIN_TABLE_MEAN[system]?.[domain]) ?? {};

/**
 * 시기 기호를 축 이동으로 바꾼다.
 *
 * **정적 해석과 같은 규칙표를 쓴다.** 그 표의 평균에서 벗어난 만큼이
 * 곧 "이 시기가 어느 쪽으로 미는가"다.
 */
function shiftFrom(system, domain, conditions, strength = 1) {
  const mean = tableMeanOf(system, domain);
  const axes = AXES[domain] ?? [];
  const out = {};
  let n = 0;
  for (const c of conditions) {
    const r = ruleOf(system, domain, c);
    if (!r) continue;
    n++;
    for (const ax of axes) {
      const dev = (r.features[ax] ?? 0) - (mean[ax] ?? 0);
      out[ax] = (out[ax] ?? 0) + dev;
    }
  }
  if (!n) return null;
  return clampShift(Object.fromEntries(axes.map((ax) => [ax, ((out[ax] ?? 0) / n) * strength])));
}

// ═════════════════════════════════════════════════════════════
// 사주 — 세운·월운 간지가 원국을 건드리는가
// ═════════════════════════════════════════════════════════════

/** 분야마다 그 시기 십성이 자리에 들었는지 본다 (명리 표준 배당) */
const SAJU_SEAT_GODS = {
  personality: null,
  career: ['정관', '편관', '식신', '상관', '비견', '겁재'],
  relationship: ['정재', '편재', '정관', '편관'],
  marriage: ['정재', '편재', '정관', '편관'],
  children: ['식신', '상관'],
  education: ['정인', '편인'],
  wealth: ['정재', '편재', '식신', '상관'],
  residence: ['정인', '편인', '정재'],
  movement: ['편재', '상관', '편관', '겁재'],
  health: ['편관', '상관', '겁재'],
  majorChange: ['겁재', '상관', '편재', '편관'],
  timing: null,
};

export function sajuTiming(month, period) {
  const b = month?.bazi;
  if (!b) return unavailable('saju', period, '월운을 세우지 못했다');

  // 원국과의 합·충·형 — 그 달이 얼마나 시끄러운가
  const friction = (b.hits ?? []).reduce((a, h) => a + (h.weight ?? 0), 0);
  const stir = clamp01(friction / 1.8);

  const gods = [b.god, b.branchGod].filter(Boolean);
  const activations = zeroActivations();
  const featureShift = {};
  const evidence = [];

  for (const d of DOMAINS) {
    const seat = SAJU_SEAT_GODS[d];
    // 그 시기 십성이 이 분야의 자리에 들었는가
    const onSeat = seat ? gods.filter((g) => seat.includes(g)).length : 0;
    const seatHit = seat ? clamp01(onSeat / Math.max(1, gods.length)) : 0.3;
    activations[d] = clamp01(0.25 * stir + 0.75 * seatHit * (0.4 + 0.6 * stir));

    const sh = shiftFrom('saju', d, gods.map((g) => `god:${g}`));
    if (sh) featureShift[d] = sh;
  }

  // 대운이 바뀌는 무렵은 판 자체가 바뀐다
  if (b.daeun?.changing) {
    for (const d of ['career', 'majorChange', 'residence', 'movement']) {
      activations[d] = clamp01(activations[d] + 0.2);
    }
    evidence.push({ what: '대운 전환', basis: b.daeun.label ?? '대운이 바뀌는 무렵', weight: 0.2 });
  }

  if (gods.length) {
    evidence.push({ what: '시기 십성', basis: `${b.gz ?? ''} ${gods.join('·')}`, weight: 1 });
  }
  for (const h of (b.hits ?? []).slice(0, 3)) {
    evidence.push({ what: `원국 ${h.with} ${h.kind}`, basis: `무게 ${h.weight}`, weight: h.weight ?? 0 });
  }

  return signal('saju', period, { activations, featureShift, evidence, resolution: 'month' });
}

// ═════════════════════════════════════════════════════════════
// 자미두수 — 대한·유년·유월 궁이 원국 궁과 겹치는가
// ═════════════════════════════════════════════════════════════

/** 분야 → 볼 궁 (정적 해석과 같은 배당) */
const ZIWEI_PALACE = {
  personality: '명궁', career: '관록궁', relationship: '부처궁', marriage: '부처궁',
  children: '자녀궁', education: '관록궁', wealth: '재백궁', residence: '전택궁',
  movement: '천이궁', health: '질액궁', majorChange: '명궁', timing: '명궁',
};

export function ziweiTiming(month, period, stack) {
  const z = month?.ziwei;
  if (!z || !stack) return unavailable('jamidusu', period, '출생 시각을 알아야 판을 세운다');

  const activations = zeroActivations();
  const featureShift = {};
  const evidence = [];

  // 그 달의 유월 층에서 어느 궁이 어디에 왔는가
  const monthMap = z.month?.map ?? null;
  const monthStars = z.month?.stars ?? [];
  const monthSihwa = (z.month?.sihwa ?? []).map((s) => (typeof s === 'string' ? s : `${s.star ?? ''}${s.kind ?? ''}`));

  for (const d of DOMAINS) {
    const palace = ZIWEI_PALACE[d];
    let act = 0;
    const stars = [];

    // 층이 겹치는 수 — 두수가 '되풀이 켜진다'고 보는 자리
    const row = (z.overlap?.rows ?? []).find((x) => x.palace === palace);
    if (row) {
      const layers = row.hits ?? [];
      const repeated = layers.length > 1 ? layers.length - 1 : 0;
      act += clamp01(repeated / 3) * 0.5;
      for (const h of layers) {
        for (const s of h.stars ?? []) stars.push(s);
        // 사화가 그 궁에 들면 그 자리가 켜진다
        if ((h.sihwa ?? []).length) {
          act += 0.25;
          evidence.push({ what: `${palace} 사화`, basis: `${h.layer} ${h.sihwa.join('·')}`, domain: d, weight: 0.25 });
        }
      }
    }
    // 유월에 그 궁이 오면 그 달이 그 분야의 달이다
    if (monthMap && monthMap[z.month?.branch ?? -1] === palace) {
      act += 0.3;
      evidence.push({ what: `유월 ${palace}`, basis: `${period} 유월이 ${palace}`, domain: d, weight: 0.3 });
    }
    if (monthSihwa.length && palace === ZIWEI_PALACE[d]) act += 0.1;

    activations[d] = clamp01(act);
    const syms = [...new Set([...stars, ...monthStars])];
    const sh = shiftFrom('jamidusu', d, syms.map((s) => (d === 'career' ? `career:${s}` : `star:${s}`)));
    if (sh) featureShift[d] = sh;
  }

  return signal('jamidusu', period, { activations, featureShift, evidence, resolution: 'month' });
}

// ═════════════════════════════════════════════════════════════
// 점성술 — 트랜싯이 그 분야의 하우스를 건드리는가
// ═════════════════════════════════════════════════════════════

const WEST_HOUSE = {
  personality: [1], career: [10, 6], relationship: [7, 5], marriage: [7],
  children: [5], education: [9, 3], wealth: [2, 8], residence: [4],
  movement: [3, 9, 12], health: [6, 1], majorChange: [1, 8, 10], timing: [10],
};

/** 각의 무게 — 합·대각이 가장 세다 (전통 배당) */
const ASPECT_W = { 합: 1, 대각: 0.9, 사각: 0.85, 삼각: 0.6, 육각: 0.4 };
/** 느린 행성일수록 시기를 가른다 */
const SLOW = { 토성: 1, 천왕성: 1, 해왕성: 0.9, 명왕성: 1, 목성: 0.8, 화성: 0.5, 태양: 0.35, 금성: 0.3, 수성: 0.25, 달: 0.15 };

const ANGLE_HOUSE = { 중천: 10, 상승점: 1, 하강점: 7, 천저: 4 };

export function westernTiming(month, period, natal) {
  const t = month?.western?.transits;
  if (!t || !natal?.cusps) return unavailable('astrology', period, '출생 시각을 알아야 하우스를 세운다');

  const activations = zeroActivations();
  const featureShift = {};
  const evidence = [];
  const byDomain = Object.fromEntries(DOMAINS.map((d) => [d, []]));

  for (const h of t.hits ?? []) {
    const w = (ASPECT_W[h.aspect] ?? 0.3) * (SLOW[h.planet] ?? 0.3) * (0.4 + 0.6 * (h.tight ?? 0.5));
    // 맞은 자리가 어느 하우스인가
    const targetHouse = h.house ?? ANGLE_HOUSE[h.target] ?? null;
    for (const d of DOMAINS) {
      const houses = WEST_HOUSE[d] ?? [];
      if (targetHouse != null && houses.includes(targetHouse)) {
        byDomain[d].push({ h, w });
      }
    }
  }

  for (const d of DOMAINS) {
    const hits = byDomain[d];
    // 여러 트랜싯이 겹치면 누적하되 포화시킨다
    const act = clamp01(1 - hits.reduce((a, x) => a * (1 - Math.min(0.9, x.w)), 1));
    activations[d] = act;
    if (hits.length) {
      const planets = [...new Set(hits.map((x) => x.h.planet))];
      // 트랜싯 행성의 뜻을 정적 해석과 같은 표로 옮긴다
      const conds = d === 'career'
        ? planets.map((p) => `tenth:${p}`)
        : planets.map((p) => `planet:${p}`);
      const sh = shiftFrom('astrology', d, conds) ?? shiftFrom('astrology', d, planets.map((p) => `sign:${p}`));
      if (sh) featureShift[d] = sh;
      for (const x of hits.slice(0, 2)) {
        evidence.push({ what: `${x.h.planet}–${x.h.target} ${x.h.aspect}`,
          basis: `오브 ${x.h.orb}°${x.h.exact ? ' (정각)' : ''}`, domain: d, weight: Math.round(x.w * 100) / 100 });
      }
    }
  }

  return signal('astrology', period, { activations, featureShift, evidence, resolution: 'month' });
}

// ═════════════════════════════════════════════════════════════
// 베딕 — 다샤 주인이 그 분야의 자리인가
// ═════════════════════════════════════════════════════════════

const VEDIC_HOUSE = WEST_HOUSE;

export function vedicTiming(month, period, packs) {
  const d1 = packs?.d1;
  const dasha = month?.vedic?.dasha;
  if (!d1 || !dasha) return unavailable('vedic', period, '다샤를 세우지 못했다');

  const lords = [dasha.maha?.lord ?? dasha.md, dasha.antar?.lord ?? dasha.ad, dasha.pratyantar?.lord ?? dasha.pd]
    .filter(Boolean);
  const activations = zeroActivations();
  const featureShift = {};
  const evidence = [];

  for (const d of DOMAINS) {
    const houses = VEDIC_HOUSE[d] ?? [];
    let act = 0;
    // 다샤 주인이 그 분야 궁의 주인이거나 그 궁에 앉았으면 그 자리가 켜진다
    lords.forEach((p, i) => {
      const w = [0.5, 0.35, 0.15][i] ?? 0.1;
      for (const hn of houses) {
        const l = safe(() => d1.lordOf(hn));
        const occ = safe(() => d1.inHouse(hn)) ?? [];
        if (l?.lord === p) { act += w; evidence.push({ what: `다샤 ${p} = ${hn}궁주`, basis: `${i === 0 ? '마하' : i === 1 ? '안타르' : '프라탼타르'}다샤`, domain: d, weight: w }); }
        else if (occ.includes(p)) { act += w * 0.7; }
      }
    });
    activations[d] = clamp01(act);
    const sh = shiftFrom('vedic', d, lords.map((p) => (d === 'career' ? `d10Lagnesh:${p}` : `planet:${p}`)));
    if (sh) featureShift[d] = sh;
  }

  // 다샤가 바뀌는 무렵은 판이 바뀐다
  if (month?.vedic?.changes?.length) {
    for (const d of ['career', 'majorChange']) activations[d] = clamp01(activations[d] + 0.2);
    evidence.push({ what: '다샤 전환', basis: String(month.vedic.changes[0]?.label ?? ''), weight: 0.2 });
  }

  return signal('vedic', period, { activations, featureShift, evidence, resolution: 'month' });
}

// ═════════════════════════════════════════════════════════════
// 나머지 열한 체계 — 각자의 주기
//
// 이들은 하우스도 궁도 없다. 대신 **그 시기의 기호**를 낸다 (개인년 수,
// 구성 연반 궁, 태을궁, 그 해의 괘 …). 그 기호를 정적 해석과 같은 물상표에
// 통과시켜 featureShift 를 만들고, activation 은 `forecast()` 가 내는
// 영역 점수의 **그 사람 안에서의 편차**로 잡는다.
//
// 태국 점성술처럼 달마다 값이 같은 체계는 `resolution: 'none'` 이다 —
// 시기를 가르지 못한다고 **적어 둔다.**
// ═════════════════════════════════════════════════════════════

/** 옛 여섯 영역 → 열두 분야 */
const AREA_TO_DOMAIN = {
  총운: ['personality', 'majorChange', 'timing'],
  애정운: ['relationship', 'marriage'],
  금전운: ['wealth'],
  직장운: ['career'],
  학업운: ['education', 'children'],
  건강운: ['health'],
};

/** 그 체계가 그 시기에 낸 기호 — headline·facts 에서 집는다 */
function periodSymbol(system, row) {
  const head = String(row?.headline ?? '');
  const fact = (label) => (row?.facts ?? []).find((f) => f.label === label)?.value ?? null;
  const GUA = /[乾兌離震巽坎艮坤]/;
  switch (system) {
    case 'juyeok': case 'tojeong':
      return [head.match(GUA)?.[0]].filter(Boolean);
    case 'taeeul':
      return [String(head).match(/[離坎坤震巽乾兌艮]/)?.[0]].filter(Boolean);
    case 'gujeong':
      return [head.match(/(일백|이흑|삼벽|사록|오황|육백|칠적|팔백|구자)/)?.[1],
        head.match(GUA)?.[0]].filter(Boolean);
    case 'yukim':
      return [head.match(/(귀인|등사|주작|육합|구진|청룡|천공|백호|태상|현무|태음|천후)/)?.[1]].filter(Boolean);
    case 'hongguk':
      return [head.match(/(휴문|생문|상문|두문|경문|사문|개문)/)?.[1], head.match(GUA)?.[0]].filter(Boolean);
    case 'kabbalah': {
      const n = Number(head.match(/개인년\s*(\d+)/)?.[1]);
      return Number.isFinite(n) ? [n] : [];
    }
    case 'sukyo': case 'thai':
      return [head.match(/[일월화수목금토]/)?.[0]].filter(Boolean);
    case 'mahabote':
      return [head.match(/(태양|달|화성|수성|목성|금성|토성|라후|케투)/)?.[1]].filter(Boolean);
    case 'tarot':
      return [head.replace(/^\d+\.\s*/, '').trim()].filter(Boolean);
    default: return [];
  }
}

/**
 * @param {object} row  그 체계의 `forecast()` 결과
 * @param {object} stats {mean, sd} — 그 사람의 그 기간 안에서의 분포
 */
export function otherTiming(system, period, row, stats) {
  if (!row) return unavailable(system, period, '그 시기를 계산하지 못했다');
  const activations = zeroActivations();
  const featureShift = {};
  const evidence = [];

  // 달마다 값이 같으면 시기를 가르지 못한다 — 그렇다고 적는다.
  // 흔들림은 있어도 **해 단위로만** 바뀌는 체계가 있다 (태을신수는 한 궁에
  // 세 해를 머문다). 없는 해상도를 있다고 하지 않으려고 따로 가른다.
  const flat = !stats || stats.sd < 0.6;
  const yearly = !flat && (stats.changeRate ?? 1) < 0.25;
  for (const [area, doms] of Object.entries(AREA_TO_DOMAIN)) {
    const v = row.areas?.[area];
    if (v == null) continue;
    // 그 사람의 그 기간 안에서 몇 표준편차인가 (절대 점수가 아니라 상대 순위)
    const z = flat ? 0 : (v - (stats.mean?.[area] ?? 50)) / Math.max(1e-6, stats.sd);
    for (const d of doms) activations[d] = clamp01(0.5 + z * 0.25);
  }

  const syms = periodSymbol(system, row);
  for (const d of DOMAINS) {
    const sh = shiftFrom(system, d,
      syms.map((s) => (d === 'career' && system === 'hongguk' ? `gate:${s}` : `symbol:${s}`)));
    if (sh) featureShift[d] = sh;
  }
  if (syms.length) evidence.push({ what: '그 시기의 기호', basis: `${row.headline ?? ''}`, weight: 1 });

  return signal(system, period, {
    activations, featureShift, evidence,
    resolution: flat ? 'none' : yearly ? 'year' : 'month',
    ...(flat ? { why: '달마다 값이 같아 시기를 가르지 못한다' }
      : yearly ? { why: '해 단위로만 바뀐다 — 달을 가르지 못한다' } : {}),
  });
}

export { lineageOf, SYSTEM_IDS, SYSTEM_NAME };
