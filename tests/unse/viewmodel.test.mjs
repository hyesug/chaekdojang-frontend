import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { readFortune } from '../../public/unse-8f3k2m/src/engine.js';
import { readForecast } from '../../public/unse-8f3k2m/src/forecast.js';
import { buildView } from '../../public/unse-8f3k2m/src/viewmodel.js';

const FORM = {
  name: '구조 테스트',
  year: 1992,
  month: 1,
  day: 30,
  hour: 16,
  minute: 28,
  birthPlace: '여주',
  homePlace: '대전',
  gender: 'female',
};
const NOW = new Date('2026-09-15T03:00:00Z');

test('나라는 사람은 등록된 15체계를 각각 한 줄로 보여준다', () => {
  const r = readFortune(FORM, { now: NOW });
  const f = readForecast(FORM, NOW);
  const v = buildView(FORM, r, f);

  assert.equal(r.results.length, 15);
  assert.equal(v.me.systemCount, 15);
  assert.equal(v.me.systems.length, 15);
  assert.ok(v.me.systems.every((x) => x.name && x.line));
  assert.deepEqual(
    v.me.systems.slice(0, 4).map((x) => x.core),
    [true, true, true, true],
  );
});

test('상세 성향은 여러 체계에서 실제로 반복된 것만 남긴다', () => {
  const r = readFortune(FORM, { now: NOW });
  const f = readForecast(FORM, NOW);
  const v = buildView(FORM, r, f);

  assert.ok(v.me.lenses.length > 0);
  for (const x of v.me.lenses) {
    assert.ok(x.total >= 2, '단일 체계 신호가 상세 공통 리딩에 들어옴');
    assert.ok(
      x.coreCount >= 1 || x.total >= 3,
      '보조체계 둘만 겹친 신호가 상세 공통 리딩에 들어옴',
    );
  }
});

test('화면은 결론을 큰 제목으로, 근거 강도를 작은 보조문구로 배치한다', async () => {
  const ui = await readFile(
    new URL('../../public/unse-8f3k2m/src/ui.js', import.meta.url),
    'utf8',
  );

  assert.match(ui, /class="trait-title"/);
  assert.match(ui, /class="trait-confidence/);
  assert.match(ui, /체계가 본 나 · 한눈에/);
  assert.match(ui, /여러 체계에서 반복되는 특징/);

  assert.equal(ui.includes('이 명반에서 눈에 띄는 것'), false);
  assert.equal(ui.includes('사주 원국에서 강한 구조'), false);
});
