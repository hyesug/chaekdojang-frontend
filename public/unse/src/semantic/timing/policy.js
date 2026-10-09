/**
 * 리포트에서 분야별로 실제 사용할 시기 체계.
 *
 * `npm run unse:timing-learn` 이 본인·지인이 확인한 사례만으로 고른 값이다.
 * 유명인 사례는 생시가 불확실해 선택에 쓰지 않고 따로 검증한다(`unse:timing-learn:celebs`).
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
  // 2026-10-08 학습: 본인·지인 사람 9명·사건 47건 (유명인 제외)
  // 결혼식 — 사람 5명 빼고 고르기 5번 중 2표. 검증 전에는 리포트에 쓰지 않는다.
  결혼: Object.freeze({ scope: 'provisional', systems: ['yukim', 'hongguk'], eventKind: 'wedding_ceremony', basis: 'loo-vote' }),
  // 출산 — 임신 신호를 출산 시점으로 옮기지 않는다. 검증 전에는 리포트에 쓰지 않는다.
  자녀: Object.freeze({ scope: 'provisional', systems: ['saju'], eventKind: 'birth', leadMonths: 0, basis: 'loo-vote' }),

  직업: Object.freeze({ scope: 'provisional', systems: ['jamidusu', 'hongguk'], basis: 'loo-vote' }),     // 1명·사건 5건 중 2표
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

/** 구체 사건은 서비스 검증 정책과 선언된 사건 종류가 모두 맞을 때만 리포트에 쓴다. */
export const reportTimingPolicy = (domain, eventKind = null, policy = VALIDATED_REPORT_TIMING_POLICY) => {
  // 기존 호출부의 reportTimingPolicy(domain, policy)도 안전하게 막는다.
  if (eventKind && typeof eventKind === 'object') { policy = eventKind; eventKind = null; }
  const entry = policy[domain] ?? null;
  if (entry?.scope !== 'service') return null;
  if (eventKind != null && entry.eventKind !== eventKind) return null;
  return entry;
};
