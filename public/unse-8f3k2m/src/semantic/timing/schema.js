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
