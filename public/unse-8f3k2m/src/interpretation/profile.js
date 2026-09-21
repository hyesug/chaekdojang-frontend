// 출생 정보만으로 계산된 15체계 신호를 현실 질문으로 번역한다.
// 사례의 삶의 사실은 이 함수에 전달하지 않는다.
import { canDirectlySupport } from './capabilities.js';
import { deriveProfileTargets } from './targets.js';
const RULES = {
  직업: [
    { key: 'independent-professional', label: '전문성을 쌓아 독립성·재량을 넓히는 일', tags: ['독립', '학습'], min: 2 },
    { key: 'structured-career', label: '자격·직책·조직 안에서 전문성을 쌓는 일', tags: ['책임', '학습'], min: 2 },
    { key: 'creative-project', label: '표현·기획·프로젝트형 일', tags: ['표현', '실행'], min: 2 },
  ],
  관계: [
    { key: 'committed-relationship', label: '관계를 책임·안정의 형태로 굳히는 경향', tags: ['책임', '안정'], min: 2 },
    { key: 'independent-relationship', label: '관계 안에서도 개인 공간과 자율성을 중시하는 경향', tags: ['독립', '자유'], min: 2 },
  ],
  학업: [
    { key: 'credential-path', label: '학습·자격·재교육으로 경로를 다시 만드는 경향', tags: ['학습', '분석'], min: 2 },
  ],
  재물: [
    { key: 'asset-builder', label: '수입·자산을 구조적으로 쌓는 경향', tags: ['재물', '인내'], min: 2 },
    { key: 'variable-income', label: '고정성보다 기회·변화에 따라 수입이 흔들릴 수 있는 경향', tags: ['재물', '변화'], min: 2 },
  ],
  건강: [
    { key: 'routine-needed', label: '무리보다 생활 리듬·회복 관리가 중요한 경향', tags: ['책임', '인내'], min: 2 },
  ],
};

const DOMAIN_NAMES = ['직업', '관계', '재물', '건강', '학업'];
const FACT_KEYS = {
  직업: ['십신', '관록궁', '중천', '현재 다샤', '내 궁', '사화'],
  관계: ['부처궁', '일간', '상승점', '금성', '달', '나크샤트라'],
  재물: ['십신', '재백궁', '목성', '세피라', '내 자리'],
  건강: ['오행', '질액궁', '상승점', '라그나', '문'],
  학업: ['십신', '문곡', '문창', '수성', '나크샤트라', '라이프 패스'],
};

function evidence(results, area, rule) {
  const eligible = results.filter((r) => canDirectlySupport(r.id, area) && (r.signals?.domains?.[area] ?? -Infinity) >= 60);
  const byTag = rule.tags.map((tag) => eligible.filter((r) => (r.signals?.tags ?? []).includes(tag)));
  if (byTag.some((items) => !items.length)) return [];
  const ids = new Map();
  for (const [index, items] of byTag.entries()) for (const r of items) {
    const item = ids.get(r.id) ?? { id: r.id, name: r.name, tags: [] };
    item.tags.push(rule.tags[index]);
    item.facts = (r.facts ?? []).filter((fact) => FACT_KEYS[area].some((key) => fact.label.includes(key)));
    ids.set(r.id, item);
  }
  return [...ids.values()];
}

export function interpretProfile(results) {
  const areas = {};
  for (const [area, rules] of Object.entries(RULES)) {
    const candidates = rules.map((rule) => ({ ...rule, systems: evidence(results, area, rule) }))
      .filter((candidate) => candidate.systems.length >= candidate.min)
      .sort((a, b) => b.systems.length - a.systems.length)
      .map(({ tags, min, ...candidate }) => candidate);
    const keys = new Set(candidates.map((candidate) => candidate.key));
    const conflicted = area === '직업' && keys.has('independent-professional') && keys.has('structured-career');
    areas[area] = { candidates, conflicted, status: candidates.length ? 'supported' : 'insufficient-evidence' };
  }
  const domainEvidence = Object.fromEntries(DOMAIN_NAMES.map((domain) => {
    const supporting = results
      .map((r) => ({ id: r.id, name: r.name, score: r.signals?.domains?.[domain] }))
      .filter((r) => canDirectlySupport(r.id, domain) && Number.isFinite(r.score));
    const average = supporting.length
      ? Math.round(supporting.reduce((sum, r) => sum + r.score, 0) / supporting.length * 10) / 10
      : null;
    const anchors = results.flatMap((r) => !canDirectlySupport(r.id, domain) ? []
      : (r.facts ?? []).filter((fact) => FACT_KEYS[domain].some((key) => fact.label.includes(key)))
        .map((fact) => ({ id: r.id, name: r.name, fact })));
    return [domain, { supporting, anchors, average, status: supporting.length >= 2 ? 'measurable' : 'insufficient-evidence' }];
  }));
  return {
    method: '15체계의 공통 태그와 체계가 직접 제공한 영역 점수를 분리해 집계한다. 사례 사실은 입력하지 않는다.',
    limits: ['결혼·이혼·자녀·수술처럼 구체적 사건은 원국만으로 확정하지 않는다.', '영역 점수는 체계 사이의 확률 비교가 아니라 각 체계의 해석 범위 표시다.'],
    domainEvidence, areas, targets: deriveProfileTargets(results),
  };
}
