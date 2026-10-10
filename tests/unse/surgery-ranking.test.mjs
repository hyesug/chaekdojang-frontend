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
const byDate = new Map([...ranked.candidates, ...ranked.excluded].map((x, i) => [key(x), { x, i }]));

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

test('천의는 절대 게이트가 아니며 비천의 후보도 천의 후보보다 앞설 수 있다', () => {
  // 복합 참고점수에서는 천의 여부 하나가 전체 순서를 고정하면 안 된다 —
  // 비천의 후보가 그보다 뒤의 천의 후보보다 앞서는 경우가 하나라도 있어야 한다
  const c = ranked.candidates.map((x) => x.surgery.cheonui);
  const firstNon = c.indexOf(false);
  assert.ok(firstNon >= 0 && c.slice(firstNon + 1).includes(true));
});

test('원국·대운의 직접 충과 형해파를 실제 후보마다 잡는다', () => {
  // 익명 고정 명반(1998 戊寅년 · 癸亥대운)
  const d0928 = byDate.get('2026-09-28');   // 乙巳일
  const d1001 = byDate.get('2026-10-01');   // 戊申일
  for (const v of [d0928, d1001]) assert.ok(v);
  assert.ok(
    d0928.x.surgery.branchRisk.some((r) => r.label === '대운' && r.relation === '충'),
    '巳일은 癸亥대운의 亥와 巳亥충이 잡혀야 한다',
  );
  assert.ok(
    d1001.x.surgery.branchRisk.some((r) => r.label === '년지' && r.relation === '충'),
    '申일은 원국 寅년지와 寅申충이 잡혀야 한다',
  );
});

test('2026 남은 평일 상위 후보를 로그로 남긴다', () => {
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
  // 시험 기간 안에 대운이 바뀌는 익명 명반
  const T = prepareInput({ ...FORM, year: 1985, month: 1, day: 10, hour: 12, minute: 0, birthPlace: '서울', homePlace: '서울', gender: 'female' },
    { now: new Date('2026-09-15T03:00:00Z') });
  const tr = rankSurgeryDays(T.input, T.chart, dayRange(T.input, T.chart, { y: 2026, m: 9, d: 15 }, 120));
  const near = tr.candidates.filter((x) => x.surgery.daeunTransition);
  assert.ok(near.length > 0);
  for (const x of near) {
    assert.ok(Math.abs(x.surgery.daeunTransition.delta) <= 45);
    assert.ok(x.surgery.daeunTransition.from);
    assert.ok(x.surgery.daeunTransition.to);
  }
});
