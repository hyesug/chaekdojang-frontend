import test from 'node:test';
import assert from 'node:assert/strict';

import { reportTimingPolicy } from '../../public/unse/src/semantic/timing/policy.js';

test('리포트는 서비스 검증을 통과한 시기 정책만 쓴다', () => {
  for (const domain of ['직업', '재물', '관계', '결혼', '자녀', '이사', '주거', '건강', '학업']) {
    const policy = reportTimingPolicy(domain);
    assert.equal(policy, null, `${domain} 잠정 정책이 리포트에 나오면 안 된다`);
  }
  assert.equal(reportTimingPolicy('큰 전환')?.scope, 'service');
});
