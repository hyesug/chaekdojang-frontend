/**
 * 리포트에서 분야별로 실제 사용할 시기 체계.
 *
 * 다인 교차검증을 통과한 것은 `service`, 사례가 부족하지만 현재 기록에서 가장
 * 설명력이 높은 것은 `provisional` 로 구분한다. 후자도 리포트에는 쓰되,
 * 새 사례가 들어오면 학습 스크립트가 우선 교체 대상으로 검사한다.
 *
 * 단, 이 표는 미래 사건의 보증이 아니다. 한 사람의 사례만 있는 분야도 있어
 * 결과 화면에서는 "신호가 높은 구간"으로만 읽는다.
 */
export const VALIDATED_REPORT_TIMING_POLICY = Object.freeze({
  // 현재 개인 이력으로는 다인 검증에 못 미치는 분야다. 전수 후보 비교에서
  // 고른 조합을 잠정 적용하며, 여러 사람 사례가 쌓이면 service 정책으로만 승격한다.
  직업: Object.freeze({ scope: 'provisional', systems: ['vedic', 'tojeong'], basis: 'personal-development' }),
  이사: Object.freeze({ scope: 'provisional', systems: ['jamidusu', 'astrology_classical'], basis: 'personal-development' }),
  관계: Object.freeze({ scope: 'provisional', systems: ['saju', 'sukyo'], basis: 'personal-development' }),
  결혼: Object.freeze({ scope: 'provisional', systems: ['yukim', 'hongguk'], basis: 'underpowered-multiperson' }),
  // 출산일보다 약 아홉 달 앞의 사주 신호가 현재 사례에서 더 일관됐다.
  자녀: Object.freeze({ scope: 'service', systems: ['saju'], leadMonths: 9, basis: 'observed' }),

  // 아직 날짜가 붙은 사례가 없거나 너무 적은 분야. 각 체계의 전용 자리
  // (재성·전택궁·질액궁·인성)을 가진 체계 하나만 임시로 쓴다.
  재물: Object.freeze({ scope: 'provisional', systems: ['vedic', 'mahabote'], basis: 'personal-development' }),
  주거: Object.freeze({ scope: 'service', systems: ['jamidusu'], basis: 'inferred' }),
  건강: Object.freeze({ scope: 'service', systems: ['jamidusu'], basis: 'inferred' }),
  학업: Object.freeze({ scope: 'provisional', systems: ['gujeong', 'thai'], basis: 'personal-development' }),
  '큰 전환': Object.freeze({ scope: 'service', systems: ['saju'], basis: 'inferred' }),
});

/** 개인 전용 결과는 막되, 사례 부족의 잠정 분야 정책은 리포트에 적용한다. */
export const reportTimingPolicy = (domain, policy = VALIDATED_REPORT_TIMING_POLICY) => {
  const entry = policy[domain] ?? null;
  return ['service', 'provisional'].includes(entry?.scope) ? entry : null;
};
