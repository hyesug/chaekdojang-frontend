import test from 'node:test';
import assert from 'node:assert/strict';

import { reportTimingPolicy } from '../../public/unse/src/semantic/timing/policy.js';

test('리포트는 분야별 선택 정책을 쓰되 잠정·사전 후보의 등급을 보존한다', () => {
  for (const domain of ['직업', '재물', '관계', '이사', '학업']) {
    const policy = reportTimingPolicy(domain);
    assert.equal(policy?.scope, 'provisional', `${domain}은 사례 부족 잠정 후보여야 한다`);
  }
  for (const domain of ['결혼', '자녀', '주거', '건강', '큰 전환']) {
    assert.equal(reportTimingPolicy(domain)?.scope, 'prior', `${domain}은 사례 없는 사전 후보여야 한다`);
  }
});
