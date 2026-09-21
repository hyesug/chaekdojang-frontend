/**
 * timing.js — LEVEL 7 로 나가는 **이음매**
 *
 * ── 지금 이 파일이 하지 않는 일 ─────────────────────────────
 * **사건이 몇 년에 일어난다고 말하지 않는다.** 시기 예측은 서로 다른 두
 * 자료에서 각각 쟀고 둘 다 졌다 (달 p=0.868 · 해 p=0.196). 원국 프로파일
 * 성적이 시기로 넘어가지 않는다 — 둘은 다른 능력이다.
 *
 * ── 그럼 무엇을 하나 ───────────────────────────────────────
 * 나중에 시기 엔진이 붙을 자리를 **모양만** 만들어 둔다.
 *
 *   natal susceptibility  (이 파일)      원국이 그 사건에 얼마나 열려 있나
 *   × period activation   (나중)         그 해에 그 자리가 켜지나
 *   = event score         (나중)
 *
 * 지금은 activation 자리가 비어 있고, 비어 있으면 **기저율만** 곱한다.
 * 기저율은 점이 아니라 통계청 공표값이고, 그렇게 표시해서 내보낸다.
 *
 * ── 결혼 시기를 이렇게 내는 이유 ────────────────────────────
 * "몇 살에 결혼하나"는 사람들이 가장 많이 묻는 질문이다. 그런데 명반
 * 시기 신호는 검증에서 죽었다. 그래서 답의 **뼈대는 인구통계**로 세우고,
 * 원국은 그 곡선을 앞뒤로 **살짝 밀기만** 한다. 미는 폭을 크게 잡으면
 * 검증된 적 없는 신호가 검증된 통계를 덮는다.
 */

import { baseRateFor, FIRST_MARRIAGE_AGE, SOURCES } from '../hires/baserate.js';

/** 시기 예측을 실제로 쟀을 때 나온 것. 두 자료에서 다 졌다 */
export const TIMING_EVIDENCE = {
  month: { p: 0.868, note: '달 단위 시기 예측은 섞은 것보다 나빴다 (두 자료)' },
  year: { p: 0.196, note: '해 단위 사주의 p=0.004 는 독립 자료에서 재현되지 않았다' },
  profile: { note: '성향은 시기와 다른 능력이다. 프로파일 성적이 시기로 넘어가지 않는다' },
};

/** 원국 경향이 곡선을 밀 수 있는 최대 폭 (해). 검증되지 않은 신호이므로 작다 */
export const MAX_SHIFT_YEARS = 2;

/** 다섯 살 구간 */
const BANDS = [[23, 25], [26, 28], [29, 31], [32, 34], [35, 37], [38, 40]];

/**
 * 원국이 결혼 시기를 앞뒤로 얼마나 미는가.
 *
 * @param {object|null} unionTiming categories.UNION_TIMING 분포
 * @returns {number} −2 ~ +2 (음수면 이른 쪽)
 */
export function natalShift(unionTiming) {
  if (!unionTiming?.dist) return 0;
  const { early = 0, late = 0 } = unionTiming.dist;
  return Math.round((late - early) * MAX_SHIFT_YEARS * 100) / 100;
}

/**
 * 나이 구간별 결혼 activation.
 *
 * **점수는 확률이 아니다.** 그 구간이 다른 구간에 견주어 얼마나 두드러지는지
 * 뿐이다. 합이 1 이 되도록 맞춰 내보낸다.
 *
 * @param {object} who { age, gender }
 * @param {object|null} unionTiming
 */
export function marriageTimingCurve(who, unionTiming = null) {
  const gender = who?.gender;
  const shift = natalShift(unionTiming);
  const peak = FIRST_MARRIAGE_AGE[gender];
  if (peak == null) {
    return { unknown: '성별을 알아야 혼인 통계를 댈 수 있다.', bands: [] };
  }

  const center = peak + shift;
  const rows = BANDS.map(([a, b]) => {
    const mid = (a + b) / 2;
    const rate = baseRateFor('결혼', { age: mid, gender });
    // 통계에 없는 구간은 **0 으로 채우지 않는다.** 없으면 없다고 적는다
    const base = rate.unknown ? null : rate.annualPct;
    // 평균 초혼연령에서 멀수록 낮아지는 완만한 종 모양. 통계 칸이 비어도
    // 구간 사이의 상대적 높낮이는 이것으로 말할 수 있다
    const bell = Math.exp(-((mid - center) ** 2) / (2 * 4.5 ** 2));
    return { ageRange: `${a}-${b}`, mid, baseAnnualPct: base, bell };
  });

  const total = rows.reduce((t, r) => t + r.bell * (r.baseAnnualPct ?? 1), 0) || 1;
  const bands = rows.map((r) => ({
    ageRange: r.ageRange,
    score: Math.round((r.bell * (r.baseAnnualPct ?? 1)) / total * 1000) / 1000,
    baseAnnualPct: r.baseAnnualPct,
    baseUnknown: r.baseAnnualPct == null,
  }));

  const ranked = bands.slice().sort((a, b) => b.score - a.score);
  return {
    bands,
    top: ranked.slice(0, 2).map((b) => b.ageRange),
    shiftYears: shift,
    center: Math.round(center * 10) / 10,
    basis: {
      statistics: SOURCES.marriage,
      natal: unionTiming ? '원국 조혼/만혼 경향이 곡선을 앞뒤로 밀었다' : '원국 경향 없음 — 통계만',
      caution: '이 곡선의 뼈대는 인구통계다. 명반 시기 신호는 검증에서 살아남지 못했다 ' +
               `(달 p=${TIMING_EVIDENCE.month.p} · 해 p=${TIMING_EVIDENCE.year.p}).`,
    },
    // 한 해를 단정하지 않는다
    disclaimer: '특정 나이에 꼭 결혼한다는 뜻이 아닙니다. 구간 사이의 상대적 높낮이입니다.',
  };
}

/**
 * 원국 susceptibility — 시기 엔진이 나중에 곱할 값.
 *
 * 분야별로 "이 사람의 원국이 이 사건에 얼마나 열려 있나"를 0~1 로 낸다.
 * **이 값만으로 시기를 말하지 않는다.** activation 이 붙기 전에는
 * 곡선의 모양을 정하는 데만 쓴다.
 */
export function natalSusceptibility(domains) {
  const out = {};
  const g = (d, k) => domains?.[d]?.features?.[k] ?? 0;
  out.career_change = Math.max(g('career', 'change'), g('career', 'independence') * 0.6);
  out.marriage = Math.max(g('relationship', 'commitment'), g('relationship', 'bonding') * 0.8);
  out.children = g('children', 'childThick');
  out.move = g('residence', 'mobile');
  out.study = Math.max(g('education', 'credential'), g('education', 'repeatChallenge'));
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
}

/**
 * 시기 엔진이 붙는 자리. 지금은 비어 있다.
 *
 * 나중에 `activation(year)` 가 들어오면 `event = susceptibility × activation`
 * 으로 잇는다. 그 전에는 **없다고 말한다** — 빈 자리를 그럴듯한 값으로
 * 채우면 그것이 곧 검증되지 않은 예측이 된다.
 */
export function eventScore(susceptibility, activation = null) {
  if (!activation) {
    return { available: false, why: '시기(activation) 계산이 아직 붙지 않았다', susceptibility };
  }
  return {
    available: true,
    susceptibility,
    activation,
    score: Object.fromEntries(Object.entries(susceptibility)
      .map(([k, v]) => [k, Math.round(v * (activation[k] ?? 0) * 1000) / 1000])),
  };
}
