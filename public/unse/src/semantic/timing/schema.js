/**
 * timing/schema.js — **공통 시기 스키마**
 *
 * 열다섯 체계는 시기를 저마다 다른 방식으로 본다. 사주는 대운·세운·월운의
 * 간지를 원국과 맞대고, 자미는 대한·유년·유월의 궁이 원국 궁과 겹치는지를
 * 보고, 점성은 트랜싯이 하우스와 각을 맺는지를 본다.
 *
 * **계산법은 각자 두고, 내놓는 모양만 하나로 맞춘다.**
 *
 * ── 세 가지를 반드시 가른다 ────────────────────────────────
 *
 *   activation    그 분야에서 **무언가 움직일** 가능성이 상대적으로 높다
 *   featureShift  움직인다면 **어느 방향**인가 (변화↑ 조직↓ …)
 *   event         그래서 현실에서 **무슨 일**로 나타날 수 있나
 *
 * `activation = 0.9` 는 "좋은 일이 생긴다"가 아니다. **그 분야가 시끄럽다**
 * 는 뜻이고, 좋은지 나쁜지는 여기서 말하지 않는다. 이 셋을 섞으면 곧
 * "운이 좋다/나쁘다"로 뭉개지고, 그게 이 저장소가 여러 번 실패한 자리다.
 *
 * ── 정적 해석과 섞지 않는다 ────────────────────────────────
 *
 *   natal      이 사람은 원래 기술·분석이 강하다        (semantic/)
 *   timing     2028년에 변화·독립이 크게 올라온다        (여기)
 *   event      기술직인 사람에게 변화가 올라오는 시기
 *              → 이직·직무전환·프리랜서 후보            (timing/events.js)
 */

import { AXES } from '../axes.js';
import { DOMAINS, DOMAIN_LABEL } from '../domains.js';

export { DOMAINS, DOMAIN_LABEL };

/**
 * 분야마다 시간 해상도가 다르다.
 *
 * 결혼을 일 단위로 보는 전통은 없고, 이직을 연 단위로만 보면 쓸모가 없다.
 * 각 분야가 실제로 움직이는 단위에 맞춘다.
 */
export const RESOLUTION = {
  personality: 'year',      // 기질은 시기로 잘 안 움직인다
  career: 'quarter',
  relationship: 'month',
  marriage: 'halfyear',
  children: 'halfyear',
  education: 'month',
  wealth: 'month',
  residence: 'quarter',
  movement: 'quarter',
  health: 'month',
  majorChange: 'quarter',
  timing: 'year',
};

/** 해상도별 창 크기 (달 수) */
export const WINDOW_MONTHS = { month: 1, quarter: 3, halfyear: 6, year: 12 };

/** 시기 신호 하나를 만든다 — 열다섯이 모두 이 모양으로 낸다 */
export function signal(system, period, o = {}) {
  return {
    system,
    period,                                   // 'YYYY-MM'
    available: o.available ?? true,
    why: o.why ?? null,
    /** 분야 → 0~1. 그 분야가 얼마나 움직이는가 */
    activations: o.activations ?? {},
    /** 분야 → 축 → −1~+1. 움직인다면 어느 쪽인가 */
    featureShift: o.featureShift ?? {},
    /**
     * 분야 → true/false. **그 분야의 시기를 말할 근거가 있는가.**
     * activation 0 (계산했고 낮다) 과 근거 없음을 가르는 자리다.
     */
    domainAvailability: o.domainAvailability ?? {},
    /** 'month' | 'year' | 'none' — 이 체계가 이 눈금을 가를 수 있는가 */
    resolution: o.resolution ?? 'month',
    evidence: o.evidence ?? [],
  };
}

export const unavailable = (system, period, why) =>
  signal(system, period, { available: false, why, resolution: 'none' });

/** 빈 activation 한 벌 */
export const zeroActivations = () => Object.fromEntries(DOMAINS.map((d) => [d, 0]));

/** 0~1 로 자른다 */
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** −1~1 로 자른다 */
export const clamp11 = (v) => Math.max(-1, Math.min(1, v));

/** 축 벡터를 −1~1 로 자른다 */
export const clampShift = (v) =>
  Object.fromEntries(Object.entries(v ?? {}).map(([k, x]) => [k, Math.round(clamp11(x) * 1000) / 1000]));

/** 'YYYY-MM' → 달 번호 */
export const monthNo = (key) => {
  const [y, m] = String(key).split('-').map(Number);
  return y * 12 + (m - 1);
};
export const monthKey = (n) => `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;

/** 두 시기가 몇 달 떨어졌나 */
export const monthsApart = (a, b) => Math.abs(monthNo(a) - monthNo(b));

/** 분야가 쓰는 축 목록 */
export const axesOf = (domain) => AXES[domain] ?? [];

// ─────────────────────────────────────────────────────────────
// 0 · null · flat 을 엄격히 가른다
//
//   0            계산했고 낮다
//   null         계산 근거 자체가 없다 (unavailable)
//   no_variation 값은 나오지만 시기를 구분하지 못한다 (flat)
//
// 셋을 섞으면 "없는 정보"가 0점으로 들어가 앙상블을 끌어내리고,
// "구분 못 함"이 "틀림"으로 채점된다. 둘 다 거짓이다.
// ─────────────────────────────────────────────────────────────

/** 그 체계가 그 분야의 시기를 말할 근거가 있는가 */
export const isAvailable = (v) => v != null && Number.isFinite(v);

/**
 * 동점을 배열 순서로 깨지 않는 순위.
 *
 * 내림차순 index 를 rank 로 쓰면 **같은 점수인데 앞 달이 이긴다.** 값이
 * 달마다 같은 체계에서는 그것만으로 가짜 성능이 생긴다. 중간 순위를 쓴다.
 *
 * @returns {{rank, n, percentile, tied, allEqual}} allEqual 이면 채점하지 않는다
 */
export function midRank(values, target) {
  const xs = values.filter(Number.isFinite);
  if (!xs.length || !Number.isFinite(target)) return null;
  const higher = xs.filter((v) => v > target).length;
  const equal = xs.filter((v) => v === target).length;
  const rank = higher + (equal + 1) / 2;          // 동점은 중간 순위
  const n = xs.length;
  const allEqual = new Set(xs).size <= 1;
  return {
    rank: Math.round(rank * 100) / 100, n,
    // 1등이 100, 꼴찌가 0. 전부 같으면 뜻이 없으므로 null
    percentile: allEqual || n < 2 ? null : Math.round(((n - rank) / (n - 1)) * 100),
    tied: equal, allEqual,
  };
}

/**
 * 동점을 배열 순서로 자르지 않는 Top-K.
 *
 * 3위 자리에 네 달이 동점이면 셋만 뽑는 것은 배열 순서로 고르는 것이다.
 * 잘라내는 점수와 같은 달은 **모두** 넣고, 실제로 몇 달이 들어갔는지 함께 낸다.
 */
export function topK(entries, k) {
  const xs = entries.filter((e) => Number.isFinite(e.v));
  if (!xs.length) return { keys: [], candidateCount: 0, topKRequested: k, cutoff: null };
  const sorted = xs.slice().sort((a, b) => b.v - a.v);
  const cutoff = sorted[Math.min(k, sorted.length) - 1].v;
  const keys = sorted.filter((e) => e.v >= cutoff).map((e) => e.k);
  return { keys, candidateCount: keys.length, topKRequested: k, cutoff };
}

/**
 * 창에 **정확히 그 달 수**만 담는다.
 *
 * `floor(w/2)` 로 앞뒤를 잘라내면 6개월 창이 7개, 12개월 창이 13개가 된다.
 * 짝수 창은 **왼쪽을 하나 적게** 둔다 (6개월이면 왼쪽 2 · 현재 · 오른쪽 3).
 * 규칙을 정해 두지 않으면 구현마다 달라진다.
 */
export function windowSlice(keys, i, months) {
  if (months <= 1) return { from: i, to: i, count: 1, full: true };
  const left = Math.floor((months - 1) / 2);
  const right = months - 1 - left;
  const from = Math.max(0, i - left);
  const to = Math.min(keys.length - 1, i + right);
  return { from, to, count: to - from + 1, full: to - from + 1 === months };
}

/** 재현 가능한 난수 — 순열 기준선이 돌릴 때마다 달라지면 안 된다 */
export function seededRandom(seed = 20260924) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
