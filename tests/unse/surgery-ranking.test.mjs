import test from 'node:test';
import assert from 'node:assert/strict';

import { prepareInput } from '../../public/unse-8f3k2m/src/engine.js';
import { dayRange, rankSurgeryDays } from '../../public/unse-8f3k2m/src/reading.js';

const FORM = {
  name: '이대희',
  year: 1999,
  month: 4,
  day: 28,
  hour: 10,
  minute: 15,
  birthPlace: '대전',
  homePlace: '대전',
  gender: 'male',
};

const { input, chart } = prepareInput(FORM, {
  now: new Date('2026-09-15T03:00:00Z'),
});
const days = dayRange(input, chart, { y: 2026, m: 9, d: 15 }, 120);
const ranked = rankSurgeryDays(input, chart, days);

const key = (x) => `${x.y}-${String(x.m).padStart(2, '0')}-${String(x.d).padStart(2, '0')}`;
const byDate = new Map(ranked.candidates.map((x, i) => [key(x), { x, i }]));

test('수술 후보에서는 일지충·띠충·양인을 모두 제외한다', () => {
  for (const x of ranked.candidates) {
    assert.equal(x.taekil.clashDay, false);
    assert.equal(x.taekil.clashYear, false);
    assert.equal(x.sinsal.includes('양인'), false);
  }
  assert.ok(ranked.excluded.length > 0);
});

test('수술 전용 순위는 천의 → 황도 → 월건강 → 당일건강 → 일반등급 순을 보존한다', () => {
  const tuple = (x) => [
    Number(x.surgery.cheonui),
    Number(x.surgery.hwangdo),
    x.surgery.monthHealth,
    x.surgery.dayHealth,
    x.surgery.gradeRank,
    x.score,
  ];

  const cmp = (a, b) => {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return b[i] - a[i];
    }
    return 0;
  };

  for (let i = 1; i < ranked.candidates.length; i++) {
    assert.ok(
      cmp(tuple(ranked.candidates[i - 1]), tuple(ranked.candidates[i])) <= 0,
      '우선순위가 뒤집힘: ' + key(ranked.candidates[i - 1]) + ' / ' + key(ranked.candidates[i]),
    );
  }
});

test('대희 실제 후보에서 황도 천의 날짜가 흑도 천의 날짜보다 앞선다', () => {
  const d1001 = byDate.get('2026-10-01');
  const d1108 = byDate.get('2026-11-08');
  const d1120 = byDate.get('2026-11-20');
  const d1202 = byDate.get('2026-12-02');
  const d1227 = byDate.get('2026-12-27');

  for (const v of [d1001, d1108, d1120, d1202, d1227]) assert.ok(v);

  assert.equal(d1001.x.surgery.cheonui, true);
  assert.equal(d1001.x.surgery.hwangdo, false);
  assert.equal(d1227.x.surgery.cheonui, true);
  assert.equal(d1227.x.surgery.hwangdo, false);

  for (const v of [d1108, d1120, d1202]) {
    assert.equal(v.x.surgery.cheonui, true);
    assert.equal(v.x.surgery.hwangdo, true);
    assert.ok(v.i < d1001.i);
    assert.ok(v.i < d1227.i);
  }
});

test('대운 전환 45일 이내 후보에는 전환 주의 정보를 붙인다', () => {
  const near = ranked.candidates.filter((x) => x.surgery.daeunTransition);
  assert.ok(near.length > 0);
  for (const x of near) {
    assert.ok(Math.abs(x.surgery.daeunTransition.delta) <= 45);
    assert.ok(x.surgery.daeunTransition.from);
    assert.ok(x.surgery.daeunTransition.to);
  }
});
