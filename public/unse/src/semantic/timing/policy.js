/**
 * 리포트에서 분야별로 실제 사용할 시기 체계.
 *
 * `npm run unse:timing-learn` 이 모든 사례 파일(지인·유명인)을 합쳐 고른 값이다.
 *  · service      — 사람 6명·월 사건 8건 이상, 한 사람씩 빼도 같은 후보, 날짜 섞기보다 확실히 나음
 *  · provisional  — 위 기준에 못 미치는 분야. **빼고 고르기**로 하나를 고른다:
 *                   한 단위(사람 3명 이상이면 사람, 아니면 사건)를 가려 두고 나머지로 최고
 *                   후보를 고르기를 반복해 가장 많이 뽑힌 후보(loo-vote). 사례가 한 건뿐이면
 *                   그 사례 최고(single-case).
 * 후보는 17체계 단독(15체계 + 현대·고전 점성), 계보가 다른 두 체계의 쌍, 15체계 전체다.
 *
 * 이 표는 미래 사건의 보증이 아니다. 결과 화면에서는 "신호가 높은 구간"으로만 읽는다.
 */
export const VALIDATED_REPORT_TIMING_POLICY = Object.freeze({
  // 2026-10-08 학습: 사람 34명·사건 89건 (유명인 생시는 출처 미검증)
  // 결혼 — 사람 9명·월 사건 12건, 사람 단위 LOO·날짜 섞기 통과 (75% vs 기본 43%)
  결혼: Object.freeze({ scope: 'service', systems: ['yukim', 'sukyo'], basis: 'loo-and-shuffle' }),
  // 출산일보다 약 아홉 달 앞의 사주 신호 — 사람 7명 빼고 고르기에서 7번 모두 뽑혔다(빠진 쪽 77%)
  자녀: Object.freeze({ scope: 'service', systems: ['saju'], leadMonths: 9, basis: 'observed' }),

  직업: Object.freeze({ scope: 'provisional', systems: ['vedic', 'tarot'], basis: 'loo-vote' }),          // 사람 24명 중 14표
  재물: Object.freeze({ scope: 'provisional', systems: ['vedic', 'mahabote'], basis: 'loo-vote' }),       // 사건 5건 중 3표
  이사: Object.freeze({ scope: 'provisional', systems: ['jamidusu'], basis: 'loo-vote' }),                // 사람 3명, 1:1:1 → 사례 점수
  관계: Object.freeze({ scope: 'provisional', systems: ['sukyo', 'astrology_classical'], basis: 'loo-vote' }), // 사람 3명, 1:1:1 → 사례 점수
  학업: Object.freeze({ scope: 'provisional', systems: ['gujeong', 'thai'], basis: 'loo-vote' }),         // 사건 5건 중 3표
  // 2명·3건(무릎 수술 2017·2026-10 포함), 빼고 고르기 3번 중 2표 — 빠진 쪽 78% vs 기본 49%
  건강: Object.freeze({ scope: 'provisional', systems: ['yukim', 'mahabote'], basis: 'loo-vote' }),
  주거: Object.freeze({ scope: 'provisional', systems: ['saju'], basis: 'single-case' }),                 // 사례 1건

  // 날짜가 붙은 사례가 없는 분야 — 대운 전환을 보는 사주 하나를 임시로 쓴다
  '큰 전환': Object.freeze({ scope: 'service', systems: ['saju'], basis: 'inferred' }),
});

/** 개인 전용 결과는 막되, 사례 부족의 잠정 분야 정책은 리포트에 적용한다. */
export const reportTimingPolicy = (domain, policy = VALIDATED_REPORT_TIMING_POLICY) => {
  const entry = policy[domain] ?? null;
  return ['service', 'provisional'].includes(entry?.scope) ? entry : null;
};
