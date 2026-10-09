import test from 'node:test';
import assert from 'node:assert/strict';

import { reportTimingPolicy } from '../../public/unse/src/semantic/timing/policy.js';

test('리포트는 분야별 선택 정책을 쓰되 잠정·사전 후보의 등급을 보존한다', () => {
  for (const domain of ['직업', '재물', '관계', '이사', '학업']) {
    const policy = reportTimingPolicy(domain);
    assert.equal(policy?.scope, 'provisional', `${domain}은 사례 부족 잠정 후보여야 한다`);
  }
  // 결혼·자녀는 사례 재검증에서 나이 기준선보다 못해 정책에서 뺐다 (docs/unse/rebuild-result.md)
  for (const domain of ['결혼', '자녀']) assert.equal(reportTimingPolicy(domain), null, `${domain} 연도는 내지 않는다`);
  for (const domain of ['주거', '건강', '큰 전환']) {
    assert.equal(reportTimingPolicy(domain)?.scope, 'prior', `${domain}은 사례 없는 사전 후보여야 한다`);
  }
});
