import test from 'node:test';
import assert from 'node:assert/strict';

import { scoreEventKind } from '../../public/unse/src/validation/timingMetrics.js';
import { predictTimeline } from '../../public/unse/src/semantic/timing/timeline.js';

test('같은 달에 다른 사건 후보가 더 높으면 상황 적중으로 세지 않는다', () => {
  const result = scoreEventKind([
    { k: '2024-12', scores: { new_relationship: 0.1, breakup: 0.2 } },
    { k: '2025-01', scores: { new_relationship: 0.7, breakup: 0.9 } },
    { k: '2025-02', scores: { new_relationship: 0.2, breakup: 0.1 } },
  ], '2025-01', 'new_relationship');

  assert.equal(result.leadingType, 'breakup');
  assert.equal(result.kindMatch, false);
  assert.equal(result.score.eventPercentile, 100);
});

test('타임라인은 잘린 화면 후보와 별개로 모든 사건 후보 점수를 남긴다', () => {
  const result = predictTimeline({
    birth: { gender: 'female', year: 1993, month: 3, day: 17, hour: 15, minute: 42, birthPlace: '여주' },
    from: '2028-01', to: '2028-03', domains: ['career'],
  });

  const firstPeriod = Object.keys(result.timeline)[0];
  const scores = result.timeline[firstPeriod].eventScores.career;
  assert.equal(typeof scores.job_change, 'number');
  assert.equal(typeof scores.promotion, 'number');
});
