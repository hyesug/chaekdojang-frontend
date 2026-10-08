import test from 'node:test';
import assert from 'node:assert/strict';

import { selectTimingPolicy } from '../../public/unse/src/validation/timingPolicy.js';
import { reportTimingPolicy } from '../../public/unse/src/semantic/timing/policy.js';

const row = (person, baseline, candidate, precision = 'month') => ({
  person, precision, scores: { baseline, candidate },
});

test('사람 여섯 명에게 일관되게 나은 후보만 시기 정책으로 승격한다', () => {
  const rows = [
    row('A', 50, 70), row('B', 50, 70), row('C', 50, 70),
    row('D', 50, 70), row('E', 50, 70), row('F', 50, 70),
    row('A', 50, 70), row('B', 50, 70),
  ];

  const verdict = selectTimingPolicy(rows, {
    baseline: 'baseline', shuffledSelectedScores: Array(100).fill(50),
  });

  assert.equal(verdict.promote, true);
  assert.equal(verdict.selected, 'candidate');
  assert.equal(verdict.loo.selected, 70);
  assert.equal(verdict.loo.baseline, 50);
});

test('사례 하나만 잘 맞는 후보는 다른 사람에서 꺾이면 승격하지 않는다', () => {
  const rows = [
    row('A', 50, 100), row('A', 50, 100),
    row('B', 50, 20), row('C', 50, 20), row('D', 50, 20),
    row('E', 50, 20), row('F', 50, 20), row('G', 50, 20),
  ];

  const verdict = selectTimingPolicy(rows, { baseline: 'baseline' });

  assert.equal(verdict.promote, false);
  assert.equal(verdict.selected, 'baseline');
});

test('사건이 많아도 사람이 한 명이면 시기 정책을 학습하지 않는다', () => {
  const rows = Array.from({ length: 12 }, () => row('A', 50, 90));

  const verdict = selectTimingPolicy(rows, { baseline: 'baseline' });

  assert.equal(verdict.promote, false);
  assert.match(verdict.reason, /사람/);
});

test('쌍 후보가 단독 후보보다 LOO 성적이 낮으면 채택하지 않는다', () => {
  const rows = [
    { person: 'A', precision: 'month', scores: { baseline: 40, vedic: 80, saju_vedic: 70 } },
    { person: 'B', precision: 'month', scores: { baseline: 40, vedic: 80, saju_vedic: 70 } },
    { person: 'C', precision: 'month', scores: { baseline: 40, vedic: 80, saju_vedic: 70 } },
    { person: 'D', precision: 'month', scores: { baseline: 40, vedic: 80, saju_vedic: 70 } },
    { person: 'E', precision: 'month', scores: { baseline: 40, vedic: 80, saju_vedic: 70 } },
    { person: 'F', precision: 'month', scores: { baseline: 40, vedic: 80, saju_vedic: 70 } },
    { person: 'G', precision: 'month', scores: { baseline: 40, vedic: 80, saju_vedic: 70 } },
    { person: 'H', precision: 'month', scores: { baseline: 40, vedic: 80, saju_vedic: 70 } },
  ];
  const verdict = selectTimingPolicy(rows, {
    baseline: 'baseline', shuffledSelectedScores: Array(100).fill(40),
    candidateSystems: { vedic: ['vedic'], saju_vedic: ['saju', 'vedic'] },
  });
  assert.equal(verdict.selected, 'vedic');
  assert.equal(verdict.scope, 'service');
  assert.equal(verdict.pairComparison, null);
});

test('개인 사례로 얻은 결과는 서비스용 정책을 덮어쓰지 않는다', () => {
  const personalOnly = {
    직업: { scope: 'personal', systems: ['vedic'], basis: 'personal-development' },
  };
  assert.equal(reportTimingPolicy('직업', personalOnly), null);
});
