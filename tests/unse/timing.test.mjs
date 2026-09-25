import test from 'node:test';
import assert from 'node:assert/strict';

import { prepareInput } from '../../public/unse/src/engine.js';
import { currentDaeun } from '../../public/unse/src/core/ganzhi.js';
import { analyze as kabbalahAnalyze } from '../../public/unse/src/systems/kabbalah.js';
import { analyze as tarotAnalyze } from '../../public/unse/src/systems/tarot.js';
import { analyze as vedicAnalyze } from '../../public/unse/src/systems/vedic.js';

const FORM = {
  name: '경계값 테스트',
  year: 1990,
  month: 6,
  day: 15,
  hour: 12,
  minute: 0,
  birthPlace: '서울',
  homePlace: '서울',
  gender: 'female',
};

const inputAt = (iso) => prepareInput(FORM, { now: new Date(iso) }).input;
const fact = (r, label) => r.facts.find((x) => x.label === label);

test('양력 연도는 한국시간 1월 1일에 바뀌고 사주 연도는 입춘 전까지 유지된다', () => {
  const before = inputAt('2026-12-31T14:59:59Z'); // KST 2026-12-31 23:59:59
  const after = inputAt('2026-12-31T15:00:01Z');  // KST 2027-01-01 00:00:01

  assert.equal(before.civilYear, 2026);
  assert.equal(after.civilYear, 2027);
  assert.equal(before.currentYear, 2026);
  assert.equal(after.currentYear, 2026);
});

test('사주 연도는 입춘 전후에서 바뀐다', () => {
  const before = inputAt('2027-02-03T03:00:00Z'); // KST 2/3 정오
  const after = inputAt('2027-02-05T03:00:00Z');  // KST 2/5 정오

  assert.equal(before.currentYear, 2026);
  assert.equal(after.currentYear, 2027);
});

test('카발라 개인년은 입춘이 아니라 양력 1월 1일을 따른다', () => {
  const before = kabbalahAnalyze(inputAt('2026-12-31T14:59:59Z'));
  const after = kabbalahAnalyze(inputAt('2026-12-31T15:00:01Z'));

  assert.ok(before.facts.some((x) => x.label === '2026 개인년'));
  assert.ok(after.facts.some((x) => x.label === '2027 개인년'));
});

test('타로 연도 배열도 양력 1월 1일을 따른다', () => {
  const before = tarotAnalyze(inputAt('2026-12-31T14:59:59Z'));
  const after = tarotAnalyze(inputAt('2026-12-31T15:00:01Z'));

  const notesBefore = before.facts.map((x) => x.note || '').join(' ');
  const notesAfter = after.facts.map((x) => x.note || '').join(' ');
  assert.match(notesBefore, /2026년 배열/);
  assert.match(notesAfter, /2027년 배열/);
});

test('대운은 정수 만 나이가 아니라 소수 경계에서 즉시 전환된다', () => {
  const daeun = {
    startAgeExact: 2.4,
    list: [
      { id: 'A', fromExact: 2.4, toExact: 12.4 },
      { id: 'B', fromExact: 12.4, toExact: 22.4 },
    ],
  };
  assert.equal(currentDaeun(daeun, 12.3999).id, 'A');
  assert.equal(currentDaeun(daeun, 12.4).id, 'B');
});

test('빔쇼타리 다샤 선택은 소수 elapsedYears 경계를 실제로 사용한다', () => {
  const base = inputAt('2026-09-15T00:00:00Z');

  const lordAt = (elapsedYears) => {
    const r = vedicAnalyze({ ...base, age: 0, elapsedYears });
    return fact(r, '현재 다샤').value;
  };

  const first = lordAt(0);
  let lo = 0;
  let hi = null;

  for (let x = 0.25; x <= 30; x += 0.25) {
    if (lordAt(x) !== first) {
      hi = x;
      lo = x - 0.25;
      break;
    }
  }

  assert.notEqual(hi, null, '30세 안에서 첫 다샤 전환 경계를 찾지 못함');

  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (lordAt(mid) === first) lo = mid;
    else hi = mid;
  }

  assert.equal(lordAt(lo), first);
  assert.notEqual(lordAt(hi), first);
  assert.ok(hi - lo < 0.000001, '전환 경계를 소수 나이로 좁히지 못함');
});
