/**
 * 리포트에서 분야별로 실제 사용할 시기 체계.
 *
 * 다인 교차검증·날짜 섞기를 통과한 것은 `service`, 사례가 부족한 분야는 `provisional` 이다.
 * provisional 은 `npm run unse:timing-learn` 의 **빼고 고르기**로 정한다 —
 * 한 단위(사람 3명 이상이면 사람, 아니면 사건)를 가려 두고 나머지로 조합을 고른 뒤
 * 가려 둔 쪽을 맞히는지 본다. 그렇게 고른 조합이 기본 방식(15체계 전체)보다
 * 빠진 쪽을 더 잘 맞히면 `cv-provisional` 로 채택하고, 아니면 `cv-baseline` 으로
 * 기본 방식을 쓴다. 전체 사례 점수가 가장 높은 조합을 그대로 쓰지 않는 이유는
 * 수백 개 조합 중 우연히 그 사례들에만 맞은 것이 뽑히기 때문이다(2026-10 점검:
 * 직업 베딕+토정은 사례 전체 80%였지만 빠진 사건 46%, 기본 방식 69%).
 *
 * 이 표는 미래 사건의 보증이 아니다. 결과 화면에서는 "신호가 높은 구간"으로만 읽는다.
 */
// 기본 방식 = 예측기가 따로 고르지 않을 때 쓰는 15체계 전체
const ALL_SYSTEMS = Object.freeze(['saju', 'jamidusu', 'astrology', 'vedic', 'juyeok', 'yukim', 'hongguk',
  'taeeul', 'gujeong', 'sukyo', 'tojeong', 'kabbalah', 'mahabote', 'thai', 'tarot']);

export const VALIDATED_REPORT_TIMING_POLICY = Object.freeze({
  // 2026-10-08 학습(사람 8명·사건 42건). 괄호는 빠진 쪽 점수: 고른 조합 vs 기본 방식
  직업: Object.freeze({ scope: 'provisional', systems: ALL_SYSTEMS, basis: 'cv-baseline' }),            // 46% vs 69%
  재물: Object.freeze({ scope: 'provisional', systems: ['vedic', 'mahabote'], basis: 'cv-provisional' }), // 52% vs 44%
  이사: Object.freeze({ scope: 'provisional', systems: ALL_SYSTEMS, basis: 'cv-baseline' }),            // 57% vs 74%
  관계: Object.freeze({ scope: 'provisional', systems: ['saju', 'sukyo'], basis: 'cv-provisional' }),     // 58% vs 52%
  학업: Object.freeze({ scope: 'provisional', systems: ['gujeong', 'thai'], basis: 'cv-provisional' }),   // 47% vs 34%
  결혼: Object.freeze({ scope: 'provisional', systems: ['yukim', 'hongguk'], basis: 'cv-provisional' }),  // 66% vs 38%
  // 출산일보다 약 아홉 달 앞의 사주 신호 — 사람 단위 교차검증에서 유지됐다(빠진 쪽 76%)
  자녀: Object.freeze({ scope: 'service', systems: ['saju'], leadMonths: 9, basis: 'observed' }),

  // 날짜가 붙은 사례가 없거나 한 건뿐이라 빼고 고르기를 할 수 없는 분야. 각 체계의
  // 전용 자리(전택궁·질액궁·대운 전환)를 가진 체계 하나만 임시로 쓴다.
  주거: Object.freeze({ scope: 'service', systems: ['jamidusu'], basis: 'inferred' }),
  건강: Object.freeze({ scope: 'service', systems: ['jamidusu'], basis: 'inferred' }),
  '큰 전환': Object.freeze({ scope: 'service', systems: ['saju'], basis: 'inferred' }),
});

/** 개인 전용 결과는 막되, 사례 부족의 잠정 분야 정책은 리포트에 적용한다. */
export const reportTimingPolicy = (domain, policy = VALIDATED_REPORT_TIMING_POLICY) => {
  const entry = policy[domain] ?? null;
  return ['service', 'provisional'].includes(entry?.scope) ? entry : null;
};
