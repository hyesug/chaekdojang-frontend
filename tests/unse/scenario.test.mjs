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
  conditionalStateAt,
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

/**
 * 국면 하나를 손으로 만든다 — 시기·방향·사건 후보가 **한 덩어리**여야 한다.
 * @param start  국면 시작 (곧 id)
 * @param events 그 국면에 시기 신호가 있는 사건들 (앞쪽이 점수가 높다)
 * @param dirs   그 국면에서 체계들이 가리킨 방향 (첫째가 primary)
 */
const sig = (start, events, dirs = [], pct = 90) => ({
  phase: { id: start, start, end: `${start.slice(0, 4)}-12`, peakMonth: start,
    peakPercentile: pct, persistence: 1, grain: 'quarter' },
  conflict: { primaryDirection: dirs[0] ?? null, competingDirections: dirs.slice(1),
    activationAgreement: 'strong', directionalAgreement: dirs.length > 1 ? 'mixed' : 'unanimous',
    evidenceStrength: 0.6 },
  rawEvents: events.map((t, i) => ({ type: t, label: t, score: 0.5 - i * 0.05 })),
});

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
  const b = buildBranches({ domain: 'career', snapshot: s,
    signals: [sig('2028-02', ['role_change'], ['role_change', 'promotion'])] });
  assert.ok(b.branches.length);
  for (const br of b.branches) {
    for (const st of br.steps) {
      assert.equal(st.stateAfter.kind, 'predicted');
      assert.equal(st.sourceType, 'derived');
    }
  }
  // 국면이 없으면 가지를 만들지 않는다 — 시점을 지어내지 않는다
  const none = buildBranches({ domain: 'career', snapshot: s, signals: [] });
  assert.deepEqual(none.branches, []);
  assert.ok(none.note);
});

test('7. 미래 가지 A/B 가 동시에 남는다', () => {
  const s = snapshotFromState('2028-01', { relationshipStatus: 'dating' });
  const b = buildBranches({
    domain: 'relationship', snapshot: s,
    signals: [sig('2028-03', ['relationship_deepening', 'conflict'],
      ['relationship_deepening', 'conflict'])],
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

// ── 14~16. 교정 세 가지 ──────────────────────────────────────

test('14. 가지의 단계는 시간 오름차순이고, 같은 국면을 두 번 쓰지 않는다', () => {
  // 일부러 봉우리 높은 순(= 시간 역순)으로 넣는다
  const signals = [
    sig('2029-04', ['promotion'], ['promotion'], 99),
    sig('2028-02', ['role_change'], ['role_change'], 90),
    sig('2030-01', ['job_change'], ['job_change'], 88),
  ];
  const s = snapshotFromState('2028-01', { employmentType: 'employed' });
  const b = buildBranches({ domain: 'career', snapshot: s, signals, depth: 3 });

  assert.deepEqual(b.phaseOrder, ['2028-02', '2029-04', '2030-01'], '날짜순으로 다시 세운다');
  for (const br of b.branches) {
    const wins = br.steps.map((x) => x.window).filter(Boolean);
    for (let i = 1; i < wins.length; i++) {
      assert.ok(wins[i - 1].from < wins[i].from,
        `${br.id}: ${wins[i - 1].from} 다음이 ${wins[i].from} 이면 시간이 거꾸로 간다`);
      assert.ok(wins[i - 1].to < wins[i].from, '앞 국면이 끝난 뒤에 다음 단계가 온다');
    }
    // 같은 국면을 두 단계가 나눠 쓰지 않는다
    assert.equal(new Set(wins.map((w) => w.from)).size, wins.length);
    // 같은 사건을 두 번 쓰지 않는다
    const evs = br.steps.map((x) => x.event);
    assert.equal(new Set(evs).size, evs.length);
  }

  // 뒤에 국면이 없으면 depth 가 2 라도 1단계에서 끝낸다
  const one = buildBranches({ domain: 'career', snapshot: s, signals: [signals[2]], depth: 2 });
  assert.ok(one.branches.length);
  for (const br of one.branches) assert.equal(br.steps.length, 1, `${br.id} 가 ${br.steps.length}단계`);

  // 국면이 아예 없으면 가지를 만들지 않는다 — 시점을 지어내지 않는다
  const none = buildBranches({ domain: 'career', snapshot: s, signals: [], depth: 2 });
  assert.deepEqual(none.branches, []);
  assert.match(none.note, /국면이 없다/);
});

test('15. 앞 단계를 가정한 상태에서 다음 단계를 고른다 (조건부)', () => {
  const s = snapshotFromState('2028-01', { employmentType: 'none' });
  assert.equal(stateOf('career', { employmentType: 'none' }), 'unemployed');
  // 2028 국면에는 취업 신호가, 2029 국면에는 승진 신호가 있다
  const signals = [
    sig('2028-02', ['first_job', 'freelance'], ['first_job'], 90),
    sig('2029-04', ['promotion', 'role_change'], ['promotion'], 99),
  ];
  const b = buildBranches({ domain: 'career', snapshot: s, signals, depth: 2 });

  const a = b.branches.find((x) => x.steps[0].event === 'first_job');
  assert.ok(a, '취업 가지가 있어야 한다');
  assert.equal(a.steps.length, 2, 'unemployed → first_job → 그다음이 이어져야 한다');
  assert.equal(a.steps[0].stateAfter.value, 'employed');
  assert.equal(a.steps[1].from, 'employed', '앞 단계를 가정한 상태에서 골랐다');
  assert.equal(a.steps[1].event, 'promotion');

  // 가정은 표시로만 남는다 — 사실로 승격되지 않는다
  assert.equal(a.steps[0].stateBefore.kind, 'observed');
  assert.equal(a.steps[1].stateBefore.kind, 'predicted');
  assert.equal(a.steps[1].stateAfter.kind, 'predicted');
  assert.deepEqual(a.steps[1].conditionalOn, ['first_job']);
  assert.match(a.steps[1].assumption, /first_job 가 실제로 일어난다는 가정/);
  assert.equal(a.endState.kind, 'predicted');

  // snapshot 을 덮어쓰지 않는다
  assert.equal(s.observed.employmentType, 'none');
  assert.equal(s.observed.careerState, undefined);
  assert.equal(contextFor(s).context.employmentType, 'none');

  // 가지 A 의 가정이 가지 B 로 새지 않는다
  for (const br of b.branches) {
    assert.equal(br.startState, 'unemployed', `${br.id} 출발 상태가 바뀌었다`);
    assert.equal(br.steps[0].from, 'unemployed');
  }

  // 다음 층이 물을 수 있게 조건을 꺼내 준다
  const c = conditionalStateAt(a, 1);
  assert.equal(c.value, 'employed');
  assert.equal(c.kind, 'predicted');
  assert.deepEqual(c.assumedEvents, ['first_job']);
  assert.match(c.note, /사실로 쓰지 않는다/);

  // 승진은 2029 국면 것이지 2028 국면 것이 아니다
  assert.equal(a.steps[0].phaseId, '2028-02');
  assert.equal(a.steps[1].phaseId, '2029-04');
  assert.equal(a.steps[1].window.from, '2029-04');

  // 현재 재직 중이면 first_job 은 첫 단계에서 여전히 없다
  const emp = buildBranches({ domain: 'career',
    snapshot: snapshotFromState('2028-01', { employmentType: 'employed' }),
    signals, depth: 2 });
  assert.ok(!emp.branches.some((x) => x.steps[0].event === 'first_job'));
});

test('16. 연도 × 상·하반기를 함께 읽는다', () => {
  const h = (q) => interpretQuestion(q, { now: NOW }).horizon;
  const span = (q) => [h(q).from, h(q).to];
  assert.deepEqual(span('2028년 상반기에 이직할까?'), ['2028-01', '2028-06']);
  assert.deepEqual(span('2028년 하반기에 이직할까?'), ['2028-07', '2028-12']);
  assert.deepEqual(span('내년 상반기에 이직할까?'), ['2027-01', '2027-06']);
  assert.deepEqual(span('내년 하반기에 이직할까?'), ['2027-07', '2027-12']);
  assert.deepEqual(span('올해 상반기 어때?'), ['2026-01', '2026-06']);
  assert.deepEqual(span('올해 하반기 어때?'), ['2026-07', '2026-12']);
  assert.deepEqual(span('2028년 3분기에 이직?'), ['2028-07', '2028-09']);
  assert.equal(h('2028년 상반기에 이직할까?').source, '2028년 상반기');

  // 단순 연도 질문은 그대로다 (회귀 없음)
  assert.deepEqual(span('2028년에 이직?'), ['2028-01', '2028-12']);
  assert.deepEqual(span('내년에 직장 바뀔까?'), ['2027-01', '2027-12']);
  assert.deepEqual(span('2027년부터 2029년 사이에 이직?'), ['2027-01', '2029-12']);
  assert.equal(h('3년 안에 이직할까?').to, '2029-12');
  assert.equal(h('2년 뒤에 이직할까?').from, '2028-01');
  assert.equal(h('이직 언제 해?').source, '기본 창 (질문에 기간이 없다)');

  // 반기는 halfyear 이지 quarter 가 아니다
  const g = (q) => interpretQuestion(q, { now: NOW }).requestedSpecificity.timing;
  assert.equal(g('2028년 상반기에 이직할까?'), 'halfyear');
  assert.equal(g('하반기에 이직할까?'), 'halfyear');
  assert.equal(g('2028년 3분기에 이직?'), 'quarter');
  assert.equal(g('몇 월에 이직해?'), 'month');
  assert.equal(g('몇 년도에 이직해?'), 'year');
  assert.equal(g('언제 이직해?'), 'quarter');

  // 실제 흐름에서도 반기가 살아남는다
  const r = prepareScenario({
    birth: BIRTH, question: '2028년 하반기에 이직할까?', now: NOW,
    currentState: { employmentType: 'employed' },
  });
  assert.equal(r.from, '2028-07');
  assert.equal(r.to, '2028-12');
  assert.equal(r.specificity.timing.requested, 'halfyear');
  assert.ok(['year', 'halfyear'].includes(r.specificity.timing.allowed),
    `반기로 물었는데 ${r.specificity.timing.allowed} 로 답한다`);
});

// ── 17~19. 국면 ↔ 사건 ↔ 조건부 상태 연결 ─────────────────────

test('17. 강한 국면의 방향이 다른 날짜의 국면에 붙지 않는다', () => {
  // 2029 가 더 강하지만(99) 2028 도 국면이다. 방향은 서로 다르다
  const signals = [
    sig('2029-04', ['business_start'], ['business_start'], 99),
    sig('2028-02', ['role_change'], ['role_change'], 88),
  ];
  const s = snapshotFromState('2028-01', { employmentType: 'employed' });

  // 2029 에서 출발하라고 하면 1단계는 반드시 2029 의 방향이다
  const fromStrong = buildBranches({ domain: 'career', snapshot: s, signals,
    primaryPhaseId: '2029-04', depth: 2 });
  assert.equal(fromStrong.branches[0].steps[0].phaseId, '2029-04');
  assert.equal(fromStrong.branches[0].steps[0].event, 'business_start');
  assert.equal(fromStrong.branches[0].steps[0].window.from, '2029-04');

  // 2028 에서 출발하면 2029 의 business_start 를 빌려 오지 않는다
  const fromEarly = buildBranches({ domain: 'career', snapshot: s, signals,
    primaryPhaseId: '2028-02', depth: 2 });
  const a = fromEarly.branches[0];
  assert.equal(a.steps[0].phaseId, '2028-02');
  assert.equal(a.steps[0].event, 'role_change', '2029 의 방향이 2028 에 붙었다');
  // 이어지는 단계는 그 국면(2029) 것이어야 한다
  if (a.steps[1]) {
    assert.equal(a.steps[1].phaseId, '2029-04');
    assert.equal(a.steps[1].event, 'business_start');
  }
  // 모든 단계에서 사건·방향·시기가 같은 국면 것이다
  for (const br of [...fromStrong.branches, ...fromEarly.branches]) {
    for (const st of br.steps) {
      const own = signals.find((x) => x.phase.id === st.phaseId);
      assert.ok(own.rawEvents.some((e) => e.type === st.event),
        `${st.phaseId} 에 없는 사건 ${st.event} 가 붙었다`);
      assert.equal(st.window.from, own.phase.start);
      assert.equal(st.phaseDirection, own.conflict.primaryDirection);
    }
  }
});

test('18. 시기 신호가 없는 사건은 상태 기계만 보고 만들어지지 않는다', () => {
  const s = snapshotFromState('2028-01', { employmentType: 'employed' });
  // 재직 중이면 상태 기계에는 promotion·job_change·resignation … 길이 여럿이다
  assert.ok(possibleTransitions('career', 'employed').transitions.length > 3);

  // 그런데 이 국면의 시기 후보는 role_change 하나뿐이다
  const only = buildBranches({ domain: 'career', snapshot: s,
    signals: [sig('2028-02', ['role_change'], ['role_change'])], depth: 2 });
  assert.equal(only.branches.length, 1, '시기 신호가 없는 길까지 가지로 만들면 안 된다');
  assert.equal(only.branches[0].steps[0].event, 'role_change');

  // 다음 국면에 갈 수 있는 사건이 하나도 없으면 거기서 끝낸다
  const dead = buildBranches({ domain: 'career', snapshot: s, depth: 3,
    signals: [
      sig('2028-02', ['role_change'], ['role_change']),
      // 재직 중에서 갈 수 없는 사건만 있는 국면
      sig('2029-04', ['first_job'], ['first_job']),
    ] });
  assert.equal(dead.branches[0].steps.length, 1, '갈 수 없는 국면인데 단계가 이어졌다');

  // 시기 후보가 아예 없는 국면에서 출발하라고 하면 가지를 만들지 않는다
  const empty = buildBranches({ domain: 'career', snapshot: s,
    signals: [sig('2028-02', [], [])] });
  assert.deepEqual(empty.branches, []);
  assert.match(empty.note, /상태 기계만 보고 만들지 않는다/);
});

test('19. 현재 상태가 미래 사건 원재료를 미리 지우지 않는다', () => {
  const opts = { birth: BIRTH, question: '2027년부터 2030년 사이에 이직할까?', now: NOW };
  const emp = prepareScenario({ ...opts, currentState: { employmentType: 'employed' } });
  const un = prepareScenario({ ...opts, currentState: { employmentType: 'none' } });

  // 상태 중립으로 계산했으므로 원재료는 두 경우가 같아야 한다
  assert.equal(emp.meta.stateNeutralTimeline, true);
  const rawOf = (r) => r.resolvedSignals.map((s) =>
    [s.phase.id, s.rawEvents.map((e) => e.type).sort().join(',')].join('|')).sort();
  assert.deepEqual(rawOf(un), rawOf(emp),
    '현재 상태가 timeline 단계에서 사건 후보를 지웠다');

  // 무직이라고 미래의 승진·이직 후보가 원재료에서 사라지지 않는다
  const rawAll = new Set(un.resolvedSignals.flatMap((s) => s.rawEvents.map((e) => e.type)));
  assert.ok(rawAll.has('promotion'), `원재료에 promotion 이 없다: ${[...rawAll].join(',')}`);

  // 대신 지금 상태에서 갈 수 없는 것으로 표시된다 — 지워지는 게 아니다
  const withProm = un.resolvedSignals.find((s) => s.rawEvents.some((e) => e.type === 'promotion'));
  assert.ok(!withProm.reachableEvents.some((e) => e.type === 'promotion'),
    '무직인데 승진이 지금 갈 수 있는 후보로 남았다');
  assert.ok(withProm.removedEvents.some((x) => x.event === 'promotion'),
    '왜 빠졌는지 적지 않고 조용히 지웠다');

  // 예측이 관측으로 승격되지 않는다
  assert.deepEqual(un.snapshot.observed, { employmentType: 'none' });
  assert.equal(un.contextUsed.context.employmentType, 'none');
  for (const br of un.branches) {
    for (const st of br.steps.slice(1)) assert.equal(st.stateBefore.kind, 'predicted');
  }
});

test('20. 주 시나리오와 가지 1단계가 같은 국면·같은 사건에서 출발한다', () => {
  for (const cur of [{ employmentType: 'employed' }, { employmentType: 'none' }, null]) {
    const r = prepareScenario({
      birth: BIRTH, question: '2027년부터 2030년 사이에 이직할까?', now: NOW, currentState: cur });
    const p = r.scenarioInput.primary;
    if (!p) continue;
    const bs = r.scenarioInput.branchStart;
    assert.equal(bs.matchesPrimary, true,
      `primary ${p.phaseId}/${p.eventType} vs 가지 ${bs.phaseId}/${bs.event}`);
    if (bs.branch) {
      const a = r.branches.find((x) => x.id === bs.branch);
      assert.equal(a.steps[0].phaseId, p.phaseId);
      assert.equal(a.steps[0].event, p.eventType);
      assert.equal(a.steps[0].window.from, p.timing.window.from);
      // 이후 단계는 더 미래 국면으로만 이어진다
      for (let i = 1; i < a.steps.length; i++) {
        assert.ok(a.steps[i].window.from > a.steps[i - 1].window.to);
      }
    }
    // 대안도 어느 국면에서 나온 말인지 밝힌다
    for (const alt of r.scenarioInput.alternatives) assert.ok(alt.phaseId);
  }
});
