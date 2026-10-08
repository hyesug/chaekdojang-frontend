import test from 'node:test';
import assert from 'node:assert/strict';

import { reportTimingPolicy } from '../../public/unse/src/semantic/timing/policy.js';

test('리포트의 모든 시기 분야는 한 개 이상의 채택 체계를 가진다', () => {
  for (const domain of ['직업', '재물', '관계', '결혼', '자녀', '이사', '주거', '건강', '학업', '큰 전환']) {
    const policy = reportTimingPolicy(domain);
    assert.ok(policy, `${domain} 정책이 없다`);
    assert.ok(policy.systems.length >= 1, `${domain} 체계가 비어 있다`);
    // service 는 관측·추정, provisional 은 개인 이력·사례 부족 다인 검증에서 고른 잠정 조합이다
    assert.ok(['observed', 'inferred', 'personal-development', 'underpowered-multiperson'].includes(policy.basis), `${domain} 채택 근거가 없다`);
  }
});
