import assert from 'node:assert/strict';
import test from 'node:test';

import { redactNames } from '../../public/unse/src/ai.js';
import { readFortune } from '../../public/unse/src/engine.js';
import { readForecast } from '../../public/unse/src/forecast.js';
import { compareFortune } from '../../public/unse/src/compat.js';
import { buildContext, buildCompatContext } from '../../public/unse/src/aiContext.js';
import * as PAIR from '../../public/unse/src/hires/pair.js';

// 개인정보처리방침: 이름은 AI 요청에 넣지 않는다. 궁합은 두 사람 모두.
const A = { name: '홍길순', gender: 'female', year: 1992, month: 1, day: 30, hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전' };
const B = { name: '김철수', gender: 'male', year: 1990, month: 5, day: 5, hour: 7, minute: 0, birthPlace: '서울', homePlace: '서울' };
const NOW = { now: new Date('2026-10-06T00:00:00Z') };

test('이름 지우기는 두 글자 이상 이름만 바꾸고 나머지 글은 그대로 둔다', () => {
  const names = [['홍길순', '첫 번째 사람'], ['김', '두 번째 사람']];
  assert.equal(redactNames('홍길순 님과 김 대리', names), '첫 번째 사람 님과 김 대리');
  assert.equal(redactNames(null, names), null);
});

test('개인 명반 문맥에 입력한 이름이 없다', () => {
  const r = readFortune(A, NOW);
  const ctx = buildContext(A, r, readForecast(A));
  assert.equal(ctx.includes(A.name), false);
});

test('궁합 문맥과 결혼 시기 구획을 보낼 때 두 사람 이름이 남지 않는다', () => {
  const c = compareFortune(A, B);
  const names = [[A.name, '첫 번째 사람'], [B.name, '두 번째 사람']];
  const ctx = redactNames(buildCompatContext(A, B, c, readForecast(A), readForecast(B)), names);
  const mw = PAIR.marriageWindow(c.A, c.B, c.A.input.currentYear, 6);
  const focus = redactNames(PAIR.formatPair(mw, PAIR.relationshipCharts(c.A, c.B, mw.rows.map((x) => x.year)), PAIR.navamsaPair(c.A, c.B), '첫 번째 사람', '두 번째 사람'), names);
  for (const text of [ctx, focus]) {
    assert.equal(text.includes(A.name), false);
    assert.equal(text.includes(B.name), false);
  }
});
