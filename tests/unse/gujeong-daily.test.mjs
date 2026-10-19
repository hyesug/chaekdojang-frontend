/**
 * 일가구성(日家九星) 회귀 — 일본 역서 값과 대조.
 * 출처: rekichu.com 2026년 일가구성 달력(매월 1일, 전환일 반복), koyomil.com·nihonkoyomi.com 2026년 날짜.
 * 중국식 자백비성(skillon.com)은 전환 규칙이 다른 유파라 대조하지 않는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyStar } from '../../public/unse/src/systems/gujeong.js';

test('2026년 매월 1일 일가구성이 일본 역서와 같다', () => {
  const expected = { 1: 3, 2: 7, 3: 8, 4: 3, 5: 6, 6: 1, 7: 6, 8: 2, 9: 7, 10: 4, 11: 9, 12: 6 };
  for (const [m, v] of Object.entries(expected)) assert.equal(dailyStar(2026, Number(m), 1), v, `2026-${m}-1`);
});

test('전환일에는 같은 별이 이틀 이어진다 — 하지 쪽 甲子(9)·동지 쪽 甲子(1)', () => {
  assert.equal(dailyStar(2026, 6, 18), 9); assert.equal(dailyStar(2026, 6, 19), 9);
  assert.equal(dailyStar(2026, 6, 20), 8);
  assert.equal(dailyStar(2026, 12, 15), 1); assert.equal(dailyStar(2026, 12, 16), 1);
  assert.equal(dailyStar(2026, 12, 17), 2);
  assert.equal(dailyStar(2026, 9, 29), 6); assert.equal(dailyStar(2026, 10, 17), 6);
});

test('윤(閏) — 2008년 겨울은 甲午를 7(칠적)로 양둔, 2020년 여름은 甲午를 3(삼벽)으로 음둔', () => {
  assert.equal(dailyStar(2008, 12, 19), 7); assert.equal(dailyStar(2008, 12, 20), 7); assert.equal(dailyStar(2008, 12, 21), 8);
  assert.equal(dailyStar(2020, 6, 19), 3); assert.equal(dailyStar(2020, 6, 20), 3); assert.equal(dailyStar(2020, 6, 21), 2);
});

test('구성학 오늘·이달 운은 그날의 판(일반)·그달의 판(월반)으로 본다 — 예전엔 셋 다 연반이었다', async () => {
  const { readForecast } = await import('../../public/unse/src/forecast.js');
  const form = { name: 't', gender: 'female', year: 1986, month: 5, day: 9, hour: 10, minute: 8, birthPlace: '여주', homePlace: '서울' };
  const f = readForecast(form, new Date('2026-10-19T03:00:00Z'));
  const g = (b) => b.results.find((x) => x.id === 'gujeong').text;
  assert.match(g(f.day), /^오늘의 방위반\(일반\)/);
  assert.match(g(f.day), /그날의 별은 사록목성/); // 2026-10-19 = 4
  assert.match(g(f.day), /오늘 움직이기 좋은 방향은 /);
  assert.match(g(f.month), /^이달의 방위반\(월반\).*이달의 별은 구자화성/); // 2026 戌월 = 9
  assert.match(g(f.year), /^2026년 방위반/);
});

test('그날 방위 — 일반만 열린 방향(하루짜리)과 연반·월반·일반이 모두 열린 방향(이사)', async () => {
  const { goodDirectionsOn } = await import('../../public/unse/src/systems/gujeong.js');
  const g = goodDirectionsOn(1986, 2026, 8, 2026, 10, 19);
  assert.equal(g.center, 4);
  assert.ok(g.day.length > 0);
  assert.ok(g.all.every((d) => g.day.includes(d)), '이사 방향은 그날 방향 안에 있어야 한다');
});

test('AI 문맥 — 그날 운에 그날의 판, 120일 표에 이사길방·팔방색을 싣는다', async () => {
  const { readFortune } = await import('../../public/unse/src/engine.js');
  const { readForecast } = await import('../../public/unse/src/forecast.js');
  const { targetDayContext, dayContext } = await import('../../public/unse/src/aiContext.js');
  const form = { name: 't', gender: 'female', year: 1986, month: 5, day: 9, hour: 10, minute: 8, birthPlace: '여주', homePlace: '서울' };
  const now = new Date('2026-10-19T03:00:00Z');
  const r = readFortune(form, { now });
  assert.match(targetDayContext(form, r, { y: 2026, m: 10, d: 20, label: '내일' }), /구성학 그날의 판\(일반\): 그날의 별 3 .*그날 움직이기 좋은 방향/);
  const table = dayContext(r, readForecast(form, now));
  assert.match(table, /10\/19\(월\) 丙寅 .*이사길방 /);
  assert.match(table, /팔방색/);
});
