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
