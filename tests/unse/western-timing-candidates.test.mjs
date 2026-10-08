import test from 'node:test';
import assert from 'node:assert/strict';

import {
  modernAstrologyTiming,
  classicalAstrologyTiming,
} from '../../public/unse/src/semantic/timing/adapters.js';
import { predictTimeline } from '../../public/unse/src/semantic/timing/timeline.js';

const BIRTH = {
  name: 'P01', gender: 'female', year: 1992, month: 1, day: 30,
  hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전',
};

const CANDIDATES = {
  modern: { career: { systems: ['astrology_modern'] } },
  classical: { career: { systems: ['astrology_classical'] } },
};

test('현대·고전 점성 시기 후보는 서로 다른 체계 ID를 쓴다', () => {
  const result = predictTimeline({
    birth: BIRTH, from: '2028-01', to: '2028-06', domains: ['career'],
    validationPolicies: CANDIDATES,
  });

  const modern = Object.values(result.validationCandidates.modern.career);
  const classical = Object.values(result.validationCandidates.classical.career);
  assert.ok(modern.some(Number.isFinite), '현대 점성 후보에 월별 점수가 있어야 한다');
  assert.ok(classical.some(Number.isFinite), '고전 점성 후보에 월별 점수가 있어야 한다');
  assert.notDeepEqual(modern, classical, '고전·현대 후보가 같은 신호를 재사용하면 안 된다');
});

test('출생 시각이 없으면 현대·고전 점성 후보 모두 사용할 수 없다고 말한다', () => {
  const unknownTime = { ...BIRTH, hour: undefined, minute: undefined };
  const modern = modernAstrologyTiming(null, '2028-01', null, { timeKnown: false });
  const classical = classicalAstrologyTiming(null, '2028-01', null, { timeKnown: false });
  assert.equal(modern.system, 'astrology_modern');
  assert.equal(classical.system, 'astrology_classical');
  assert.equal(modern.available, false);
  assert.equal(classical.available, false);

  const result = predictTimeline({
    birth: unknownTime, from: '2028-01', to: '2028-02', domains: ['career'],
    validationPolicies: CANDIDATES,
  });
  for (const candidate of Object.values(result.validationCandidates)) {
    assert.ok(Object.values(candidate.career).every((score) => score == null));
  }
});
