/**
 * 명반 기초 데이터 — 2026-10 정확도 점검에서 찾은 세 가지의 회귀 테스트
 *
 *  1) 서머타임 시작·종료 당일의 시각 경계 (1987·1988: 새벽 2시 시작, 종료일 새벽 3시 끝)
 *  2) 자미두수의 해는 설날 기준 — 입춘과 설날 사이 출생자의 판이 사주 연도로 세워지던 것
 *  3) 자미두수의 날짜는 사주 일주와 같은 날(진태양시, 23시 이후 다음 날) · 윤달 16일부터 다음 달
 *
 * 천문 계산 자체(절기·삭·행성·상승점)는 정밀 천문 라이브러리와 대조해 1분·수 분각 안이었다.
 * 그 대조는 ephemeris-accuracy.test.mjs 와 별개로 한 번 잰 것이라 여기에는 싣지 않는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { koreaDST } from '../../public/unse/src/core/time.js';
import { prepareInput } from '../../public/unse/src/engine.js';
import { buildBoard } from '../../public/unse/src/hires/ziwei.js';
import { solarToLunar } from '../../public/unse/src/core/lunar.js';

const form = (o) => ({ name: 'x', gender: 'female', hour: 12, minute: 0, birthPlace: '서울', homePlace: '서울', ...o });

test('서머타임 시작·종료 당일은 벽시계 시각으로 가른다', () => {
  assert.equal(koreaDST(1988, 5, 8, 1, 30), false, '시작 전 (02:00 전)');
  assert.equal(koreaDST(1988, 5, 8, 3, 0), true, '시작 후');
  assert.equal(koreaDST(1988, 10, 9, 2, 30), true, '종료 전 (03:00 전)');
  assert.equal(koreaDST(1988, 10, 9, 3, 30), false, '종료 후');
  assert.equal(koreaDST(1987, 5, 10, 1, 59), false);
  assert.equal(koreaDST(1987, 10, 11, 4, 0), false);
  assert.equal(koreaDST(1988, 7, 15, 12, 0), true, '기간 한가운데');
  // 1960년 이전은 자정 전환 — 날짜 경계 그대로
  assert.equal(koreaDST(1960, 5, 1, 0, 30), true);
  assert.equal(koreaDST(1960, 9, 17, 23, 30), true);
  assert.equal(koreaDST(1960, 9, 18, 0, 30), false);
});

test('자미두수의 해는 설날 기준이다 — 입춘과 설날 사이 출생자', () => {
  // 2026: 입춘 2/4, 설날 2/17 → 2/10 생은 사주 2026(丙午)년, 음력은 아직 2025(乙巳)년
  const a = prepareInput(form({ year: 2026, month: 2, day: 10 })).input;
  assert.equal(a.sajuYear, 2026);
  assert.equal(a.ziweiYear, 2025);
  assert.equal(buildBoard(a).yearStem, 1, '乙');
  // 2025: 설날 1/29, 입춘 2/3 → 1/31 생은 사주 2024(甲辰)년, 음력은 이미 2025(乙巳)년
  const b = prepareInput(form({ year: 2025, month: 1, day: 31 })).input;
  assert.equal(b.sajuYear, 2024);
  assert.equal(b.ziweiYear, 2025);
  assert.equal(buildBoard(b).yearStem, 1, '乙');
  // 둘이 같은 날은 바뀌지 않는다
  const c = prepareInput(form({ year: 1993, month: 3, day: 17, hour: 15, minute: 42, birthPlace: '여주', homePlace: '대전' })).input;
  assert.equal(c.ziweiYear, c.sajuYear);
});

test('자미두수의 날짜는 사주 일주와 같은 날이다 — 진태양시 23시 이후는 다음 날', () => {
  // 가상 출생: 1995-11-07 23:50 서울 → 진태양시 23:34 → 사주 일주는 11-08 것
  // (실제 사례로 확인하는 테스트는 tests/unse/private/ 에 둔다 — 개인정보라 저장소에 올리지 않는다)
  const late = prepareInput(form({ year: 1995, month: 11, day: 7, hour: 23, minute: 50 }));
  const nextNoon = prepareInput(form({ year: 1995, month: 11, day: 8 }));
  const next = solarToLunar(1995, 11, 8);
  assert.ok(late.birth.tst.h >= 23, '진태양시가 23시를 넘는 사례여야 한다');
  assert.equal(late.chart.pillars.day.hanja, nextNoon.chart.pillars.day.hanja);
  assert.equal(late.input.ziweiLunar.day, next.day);
  assert.equal(late.input.ziweiLunar.month, next.month);
  // 같은 날 22:50 이면 그날 그대로
  const early = prepareInput(form({ year: 1995, month: 11, day: 7, hour: 22, minute: 50 }));
  assert.equal(early.input.ziweiLunar.day, solarToLunar(1995, 11, 7).day);
});

test('윤달은 15일까지 그 달, 16일부터 다음 달로 자미두수 판을 세운다', () => {
  // 2020 윤4월 = 양력 5/23~6/20
  const first = prepareInput(form({ year: 2020, month: 5, day: 30 })).input.ziweiLunar;   // 윤4/8
  assert.equal(first.isLeap, true);
  assert.equal(first.month, 4);
  const second = prepareInput(form({ year: 2020, month: 6, day: 15 })).input.ziweiLunar;  // 윤4/24
  assert.equal(second.isLeap, true);
  assert.equal(second.leapShifted, true);
  assert.equal(second.month, 5);
});
