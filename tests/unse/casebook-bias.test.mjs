import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCasebookBias } from '../../public/unse-8f3k2m/src/validation/casebook.js';

test('같은 출생 연도가 표본 과반이면 일반화 경고를 낸다', () => {
  const r = assessCasebookBias([{ profile: { year: 1992, homePlace: '대구' } }, { profile: { year: 1992, homePlace: '대구' } }, { profile: { year: 1991, homePlace: '서울' } }]);
  assert.equal(r.warnings.some((w) => w.includes('1992')), true);
});
