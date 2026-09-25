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

/**
 * **같은 원천을 두 번 세지 않는다.**
 *
 * 대운이 바뀌는 달은 세운 충도 같이 걸리기 쉽고, 마주 보는 두 커스프는 한
 * 각이 만든 두 줄이다. 그런 것을 그냥 더하면 한 가지 사실이 두세 몫을 받는다.
 *
 * 그래서 근거를 **원천(group)** 으로 묶는다. 한 묶음 안에서는 가장 센 것을
 * 쓰고 되풀이된 만큼만 조금 올린다(포화). 묶음끼리는 noisy-OR 로 합친다 —
 * 서로 다른 원천이 겹칠 때만 확신이 오른다.
 */
export function evidenceOr(groups) {
  let miss = 1;
  for (const xs of Object.values(groups)) {
    const v = (xs ?? []).filter(Number.isFinite);
    if (!v.length) continue;
    const top = Math.max(...v);
    // 같은 원천이 두 번, 세 번 걸리면 조금만 올린다 (최대 +30%)
    const rep = 1 + 0.15 * Math.min(2, v.length - 1);
    miss *= 1 - clamp01(top * rep);
  }
  return clamp01(1 - miss);
}

/** activation 이 숫자인 분야만 '말할 수 있다'로 센다 */
const availabilityOf = (acts) =>
  Object.fromEntries(Object.entries(acts).map(([d, v]) => [d, Number.isFinite(v)]));

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

/**
 * 근묘화실 — 원국의 어느 기둥이 그 분야의 자리인가.
 *
 * 년주=뿌리·조상, 월주=부모·사회·직업, 일주=자신과 배우자, 시주=자녀·말년.
 * **명리 기본 배당이다.** 여기 없는 분야는 기둥을 배정하지 않는다 —
 * 재물은 기둥이 아니라 재성(십성)으로 보기 때문이다.
 */
const SAJU_PILLAR = {
  career: '월주', education: '월주',
  marriage: '일주', relationship: '일주',
  children: '시주',
  health: '일주',
};

/** 관계의 종류별 무게 — 충이 가장 크게 자리를 흔든다 */
const HIT_W = { 충: 1, 천간충: 0.9, 형: 0.7, 삼형: 0.8, 자형: 0.6, 해: 0.5, 파: 0.4,
  육합: 0.7, 천간합: 0.7, 삼합: 0.8, 반합: 0.6, 방합: 0.7, 가합: 0.3 };
/** 어느 층과 부딪쳤나 — 원국을 직접 치는 것이 가장 세다 */
const LAYER_W = { 년주: 0.8, 월주: 1, 일주: 1, 시주: 0.9, 세운: 0.7, 대운: 0.6 };

export function sajuTiming(month, period, ctx = null) {
  const b = month?.bazi;
  if (!b) return unavailable('saju', period, '월운을 세우지 못했다');

  const hits = b.hits ?? [];
  // 그 달이 얼마나 시끄러운가 — 합과 충형을 **따로** 센다.
  // 합도 충도 자리를 움직이지만 뜻이 다르고, 뭉쳐서 더하면 방향이 사라진다.
  const sumOf = (pick) => hits.filter(pick)
    .reduce((a, h) => a + (HIT_W[h.kind] ?? h.weight ?? 0.4) * (LAYER_W[h.with] ?? 0.6), 0);
  // 그 분야의 기둥을 친 관계는 아래에서 따로 센다. 여기서 또 세면 한 번의
  // 충이 두 몫을 받는다 — 같은 원천을 두 번 세지 않는다
  const stirOf = (pillar) => {
    const rest = (h) => h.with !== pillar;
    return clamp01((sumOf((h) => rest(h) && h.good === false)
      + sumOf((h) => rest(h) && h.good !== false) * 0.7) / 2.2);
  };

  // 세운 십성도 함께 본다 — 그 해의 십성이 자리에 들면 그 해 내내 그 분야가
  // 열려 있고, 달은 그 위에서 언제인지를 가린다
  const yearGods = ctx?.year ? [ctx.year.god, ctx.year.branchGod].filter(Boolean) : [];
  const monthGods = [b.god, b.branchGod].filter(Boolean);
  const activations = zeroActivations();
  const featureShift = {};
  const evidence = [];

  // 대운이 바뀌는 무렵은 판 자체가 바뀐다.
  // (전에는 `b.daeun?.changing` 을 봤는데 `b.daeun` 은 간지 문자열이라
  //  이 가지가 한 번도 실행되지 않았다. 실제 전환 시점으로 고쳤다.)
  const toTurn = ctx?.daeun?.toTurn;
  const daeunTurn = Number.isFinite(toTurn) && toTurn < 1;

  for (const d of DOMAINS) {
    const seat = SAJU_SEAT_GODS[d];
    if (!seat) { activations[d] = null; continue; }

    const onMonth = monthGods.filter((g) => seat.includes(g)).length;
    const onYear = yearGods.filter((g) => seat.includes(g)).length;
    // 그 분야의 기둥이 이 달에 직접 부딪쳤는가 (근묘화실)
    const pillar = SAJU_PILLAR[d];
    const own = pillar ? hits.filter((h) => h.with === pillar) : [];
    const ownClash = own.filter((h) => h.good === false)
      .reduce((a, h) => a + (HIT_W[h.kind] ?? 0.5), 0);
    const ownBond = own.filter((h) => h.good !== false)
      .reduce((a, h) => a + (HIT_W[h.kind] ?? 0.5), 0);

    // 원천을 묶는다 — 십성 자리 / 그 기둥의 충 / 그 기둥의 합 / 전체 소란 / 대운 전환
    activations[d] = evidenceOr({
      seat: [
        onMonth ? 0.55 * clamp01(onMonth / Math.max(1, monthGods.length)) : 0,
        onYear ? 0.35 * clamp01(onYear / Math.max(1, yearGods.length)) : 0,
      ],
      pillarClash: [clamp01(ownClash * 0.45)],
      pillarBond: [clamp01(ownBond * 0.3)],
      stir: [stirOf(pillar) * 0.3],
      daeun: [daeunTurn && ['career', 'majorChange', 'residence', 'movement'].includes(d) ? 0.25 : 0],
    });

    // 방향은 그 시기 십성이 정한다. 세운은 달보다 약하게 싣는다
    const sh = shiftFrom('saju', d, monthGods.map((g) => `god:${g}`));
    const shY = yearGods.length ? shiftFrom('saju', d, yearGods.map((g) => `god:${g}`), 0.5) : null;
    if (sh || shY) {
      featureShift[d] = Object.fromEntries((AXES[d] ?? []).map((ax) =>
        [ax, Math.round((((sh?.[ax] ?? 0) + (shY?.[ax] ?? 0)) / (shY ? 1.5 : 1)) * 1000) / 1000]));
    }
    if (pillar && own.length) {
      evidence.push({ what: `${pillar} ${own.map((h) => h.kind).join('·')}`,
        basis: `${DOMAINS.includes(d) ? d : ''} 자리를 직접 건드린다`, domain: d, weight: clamp01(ownClash + ownBond) });
    }
  }

  if (daeunTurn) {
    evidence.push({ what: '대운 전환', basis: `${ctx?.daeun?.current?.hanja ?? ''} → ${ctx?.daeun?.next?.hanja ?? ''} (${toTurn}년 남음)`, weight: 0.25 });
  }
  if (monthGods.length) {
    evidence.push({ what: '월운 십성', basis: `${b.gz?.hanja ?? b.gz ?? ''} ${monthGods.join('·')}`, weight: 1 });
  }
  if (yearGods.length) {
    evidence.push({ what: '세운 십성', basis: `${ctx.year.gz?.hanja ?? ''} ${yearGods.join('·')}`, weight: 0.5 });
  }
  for (const h of hits.slice(0, 3)) {
    evidence.push({ what: `${h.with} ${h.kind}`, basis: `무게 ${h.weight}`, weight: h.weight ?? 0 });
  }

  // 기질은 시기로 움직이지 않고, timing 은 메타 분야다 — 말하지 않는다
  activations.personality = null; activations.timing = null;
  return signal('saju', period, {
    activations, featureShift, evidence, resolution: 'month',
    domainAvailability: availabilityOf(activations),
  });
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

/**
 * 사화 넷은 같은 크기의 '있음'이 아니다.
 *
 *   화록 재물·기회가 열린다        방향을 그대로 밀어 준다
 *   화권 권한·추진이 붙는다        그대로, 조금 세게
 *   화과 이름·시험이 밝아진다      약하게
 *   화기 막히고 집착한다           **반대로 당긴다** — 그 별의 성질이 뒤틀린다
 *
 * activation(얼마나 시끄러운가)에는 넷 다 더한다. 화기는 오히려 가장
 * 시끄럽다. 방향(featureShift)에서만 부호가 갈린다.
 */
export const SIHWA_ACT = { 화록: 0.3, 화권: 0.3, 화과: 0.22, 화기: 0.35 };
export const SIHWA_DIR = { 화록: 1, 화권: 0.9, 화과: 0.6, 화기: -0.5 };
const sihwaKind = (s) => (typeof s === 'string' ? s.slice(-2) : `${s?.kind ?? ''}`);
const sihwaStar = (s) => (typeof s === 'string' ? s.slice(0, -2) : `${s?.star ?? ''}`);

export function ziweiTiming(month, period, stack, ctx = null) {
  const z = month?.ziwei;
  if (!z || !stack) return unavailable('jamidusu', period, '출생 시각을 알아야 판을 세운다');

  const activations = zeroActivations();
  const featureShift = {};
  const evidence = [];

  // 유월 명궁이 **원국의 어느 궁**에 내려앉았는가.
  // (전에는 유월 판의 자기 자리를 봤는데, 그 자리는 언제나 '명궁'이라
  //  명궁 말고는 한 번도 걸리지 않았다. 원국 궁으로 고쳤다.)
  const monthOnNatal = z.month?.palaceOfNatal ?? null;
  const monthStars = z.month?.stars ?? [];
  const monthSihwa = z.month?.sihwa ?? [];

  // 열두 분야가 보는 궁은 '직업' 넷보다 넓다. ctx 가 분야별 궁을 모아 준다
  const rowOf = (palace) => ctx?.palaceRows?.[palace]
    ?? (z.overlap?.rows ?? []).find((x) => x.palace === palace) ?? null;

  for (const d of DOMAINS) {
    const palace = ZIWEI_PALACE[d];
    const row = rowOf(palace);
    const groups = { repeat: [], sihwa: [], monthPalace: [], monthSihwa: [] };
    const stars = [];
    const dirs = [];   // {star, w}

    if (row) {
      // 대한·유년·유월이 **같은 지지**에서 그 궁을 되풀이 켜는가
      const rep = (row.repeated ?? []).reduce((a, x) => a + (x.layers - 1), 0);
      groups.repeat.push(clamp01(rep / 3) * 0.5);
      for (const h of row.hits ?? []) {
        for (const s of h.stars ?? []) stars.push(s);
        for (const s of h.sihwa ?? []) {
          const kind = sihwaKind(s); const star = sihwaStar(s);
          groups.sihwa.push(SIHWA_ACT[kind] ?? 0.2);
          if (star) dirs.push({ star, w: SIHWA_DIR[kind] ?? 0.5 });
          evidence.push({ what: `${palace} ${s}`, basis: `${h.layer} 층`, domain: d,
            weight: SIHWA_ACT[kind] ?? 0.2 });
        }
      }
    }
    // 이 달의 유월 명궁이 원국 그 궁에 오면, 그 달이 그 분야의 달이다
    if (monthOnNatal && monthOnNatal === palace) {
      groups.monthPalace.push(0.35);
      evidence.push({ what: `유월 명궁 → 원국 ${palace}`, basis: period, domain: d, weight: 0.35 });
    }
    // 유월 사화는 그 달 전체의 기운이라 어느 궁에나 약하게만 싣는다
    for (const s of monthSihwa) {
      const kind = sihwaKind(s);
      groups.monthSihwa.push((SIHWA_ACT[kind] ?? 0.2) * 0.35);
      const star = sihwaStar(s);
      if (star) dirs.push({ star, w: (SIHWA_DIR[kind] ?? 0.5) * 0.4 });
    }

    activations[d] = evidenceOr(groups);

    // 방향 — 궁에 있는 별들의 뜻에 사화의 부호를 얹는다.
    // 화기는 같은 별이라도 반대쪽으로 당긴다
    const syms = [...new Set([...stars, ...monthStars])];
    const base = shiftFrom('jamidusu', d, syms.map((s) => (d === 'career' ? `career:${s}` : `star:${s}`)));
    const parts = [];
    if (base) parts.push({ v: base, w: 1 });
    for (const { star, w } of dirs) {
      const sh = shiftFrom('jamidusu', d, [d === 'career' ? `career:${star}` : `star:${star}`], w);
      if (sh) parts.push({ v: sh, w: Math.abs(w) });
    }
    if (parts.length) {
      const den = parts.reduce((a, p) => a + p.w, 0) || 1;
      featureShift[d] = Object.fromEntries((AXES[d] ?? []).map((ax) =>
        [ax, Math.round((parts.reduce((a, p) => a + (p.v[ax] ?? 0) * p.w, 0) / den) * 1000) / 1000]));
    }
  }

  activations.personality = null; activations.timing = null;
  return signal('jamidusu', period, {
    activations, featureShift, evidence, resolution: 'month',
    domainAvailability: availabilityOf(activations),
  });
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

/** 느린 별은 판을 깔고, 빠른 별은 방아쇠를 당긴다 — 전통 독법의 두 층 */
const SLOW_PLANETS = new Set(['명왕성', '해왕성', '천왕성', '토성', '목성', '라후']);

export function westernTiming(month, period, natal, ctx = null) {
  // 열두 하우스를 모두 겨냥한 트랜싯이 있으면 그것을 쓴다. 없으면 기존 것
  // (분야가 '직업' 으로 고정돼 하우스 넷만 보던 자료) 으로 물러선다.
  const t = ctx?.transits ?? month?.western?.transits;
  if (!t || !natal?.cusps) return unavailable('astrology', period, '출생 시각을 알아야 하우스를 세운다');
  // 시각을 모르면 커스프도 앵글도 없다. 트랜싯은 구해지지만 **어느 방을
  // 건드렸는지** 말할 수가 없어서 열두 분야가 전부 0 으로 나온다.
  // 그것은 "계산했고 낮다"가 아니라 "말할 수 없다"다.
  if (ctx?.timeKnown === false) {
    return unavailable('astrology', period, '출생 시각을 몰라 트랜싯이 어느 하우스를 건드렸는지 말할 수 없다');
  }

  const activations = zeroActivations();
  const featureShift = {};
  const evidence = [];
  const bg = Object.fromEntries(DOMAINS.map((d) => [d, []]));     // 느린 배경
  const tg = Object.fromEntries(DOMAINS.map((d) => [d, []]));     // 빠른 방아쇠
  const planetsOf = Object.fromEntries(DOMAINS.map((d) => [d, new Set()]));

  for (const h of t.hits ?? []) {
    // 다가오는 각이 일을 만든다. 멀어지는 각은 이미 지난 것이다
    const phase = h.applying === false ? 0.65 : 1;
    const w = (ASPECT_W[h.aspect] ?? 0.3) * (SLOW[h.planet] ?? 0.3)
      * (0.4 + 0.6 * (h.tight ?? 0.5)) * phase * (h.exact ? 1.15 : 1);
    // 맞은 자리가 어느 하우스인가. 마주 보는 커스프는 한 각이 둘을 건드린 것이다
    const houses = h.axisHouses?.length ? h.axisHouses
      : [h.house ?? ANGLE_HOUSE[h.target] ?? null].filter((x) => x != null);
    const slow = SLOW_PLANETS.has(h.planet);
    for (const d of DOMAINS) {
      if (!(WEST_HOUSE[d] ?? []).some((hn) => houses.includes(hn))) continue;
      (slow ? bg : tg)[d].push(Math.min(0.9, w));
      planetsOf[d].add(h.planet);
    }
  }

  // 느린 별이 지금 어느 하우스를 지나는가 — 각이 없어도 그 방을 데운다.
  // 이것은 몇 해씩 이어지는 배경이라 아주 낮게만 싣는다
  for (const [p, hn] of Object.entries(t.inHouse ?? {})) {
    if (!SLOW_PLANETS.has(p) || hn == null) continue;
    for (const d of DOMAINS) {
      if ((WEST_HOUSE[d] ?? []).includes(hn)) { bg[d].push(0.18 * (SLOW[p] ?? 0.5)); planetsOf[d].add(p); }
    }
  }

  for (const d of DOMAINS) {
    // 배경과 방아쇠를 따로 묶는다. 같은 배경이 여러 줄로 잡혀도 한 몫이고,
    // **배경과 방아쇠가 함께 있을 때만** 둘이 겹쳐 올라간다
    activations[d] = evidenceOr({ background: bg[d], trigger: tg[d] });
    const planets = [...planetsOf[d]];
    if (planets.length) {
      const conds = d === 'career' ? planets.map((p) => `tenth:${p}`) : planets.map((p) => `planet:${p}`);
      const sh = shiftFrom('astrology', d, conds) ?? shiftFrom('astrology', d, planets.map((p) => `sign:${p}`));
      if (sh) featureShift[d] = sh;
    }
  }
  for (const h of (t.hits ?? []).slice(0, 3)) {
    evidence.push({ what: `${h.planet}–${h.target} ${h.aspect}`,
      basis: `오브 ${h.orb}°${h.exact ? ' 정각' : ''}${h.applying === false ? ' (멀어짐)' : ' (다가옴)'}`,
      weight: Math.round((h.tight ?? 0) * 100) / 100 });
  }

  activations.personality = null; activations.timing = null;
  return signal('astrology', period, {
    activations, featureShift, evidence, resolution: 'month',
    domainAvailability: availabilityOf(activations),
  });
}

// ═════════════════════════════════════════════════════════════
// 베딕 — 다샤 주인이 그 분야의 자리인가
// ═════════════════════════════════════════════════════════════

const VEDIC_HOUSE = WEST_HOUSE;

/**
 * 분야마다 보는 분할도(varga)가 다르다 — 베딕의 기본 독법이다.
 *
 * D1 한 장으로 직업도 결혼도 자녀도 보면, 그 체계가 가진 것의 일부만 쓰는
 * 것이다. 분할도는 `hires/vedicExt.js` 가 이미 세운다.
 *
 * **학업은 D1 로 둔다.** 전통은 D24(싯담샤)로 보는데 그 계산이 없다.
 * 없는 것을 D7(자녀) 로 대신하지 않는다 — 그건 근거 없는 갖다 붙이기다.
 */
export const VEDIC_VARGA = {
  career: 'D10', marriage: 'D9', relationship: 'D9', children: 'D7',
  residence: 'D4', movement: 'D4', wealth: 'D2',
  education: 'D1', health: 'D1', majorChange: 'D1',
};
/** 다샤 층의 무게 — 마하 > 안타르 > 프라탼타르 */
const DASHA_W = [0.5, 0.35, 0.15];
const DASHA_LABEL = ['마하', '안타르', '프라탼타르'];

export function vedicTiming(month, period, packs, ctx = null) {
  const d1 = packs?.d1 ?? packs?.D1;
  const dasha = month?.vedic?.dasha;
  if (!d1 || !dasha) return unavailable('vedic', period, '다샤를 세우지 못했다');

  // `dashaAt` 이 주는 것은 `{md, ad, pd}` 노드다. 예전 코드는 `dasha.maha`
  // 를 찾다 없어서 **노드 객체 자체**를 행성 이름 자리에 넣었고, 그래서
  // 어떤 비교도 참이 되지 않아 activation 이 늘 0 이었다.
  const lords = [dasha.md?.lord, dasha.ad?.lord, dasha.pd?.lord].filter(Boolean);
  if (!lords.length) return unavailable('vedic', period, '다샤 주인을 읽지 못했다');

  const activations = zeroActivations();
  const featureShift = {};
  const evidence = [];

  for (const d of DOMAINS) {
    const houses = VEDIC_HOUSE[d] ?? [];
    const code = VEDIC_VARGA[d] ?? 'D1';
    // 그 분야 전용 분할도를 먼저 본다. 없으면 D1 으로 물러선다
    const V = ctx?.vedic?.[code] ?? d1;
    // `background` 에 D1 확인과 고차라를 함께 담는다. 둘 다 "분할도 말고
    // 다른 데서도 그 자리가 켜져 있다"는 한 가지 뜻이라, 따로 묶어 두 몫을
    // 주면 배경이 본 신호보다 커진다
    const groups = { lord: [], lagna: [], occupant: [], aspect: [], background: [], change: [] };

    lords.forEach((p, i) => {
      const w = DASHA_W[i] ?? 0.1;
      // 분할도의 라그나주는 그 분야의 1순위 지표다
      const lagnaLord = safe(() => V.lordOf(1))?.lord ?? null;
      if (lagnaLord && lagnaLord === p) {
        groups.lagna.push(w * 0.8);
        evidence.push({ what: `${code} 라그나주 = ${p}`, basis: `${DASHA_LABEL[i]}다샤`, domain: d, weight: w * 0.8 });
      }
      for (const hn of houses) {
        const l = safe(() => V.lordOf(hn));
        if (l?.lord === p) {
          groups.lord.push(w);
          evidence.push({ what: `${code} ${hn}궁주 = ${p}`, basis: `${DASHA_LABEL[i]}다샤`, domain: d, weight: w });
          continue;
        }
        if ((safe(() => V.inHouse(hn)) ?? []).includes(p)) { groups.occupant.push(w * 0.7); continue; }
        if ((safe(() => V.aspecting(hn)) ?? []).includes(p)) groups.aspect.push(w * 0.4);
      }
      // D1 도 함께 본다 — 분할도는 D1 을 확인하는 자리이지 대신하는 자리가 아니다
      if (code !== 'D1') {
        for (const hn of houses) {
          if (safe(() => d1.lordOf(hn))?.lord === p) { groups.background.push(w * 0.5); break; }
        }
      }
    });

    // 고차라 — 느린 넷이 라그나에서 그 자리를 지나는가 (배경)
    for (const g of month?.vedic?.gochara?.rows ?? []) {
      if (g.fromLagna != null && houses.includes(g.fromLagna)) groups.background.push(0.15);
    }
    // 다샤가 바뀌는 달은 판이 바뀐다
    if (ctx?.dashaChanged) {
      groups.change.push(ctx.dashaChanged === 'md' ? 0.3 : ctx.dashaChanged === 'ad' ? 0.2 : 0.1);
    }

    activations[d] = evidenceOr(groups);
    const sh = shiftFrom('vedic', d, lords.map((p) => (d === 'career' ? `d10Lagnesh:${p}` : `planet:${p}`)));
    if (sh) featureShift[d] = sh;
  }

  if (ctx?.dashaChanged) {
    evidence.push({ what: '다샤 전환', basis: `${ctx.dashaChanged.toUpperCase()} → ${dasha.label ?? ''}`, weight: 0.3 });
  }
  evidence.push({ what: '다샤', basis: dasha.label ?? lords.join('–'), weight: 1 });

  activations.personality = null; activations.timing = null;
  return signal('vedic', period, {
    activations, featureShift, evidence, resolution: 'month',
    domainAvailability: availabilityOf(activations),
  });
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

/**
 * 옛 여섯 영역 → 열두 분야. **다시 감사했다.**
 *
 * ── 뺀 것 ─────────────────────────────────────────────────
 *   학업운 → children   학업과 자녀는 같은 분야가 아니다. 영역이 모자란다고
 *                       남의 영역 점수를 빌려 쓰면 없는 신호를 만든다.
 *
 * ── 대응이 없어 **말하지 않는** 분야 ────────────────────────
 *   children · residence · movement
 *   보조 열한 체계의 여섯 영역에 이 셋에 해당하는 자리가 없다. 억지로
 *   다른 영역을 재사용하지 않고 `null`(unavailable) 로 둔다.
 *
 *   **중요** — 그 시기의 괘가 '이동'을 뜻한다는 것은 `featureShift` 의
 *   근거가 될 수 있어도 "이번 달 이동 분야가 켜졌다"는 뜻이 아니다.
 *   방향을 말할 수 있는 것과 시기를 말할 수 있는 것은 별개다.
 *
 * ── personality · timing ──────────────────────────────────
 *   기질은 시기로 움직이는 것이 아니고, timing 은 메타 분야다. 둘 다 뺀다.
 */
const AREA_TO_DOMAIN = {
  총운: ['majorChange'],
  애정운: ['relationship', 'marriage'],
  금전운: ['wealth'],
  직장운: ['career'],
  학업운: ['education'],
  건강운: ['health'],
};

/** 보조 열한 체계가 시기를 말할 수 있는 분야 */
const OTHER_TIMING_DOMAINS = new Set(Object.values(AREA_TO_DOMAIN).flat());

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
  // 말할 근거가 없는 분야는 **0 이 아니라 null** 이다. 0 으로 두면
  // "계산했는데 낮다"가 되어 앙상블 분모에 들어가고, 없는 정보가 결과를
  // 끌어내린다.
  const activations = Object.fromEntries(DOMAINS.map((d) =>
    [d, OTHER_TIMING_DOMAINS.has(d) ? 0 : null]));
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
    domainAvailability: Object.fromEntries(DOMAINS.map((d) => [d, OTHER_TIMING_DOMAINS.has(d)])),
    resolution: flat ? 'none' : yearly ? 'year' : 'month',
    ...(flat ? { why: '달마다 값이 같아 시기를 가르지 못한다' }
      : yearly ? { why: '해 단위로만 바뀐다 — 달을 가르지 못한다' } : {}),
  });
}

export { lineageOf, SYSTEM_IDS, SYSTEM_NAME };
