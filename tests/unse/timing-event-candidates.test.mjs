import test from 'node:test';
import assert from 'node:assert/strict';

import { predictTimeline } from '../../public/unse/src/semantic/timing/timeline.js';

const birth = {
  gender: 'female', year: 1993, month: 3, day: 17, hour: 15, minute: 42,
  birthPlace: '여주', homePlace: '대전',
};

test('검증 후보는 자기 체계의 결혼·출산 사건 점수를 따로 남긴다', () => {
  const result = predictTimeline({
    birth, from: '2028-01', to: '2028-03', domains: ['marriage', 'children'],
    validationPolicies: { sajuOnly: { marriage: { systems: ['saju'] }, children: { systems: ['saju'] } } },
  });
  const key = Object.keys(result.timeline)[0];

  assert.equal(typeof result.validationEventCandidates.sajuOnly.marriage[key].marriage, 'number');
  assert.equal(typeof result.validationEventCandidates.sajuOnly.children[key].birth, 'number');
  assert.equal(result.validationCandidateMeta.sajuOnly.marriage.resolution, 'month');
});

test('검증 후보의 가장 거친 고유 눈금은 연 단위 채점용으로 남긴다', () => {
  const result = predictTimeline({
    birth, from: '2028-01', to: '2028-03', domains: ['marriage'],
    validationPolicies: { annual: { marriage: { systems: ['tojeong'] } } },
  });

  assert.equal(result.validationCandidateMeta.annual.marriage.resolution, 'year');
});
