/**
 * AI 대화 질문 전수 점검(2026-10-19) 회귀.
 *
 * "내일 수술인데 잘될까"에 점시가 꺼지고 그날 값도 안 실려, 답이 "이 질문을 볼 판이 없어요",
 * "내일 하루의 값은 계산되어 있지 않아요"로 나갔다. 데이트·궁합·가족·주식·오늘 운세는 분야를 못 가려
 * 직업 구획이 실려 갔다. 질문 33개가 올바른 계산으로 가는지 고정한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { routeQuestion, targetDayOf } from '../../public/unse/src/hires/router.js';
import { readFortune } from '../../public/unse/src/engine.js';
import { targetDayContext } from '../../public/unse/src/aiContext.js';

const route = (q) => routeQuestion(q, 2026);

// [질문, 첫 분야(null = 분야 없음), 점시, 하루를 짚었나, 그 밖의 기대]
const CASES = [
  ['내일 수술인데 잘될까', '건강', true, true],
  ['다음 주 수술 괜찮을까요', '건강', true, false, { asksOutcome: true }],
  ['내일 면접 붙을까', '직업', true, true],
  ['이번 주 시험 합격할까', '학업', true, false],
  ['오늘 소개팅 잘될까', '관계', true, true],
  ['오늘 데이트 어떨까', '관계', true, true],
  ['내일 고백해도 될까', '관계', true, true],
  ['이번 계약 잘 될까', '직업', true, false],
  ['이 사람이랑 사귀어도 될까', '관계', false, false],
  ['지금 이직해도 될까', '직업', true, false],
  ['오늘 운세 어때', null, false, true],
  ['내일 운세', null, false, true],
  ['이번 달 운세', null, false, false],
  ['다음 달 조심할 것', null, false, false],
  ['올해 재물운', '재물', false, false],
  ['언제 결혼해', '결혼', false, false],
  ['나 어떤 사람이야', null, false, false, { traitsOnly: true }],
  ['내 성격 장단점', null, false, false, { traitsOnly: true }],
  ['돈 모으는 법', '재물', false, false],
  ['건강 조심할 곳', '건강', false, false],
  ['엄마랑 사이가 왜 안 좋을까', null, false, false, { family: true }],
  ['이사 언제가 좋아', '이사', false, false],
  ['주식 사도 될까', '재물', false, false],
  ['코인 해도 될까', '재물', true, false],
  ['로또 사도 될까', '재물', false, false],
  ['남자친구랑 궁합', '관계', false, false],
  ['헤어진 사람 다시 연락올까', '관계', false, false],
  ['임신 될까', '자녀', false, false],
  ['수술 날짜 잡아줘', '건강', false, false, { needsDay: true }],
  ['이번 주 중요한 미팅 있는데 어때', '직업', true, false],
];

for (const [q, domain, horary, day, extra = {}] of CASES) {
  test(`질문 분류: ${q}`, () => {
    const r = route(q);
    if (domain) { assert.equal(r.domains[0], domain, `분야 ${r.domains}`); assert.equal(r.fallback, false); }
    else assert.equal(r.fallback, true, `분야를 못 가린 질문이어야 한다 (지금 ${r.domains})`);
    assert.equal(r.needsHorary, horary, '점시');
    assert.equal(r.asksDay, day, '하루를 짚었나');
    for (const [k, v] of Object.entries(extra)) assert.equal(r[k], v, k);
  });
}

test('질문이 짚은 하루를 날짜로 바꾼다 (기준 2026-10-19 월요일)', () => {
  const today = { y: 2026, m: 10, d: 19 };
  const at = (q) => { const t = targetDayOf(q, today); return t && `${t.y}-${t.m}-${t.d}`; };
  assert.equal(at('내일 수술인데 잘될까'), '2026-10-20');
  assert.equal(at('모레 면접'), '2026-10-21');
  assert.equal(at('오늘 소개팅'), '2026-10-19');
  assert.equal(at('이번 주 금요일 발표'), '2026-10-23');
  assert.equal(at('다음 주 금요일 수술'), '2026-10-30');
  assert.equal(at('다음주 월요일 계약'), '2026-10-26');
  assert.equal(at('10월 25일 계약 괜찮을까'), '2026-10-25');
  assert.equal(at('1월 3일 이사'), '2027-1-3');
  assert.equal(at('올해 재물운'), null);
});

test('그날 운 구획 — 그날 간지·분야 순서·택일 표시를 싣고, 1차 근거로 쓰라고 적는다', () => {
  const form = { name: '테스트', gender: 'female', year: 1986, month: 5, day: 9, hour: 10, minute: 8, birthPlace: '여주', homePlace: '서울' };
  const r = readFortune(form, { now: new Date('2026-10-19T03:00:00Z') });
  const text = targetDayContext(form, r, { y: 2026, m: 10, d: 20, label: '내일' });
  assert.match(text, /^## 그날 운 — 질문이 짚은 날: 내일 \(2026년 10월 20일, .요일\)/);
  assert.match(text, /총\d+/);
  assert.match(text, /택일 표시: (황도|흑도)/);
  assert.match(text, /1차 근거/);
});

test('둘 중 하나를 물으면 하나를 고르게 하고, 두 사람은 순서 이름으로 부르게 한다(화면에서 이름으로 바뀜)', async () => {
  const { readFileSync } = await import('node:fs');
  const PROMPT = readFileSync('app/fortune-ai/route.ts', 'utf8');
  assert.match(PROMPT, /## 둘 중 하나를 물으면 하나를 고르세요/);
  assert.match(PROMPT, /첫 문장에서 계산이 더 가까운 쪽 하나를 고르세요/);
  assert.match(PROMPT, /"첫 번째 사람님", "두 번째 사람님"으로 부르세요/);
  const ai = readFileSync('public/unse/src/ai.js', 'utf8');
  assert.match(ai, /function showNames\(t\)/);
  assert.match(ai, /content: redactNames\(question, session\.names\)/);
});

test('결혼식 날짜 후보 — 18개월 달마다 주말, 가까운 석 달은 따로 표시하고 가까운 날부터 고르지 말라고 적는다', async () => {
  const { readFortune } = await import('../../public/unse/src/engine.js');
  const { weddingDayCandidates } = await import('../../public/unse/src/aiContext.js');
  const A = readFortune({ name: 'a', gender: 'male', year: 1990, month: 3, day: 2, hour: 9, minute: 0, birthPlace: '서울', homePlace: '서울' });
  const B = readFortune({ name: 'b', gender: 'female', year: 1992, month: 8, day: 20, hour: 9, minute: 30, birthPlace: '부산', homePlace: '부산' });
  const text = weddingDayCandidates(A, B, 18, new Date('2026-10-19T03:00:00Z'));
  const rows = text.split('\n').filter((l) => /^\d{4}년 \d{1,2}월/.test(l));
  assert.ok(rows.length >= 17, `달 수 ${rows.length}`);
  assert.equal(rows.filter((l) => l.includes('가까운 석 달')).length, 3);
  for (const l of rows) for (const d of l.matchAll(/\((.)\)/g)) assert.match(d[1], /[토일]/);
  assert.match(text, /가장 가까운 날부터 고르지 말 것/);
  assert.match(text, /2027년 /);
});
