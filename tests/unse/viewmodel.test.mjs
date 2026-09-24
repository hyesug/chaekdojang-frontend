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

test('개인 화면은 명반 · 오늘/이달 두 탭 · 프로필 저장 · AI 만, 궁합은 문장과 AI 만 둔다', async () => {
  const ui = await readFile(
    new URL('../../public/unse-8f3k2m/src/ui.js', import.meta.url),
    'utf8',
  );

  assert.match(ui, /\$\{chartPanel\(r\)\}/);
  const tabs = [...ui.matchAll(/<button type="button"[^>]*data-tab="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ['today', 'month']);
  assert.match(ui, /오늘의 운세/);
  assert.match(ui, /이달의 운세/);
  assert.match(ui, /id="profileCard"/);
  assert.match(ui, /aiSection\('solo', v\)/);

  // 걷어낸 것들
  assert.match(ui, /aiSection\('pair'\)/);
  for (const gone of ['나라는 사람', 'hiresPanel', 'shareBar', 'sensitivityPanel']) {
    assert.equal(ui.includes(gone), false, gone + ' 이(가) 남아 있다');
  }
});
