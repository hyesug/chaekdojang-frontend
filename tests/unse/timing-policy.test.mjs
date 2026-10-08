import test from 'node:test';
import assert from 'node:assert/strict';

import { predictTimeline } from '../../public/unse/src/semantic/timing/timeline.js';

const BIRTH = {
  name: 'policy-test', gender: 'female', year: 1992, month: 1, day: 30,
  hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전',
};

test('시기 정책은 어떤 체계와 선행 개월을 써서 계산했는지 결과에 남긴다', () => {
  const result = predictTimeline({
    birth: BIRTH, from: '2028-01', to: '2029-12', domains: ['children'],
    timingPolicy: { children: { systems: ['saju'], leadMonths: 0 } },
  });

  assert.deepEqual(result.meta.timingPolicy.children, {
    systems: ['saju'], leadMonths: 0,
  });
});

test('후보 정책은 같은 명반 계산에서 나란히 시계열로 꺼내 비교한다', () => {
  const result = predictTimeline({
    birth: BIRTH, from: '2028-01', to: '2029-12', domains: ['children'],
    validationPolicies: {
      current: { children: { systems: ['saju'], leadMonths: 9 } },
      noLead: { children: { systems: ['saju'], leadMonths: 0 } },
    },
  });

  assert.equal(Object.keys(result.validationCandidates.current.children).length, 24);
  assert.equal(Object.keys(result.validationCandidates.noLead.children).length, 24);
  assert.notDeepEqual(result.validationCandidates.current.children,
    result.validationCandidates.noLead.children);
});
