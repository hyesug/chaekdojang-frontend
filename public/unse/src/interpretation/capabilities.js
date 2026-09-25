// 전통에 해당 영역을 직접 보는 자리가 있는 경우만 결론 근거가 될 수 있다.
export const DIRECT_SYSTEMS = {
  직업: new Set(['saju', 'jamidusu', 'astrology', 'vedic', 'hongguk', 'yukim']),
  관계: new Set(['saju', 'jamidusu', 'astrology', 'vedic', 'sukyo']),
  재물: new Set(['saju', 'jamidusu', 'astrology', 'vedic', 'hongguk']),
  건강: new Set(['saju', 'jamidusu', 'astrology', 'vedic']),
  학업: new Set(['saju', 'astrology', 'vedic']),
};

export function canDirectlySupport(systemId, area) {
  return DIRECT_SYSTEMS[area]?.has(systemId) ?? false;
}
