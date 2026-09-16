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

test('수술 참고 후보는 복합 참고점수 내림차순을 보존한다', () => {
  for (let i = 1; i < ranked.candidates.length; i++) {
    assert.ok(
      ranked.candidates[i - 1].surgery.referenceScore >= ranked.candidates[i].surgery.referenceScore,
      '참고점수 순서가 뒤집힘: ' + key(ranked.candidates[i - 1]) + ' / ' + key(ranked.candidates[i]),
    );
  }
});

test('천의는 절대 게이트가 아니며 원국 위험 감점에 따라 비천의 후보가 앞설 수 있다', () => {
  const d1202 = byDate.get('2026-12-02');
  const d1224 = byDate.get('2026-12-24');

  for (const v of [d1202, d1224]) assert.ok(v);
  assert.equal(d1202.x.surgery.cheonui, true);
  assert.equal(d1224.x.surgery.cheonui, false);
  assert.ok(
    d1224.x.i < d1202.x.i,
    '천의 여부 하나가 원국 충 감점을 무조건 덮으면 안 된다',
  );
});

test('대희 원국·대운의 직접 충과 형해파를 실제 후보마다 잡는다', () => {
  const d0928 = byDate.get('2026-09-28');
  const d1001 = byDate.get('2026-10-01');
  const d1120 = byDate.get('2026-11-20');
  const d1202 = byDate.get('2026-12-02');

  for (const v of [d0928, d1001, d1120, d1202]) assert.ok(v);

  assert.ok(
    d0928.x.surgery.branchRisk.some((r) => r.label === '대운' && r.relation === '삼형'),
    '9/28 巳일은 丙寅대운의 寅과 형 관계가 잡혀야 한다',
  );
  assert.ok(
    d1001.x.surgery.branchRisk.some((r) => r.label === '대운' && r.relation === '충'),
    '10/1 申일은 丙寅대운의 寅과 충이 잡혀야 한다',
  );
  for (const v of [d1120, d1202]) {
    assert.ok(
      v.x.surgery.branchRisk.some((r) => r.label === '월지' && r.relation === '충'),
      '戌일은 원국 辰월지와 辰戌충이 잡혀야 한다',
    );
  }
});

test('대희 2026 남은 평일 상위 후보를 로그로 남긴다', () => {
  const weekdays = ranked.candidates
    .filter((x) => x.y === 2026 && !['토', '일'].includes(x.weekday))
    .slice(0, 12);

  assert.ok(weekdays.length >= 5);
  console.log('SURGERY_WEEKDAY_TOP=' + JSON.stringify(weekdays.map((x, i) => ({
    rank: i + 1,
    date: key(x),
    weekday: x.weekday,
    gz: x.gz.hanja,
    cheonui: x.surgery.cheonui,
    hwangdo: x.surgery.hwangdo,
    hwangdoName: x.surgery.hwangdoName,
    clashPenalty: x.surgery.clashPenalty,
    minorPenalty: x.surgery.minorPenalty,
    branchRisk: x.surgery.branchRisk.map((r) => r.label + r.relation),
    daeun: x.surgery.activeDaeun?.hanja ?? null,
    monthHealth: x.surgery.monthHealth,
    dayHealth: x.surgery.dayHealth,
    grade: x.grade,
    referenceScore: x.surgery.referenceScore,
  }))));

  const weekdayAll = ranked.candidates
    .filter((x) => x.y === 2026 && !['토', '일'].includes(x.weekday));
  const compareDates = ['2026-09-28', '2026-11-13', '2026-11-25', '2026-12-02', '2026-11-20'];
  console.log('SURGERY_COMPARE=' + JSON.stringify(compareDates.map((date) => {
    const i = weekdayAll.findIndex((x) => key(x) === date);
    if (i < 0) return { date, excluded: true };
    const x = weekdayAll[i];
    return {
      date,
      rank: i + 1,
      gz: x.gz.hanja,
      cheonui: x.surgery.cheonui,
      hwangdo: x.surgery.hwangdo,
      hwangdoName: x.surgery.hwangdoName,
      clashPenalty: x.surgery.clashPenalty,
      minorPenalty: x.surgery.minorPenalty,
      branchRisk: x.surgery.branchRisk.map((r) => r.label + r.relation),
      daeun: x.surgery.activeDaeun?.hanja ?? null,
      monthHealth: x.surgery.monthHealth,
      dayHealth: x.surgery.dayHealth,
      grade: x.grade,
    };
  })));
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
