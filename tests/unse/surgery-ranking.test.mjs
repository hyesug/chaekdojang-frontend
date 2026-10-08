import test from 'node:test';
import assert from 'node:assert/strict';

import { prepareInput } from '../../public/unse/src/engine.js';
import { dayRange, rankSurgeryDays } from '../../public/unse/src/reading.js';

const FORM = {
  name: '테스트',
  year: 1998,
  month: 8,
  day: 21,
  hour: 9,
  minute: 35,
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

test('수술 후보에서는 일지충·양인만 강하게 제외한다', () => {
  for (const x of ranked.candidates) {
    assert.equal(x.taekil.clashDay, false);
    assert.equal(x.sinsal.includes('양인'), false);
  }
  assert.ok(ranked.excluded.length > 0);
  for (const x of ranked.excluded) {
    assert.ok(
      x.surgeryExclude.every((reason) => reason === '일지충' || reason === '양인'),
      '년지·월지·시지·대운 충을 강제 제외 사유로 쓰면 안 된다',
    );
  }
});

test('수술 전용 순위는 천의 → 황도 → 충 감점 → 형해파 감점 → 건강 흐름 → 일반등급 순을 보존한다', () => {
  const tuple = (x) => [
    Number(x.surgery.cheonui),
    Number(x.surgery.hwangdo),
    -x.surgery.clashPenalty,
    -x.surgery.minorPenalty,
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

// 실제 인물로 확인하는 후보 테스트는 tests/unse/private/surgery-real.test.mjs 에 둔다(개인정보).
