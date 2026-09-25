import test from 'node:test';
import assert from 'node:assert/strict';

import { readFortune } from '../../public/unse/src/engine.js';
import { readForecast } from '../../public/unse/src/forecast.js';
import { buildContext } from '../../public/unse/src/aiContext.js';
import { analyze as gujeongAnalyze, yearDirections } from '../../public/unse/src/systems/gujeong.js';

const NOW = new Date('2026-09-24T03:00:00Z');
const A = { name: '가', gender: 'female', year: 1992, month: 1, day: 30, hour: 16, minute: 28, birthPlace: '여주', homePlace: '서울' };

const context = (form) =>
  buildContext(form, readFortune(form, { now: NOW }), readForecast(form, NOW));

test('구성학 풀이 문장과 AI 문맥이 같은 방위 판정을 쓴다', () => {
  const d = yearDirections(1991, 2026);
  const r = gujeongAnalyze({ sajuYear: 1991, sectorIndex: 11, currentYear: 2026, age: 34 });
  const open = r.readings.find((x) => x.title === '올해 열린 방위').text;
  const shut = r.readings.find((x) => x.title === '올해 피할 방위').text;
  for (const x of d.good) assert.ok(open.includes(`${x.dir} (${x.star})`));
  for (const x of d.bad) assert.ok(shut.includes(`${x.dir} (${x.kind})`));
});

test('개인 문맥에 체계별 해석과 방위 도시 후보가 실린다', () => {
  const c = context(A);
  assert.match(c, /- 부처궁 — 배우자의 자리: /);
  assert.match(c, /- 올해 열린 방위: /);
  assert.match(c, /## 이동 방위와 도시 후보 \(거주지 서울 기준/);
  assert.match(c, /2026년\(입춘~이듬해 입춘\)\n- 열린 방위 /);
  assert.match(c, /2027년\(입춘~이듬해 입춘\)/);
  assert.match(c, /- 열린 방위 [^:]+: [^\n]*\(\d+km\)/);
  assert.ok(c.length < 60_000, `문맥 ${c.length}자`);
});
