import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMonths, summarize } from '../../public/unse/src/validation/metrics.js';

test('실제 사건 월이 최고점이면 Hit@1이다', () => {
  const r = evaluateMonths([{ key: '2024-10', score: 2 }, { key: '2024-11', score: 9 }, { key: '2024-12', score: 1 }], '2024-11');
  assert.equal(r.rank, 1); assert.equal(r.percentile, 100); assert.equal(r.hitAt[1], true);
});

test('±2개월 안 최고점은 tolerance hit이다', () => {
  const r = evaluateMonths([{ key: '2024-09', score: 8 }, { key: '2024-11', score: 1 }], '2024-11', 2);
  assert.equal(r.toleranceHit, true); assert.equal(r.nearestPeakError, 2);
});

test('동점은 평균 순위를 사용한다', () => {
  const r = evaluateMonths([{ key: '2024-10', score: 9 }, { key: '2024-11', score: 9 }, { key: '2024-12', score: 1 }], '2024-11');
  assert.equal(r.rank, 1.5); assert.equal(r.percentile, 75); assert.equal(r.hitAt[1], true);
});

test('표본이 10보다 작으면 부족 표시를 한다', () => {
  assert.equal(summarize([{ percentile: 100, hitAt: { 1: true, 3: true, 5: true }, nearestPeakError: 0 }]).insufficientSample, true);
});
