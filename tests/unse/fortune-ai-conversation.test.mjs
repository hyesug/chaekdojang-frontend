import test from 'node:test';
import assert from 'node:assert/strict';

import { compactHistory, conclusionOf, timeAnchorsOf, detailLevel, OUTPUT_BUDGET, HISTORY }
  from '../../app/fortune-ai/conversation.ts';
import { routeQuestion, inheritPlan } from '../../public/unse/src/hires/router.js';

/** n 턴짜리 대화 + 이번 질문 */
function convo(n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    out.push({ role: 'user', content: `질문 ${i}` });
    out.push({ role: 'assistant', content: `## 결론\n\n${2026 + i}년 하반기가 가장 강합니다. 답 ${i}.\n\n자세한 근거 ${'가'.repeat(500)}` });
  }
  out.push({ role: 'user', content: '이번 질문' });
  return out;
}

test('짧은 대화는 요약하지 않고 원문 그대로 보낸다', () => {
  const m = convo(HISTORY.FULL_UP_TO);
  const r = compactHistory(m);
  assert.equal(r.summary, null);
  assert.equal(r.summarizedTurns, 0);
  assert.deepEqual(r.recent, m);
});

test('긴 대화는 오래된 턴을 요약으로 접고 최근 3~5턴만 원문으로 남긴다', () => {
  for (let n = HISTORY.FULL_UP_TO + 1; n <= 20; n++) {
    const r = compactHistory(convo(n));
    const recentTurns = (r.recent.length - 1) / 2;
    assert.ok(recentTurns >= 3 && recentTurns <= 5, `${n}턴 → 최근 ${recentTurns}턴`);
    assert.equal(r.summarizedTurns + recentTurns, n);
    assert.equal(r.recent.at(-1).content, '이번 질문');
    assert.equal(r.recent[0].role, 'user');
  }
});

test('요약은 세 턴에 한 번만 바뀐다 — 그 사이에는 캐시가 그대로 맞는다', () => {
  const s = (n) => compactHistory(convo(n)).summary;
  assert.equal(s(7), s(8));     // 같은 3턴이 접혀 있다
  assert.notEqual(s(8), s(10)); // 6턴으로 늘었다
  assert.equal(s(10), s(11));
});

test('요약에 질문 원문·결론·시기가 남는다', () => {
  const r = compactHistory(convo(7));
  assert.match(r.summary, /1\. 질문: 질문 1/);
  assert.match(r.summary, /결론: 결론|결론: 2027년 하반기가 가장 강합니다/);
  assert.match(r.summary, /답에 나온 시기: 2027년 하반기/);
});

test('결론은 소제목을 건너뛴 첫 문단이다', () => {
  const a = '# 전체 풀이\n\n**2027년이 결혼의 핵심 해입니다.** 상대는 일로 만난 사람입니다.\n\n## 근거\n\n- 부처궁 ...';
  assert.match(conclusionOf(a), /^2027년이 결혼의 핵심 해입니다\./);
});

test('시기 표현을 원문 그대로 뽑는다', () => {
  const t = timeAnchorsOf('2027년 6~9월이 가장 강하고 2028년 하반기에 정리됩니다. 11월 3일(화)도 좋습니다. 40대가 정점입니다.');
  assert.ok(t.includes('2027년 6~9월'));
  assert.ok(t.includes('2028년 하반기'));
  assert.ok(t.includes('11월 3일(화)'));
  assert.ok(t.includes('40대'));
});

test('답 길이 — 짧게 원할 때만 상한을 낮추고, 자세히·비교·평생은 기존 상한을 지킨다', () => {
  assert.equal(detailLevel('올해 연애운 한 줄로 알려줘'), 'short');
  assert.equal(detailLevel('내 성격을 자세하게 분석해줘'), 'long');
  assert.equal(detailLevel('2027년과 2028년 결혼운을 비교해줘'), 'long');
  assert.equal(detailLevel('내 인생 전체 재물운을 20대부터 60대까지 자세히 분석해줘'), 'long');
  assert.equal(detailLevel('2027년 연애운 알려줘'), 'normal');
  assert.equal(OUTPUT_BUDGET.long, 32000);
});

// ── 후속 질문이 앞 질문의 분야·기간을 잇는가 (테스트 질문 B → C → D) ──

test('"그중 몇 월"은 앞 질문의 분야를 잇는다', () => {
  const b = inheritPlan(routeQuestion('2027년 연애운 알려줘', 2026), null);
  const c = inheritPlan(routeQuestion('2027년 중에서도 몇 월이 가장 강해?', 2026), b);
  assert.equal(routeQuestion('2027년 중에서도 몇 월이 가장 강해?', 2026).fallback, true);
  assert.deepEqual(c.domains, b.domains);
  assert.equal(c.fallback, false);
  assert.equal(c.fromYear + c.years - 1, 2027);
});

test('"아까 말한 시기"는 앞 질문의 기간을 잇는다', () => {
  const b = inheritPlan(routeQuestion('2027년 연애운 알려줘', 2026), null);
  const c = inheritPlan(routeQuestion('2027년 중에서도 몇 월이 가장 강해?', 2026), b);
  const raw = routeQuestion('아까 말한 시기에 만나는 사람의 성격은?', 2026);
  const d = inheritPlan(raw, c);
  assert.equal(raw.periodExplicit, false);
  assert.equal(d.fromYear, c.fromYear);
  assert.equal(d.years, c.years);
});

test('새 분야·새 기간을 말하면 앞 질문을 잇지 않는다', () => {
  const b = inheritPlan(routeQuestion('2027년 연애운 알려줘', 2026), null);
  const f = routeQuestion('내 인생 전체 재물운을 20대부터 60대까지 자세히 분석해줘', 2026);
  assert.equal(inheritPlan(f, b), f);
});

test('성향만 묻는 질문은 시기 계산 없이 성향 구획만 받는다', () => {
  assert.equal(routeQuestion('내 성격을 자세하게 분석해줘', 2026).traitsOnly, true);
  assert.equal(routeQuestion('내 성격으로 올해 운세는?', 2026).traitsOnly, false);      // 시기를 물었다
  assert.equal(routeQuestion('결혼 상대의 성격은?', 2026).traitsOnly, false);           // 분야가 있다
  assert.equal(routeQuestion('점성술로 본 내 성격', 2026).traitsOnly, false);           // 체계를 지정했다
  // "그 사람 성격"은 앞 분야(상대)의 이야기라 시기 계산까지 이어받는다
  const b = inheritPlan(routeQuestion('2027년 연애운 알려줘', 2026), null);
  assert.equal(inheritPlan(routeQuestion('그 사람 성격은?', 2026), b).traitsOnly, false);
});

test('질문 기간은 물은 해부터 센다 — 올해를 억지로 끼우지 않는다', () => {
  const span = (q) => { const p = routeQuestion(q, 2026); return [p.fromYear, p.fromYear + p.years - 1]; };
  assert.deepEqual(span('2027년과 2028년 결혼운을 비교해줘'), [2027, 2028]);
  assert.deepEqual(span('2030~2035년 재물운'), [2030, 2035]);   // 예전엔 2026~2031 로 잘렸다
  assert.deepEqual(span('2027년 연애운 알려줘'), [2026, 2027]); // 앞날 한 해는 준비기 한 해를 붙인다
  assert.deepEqual(span('2030년 이직운'), [2029, 2030]);
  assert.deepEqual(span('2019년에 무슨 일이 있었나요'), [2019, 2019]);
  assert.deepEqual(span('올해 운세'), [2026, 2026]);
});

test('기대는 말이 없는 새 질문은 분야 낱말이 없어도 앞 분야를 물려받지 않는다', () => {
  const f = routeQuestion('내 인생 전체 재물운을 20대부터 60대까지 자세히 분석해줘', 2026);
  const a = routeQuestion('내 성격을 자세하게 분석해줘', 2026);
  assert.equal(a.fallback, true);
  assert.equal(inheritPlan(a, f), a);
});
