const factsOf = (results, id, label) => results.find((r) => r.id === id)?.facts?.filter((f) => f.label.includes(label)) ?? [];
const evidence = (results, pairs) => pairs.flatMap(([id, label]) => factsOf(results, id, label).map((fact) => ({ system: id, fact })));
const target = (key, label, sources, falsifiers) => ({ key, label, sources, falsifiers, confidence: sources.length >= 2 ? 'candidate' : 'insufficient-evidence' });

export function deriveProfileTargets(results) {
  const partnership = evidence(results, [['saju', '일간'], ['jamidusu', '부처궁'], ['astrology', '금성'], ['vedic', '금성']]);
  const children = evidence(results, [['saju', '십신'], ['jamidusu', '자녀궁'], ['astrology', '달'], ['vedic', '달']]);
  const career = evidence(results, [['saju', '십신'], ['jamidusu', '관록궁'], ['astrology', '중천'], ['vedic', '현재 다샤']]);
  return {
    relationship: [target('formal-partnership', '장기 관계를 제도화·공동생활로 옮기는 축', partnership, ['시기 계산에서 관계 축이 반복 활성화되지 않으면 실제 결혼 시점은 예측하지 않는다.'])],
    children: [target('caregiving-axis', '자녀·돌봄 책임이 삶의 중요한 축이 될 가능성', children, ['실제 자녀 수·성별·출산 여부는 원국만으로 예측하지 않는다.'])],
    career: [target('structured-specialization', '자격·조직·전문성을 거쳐 역할을 바꾸는 직업 경로', career, ['직업명·고용형태는 월별 시기 신호와 독립 사례 검증 없이 단정하지 않는다.'])],
  };
}
