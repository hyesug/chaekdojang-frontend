/**
 * 사건 규칙 층(semantic/events/rules.js) — 원전 공식이 그대로 들어갔는가
 *
 * 맞히는지는 여기서 재지 않는다(사례집 채점은 scripts/audit-casebook.mjs).
 * 공식 값·성별 구분·말하지 않는 체계만 본다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFortune } from '../../public/unse/src/engine.js';
import {
  eventYears, hongluanOf, tianxiOf, peachOf, SILENT,
} from '../../public/unse/src/semantic/events/rules.js';

const BASE = { year: 1990, month: 5, day: 10, hour: 10, minute: 0, birthPlace: '서울', homePlace: '서울' };

test('홍란은 卯에서 子년을 일으켜 역행하고 천희는 그 대충이다', () => {
  assert.equal(hongluanOf(0), 3);    // 子년 → 卯
  assert.equal(hongluanOf(1), 2);    // 丑년 → 寅
  assert.equal(hongluanOf(6), 9);    // 午년 → 酉
  assert.equal(tianxiOf(0), 9);      // 子년 천희 → 酉
});

test('도화는 삼합의 목욕지다', () => {
  assert.equal(peachOf(0), 9);       // 申子辰 → 酉
  assert.equal(peachOf(6), 3);       // 寅午戌 → 卯
  assert.equal(peachOf(9), 6);       // 巳酉丑 → 午
  assert.equal(peachOf(3), 0);       // 亥卯未 → 子
});

test('원전 규칙이 없는 체계는 이유를 달고 말하지 않는다', () => {
  const r = eventYears(readFortune({ ...BASE, gender: 'female' }), 'marriage', 2015, 2020);
  for (const id of Object.keys(SILENT)) {
    assert.equal(r[id].available, false);
    assert.ok(r[id].why.length > 10);
  }
});

test('출생 시각이 없으면 자미·베딕·고전 점성은 말하지 않는다', () => {
  const { hour, minute, ...noTime } = BASE;
  const r = eventYears(readFortune({ ...noTime, gender: 'female' }), 'marriage', 2015, 2020);
  for (const id of ['jamidusu', 'vedic', 'astrology_classical']) assert.equal(r[id].available, false, id);
  assert.equal(r.saju.available, true);
});

test('사주 배우자성은 성별로 갈린다 — 여명 관성, 남명 재성', () => {
  const f = eventYears(readFortune({ ...BASE, gender: 'female' }), 'marriage', 2010, 2030).saju.years;
  const m = eventYears(readFortune({ ...BASE, gender: 'male' }), 'marriage', 2010, 2030).saju.years;
  const said = (ys, word) => Object.values(ys).some((y) => y.hits.some((h) => h.includes(word)));
  assert.ok(said(f, '관성'));
  assert.ok(!said(f, '= 재성'));
  assert.ok(said(m, '재성'));
  assert.ok(!said(m, '= 관성'));
});

test('같은 입력이면 같은 결과다', () => {
  const a = eventYears(readFortune({ ...BASE, gender: 'male' }), 'birth', 2015, 2025);
  const b = eventYears(readFortune({ ...BASE, gender: 'male' }), 'birth', 2015, 2025);
  assert.deepEqual(a, b);
});
