/**
 * 리포트에서 분야별로 실제 사용할 시기 체계.
 *
 * `npm run unse:timing-learn` 이 본인·지인이 확인한 사례만으로 고른 값이다.
 * 유명인 사례는 생시가 불확실해 선택에 쓰지 않고 따로 검증한다(`unse:timing-learn:celebs`).
 *  · service      — 사람 6명·월 사건 8건 이상, 한 사람씩 빼도 같은 후보, 날짜 섞기보다 확실히 나음
 *  · provisional  — 위 기준에 못 미치는 분야. **빼고 고르기**로 하나를 고른다:
 *                   한 단위(사람 3명 이상이면 사람, 아니면 사건)를 가려 두고 나머지로 최고
 *                   후보를 고르기를 반복해 가장 많이 뽑힌 후보(loo-vote). 사례가 한 건뿐이면
 *                   그 사례 최고(single-case). 표와 점수가 동률이면 후보를 조합한다.
 *  · prior        — 사건 사례가 전혀 없는 분야. 결과에 맞춰 고르지 않고, 그 분야의
 *                   고유 규칙을 가장 직접 다루는 사전 후보를 쓴다.
 * 후보는 17체계 단독(15체계 + 현대·고전 점성), 계보가 다른 두 체계의 쌍, 15체계 전체다.
 *
 * 이 표는 미래 사건의 보증이 아니다. 결과 화면에서는 "신호가 높은 구간"으로만 읽는다.
 */
export const VALIDATED_REPORT_TIMING_POLICY = Object.freeze({
  // 2026-10-09 학습: 확인된 사람 9명·사건 47건. eventKind가 없는 과거 기록은
  // 구체 사건 학습에 쓰지 않았으므로 결혼식·출산은 사전 후보로 남긴다.
  결혼: Object.freeze({ scope: 'prior', systems: ['saju', 'jamidusu', 'astrology_modern', 'vedic'], eventKind: 'wedding_ceremony', basis: 'direct-domain-rule-tie' }),
  자녀: Object.freeze({ scope: 'prior', systems: ['saju', 'jamidusu', 'astrology_modern', 'vedic'], eventKind: 'birth', leadMonths: 0, basis: 'direct-domain-rule-tie' }),
  주거: Object.freeze({ scope: 'prior', systems: ['saju', 'jamidusu', 'astrology_modern', 'vedic'], basis: 'direct-domain-rule-tie' }),
  건강: Object.freeze({ scope: 'prior', systems: ['saju', 'jamidusu', 'astrology_modern', 'vedic'], basis: 'direct-domain-rule-tie' }),
  '큰 전환': Object.freeze({ scope: 'prior', systems: ['saju', 'jamidusu', 'astrology_modern', 'vedic'], basis: 'direct-domain-rule-tie' }),

  // 한 사람 이력만 있는 분야 — 사건을 하나씩 빼고도 가장 자주 남은 잠정 후보다.
  직업: Object.freeze({ scope: 'provisional', systems: ['yukim', 'mahabote'], eventKind: 'first_job', resolution: 'year', basis: 'loo-vote' }),
  재물: Object.freeze({ scope: 'provisional', systems: ['yukim', 'mahabote'], eventKind: 'income_increase', resolution: 'year', basis: 'loo-vote' }),
  관계: Object.freeze({ scope: 'provisional', systems: ['saju', 'tarot'], eventKind: 'new_relationship', resolution: 'month', basis: 'loo-vote' }),
  이사: Object.freeze({ scope: 'provisional', systems: ['jamidusu'], eventKind: 'regional_move', resolution: 'month', basis: 'loo-vote' }),
  학업: Object.freeze({ scope: 'provisional', systems: ['taeeul', 'kabbalah'], eventKind: 'qualification_attempt', resolution: 'year', basis: 'loo-vote' }),
});

/** 화면에는 서비스·잠정·사전 후보를 모두 쓰되, 호출부가 scope를 함께 표기한다. */
export const reportTimingPolicy = (domain, eventKind = null, policy = VALIDATED_REPORT_TIMING_POLICY) => {
  // 기존 호출부의 reportTimingPolicy(domain, policy)도 안전하게 처리한다.
  if (eventKind && typeof eventKind === 'object') { policy = eventKind; eventKind = null; }
  const entry = policy[domain] ?? null;
  if (!['service', 'provisional', 'prior'].includes(entry?.scope)) return null;
  if (eventKind != null && entry.eventKind !== eventKind) return null;
  return entry;
};
