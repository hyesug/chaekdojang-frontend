/**
 * Narrator v1 — **Composer 가 허용한 것만 말하는가**
 *
 * 여기서 재는 것은 문장이 얼마나 매끄러운가가 아니라, 문장이 **시나리오를
 * 넘어서지 않는가** 다. 잘 쓰는 것보다 허용된 것만 쓰는 것이 먼저다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  narrateScenario, auditNarration, answerScenario, composePrepared, composeScenario,
} from '../../public/unse-8f3k2m/src/semantic/scenario/index.js';

const BIRTH = {
  name: 'x', gender: 'female', year: 1992, month: 1, day: 30,
  hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전',
};
const NOW = new Date('2026-09-24T00:00:00Z');

let cached = null;
const career = () => (cached ??= answerScenario({
  birth: BIRTH, question: '2027년부터 2030년 사이에 어디로 이직할까?', now: NOW,
  currentState: { employmentType: 'employed', occupation: '개발자' },
}));

/** 손으로 만든 시나리오 — 게이트·갈림을 원하는 모양으로 놓고 문장만 본다 */
const mkPrepared = (o = {}) => {
  const domain = o.domain ?? 'career';
  const phase = { id: '2028-02', start: '2028-02', end: '2028-08',
    peakMonth: '2028-05', peakPercentile: 95, persistence: 1.5, grain: 'quarter' };
  const rawEvents = o.rawEvents ?? [{ type: 'job_change', label: '이직', score: 0.31 }];
  const conflict = { primaryDirection: o.direction ?? 'job_change', competingDirections: [],
    activationAgreement: 'strong', directionalAgreement: 'unanimous', evidenceStrength: 0.7 };
  return {
    domain, from: '2028-01', to: '2028-12',
    question: { intent: 'job_change', label: '이직',
      requestedSpecificity: o.requested ?? { timing: 'quarter', location: false, company: false } },
    snapshot: { at: '2028-01', observed: o.observed ?? { employmentType: 'employed' },
      planned: {}, predicted: {}, unknown: [] },
    stateKnown: true,
    resolvedSignals: [{ phase, conflict, rawEvents, reachableEvents: rawEvents,
      removedEvents: [], stateKnown: true }],
    timingPhases: [phase],
    branches: o.branches ?? [{
      id: 'A', startState: 'employed', stateKnown: true, assumption: '현재 employed',
      steps: [{ event: rawEvents[0].type, phaseId: phase.id, conditionalOn: [],
        assumption: 'a', stateBefore: { value: 'employed', kind: 'observed' },
        stateAfter: { value: 'employed', kind: 'predicted' } }],
      endState: { value: 'employed', kind: 'predicted' }, note: 'n',
    }],
    specificity: { allowedLevel: o.cap ?? 4,
      timing: { requested: 'month', allowed: o.grain ?? 'quarter', reasons: [] },
      blocked: [], confidenceByLevel: {} },
    natal: { domain, profile: o.profile ?? null, leading: [], spokeCount: 4, directCount: 2 },
    locationEvidenceUsed: o.locationEvidence ?? null,
    contextLocationUsed: o.contextLocation ?? null,
    evidence: [],
    scenarioInput: {
      primary: { phaseId: phase.id, signalIndex: 0,
        timing: { grain: o.grain ?? 'quarter', window: { from: phase.start, to: phase.end } },
        eventType: rawEvents[0]?.type ?? null, eventLabel: rawEvents[0]?.label ?? null,
        direction: conflict.primaryDirection, competingDirections: [], company: null,
        agreement: {}, claimIds: [], candidates: rawEvents,
        rawCandidateCount: rawEvents.length, removedByState: [] },
      alternatives: [], distinct: o.distinct ?? true,
      answersQuestion: o.answersQuestion ?? true, askedFor: o.askedFor ?? null,
      allowedLevel: o.cap ?? 4, blocked: [],
      branchStart: { branch: 'A', phaseId: phase.id, event: rawEvents[0]?.type ?? null, matchesPrimary: true },
    },
  };
};
const mk = (o) => composePrepared(mkPrepared(o));

const BAD = {
  percent: /(\d+\s*%|확률|퍼센트)/,
  decisive: /(유력|가장 가능성|1순위)/,
  medical: /(암|종양|수술|입원|사망|진단|질환|질병)/,
  certain: /(합격한다|합격합니다|임신한다|출산한다|퇴사합니다|결혼합니다|취업합니다)/,
  company: /(주식회사|㈜|\(주\)|Inc\.|Corp\.)/,
  internal: /(allowedLevel|evidenceStrength|percentile|phaseId|rawEvents|eventScoreWinner|lineageVoteWinner|\bX\d{3}\b)/,
  month: /(\d{4}-\d{2}\b|\d{1,2}\s*월)/,
};

// ── 1~2. 직접 답 · 눈금 ──────────────────────────────────────

test('1. 첫 문장이 질문에 바로 답한다', () => {
  const n = narrateScenario(mk({}));
  assert.equal(n.status, 'answered');
  assert.match(n.sections.answer, /^이 계산에서 직업 쪽 변화가 가장 두드러지는 구간은 2028년/);
  assert.ok(n.text.length > 20);
  assert.ok(!BAD.internal.test(n.text), n.text);
  assert.equal(n.meta.auditOk, true, JSON.stringify(n.meta.issues));
  // 점쟁이식 수사를 쓰지 않는다
  assert.ok(!/운명|기운이 당신|반드시 큰 변화/.test(n.text));
});

test('2. 분기까지만 허용되면 글에 달이 나오지 않는다', () => {
  const q = narrateScenario(mk({ grain: 'quarter' }));
  assert.ok(!BAD.month.test(q.text), q.text);
  assert.match(q.text, /분기/);
  // 달 눈금일 때만 달을 쓴다
  const m = narrateScenario(mk({ grain: 'month' }));
  assert.match(m.text, /2028-05|2028년/);
  assert.equal(m.meta.auditOk, true);
  // 해 눈금이면 해까지만
  const y = narrateScenario(mk({ grain: 'year' }));
  assert.ok(!BAD.month.test(y.text), y.text);
});

// ── 3~4. 질문 불일치 · 팽팽 ──────────────────────────────────

test('3. 물은 것과 다르면 첫 부분에서 알린다', () => {
  const n = narrateScenario(mk({
    answersQuestion: false, askedFor: ['job_change'],
    rawEvents: [{ type: 'business_start', label: '창업·자기 판', score: 0.4 }],
    direction: 'business_start',
  }));
  assert.equal(n.status, 'question_mismatch');
  assert.match(n.sections.answer, /물으셨지만/);
  assert.match(n.sections.answer, /창업·자기 판/);
  assert.match(n.sections.answer, /답하기는 어렵습니다/);
  // 질문에 맞추려고 사건을 바꾸지 않는다
  assert.ok(!/이직 쪽 사건 후보가 잡힙니다/.test(n.text));
  assert.ok(n.sentences.some((s) => s.kind === 'mismatch'));
});

test('4. 팽팽하면 "유력"이라고 쓰지 않는다', () => {
  const n = narrateScenario(mk({ distinct: false }));
  assert.ok(!BAD.decisive.test(n.text), n.text);
  assert.match(n.text, /한쪽이 뚜렷하게 앞선 결과는 아닙니다/);
  assert.equal(n.meta.auditOk, true);
});

// ── 5~6. 사건 ↔ 방향 갈림 ────────────────────────────────────

test('5~6. 갈림은 갈림으로만 말하고 한 사건으로 붙이지 않는다', () => {
  const n = narrateScenario(mk({
    rawEvents: [{ type: 'resignation', label: '퇴사·공백', score: 0.4 }], direction: 'promotion',
  }));
  assert.ok(n.sentences.some((s) => s.kind === 'conflict'));
  assert.match(n.text, /사건 후보 점수로는 퇴사·공백 쪽이 잡히지만/);
  assert.match(n.text, /체계별 방향 표결은 승진·보상 조정 쪽으로 갈렸습니다/);
  // "승진 방향으로 퇴사한다" 같은 결합문을 만들지 않는다
  for (const s of n.sentences) {
    if (s.text.includes('퇴사·공백') && s.text.includes('승진·보상 조정')) {
      assert.match(s.text, /지만|갈렸|다릅|다른/, s.text);
    }
  }
  assert.ok(!/승진.{0,6}방향으로 퇴사/.test(n.text));
  assert.equal(n.meta.auditOk, true, JSON.stringify(n.meta.issues));
});

// ── 7~8. 상세와 출처 구분 ────────────────────────────────────

test('7. 갈래를 못 고르면 직업명을 지어내지 않는다', () => {
  const n = narrateScenario(mk({ profile: null }));
  assert.ok(!/개발자|의사|변호사|교사|자바|Java|엔지니어/.test(n.text), n.text);
  assert.match(n.text, /좁히지 않았습니다|좁힐 근거/);
});

test('8. 알려준 직업과 계산이 말한 것을 섞지 않는다', () => {
  const { narration: n } = career();
  assert.match(n.text, /알려주신 사실이고, 계산이 맞힌 것이 아닙니다/);
  // "운세가 개발자를 맞혔다" 로 읽히는 문장이 없다
  assert.ok(!/개발자[^.]*(예측|맞혔|나옵니다|읽힙니다)/.test(n.text), n.text);
  const ctx = n.sentences.find((s) => s.kind === 'context');
  assert.ok(ctx && /개발자/.test(ctx.text));
  // 운세 문장에는 직업명이 없다
  for (const s of n.sentences.filter((x) => x.kind === 'detail')) {
    assert.ok(!/개발자/.test(s.text), s.text);
  }
});

// ── 9~10. 위치와 회사 ────────────────────────────────────────

test('9~10. 위치 근거가 없으면 도시를, 어떤 경우에도 회사를 만들지 않는다', () => {
  const n = narrateScenario(mk({ requested: { timing: 'quarter', location: true, company: true } }));
  assert.match(n.text, /어느 도시로 옮기는지까지 좁힐 위치 근거는 이 계산에 없습니다/);
  assert.match(n.text, /어느 회사인지까지는 이 계산으로 좁힐 수 없습니다/);
  assert.ok(!BAD.company.test(n.text));
  assert.ok(!/대전|서울|부산|수도권/.test(n.text), n.text);

  // 근거가 있을 때만 도시를 말한다
  const withEv = narrateScenario(mk({ cap: 6,
    requested: { timing: 'quarter', location: true, company: false },
    locationEvidence: { metro: '대전권', what: '아스트로카토그래피' }, contextLocation: '대덕구' }));
  assert.match(withEv.text, /대전권/);
  assert.match(withEv.text, /대덕구는 알려주신 현재 지역이고, 계산이 짚은 지역이 아닙니다/);
  assert.equal(withEv.meta.auditOk, true, JSON.stringify(withEv.meta.issues));

  // 실제 명반에서도 회사·도시를 만들지 않는다
  const { narration } = career();
  assert.ok(!BAD.company.test(narration.text));
});

// ── 11~13. 대안과 가지 ───────────────────────────────────────

test('11. 대안은 자기 시기를 쓴다', () => {
  const { scenario, narration: n } = career();
  const alts = scenario.alternatives.filter((a) => a.event);
  if (!alts.length) return;
  const s = n.sentences.find((x) => x.kind === 'alternative');
  assert.ok(s, '대안 문장이 없다');
  for (const a of alts) {
    assert.ok(s.text.includes(a.timing.label), `${a.timing.label} 을 쓰지 않았다`);
    assert.ok(s.text.includes(a.event.label));
  }
  // 대안 문장의 근거는 그 대안 것이다
  for (const a of alts) {
    for (const r of [...a.provenance.timing, ...a.provenance.event]) {
      assert.ok(s.sourceRefs.includes(r), r);
    }
  }
});

test('12~13. 뒤 단계는 조건부로만 쓰고 예측을 사실형으로 쓰지 않는다', () => {
  const { scenario, narration: n } = answerScenario({
    birth: BIRTH, question: '2027년부터 2030년 사이에 이직할까?', now: NOW,
    currentState: { employmentType: 'employed' }, narrate: { detail: 'full' },
  });
  const multi = scenario.branches.filter((b) => b.steps.length > 1);
  const bs = n.sentences.filter((s) => s.kind === 'branch');
  if (multi.length) {
    assert.ok(bs.length, '가지 문장이 없다');
    for (const s of bs) {
      if (!/신호를 볼 수 있습니다/.test(s.text)) continue;
      assert.match(s.text, /실제로 일어난다는 전제/, s.text);
    }
    assert.match(n.sections.uncertainty, /가정 위의 이야기이고, 정해진 순서가 아닙니다/);
  }
  // 예측을 확정형으로 쓰지 않는다
  assert.ok(!/승진합니다|이직합니다|창업합니다|퇴사합니다/.test(n.text), n.text);
  assert.equal(n.meta.auditOk, true, JSON.stringify(n.meta.issues));
});

// ── 14~16. 분야별 guard ──────────────────────────────────────

test('14~16. 건강·자녀·학업에서 확정·의료 표현이 없다', () => {
  for (const [q, dom, must] of [
    ['2027년부터 2029년 사이에 건강은 어때?', 'health', /진단이나 질환을 말하는 것이 아니라/],
    ['2027년부터 2029년 사이에 아이는?', 'children', /임신이나 출산이 일어난다는 뜻이 아니라/],
    ['2027년부터 2029년 사이에 시험 어때?', 'education', /결과가 정해진다는 뜻은 아닙니다/],
  ]) {
    const { scenario, narration: n } = answerScenario({ birth: BIRTH, question: q, now: NOW });
    assert.equal(scenario.meta.domain, dom);
    assert.equal(n.status, 'answered', `${dom}: ${n.text}`);
    assert.match(n.text, must, `${dom} 주의문이 없다`);
    assert.ok(!BAD.certain.test(n.text), `${dom}: ${n.text}`);
    assert.equal(n.meta.auditOk, true, `${dom}: ${JSON.stringify(n.meta.issues)}`);
    // 주의문 말고 다른 문장에 의료어가 없다
    const claimed = n.sentences.filter((s) => s.kind !== 'caveat').map((s) => s.text).join(' ');
    if (dom === 'health') assert.ok(!BAD.medical.test(claimed), claimed);
  }
});

// ── 17. 확률 표현 ────────────────────────────────────────────

test('17. 내부 점수를 확률로 옮기지 않는다', () => {
  const { narration: n } = career();
  assert.ok(!BAD.percent.test(n.text), n.text);
  assert.ok(!/95|0\.7|0\.6/.test(n.text), '내부 수치가 그대로 나왔다');
});

// ── 18. fail-closed ──────────────────────────────────────────

test('18. 앞 층이 어긋났다고 하면 답을 만들지 않는다', () => {
  const { scenario } = career();
  const broken = JSON.parse(JSON.stringify(scenario));
  broken.coherence = { ok: false, issues: [{ code: 'company_generated', where: 'primary.company' }] };
  const n = narrateScenario(broken);
  assert.equal(n.status, 'unsafe_input');
  assert.match(n.text, /구체적인 답을 만들지 않았습니다/);
  assert.equal(n.meta.auditOk, false);
  assert.ok(n.meta.issues.some((x) => x.code === 'upstream:company_generated'));
  // 재료가 없을 때도 지어내지 않는다
  const empty = narrateScenario(composeScenario({ birth: BIRTH, question: '오늘 점심', now: NOW }).scenario);
  assert.equal(empty.status, 'insufficient');
  assert.ok(empty.text.length);
});

// ── 19~21. 근거·결정성·모드 ──────────────────────────────────

test('19. 사실 문장마다 실재하는 근거가 붙어 있다', () => {
  const { scenario, narration: n } = career();
  const ids = new Set(scenario.evidence.map((c) => c.id));
  const factual = new Set(['answer', 'timing', 'event', 'detail', 'alternative', 'branch', 'conflict']);
  for (const s of n.sentences) {
    for (const r of s.sourceRefs) assert.ok(ids.has(r), `없는 근거 ${r}`);
    if (factual.has(s.kind)) assert.ok(s.sourceRefs.length, `근거 없는 사실 문장: ${s.text}`);
  }
  assert.ok(n.sentences.length >= 4);
  // 감사가 없는 근거를 잡는다
  const bad = { ...n, sentences: [...n.sentences, { kind: 'timing', text: 'x', sourceRefs: ['X999'] }] };
  assert.equal(auditNarration(bad, scenario).ok, false);
});

test('20. 같은 입력이면 같은 글이다', () => {
  const opts = { birth: BIRTH, question: '2027년부터 2030년 사이에 이직할까?', now: NOW,
    currentState: { employmentType: 'employed' } };
  const a = answerScenario(opts).narration;
  const b = answerScenario(opts).narration;
  assert.equal(a.text, b.text);
  assert.deepEqual(a, b);
  assert.equal(a.meta.deterministic, true);
  assert.equal(a.meta.generatedFacts, 0);
});

test('21. short·normal·full 모두 넘지 않는다', () => {
  const { scenario } = career();
  const lens = [];
  for (const detail of ['short', 'normal', 'full']) {
    const n = narrateScenario(scenario, { detail });
    assert.equal(n.meta.mode, detail);
    assert.equal(n.meta.auditOk, true, `${detail}: ${JSON.stringify(n.meta.issues)}`);
    for (const [k, re] of Object.entries(BAD)) {
      if (k === 'month' && scenario.primary.timing.grain === 'month') continue;
      assert.ok(!re.test(n.text), `${detail} 에서 ${k} 위반: ${n.text}`);
    }
    // 어떤 모드도 새 사실을 만들지 않는다 — 문장은 normal 의 부분집합이거나 그 확장이다
    lens.push(n.sentences.length);
  }
  assert.ok(lens[0] <= lens[1] && lens[1] <= lens[2], `short ${lens[0]} / normal ${lens[1]} / full ${lens[2]}`);
});

// ── 22~26. 값을 말하면 근거가 따라온다 ────────────────────────

test('22. 알려준 값을 말한 문장은 context 근거를 가진다', () => {
  const { scenario, narration: n } = career();
  const anchor = scenario.primary.contextAnchor.occupation;
  assert.equal(anchor.sourceType, 'context');
  assert.ok(anchor.sourceRefs?.length, 'contextAnchor 에 근거가 없다');

  const s = n.sentences.find((x) => x.kind === 'context');
  assert.ok(s, 'context 문장이 없다');
  assert.equal(s.requiresSource, true);
  for (const r of anchor.sourceRefs) assert.ok(s.sourceRefs.includes(r), r);

  // 그 근거의 출처는 context 이고, 운세로 바뀌지 않았다
  const byId = new Map(scenario.evidence.map((c) => [c.id, c]));
  for (const r of s.sourceRefs) assert.equal(byId.get(r).sourceType, 'context');

  // 근거를 떼면 감사가 잡는다
  const bad = { ...n, sentences: n.sentences.map((x) =>
    (x.kind === 'context' ? { ...x, sourceRefs: [] } : x)) };
  const a = auditNarration(bad, scenario);
  assert.equal(a.ok, false);
  assert.ok(a.issues.some((x) => x.code === 'context_without_context_ref'));
  assert.ok(a.severe.includes('sentence_without_source') || a.severe.includes('context_without_context_ref'));

  // 운세 근거로 바꿔 달면 그것도 잡는다
  const wrong = { ...n, sentences: n.sentences.map((x) =>
    (x.kind === 'context' ? { ...x, sourceRefs: scenario.primary.provenance.timing } : x)) };
  assert.ok(auditNarration(wrong, scenario).issues.some((x) => x.code === 'context_ref_wrong_source'));
});

test('23. 불일치 문장이 사건·시기를 말하면 그 근거를 가진다', () => {
  const { scenario, narration: n } = career();
  assert.equal(scenario.questionAnswer.answersQuestion, false);
  const ms = n.sentences.filter((x) => x.kind === 'mismatch');
  assert.ok(ms.length >= 2);
  const withEvent = ms.find((x) => x.text.includes(scenario.primary.event.label));
  const withTiming = ms.find((x) => x.text.includes(scenario.primary.timing.label));
  assert.ok(withEvent && scenario.primary.provenance.event
    .every((r) => withEvent.sourceRefs.includes(r)), '사건 근거가 없다');
  assert.ok(withTiming && scenario.primary.provenance.timing
    .every((r) => withTiming.sourceRefs.includes(r)), '시기 근거가 없다');
  for (const x of ms) assert.equal(x.requiresSource, true);

  // 시기 근거를 떼면 잡는다
  const bad = { ...n, sentences: n.sentences.map((x) =>
    (x === withTiming ? { ...x, sourceRefs: [] } : x)) };
  const codes = auditNarration(bad, scenario).issues.map((x) => x.code);
  assert.ok(codes.includes('mismatch_without_ref') || codes.includes('sentence_without_source'));
});

test('24. 갈림 문장은 양쪽 근거를 모두 가진다', () => {
  const { scenario, narration: n } = career();
  const sc = scenario.primary.selectionConflict;
  assert.equal(sc.agreement, false);
  assert.ok(sc.provenance.length >= 2, '갈림 근거가 둘이 아니다');
  const s = n.sentences.find((x) => x.kind === 'conflict' && /갈렸습니다/.test(x.text));
  assert.ok(s);
  for (const r of sc.provenance) assert.ok(s.sourceRefs.includes(r), `${r} 이 빠졌다`);

  // 한쪽만 남기면 잡는다
  const half = { ...n, sentences: n.sentences.map((x) =>
    (x === s ? { ...x, sourceRefs: [sc.provenance[0]] } : x)) };
  assert.ok(auditNarration(half, scenario).issues.some((x) => x.code === 'conflict_ref_incomplete'));
});

test('25. 가지 문장은 뒤 단계의 시기·사건·상태 근거까지 가진다', () => {
  const { scenario, narration: n } = answerScenario({
    birth: BIRTH, question: '2027년부터 2030년 사이에 이직할까?', now: NOW,
    currentState: { employmentType: 'employed' }, narrate: { detail: 'full' },
  });
  const multi = scenario.branches.filter((b) => b.steps.length > 1);
  if (!multi.length) return;
  for (const br of multi) {
    // 가지마다 1단계 사건이 다르므로 그 앞부분으로 고른다
    // (뒤 단계 이름이 다른 가지의 1단계와 겹칠 수 있다)
    const head = `${br.steps[0].timing?.label ?? ''} 무렵 ${br.steps[0].label} 쪽으로 간다면`;
    const s = n.sentences.find((x) => x.kind === 'branch' && x.text.startsWith(head));
    if (!s) continue;
    for (const k of ['timing', 'event']) {
      for (const r of br.steps[0].provenance[k]) assert.ok(s.sourceRefs.includes(r), `step1 ${k} ${r}`);
      for (const r of br.steps[1].provenance[k]) assert.ok(s.sourceRefs.includes(r), `step2 ${k} ${r}`);
    }
    for (const r of br.steps[1].provenance.state) {
      assert.ok(s.sourceRefs.includes(r), `조건부 상태 근거 ${r} 가 없다`);
    }
  }
  // 상태 근거를 떼면 잡는다
  const h0 = `${multi[0].steps[0].timing?.label ?? ''} 무렵 ${multi[0].steps[0].label} 쪽으로 간다면`;
  const target = n.sentences.find((x) => x.kind === 'branch' && x.text.startsWith(h0));
  const bad = { ...n, sentences: n.sentences.map((x) => (x === target
    ? { ...x, sourceRefs: x.sourceRefs.filter((r) => !multi[0].steps[1].provenance.state.includes(r)) }
    : x)) };
  const codes = auditNarration(bad, scenario).issues.map((x) => x.code);
  assert.ok(codes.includes('branch_state_ref_missing'), codes.join(','));
});

test('26. 위치·대안 근거와, 근거가 필요 없는 문장', () => {
  const { scenario, narration: n } = career();

  // 대안 문장은 각 대안의 시기·사건 근거를 모두 가진다
  const alt = n.sentences.find((x) => x.kind === 'alternative');
  if (alt) {
    for (const a of scenario.alternatives.filter((x) => x.event)) {
      for (const r of [...a.provenance.timing, ...a.provenance.event]) {
        assert.ok(alt.sourceRefs.includes(r), `대안 근거 ${r} 가 없다`);
      }
    }
    const bad = { ...n, sentences: n.sentences.map((x) => (x === alt ? { ...x, sourceRefs: [] } : x)) };
    assert.ok(auditNarration(bad, scenario).issues.some((x) =>
      ['alternative_ref_missing', 'sentence_without_source'].includes(x.code)));
  }

  // 한계 문장은 새 사실을 주장하지 않으므로 근거가 없어도 된다
  const limits = n.sentences.filter((x) => x.kind === 'limit');
  assert.ok(limits.length);
  for (const s of limits) assert.equal(s.requiresSource, false);
  assert.equal(n.meta.auditOk, true, JSON.stringify(n.meta.issues));

  // 도시를 말하면 그 위치 근거가, 알려준 지역이면 context 근거가 붙는다
  const { narration: loc, scenario: ls } = (() => {
    const s2 = composeScenario({
      birth: BIRTH, question: '2027년부터 2030년 사이에 어디로 이직할까?', now: NOW,
      currentState: { employmentType: 'employed' },
      locationEvidence: { metro: '대전권', what: '아스트로카토그래피' }, contextLocation: '대덕구',
    }).scenario;
    return { scenario: s2, narration: narrateScenario(s2) };
  })();
  const byId = new Map(ls.evidence.map((c) => [c.id, c]));
  const metroS = loc.sentences.find((x) => ls.primary.location.metro && x.text.includes(ls.primary.location.metro));
  if (metroS) {
    assert.ok(metroS.sourceRefs.length);
    for (const r of metroS.sourceRefs) assert.equal(byId.get(r).sourceType, 'fortune');
    const bad = { ...loc, sentences: loc.sentences.map((x) => (x === metroS ? { ...x, sourceRefs: [] } : x)) };
    assert.ok(auditNarration(bad, ls).issues.some((x) =>
      ['location_without_ref', 'sentence_without_source'].includes(x.code)));
  }
  const distS = loc.sentences.find((x) => ls.primary.location.district
    && x.text.includes(`${ls.primary.location.district}는 알려주신`));
  if (distS) {
    assert.ok(distS.sourceRefs.length);
    for (const r of distS.sourceRefs) assert.equal(byId.get(r).sourceType, 'context');
  }
});

test('27. 세 모드 모두 같은 근거 계약을 지키고, 같은 입력이면 같다', () => {
  const opts = { birth: BIRTH, question: '2027년부터 2030년 사이에 어디로 이직할까?', now: NOW,
    currentState: { employmentType: 'employed', occupation: '개발자' } };
  const { scenario } = composeScenario(opts);
  const ids = new Set(scenario.evidence.map((c) => c.id));
  for (const detail of ['short', 'normal', 'full']) {
    const n = narrateScenario(scenario, { detail });
    assert.equal(n.meta.auditOk, true, `${detail}: ${JSON.stringify(n.meta.issues)}`);
    for (const s of n.sentences) {
      if (s.requiresSource) assert.ok(s.sourceRefs.length, `${detail}/${s.kind}: ${s.text}`);
      for (const r of s.sourceRefs) assert.ok(ids.has(r), r);
    }
    // 같은 모드를 두 번 불러도 같다
    assert.deepEqual(narrateScenario(scenario, { detail }), n);
  }
  // 없는 근거는 계속 severe 다
  const n = narrateScenario(scenario);
  const bad = { ...n, sentences: [...n.sentences, { kind: 'timing', text: 'x', sourceRefs: ['X999'], requiresSource: true }] };
  const a = auditNarration(bad, scenario);
  assert.equal(a.ok, false);
  assert.ok(a.severe.includes('dangling_source_ref'));
});
