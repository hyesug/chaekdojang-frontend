/**
 * AI 답변 품질 전수 점검(2026-10-19 두 번째) 회귀.
 *
 * 분야 9개 × 질문 유형(시기·양자택일·될까·성향·내용) 27개를 실제 문맥으로 만들어 본 결과:
 *  - "내 배우자는 어떤 사람이야"가 '어떤 사람'에 걸려 성향 질문으로 갔고, 배우자 구획 대신
 *    "결혼경험: 말하지 말 것"만 실려 갔다.
 *  - "이사 갈까 말까", "대학원 갈까 취업할까" 같은 양자택일은 사건 후보 1위('하는 쪽')가 판정처럼 읽혔다.
 *    이사·주거·결혼·자녀·학업 후보에는 '그대로 두는 쪽'이 아예 없다.
 *  - 분야를 가리지 않은 질문(이번 달 운세·가족)에 기본 분야 직업의 사건 후보가 실려 답이 직장 얘기로 끌렸다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { routeQuestion } from '../../public/unse/src/hires/router.js';
import { readFortune } from '../../public/unse/src/engine.js';
import { readForecast } from '../../public/unse/src/forecast.js';
import { buildHiRes } from '../../public/unse/src/hires/context.js';

const route = (q) => routeQuestion(q, 2026);
const NOW = new Date('2026-10-19T03:00:00Z');
const FORM = { name: '가', gender: 'female', year: 1993, month: 3, day: 17, hour: 15, minute: 42, birthPlace: '여주', homePlace: '서울' };

test('배우자를 물으면 성향 질문이 아니라 결혼 분야로 간다', () => {
  for (const q of ['내 배우자는 어떤 사람이야', '미래 남편은 어떤 사람일까', '와이프 성격 어때']) {
    const p = route(q);
    assert.equal(p.traitsOnly, false, q);
    assert.ok(p.domains.includes('결혼'), `${q} → ${p.domains}`);
  }
});

test('양자택일은 분야와 상관없이 잡는다', () => {
  const yes = ['이사 갈까 말까', '대학원 갈까 취업할까', '지금 남자친구랑 결혼하는 게 맞을까', '헤어질까 말까',
    '둘째 낳을까 말까', '집을 살까 전세로 계속 살까', '창업할까 회사 다닐까', '2027년에 회사를 지키는게 낫냐'];
  for (const q of yes) assert.equal(route(q).asksChoice, true, q);
  const no = ['언제 이직해?', '올해 재물운', '이사 언제가 좋아', '내 성격 장단점', '이번 달 운세'];
  for (const q of no) assert.equal(route(q).asksChoice, false, q);
});

test('양자택일 문맥은 사건 후보를 판정 근거로 쓰지 않게 하되, 회피도 막는다', () => {
  const r = readFortune(FORM, { now: NOW }), f = readForecast(FORM, NOW);
  const t = buildHiRes(r, f, route('이사 갈까 말까')).text;
  assert.match(t, /두 길 중 하나를 고르는/);
  assert.match(t, /판정이 아니다/);
  assert.match(t, /피하지도 말 것/);
});

test('분야를 가리지 않은 질문에는 직업 사건 후보를 싣지 않는다', () => {
  const r = readFortune(FORM, { now: NOW }), f = readForecast(FORM, NOW);
  for (const q of ['이번 달 운세', '내 인생 전체 흐름', '엄마랑 사이가 왜 안 좋을까']) {
    const t = buildHiRes(r, f, route(q)).text;
    assert.doesNotMatch(t, /\[직업\] 사건 후보/, q);
    assert.doesNotMatch(t, /주 시나리오:/, q);
    assert.match(t, /\[A\] 계산 사실 — 사주 다층/, q);
  }
});
