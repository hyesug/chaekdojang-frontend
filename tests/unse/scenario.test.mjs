/**
 * Scenario Composer **직전** 중간층 검사.
 *
 * 여기서 막는 것은 다음 층이 근거 없이 내려가는 것이다 — 갈린 것을 평균으로
 * 지우는 것, 예측을 사실로 쓰는 것, 회사 이름까지 내려가는 것.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  prepareScenario, interpretQuestion, resolveConflict, timingPhases,
  specificityGate, buildBranches, snapshotFromState, contextFor,
  stateOf, possibleTransitions, filterByState, claim, auditProvenance,
} from '../../public/unse-8f3k2m/src/semantic/scenario/index.js';
import { STATE_GRAPH, canTransition } from '../../public/unse-8f3k2m/src/semantic/scenario/graph.js';
import { LEVELS } from '../../public/unse-8f3k2m/src/semantic/scenario/specificity.js';
import { predictTimeline } from '../../public/unse-8f3k2m/src/semantic/timing/timeline.js';

const BIRTH = {
  name: 'x', gender: 'female', year: 1992, month: 1, day: 30,
  hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전',
};
const NOW = new Date('2026-09-24T00:00:00Z');

let cachedTl = null;
const tl = () => (cachedTl ??= predictTimeline({ birth: BIRTH, from: '2027-01', to: '2029-12' }));
let cachedSc = null;
const sc = () => (cachedSc ??= prepareScenario({
  birth: BIRTH, question: '2028년에 이직할까?', now: NOW,
  currentState: { employmentType: 'employed', occupation: '개발자' },
}));

// ── 1. 질문 해석 ─────────────────────────────────────────────

test('1. 자연어 질문이 올바른 분야·의도로 읽힌다', () => {
  const cases = [
    ['언제 이직해?', 'career', 'job_change'],
    ['결혼은 언제 할까?', 'marriage', 'marriage'],
    ['내년에 직장 바뀔까?', 'career', 'career_change'],
    ['어디로 이직할까?', 'career', 'job_change'],
    ['창업해도 될까?', 'career', 'independence'],
    ['아이는 언제쯤?', 'children', 'children'],
    ['집 언제 사?', 'residence', 'home_purchase'],
    ['시험 붙을까?', 'education', 'education'],
  ];
  for (const [q, domain, intent] of cases) {
    const r = interpretQuestion(q, { now: NOW });
    assert.equal(r.domain, domain, `${q} → ${r.domain}`);
    assert.equal(r.intent, intent, `${q} → ${r.intent}`);
  }
  // '어디로' 는 위치를 더 요구한다
  assert.equal(interpretQuestion('어디로 이직할까?', { now: NOW }).requestedSpecificity.location, true);
  assert.equal(interpretQuestion('언제 이직해?', { now: NOW }).requestedSpecificity.location, false);
  // '몇 월' 은 달 눈금을 요구한다
  assert.equal(interpretQuestion('몇 월에 이직해?', { now: NOW }).requestedSpecificity.timing, 'month');
  // 기간을 읽는다
  assert.deepEqual(interpretQuestion('내년에 직장 바뀔까?', { now: NOW }).horizon,
    { from: '2027-01', to: '2027-12', source: '내년' });
  assert.equal(interpretQuestion('2028년에 이직?', { now: NOW }).horizon.from, '2028-01');
  // 못 읽으면 지어내지 않는다
  const u = interpretQuestion('오늘 점심 뭐 먹지', { now: NOW });
  assert.equal(u.domain, null);
  assert.equal(u.intent, 'unknown');
  assert.ok(u.note);
});

// ── 2. 충돌 보존 ─────────────────────────────────────────────

test('2. 체계가 갈리면 갈린 채로 남는다 — 평균으로 지우지 않는다', () => {
  const c = resolveConflict(tl(), 'career', { from: '2027-01', to: '2029-12' });
  assert.ok(['strong', 'partial', 'weak', 'none'].includes(c.activationAgreement));
  assert.ok(['unanimous', 'majority', 'mixed', 'unknown'].includes(c.directionalAgreement));
  // 계보별 결과가 통째로 남아 있다
  assert.ok(c.lineages.length >= 3, `계보 ${c.lineages.length}개`);
  for (const l of c.lineages) assert.ok(l.systems.length >= 1 && l.representative);
  // 같은 계보를 두 표로 세지 않는다 — 계보 이름은 유일하다
  assert.equal(new Set(c.lineages.map((l) => l.lineage)).size, c.lineages.length);
  // 갈렸다고 해 놓고 경쟁 방향을 비워 두지 않는다
  if (c.directionalAgreement === 'mixed') {
    assert.ok(c.competingDirections.length >= 1, 'mixed 인데 경쟁 방향이 없다');
  }
  // 네 칸이 모두 있다
  for (const k of ['agreement', 'disagreements', 'alternatives', 'unresolved']) {
    assert.ok(Array.isArray(c[k]), `${k} 없음`);
  }
  assert.match(c.note, /확률이 아니다/);

  // 말 못 하는 체계는 조용히 빠지는 게 아니라 unresolved 로 남는다.
  // 출생 시각을 모르면 자미·점성이 그 자리에 있어야 한다
  const noTime = predictTimeline({
    birth: { ...BIRTH, hour: undefined, minute: undefined }, from: '2027-01', to: '2028-12' });
  const c2 = resolveConflict(noTime, 'career', { from: '2027-01', to: '2028-12' });
  const missing = c2.unresolved.map((u) => u.system).filter(Boolean);
  assert.ok(missing.includes('jamidusu'), '자미가 빠졌는데 unresolved 에 없다');
  assert.ok(missing.includes('astrology'), '점성이 빠졌는데 unresolved 에 없다');
  for (const u of c2.unresolved) assert.ok(u.why, '왜 못 쓰는지 적는다');
  assert.ok(!c2.lineages.some((l) => l.systems.includes('jamidusu')),
    '말 못 하는 체계가 표결에 끼면 안 된다');
});

// ── 3~4. 상태 기계 ───────────────────────────────────────────

test('3. 기혼 상태에서 불가능한 결혼 전이를 지운다', () => {
  const married = { maritalStatus: 'married' };
  assert.equal(stateOf('relationship', married), 'married');
  const p = possibleTransitions('relationship', 'married');
  assert.equal(p.stateKnown, true);
  assert.ok(!p.transitions.some((t) => t.event === 'new_relationship'),
    '기혼에서 새 만남 경로를 만들면 안 된다');
  assert.ok(!canTransition('relationship', 'married', 'new_relationship'));
  assert.ok(!canTransition('marriage', 'married', 'marriage'));

  const events = [{ type: 'new_relationship' }, { type: 'conflict' }, { type: 'relationship_deepening' }];
  const f = filterByState('relationship', 'married', events);
  assert.deepEqual(f.kept.map((e) => e.type), ['conflict', 'relationship_deepening']);
  assert.equal(f.removed.length, 1);
  assert.equal(f.removed[0].event, 'new_relationship');

  // 상태 기계가 그 사건을 아예 모르면 상태로 가리지 않는다 (조용히 지우지 않기)
  const g = filterByState('relationship', 'married', [{ type: 'made_up_event' }]);
  assert.equal(g.kept.length, 1);
});

test('4. 현재 상태를 모르면 추측하지 않고 지우지도 않는다', () => {
  assert.equal(stateOf('career', null), 'unknown');
  assert.equal(stateOf('career', { occupation: '개발자' }), 'unknown',
    '직업만 알려줬다고 고용형태를 추측하면 안 된다');
  assert.equal(stateOf('relationship', { hasChildren: true }), 'unknown');

  const p = possibleTransitions('career', 'unknown');
  assert.equal(p.stateKnown, false);
  assert.equal(p.transitions.length, STATE_GRAPH.career.transitions.length, '아무것도 지우지 않는다');
  assert.match(p.note, /추측하지도 않았다/);

  const f = filterByState('career', 'unknown', [{ type: 'first_job' }, { type: 'promotion' }]);
  assert.equal(f.kept.length, 2);
  assert.equal(f.removed.length, 0);

  // 말 안 해 준 칸은 unknown 목록에 이름만 남고 값은 비어 있다
  const s = snapshotFromState('2028-01', { employmentType: 'employed' });
  assert.equal(s.observed.employmentType, 'employed');
  assert.ok(s.unknown.includes('maritalStatus'));
  assert.equal(s.observed.maritalStatus, undefined);
});

// ── 5. 국면 ──────────────────────────────────────────────────

test('5. 한 달의 봉우리가 아니라 국면으로 묶인다', () => {
  const r = timingPhases(tl(), 'career');
  assert.ok(Array.isArray(r.phases));
  if (!r.phases.length) { assert.ok(r.note, '국면이 없으면 왜 없는지 적는다'); return; }
  for (const p of r.phases) {
    assert.ok(p.start <= p.peak && p.peak <= p.end, `${p.start}/${p.peak}/${p.end}`);
    assert.ok(p.peakPercentile >= 85);
    assert.ok(p.persistence > 0);
    assert.ok(p.months >= 1);
    assert.equal(p.resolution, 'quarter', '분야 해상도를 존중한다');
    // 세 토막이 겹치지 않고 이어진다
    const parts = [p.buildup, p.peakPhase, p.resolution_].filter(Boolean);
    assert.ok(parts.length >= 1);
    for (let i = 1; i < parts.length; i++) assert.ok(parts[i - 1].to < parts[i].from);
    assert.equal(parts[0].from, p.start);
    assert.equal(parts[parts.length - 1].to, p.end);
    // 담긴 달을 임의로 늘이지 않았다
    assert.equal(p.keys.length, p.months);
  }
  // 값이 전부 같으면 국면을 만들지 않는다
  const flat = { timeline: Object.fromEntries(['2028-01', '2028-02', '2028-03'].map((k) =>
    [k, { domains: { career: { rawActivation: 0.4, percentile: 50 } } }])) };
  assert.equal(timingPhases(flat, 'career').phases.length, 0);
});

// ── 6~7. 스냅숏과 가지 ───────────────────────────────────────

test('6. predicted 는 observed 와 섞이지 않는다', () => {
  const s = snapshotFromState('2028-01', { employmentType: 'employed' }, { housing: 'owned' });
  s.predicted.maritalStatus = 'married';       // 앞 단계가 예측했다고 치자
  const c = contextFor(s);
  assert.equal(c.context.employmentType, 'employed');
  assert.equal(c.context.housing, 'owned');
  assert.equal(c.context.maritalStatus, undefined, '예측이 상황으로 새어 들어갔다');
  assert.deepEqual(c.excluded, ['maritalStatus']);
  assert.equal(c.sourceOf.employmentType, 'observed');
  assert.equal(c.sourceOf.housing, 'planned');
  assert.match(c.note, /predicted 는 넣지 않았다/);

  // 가지의 상태 변화는 전부 predicted 로만 적힌다
  const b = buildBranches({ domain: 'career', snapshot: s, phases: [], directions: [] });
  for (const br of b.branches) {
    for (const st of br.steps) {
      assert.equal(st.stateAfter.kind, 'predicted');
      assert.equal(st.sourceType, 'derived');
    }
  }
});

test('7. 미래 가지 A/B 가 동시에 남는다', () => {
  const s = snapshotFromState('2028-01', { relationshipStatus: 'dating' });
  const b = buildBranches({
    domain: 'relationship', snapshot: s,
    phases: [{ start: '2028-03', peak: '2028-05', end: '2028-07' }],
    directions: ['relationship_deepening', 'conflict'],
  });
  assert.equal(b.startState, 'dating');
  assert.ok(b.branches.length >= 2, `가지가 ${b.branches.length}개뿐`);
  const ids = b.branches.map((x) => x.id);
  assert.deepEqual(ids.slice(0, 2), ['A', 'B']);
  // 깊어지는 쪽과 갈등 쪽이 함께 살아 있다
  const firsts = b.branches.map((x) => x.steps[0].event);
  assert.ok(firsts.includes('relationship_deepening'));
  assert.ok(firsts.includes('conflict'));
  // 두 번째 단계는 첫 단계가 일어났다는 가정 위에 선다고 적는다
  const deep = b.branches.find((x) => x.steps.length > 1);
  if (deep) assert.ok(deep.conditionalFrom);
  assert.match(b.note, /갈린 채로|길이 하나/);
});

// ── 8~10. 구체성 게이트 ──────────────────────────────────────

test('8. 아래 단계가 위 단계보다 강해질 수 없다', () => {
  const g = specificityGate({
    conflict: { activationAgreement: 'strong', directionalAgreement: 'unanimous', evidenceStrength: 0.9 },
    phase: { peakPercentile: 95, persistence: 1.5, resolution: 'month' },
    question: { requestedSpecificity: { timing: 'month' } },
    natalSupport: 1, locationEvidence: { what: '아스트로카토그래피' }, contextLocation: '대전',
  });
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(g.confidenceByLevel[i] <= g.confidenceByLevel[i - 1],
      `level ${i} (${g.confidenceByLevel[i]}) 가 level ${i - 1} (${g.confidenceByLevel[i - 1]}) 보다 강하다`);
  }
  assert.equal(g.monotonic, true);
  // 근거가 약하면 시기 눈금이 뒤로 물러난다
  const weak = specificityGate({
    conflict: { activationAgreement: 'weak', directionalAgreement: 'mixed', evidenceStrength: 0.2 },
    phase: { peakPercentile: 86, persistence: 1, resolution: 'quarter' },
    question: { requestedSpecificity: { timing: 'month' } },
  });
  assert.notEqual(weak.timing.allowed, 'month');
  assert.ok(weak.timing.reasons.length);
  // "모르겠다" 가 정상 결과다
  const none = specificityGate({ conflict: null, phase: null, question: null });
  assert.equal(none.allowedLevel, 0);
  assert.equal(none.timing.allowed, 'year');
});

test('9. 위치 근거가 약하면 도시권·구 단계가 막힌다', () => {
  const g = specificityGate({
    conflict: { activationAgreement: 'strong', directionalAgreement: 'unanimous', evidenceStrength: 0.9 },
    phase: { peakPercentile: 95, persistence: 2, resolution: 'month' },
    question: { requestedSpecificity: { timing: 'month', location: true } },
    natalSupport: 1,            // 위치 근거는 주지 않는다
  });
  assert.ok(g.allowedLevel <= 4, `위치 근거 없이 ${g.allowedLevel} 단계까지 열렸다`);
  const b5 = g.blocked.find((x) => x.level === 5);
  const b6 = g.blocked.find((x) => x.level === 6);
  assert.ok(b5 && /location evidence insufficient/.test(b5.reason));
  assert.ok(b6 && /운세로 좁히지 않는다|까지만/.test(b6.reason));
});

test('10. 특정 회사는 어떤 근거로도 열리지 않는다', () => {
  const best = specificityGate({
    conflict: { activationAgreement: 'strong', directionalAgreement: 'unanimous', evidenceStrength: 1 },
    phase: { peakPercentile: 100, persistence: 3, resolution: 'month' },
    question: { requestedSpecificity: { timing: 'month', company: true } },
    natalSupport: 1, locationEvidence: { what: '방위' }, contextLocation: '대전 대덕구',
  });
  assert.ok(best.allowedLevel < 7, `회사 단계가 열렸다 (${best.allowedLevel})`);
  assert.equal(best.confidenceByLevel[7], 0);
  const b7 = best.blocked.find((x) => x.level === 7);
  assert.ok(b7);
  assert.match(b7.reason, /Reality Matcher/);
  // 통합 결과에서도 회사 칸은 언제나 비어 있다
  const r = sc();
  assert.equal(r.scenarioInput.primary?.company ?? null, null);
  for (const a of r.scenarioInput.alternatives) assert.equal(a.company ?? null, null);
  // fortune 출처의 주장이 회사 이름을 담지 않는다
  for (const c of r.evidence.filter((x) => x.sourceType === 'fortune')) {
    assert.ok(!/(주식회사|㈜|Inc\.|Corp)/.test(c.claim), c.claim);
  }
});

// ── 11~13. 통합 ──────────────────────────────────────────────

test('11. 주요 주장마다 출처가 달려 있다', () => {
  const r = sc();
  assert.ok(r.evidence.length >= 2);
  for (const c of r.evidence) {
    assert.ok(['fortune', 'context', 'reality', 'derived'].includes(c.sourceType), c.sourceType);
    assert.ok(c.id && c.claim);
    if (c.sourceType === 'fortune') assert.ok((c.evidence ?? []).length, `${c.claim} 에 체계 근거가 없다`);
    if (c.sourceType === 'derived') assert.ok((c.derivedFrom ?? []).length, `${c.claim} 에 사슬이 없다`);
  }
  assert.equal(r.provenanceAudit.ok, true, JSON.stringify(r.provenanceAudit.problems));
  // scenarioInput 의 주장도 id 로 되짚을 수 있다
  const ids = new Set(r.evidence.map((c) => c.id));
  for (const id of r.scenarioInput.primary?.claimIds ?? []) assert.ok(ids.has(id), id);
  // 감사가 실제로 빈 근거를 잡는다
  const bad = [claim('근거 없는 말', 'fortune', { evidence: [] })];
  assert.equal(auditProvenance(bad).ok, false);
});

test('12. prepareScenario 가 Scenario Composer 가 먹을 모양을 낸다', () => {
  const r = sc();
  for (const k of ['question', 'timingPhases', 'resolvedSignals', 'possibleTransitions',
    'branches', 'specificity', 'evidence', 'scenarioInput']) {
    assert.ok(k in r, `${k} 없음`);
  }
  assert.equal(r.domain, 'career');
  assert.ok(r.scenarioInput.alternatives.length <= 2, 'alternatives 는 최대 둘');
  assert.equal(typeof r.scenarioInput.distinct, 'boolean');
  if (r.scenarioInput.distinct === false) assert.ok(r.scenarioInput.note);
  // 허용 단계를 넘는 칸은 채우지 않는다
  const p = r.scenarioInput.primary;
  if (p) {
    if (r.specificity.allowedLevel < 3) assert.equal(p.direction, null);
    if (r.specificity.allowedLevel < 4) assert.equal(p.industryOrEmployment, null);
    if (r.specificity.allowedLevel < 5) assert.equal(p.metro, null);
    assert.equal(p.timing.grain, r.specificity.timing.allowed);
    if (p.timing.grain !== 'month') assert.equal(p.timing.peak, null, '달을 못 짚는데 달을 적었다');
  }
  // 분야를 못 읽으면 아무것도 내지 않는다
  const u = prepareScenario({ birth: BIRTH, question: '오늘 점심 뭐 먹지', now: NOW });
  assert.equal(u.domain, null);
  assert.equal(u.scenarioInput.primary, null);
  assert.ok(u.note);
});

test('13. 같은 입력이면 같은 결과다', () => {
  const opts = {
    birth: BIRTH, question: '2028년에 이직할까?', now: NOW,
    currentState: { employmentType: 'employed' },
  };
  const a = prepareScenario(opts);
  const b = prepareScenario(opts);
  assert.deepEqual(a.scenarioInput, b.scenarioInput);
  assert.deepEqual(a.timingPhases, b.timingPhases);
  assert.deepEqual(a.evidence, b.evidence, '주장 id 까지 같아야 한다');
  assert.deepEqual(a.branches, b.branches);
});
