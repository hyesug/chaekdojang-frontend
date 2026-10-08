/**
 * 리포트에서 분야별로 실제 사용할 시기 체계.
 *
 * `observed` 는 현재 사례에서 해당 분야의 상대 성과가 가장 높았던 체계다.
 * 표본 수가 적거나 사건이 없는 분야는 빈 칸으로 두면 다시 모든 체계를 평균내는
 * 문제가 생기므로, 그 전통에 전용 자리가 있는 체계를 `inferred` 로 임시 채택한다.
 * 새 사례가 들어오면 학습 스크립트가 이 표를 다시 제안·교체한다.
 *
 * 단, 이 표는 미래 사건의 보증이 아니다. 한 사람의 사례만 있는 분야도 있어
 * 결과 화면에서는 "신호가 높은 구간"으로만 읽는다.
 */
export const VALIDATED_REPORT_TIMING_POLICY = Object.freeze({
  // 현재 사건 기록에서의 최고 후보 (직업 3건, 이동 3건, 관계 1건,
  // 결혼 6건, 자녀 10건). 표본의 한계는 basis 로 보존한다.
  직업: Object.freeze({ systems: ['vedic'], basis: 'observed' }),
  이사: Object.freeze({ systems: ['vedic'], basis: 'observed' }),
  관계: Object.freeze({ systems: ['vedic'], basis: 'observed' }),
  결혼: Object.freeze({ systems: ['yukim'], basis: 'observed' }),
  // 출산일보다 약 아홉 달 앞의 사주 신호가 현재 사례에서 더 일관됐다.
  자녀: Object.freeze({ systems: ['saju'], leadMonths: 9, basis: 'observed' }),

  // 아직 날짜가 붙은 사례가 없거나 너무 적은 분야. 각 체계의 전용 자리
  // (재성·전택궁·질액궁·인성)을 가진 체계 하나만 임시로 쓴다.
  재물: Object.freeze({ systems: ['vedic'], basis: 'inferred' }),
  주거: Object.freeze({ systems: ['jamidusu'], basis: 'inferred' }),
  건강: Object.freeze({ systems: ['jamidusu'], basis: 'inferred' }),
  학업: Object.freeze({ systems: ['saju'], basis: 'inferred' }),
  '큰 전환': Object.freeze({ systems: ['saju'], basis: 'inferred' }),
});

export const reportTimingPolicy = (domain) => VALIDATED_REPORT_TIMING_POLICY[domain] ?? null;
