import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { traitLenses, verdictSummary } from '../../public/unse-8f3k2m/src/lens.js';

const coreResult = (name) => ({
  name,
  headline: name + ' 테스트',
  facts: [{ label: '근거', value: '테스트값' }],
});

const fortune = (from) => ({
  synthesis: {
    sharedTags: [{ word: '분석', from }],
    soloTags: [],
  },
  results: from.map(coreResult),
});

test('핵심 한 체계 신호는 행동 묘사를 숨기고 약하게 표현한다', () => {
  const [x] = traitLenses(fortune(['사주']), 1);
  assert.equal(x.level, 'weak');
  assert.equal(x.detail, false);
  assert.match(x.conclusion, /일 수 있습니다/);
});

test('핵심 두 체계 이상이면 현실 행동 설명을 허용한다', () => {
  const [x] = traitLenses(fortune(['사주', '점성술']), 1);
  assert.equal(x.level, 'mid');
  assert.equal(x.detail, true);
});

test('핵심 세 체계 이상이면 반복 확인된 핵심 패턴으로 표시한다', () => {
  const [x] = traitLenses(fortune(['사주', '자미두수', '점성술']), 1);
  assert.equal(x.level, 'strong');
  assert.equal(x.detail, true);
});

test('궁합 총평은 좋음·무난·어려움 세 칸과 핵심/전체를 모두 적는다', () => {
  const buckets = {
    좋음: Array(6).fill({}),
    무난: Array(6).fill({}),
    어려움: Array(3).fill({}),
  };
  const core = {
    좋음: [],
    무난: Array(2).fill({}),
    어려움: Array(2).fill({}),
  };
  const v = verdictSummary(buckets, core);
  assert.deepEqual(v.all, { 좋음: 6, 무난: 6, 어려움: 3 });
  assert.deepEqual(v.core, { 좋음: 0, 무난: 2, 어려움: 2 });
  assert.match(v.text, /좋음 0, 무난 2, 어려움 2/);
  assert.match(v.text, /좋음 6, 무난 6, 어려움 3/);
});

test('사용자 현실을 알고 쓴 것처럼 보이는 잔존 문구를 막는다', async () => {
  const paths = [
    new URL('../../public/unse-8f3k2m/src/reading.js', import.meta.url),
    new URL('../../public/unse-8f3k2m/src/lens.js', import.meta.url),
  ];
  const source = (await Promise.all(paths.map((p) => readFile(p, 'utf8')))).join('\n');

  const forbidden = [
    '내가 만든 것에서 돈이 나옵니다',
    '시험 하나로만 자신을 증명하려는 것',
    '자격과 공부를 하나 더 쌓으면',
    '고향이나 부모 곁을 떠나',
    '자기 이름이 붙는 결과물',
    '보증은 어떤 사정이 있어도',
    '정보처리기사',
    '책도장',
    '조달청',
  ];
  for (const phrase of forbidden) {
    assert.equal(source.includes(phrase), false, '금지 문구가 남아 있음: ' + phrase);
  }
});
