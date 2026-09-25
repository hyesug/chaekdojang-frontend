import test from 'node:test';
import assert from 'node:assert/strict';
import { runBenchmark } from '../../public/unse/src/validation/runner.js';

test('출생 시각이 없으면 시간 필수 체계를 건너뛴다', () => {
  const result = runBenchmark([{ id: 'P001', profile: { gender: 'female', year: 1992, month: 1, day: 1, birthPlace: '대전', homePlace: '대전' }, events: [{ domain: '직업', type: '이직', date: '2024-11' }] }], { collect: () => ({ saju: [{ key: '2024-11', score: 1 }] }) });
  assert.equal(result.people[0].events[0].systems.jamidusu.status, 'skipped');
  assert.equal(result.people[0].events[0].systems.saju.status, 'ok');
});

test('한 체계 실패는 다른 체계를 중단시키지 않는다', () => {
  const result = runBenchmark([{ id: 'P001', profile: { gender: 'female', year: 1992, month: 1, day: 1, hour: 10, birthPlace: '대전', homePlace: '대전' }, events: [{ domain: '직업', type: '이직', date: '2024-11' }] }], { collect: () => ({ saju: [{ key: '2024-11', score: 1 }], astrology: new Error('boom') }) });
  assert.equal(result.people[0].events[0].systems.saju.status, 'ok');
  assert.equal(result.people[0].events[0].systems.astrology.status, 'error');
});
