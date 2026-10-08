import test from 'node:test';
import assert from 'node:assert/strict';

import { selectTimingPolicy, selectProvisionalPolicy } from '../../public/unse/src/validation/timingPolicy.js';
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

test('사례가 부족할 때의 잠정 분야 정책은 리포트에서 사용할 수 있다', () => {
  const provisional = {
    이사: { scope: 'provisional', systems: ['jamidusu', 'astrology_classical'], basis: 'personal-development' },
  };
  assert.deepEqual(reportTimingPolicy('이사', provisional), provisional.이사);
});

test('잠정 정책은 전체 사례 최고가 아니라 빼고 고른 조합이 빠진 쪽에서 나을 때만 채택한다', () => {
  // lucky 는 사례 전체 평균(70)이 기본(60)보다 높지만 한 사건 덕분이다.
  // 그 사건을 빼고 고르면 기본 방식이 뽑히고, 다른 사건을 빼면 lucky 가 뽑혀도 빠진 쪽 점수가 낮다.
  const fluke = [0, 1, 2].map((i) => ({ person: 'P', precision: 'month',
    scores: { baseline: 60, lucky: [100, 55, 55][i] } }));
  const a = selectProvisionalPolicy(fluke, { baseline: 'baseline' });
  assert.equal(a.full.candidate, 'lucky', '전체 사례로만 보면 lucky 가 1등이다');
  assert.equal(a.unit, 'event', '한 사람뿐이면 사건 단위로 뺀다');
  assert.equal(a.adopt, false);
  assert.equal(a.selected, 'baseline');

  // good 은 어느 사건을 빼도 뽑히고 빠진 쪽에서도 기본보다 낫다
  const steady = [0, 1, 2].map((i) => ({ person: 'P', precision: 'month',
    scores: { baseline: 60, good: [80, 75, 85][i] } }));
  const b = selectProvisionalPolicy(steady, { baseline: 'baseline' });
  assert.equal(b.adopt, true);
  assert.equal(b.selected, 'good');
  assert.equal(b.agreement, 1);
});

test('사람이 세 명 이상이면 사람 단위로 빼고 고른다', () => {
  const rows = ['A', 'B', 'C', 'D'].map((person) => ({ person, precision: 'month', scores: { baseline: 50, good: 70 } }));
  const v = selectProvisionalPolicy(rows, { baseline: 'baseline' });
  assert.equal(v.unit, 'person');
  assert.equal(v.units, 4);
  assert.equal(v.selected, 'good');
});