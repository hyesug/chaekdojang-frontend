import test from 'node:test';
import assert from 'node:assert/strict';

import { timingFor } from '../../public/unse/src/semantic/compose/timing.js';

const INPUT = {
  gender: 'female', year: 1993, month: 3, day: 17, hour: 15, minute: 42,
  birthPlace: '여주', homePlace: '대전', currentYear: 2026,
};

test('리포트 시기 후보는 검증 정책이 고른 체계만 사용하고 그 사실을 남긴다', () => {
  const result = timingFor(INPUT, { gender: 'female' }, '결혼', {
    from: 2026, to: 2032, policy: { systems: ['saju'] },
  });

  assert.deepEqual(result.policy.systems, ['saju']);
  for (const row of result.rows) assert.deepEqual(row.systems, ['사주']);
});
