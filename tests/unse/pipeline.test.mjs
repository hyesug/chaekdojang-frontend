/**
 * 파이프라인 보강분 — **질문 해석 · 상태 기계 · 사슬 · 근거 고르기**
 *
 * 앞서 만든 층은 그대로 두고, 빠져 있던 자리만 채운 것을 고정한다.
 * 여기서도 원칙은 같다 — 근거가 끊기는 자리에서 구체화를 멈춘다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  interpretQuestion, composeScenario, selectEvidence, questionTypeOf,
  checkTemporalConsistency, chainOf, attributesOf, stateOf, possibleTransitions,
  supportingReads, answerScenario, locationEvidenceFor, asGateEvidence,
} from '../../public/unse/src/semantic/scenario/index.js';
import {
  STATE_GRAPH, CROSS_DOMAIN, MOVE_REASONS, crossDomainOf, canTransition,
} from '../../public/unse/src/semantic/scenario/graph.js';
import { EVENT_DURATION, PHASE_ROLE } from '../../public/unse/src/semantic/scenario/attributes.js';
import { QUESTION_TYPES } from '../../public/unse/src/semantic/scenario/evidence.js';
import { confidenceOf } from '../../public/unse/src/semantic/scenario/composer.js';

const BIRTH = {
  name: 'x', gender: 'female', year: 1992, month: 1, day: 30,
  hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전',
};
const NOW = new Date('2026-09-24T00:00:00Z');
const q = (t) => interpretQuestion(t, { now: NOW });

let cached = null;
const career = () => (cached ??= composeScenario({
  birth: BIRTH, question: '2027년부터 2030년 사이에 이직할까?', now: NOW,
  currentState: { employmentType: 'employed' },
}).scenario);

// ── 1~2. Question Interpreter ────────────────────────────────

test('1. 같은 분야 질문을 하나의 의도로 뭉개지 않는다', () => {
  assert.deepEqual(
    ['나 이직하게 될까?', '지금 회사 오래 다닐까?', '내년에 직장운 어때?'].map((t) => q(t).intent),
    ['job_change', 'employment_stability', 'domain_overview']);
  for (const t of ['나 이직하게 될까?', '지금 회사 오래 다닐까?', '내년에 직장운 어때?']) {
    assert.equal(q(t).domain, 'career');
  }
  // 자리 유지 질문은 관련 사건을 함께 들고 간다
  assert.deepEqual(q('지금 회사 오래 다닐까?').targetEvents,
    ['resignation', 'job_change', 'role_change']);
  // 전반을 묻는 질문은 사건 하나를 앞세우지 않는다
  const ov = q('내년에 직장운 어때?');
  assert.equal(ov.overview, true);
  assert.equal(ov.targetEvents, null);
  assert.equal(ov.requestedSpecificity.level, 'low');
  assert.deepEqual(ov.requestedAttributes, ['timing']);
  // 다른 분야 전반도 읽는다
  assert.equal(q('올해 재물운 어때?').domain, 'wealth');
  assert.equal(q('건강운 어떄요').intent, 'domain_overview');
});

test('2. 스키마가 요구한 칸을 모두 낸다', () => {
  const a = q('나 내년에 이직하게 될까?');
  assert.equal(a.rawQuestion, '나 내년에 이직하게 될까?');
  assert.deepEqual(a.timeRange, { from: '2027-01', to: '2027-12' });
  assert.equal(a.requiresCurrentState, true, '이직은 현재 상태를 알아야 거를 수 있다');
  assert.equal(a.requiresRealityContext, false);

  // 더 구체적으로 물으면 그렇게 적힌다
  const b = q('이직한다면 언제쯤이고 어떤 회사, 어디일까?');
  assert.equal(b.requestedSpecificity.level, 'high');
  assert.equal(b.requiresRealityContext, true);
  for (const k of ['timing', 'event', 'location', 'company']) {
    assert.ok(b.requestedAttributes.includes(k), k);
  }
  // 두루뭉술하게 물으면 낮은 단계다
  assert.equal(q('내년에 직장운 어때?').requiresRealityContext, false);
  assert.equal(q('언제 이직해?').requestedSpecificity.level, 'normal');
});

// ── 3~4. 상태 기계 ───────────────────────────────────────────

test('3. 학업 상태 기계가 생겼다', () => {
  const g = STATE_GRAPH.education;
  assert.ok(g, '학업 상태 기계가 없다');
  assert.deepEqual(g.states, ['unknown', 'not_studying', 'studying', 'detour', 'completed']);
  assert.ok(canTransition('education', 'not_studying', 'study_start'));
  assert.ok(canTransition('education', 'studying', 'academic_detour'));
  assert.ok(canTransition('education', 'detour', 'return_to_study'));
  // 공부를 시작하지 않은 사람에게 우회·결실을 먼저 내지 않는다
  assert.ok(!canTransition('education', 'not_studying', 'academic_detour'));
  assert.ok(!canTransition('education', 'not_studying', 'exam_success_window'));
  // 결실 구간에 합격이라는 말을 붙이지 않는다
  const win = g.transitions.find((x) => x.event === 'exam_success_window');
  assert.match(win.note, /합격을 뜻하지 않는다/);
  // 알려준 값으로 상태를 읽고, 안 알려주면 모른다
  assert.equal(stateOf('education', { studying: true }), 'studying');
  assert.equal(stateOf('education', { educationState: 'detour' }), 'detour');
  assert.equal(stateOf('education', {}), 'unknown');
  assert.equal(possibleTransitions('education', 'studying').stateKnown, true);
});

test('4. 사건이 다른 분야를 켜지만 확정하지는 않는다', () => {
  const j = crossDomainOf('job_change');
  assert.ok(j.some((x) => x.domain === 'wealth'));
  const res = j.find((x) => x.domain === 'residence');
  assert.ok(res && res.reason === 'career', '이사의 까닭이 적혀야 한다');
  assert.ok(MOVE_REASONS.includes('career') && MOVE_REASONS.includes('marriage'));
  // 결혼은 재물·주거·자녀를 함께 켠다
  assert.deepEqual(crossDomainOf('marriage').map((x) => x.domain).sort(),
    ['children', 'residence', 'wealth']);
  // 없는 사건은 아무것도 켜지 않는다 (지어내지 않는다)
  assert.deepEqual(crossDomainOf('made_up'), []);
  for (const list of Object.values(CROSS_DOMAIN)) {
    for (const x of list) assert.ok(x.why, '왜 켜지는지 적는다');
  }
});

// ── 5~7. 사슬과 순서 ─────────────────────────────────────────

test('5. 가지를 사슬로 펴고 딸려 오는 분야를 후보로만 적는다', () => {
  const s = career();
  assert.ok(s.chains, 'chains 가 없다');
  const c = s.chains.chains[0];
  assert.ok(c, `사슬이 하나도 안 남았다: ${JSON.stringify(s.chains.dropped.map((d) => d.consistency.issues))}`);
  assert.equal(c.scenarioChain[0].conditional, false);
  if (c.scenarioChain[1]) {
    assert.equal(c.scenarioChain[1].conditional, true);
    assert.ok(c.scenarioChain[1].conditionalOn.length);
    // 시간이 앞으로만 간다
    assert.ok(c.scenarioChain[0].to < c.scenarioChain[1].from);
  }
  for (const step of c.scenarioChain) {
    assert.ok(step.window, '칸마다 시기가 붙는다');
    assert.ok(step.attributes.durationType);
    assert.equal(step.attributes.estimatedDuration, null, '햇수를 지어내지 않는다');
  }
  for (const x of c.crossDomain) {
    assert.equal(x.status, 'candidate_activation');
    assert.match(x.note, /일어난다는 뜻이 아니다/);
  }
  assert.equal(c.consistency.ok, true);
});

test('6. 불가능한 순서는 걸러진다', () => {
  // 시간 역행
  const back = checkTemporalConsistency([
    { event: 'relationship_deepening', from: '2029-01', to: '2029-06' },
    { event: 'conflict', from: '2028-01', to: '2028-06' },
  ], 'relationship', 'dating');
  assert.equal(back.ok, false);
  assert.ok(back.issues.some((x) => x.code === 'out_of_order'));

  // 상태로 갈 수 없는 순서
  const bad = checkTemporalConsistency([
    { event: 'marriage', from: '2029-01', to: '2029-06' },
  ], 'relationship', 'dating');
  assert.ok(bad.issues.some((x) => x.code === 'impossible_transition'));

  // 가능한 연쇄는 통과한다
  const ok = checkTemporalConsistency([
    { event: 'relationship_deepening', from: '2029-10', to: '2029-12' },
    { event: 'cohabitation', from: '2030-01', to: '2030-06' },
  ], 'relationship', 'dating');
  assert.equal(ok.ok, true, JSON.stringify(ok.issues));
  assert.equal(ok.endState, 'cohabiting');

  // 같은 사건을 두 번 세지 않는다
  const dup = checkTemporalConsistency([
    { event: 'conflict', from: '2029-01', to: '2029-03' },
    { event: 'conflict', from: '2029-06', to: '2029-09' },
  ], 'relationship', 'dating');
  assert.ok(dup.issues.some((x) => x.code === 'repeated_event'));
});

test('7. 전조·고비·정리가 서로 다른 뜻으로 적혀 있다', () => {
  for (const k of ['buildup', 'peak', 'resolution']) {
    assert.ok(PHASE_ROLE[k].means && PHASE_ROLE[k].caution, k);
  }
  assert.match(PHASE_ROLE.buildup.caution, /전조를 사건으로 세지 않는다/);
  assert.match(PHASE_ROLE.peak.caution, /일어난다는 뜻이 아니라/);
  // 사건의 결이 표에 있다
  assert.equal(EVENT_DURATION.marriage, 'instant');
  assert.equal(EVENT_DURATION.business_start, 'long');
  assert.equal(attributesOf('made_up').durationType, 'unknown');
  assert.equal(attributesOf('job_change').sourceType, 'derived');
  const s = career();
  if (s.primary.event) assert.ok(s.primary.attributes.durationType);
});

// ── 8~9. Evidence Selector ───────────────────────────────────

test('8. 물은 자리의 근거만 고른다', () => {
  const s = career();
  const ids = new Set(s.evidence.map((c) => c.id));

  const ev = selectEvidence({ scenario: s, questionType: 'why_event' });
  const tm = selectEvidence({ scenario: s, questionType: 'why_timing' });
  assert.ok(ev.refs.length && tm.refs.length);
  // 시기를 물으면 시기 근거만 온다 (사건 근거까지 쏟지 않는다)
  assert.deepEqual(tm.refs, s.primary.provenance.timing);
  assert.ok(ev.refs.length >= tm.refs.length);
  for (const r of [...ev.refs, ...tm.refs]) assert.ok(ids.has(r), r);
  // 출처를 갈라 적는다
  for (const [k, v] of Object.entries(tm.bySource)) {
    for (const x of v) assert.equal(x.sourceType, k);
  }
  // 새 근거를 만들지 않는다
  for (const x of ev.items) assert.ok(ids.has(x.id));
  // 물음 종류를 읽는다
  assert.equal(questionTypeOf('왜 그 지역이야?'), 'why_location');
  // 지명은 알아맞히지 않는다 — 이미 아는 지명을 줘야 읽는다
  assert.equal(questionTypeOf('왜 대전이야?'), 'why_event');
  assert.equal(questionTypeOf('왜 대전이야?', { places: ['대전'] }), 'why_location');
  assert.equal(questionTypeOf('왜 2028년 초야?'), 'why_timing');
  assert.equal(questionTypeOf('왜 이직이라고 봐?'), 'why_event');
  for (const t of QUESTION_TYPES) {
    assert.ok(selectEvidence({ scenario: s, questionType: t }).questionType === t);
  }
});

test('9. 근거가 없는 자리는 없다고 답한다', () => {
  const s = career();
  assert.equal(s.primary.location.metro, null);
  const loc = selectEvidence({ scenario: s, questionType: 'why_location' });
  assert.deepEqual(loc.refs, []);
  assert.match(loc.note, /위치를 짚을 근거가 없다/);
  assert.ok(loc.blocked?.length, '왜 막혔는지 함께 낸다');

  // 더 못 좁히는 까닭은 막힌 자리로 답한다
  const nn = selectEvidence({ scenario: s, questionType: 'why_not_narrower' });
  assert.ok(nn.blocked.length);
  assert.match(nn.note, /근거가 거기서 끊기기 때문/);

  // 시나리오가 없으면 고르지 않는다
  const none = selectEvidence({ scenario: null, questionType: 'why_event' });
  assert.equal(none.answerable, false);
  assert.equal(selectEvidence({ scenario: s, questionType: 'nope' }).answerable, false);
});

// ── 10. 칸마다 다른 확신 ─────────────────────────────────────

test('10. 확신을 칸마다 따로 내고, 아래 칸이 위 칸을 넘지 않는다', () => {
  const s = career();
  const c = s.primary.confidence;
  for (const k of ['event', 'timing', 'direction', 'role', 'location', 'district']) {
    assert.ok(c.scale.includes(c[k]), `${k}=${c[k]}`);
  }
  // 위치 근거가 없으면 지역·구는 바닥이다
  assert.equal(c.location, 'insufficient');
  assert.equal(c.district, 'insufficient');
  assert.match(c.note, /확률이 아니다/);

  // 근거가 아무리 좋아도 아래로 갈수록 두터워지지 않는다
  const best = confidenceOf({
    cap: 6, grain: 'month',
    conflict: { activationAgreement: 'strong', directionalAgreement: 'unanimous' },
    phase: { peakPercentile: 100, persistence: 2 },
    detail: { roleFamily: { key: 'x' } },
    location: { metro: '대전권', district: '유성구' },
  });
  const order = ['event', 'timing', 'direction', 'role', 'location', 'district'];
  const idx = (v) => best.scale.indexOf(v);
  for (let i = 1; i < order.length; i++) {
    assert.ok(idx(best[order[i]]) <= idx(best[order[i - 1]]),
      `${order[i]}(${best[order[i]]}) 가 ${order[i - 1]}(${best[order[i - 1]]}) 보다 두텁다`);
  }
  // 확률로 읽히는 숫자를 내지 않는다
  assert.ok(!/\d/.test(JSON.stringify(Object.values(best).filter((v) => typeof v === 'string'))));
});

// ── 11. 결정성 ───────────────────────────────────────────────

test('11. 같은 입력이면 같은 결과다', () => {
  const opts = { birth: BIRTH, question: '2027년부터 2030년 사이에 이직할까?', now: NOW,
    currentState: { employmentType: 'employed' } };
  const a = composeScenario(opts).scenario;
  const b = composeScenario(opts).scenario;
  assert.deepEqual(a.chains, b.chains);
  assert.deepEqual(a.primary.confidence, b.primary.confidence);
  assert.deepEqual(selectEvidence({ scenario: a, questionType: 'why_event' }),
    selectEvidence({ scenario: b, questionType: 'why_event' }));
  assert.deepEqual(chainOf(a.branches[0], 'career'), chainOf(b.branches[0], 'career'));
});

// ── 12~14. 곁가지 분야와 현실 후보를 붙인 최종 조립 ─────────────

test('12. 주 사건이 켠 분야를 같은 구간에서 읽되 주 시나리오를 바꾸지 않는다', () => {
  const r = composeScenario({
    birth: BIRTH, question: '나 이직하게 될까?', now: NOW, from: '2027-01', to: '2029-12',
    currentState: { employmentType: 'employed', occupation: '백엔드 개발자' },
  });
  const sup = supportingReads({ birth: BIRTH, scenario: r.scenario, from: '2027-01', to: '2029-12' });
  assert.ok(sup.reads.length, '켜진 분야를 읽지 않았다');
  const main = r.scenario.meta.domain;
  for (const s of sup.reads) {
    assert.notEqual(s.domain, main, '주 분야를 곁가지로 다시 읽었다');
    assert.equal(s.role, 'supporting');
    assert.equal(s.sourceType, 'fortune');
    // 곁가지는 주 시나리오보다 깊이 갈 수 없다
    assert.ok(s.allowedLevel < r.scenario.meta.allowedLevel);
    assert.match(s.note, /주 시나리오를 바꾸지도 않는다/);
    if (s.candidate) assert.match(s.candidate.note, /일어난다는 뜻이 아니다/);
    // 곁가지는 주 국면과 같은 구간을 본다
    assert.ok(s.window?.grain === r.scenario.primary.timing.grain);
  }
  // 주 시나리오는 그대로다
  const again = composeScenario({
    birth: BIRTH, question: '나 이직하게 될까?', now: NOW, from: '2027-01', to: '2029-12',
    currentState: { employmentType: 'employed', occupation: '백엔드 개발자' },
  }).scenario;
  assert.deepEqual(again.primary.event, r.scenario.primary.event);
  // 묻지 않은 분야를 새 주제로 꺼내지 않는다 — 켜진 것만 읽는다
  const lit = new Set(r.scenario.chains.chains.flatMap((c) => c.crossDomain.map((x) => x.domain)));
  for (const s of sup.reads) assert.ok(lit.has(s.domain), s.domain);
});

test('13. 현실 후보를 붙여도 운세가 회사를 짚은 것처럼 말하지 않는다', () => {
  const pre = composeScenario({
    birth: BIRTH, question: '나 이직하게 될까?', now: NOW, from: '2027-01', to: '2029-12',
    currentState: { employmentType: 'employed', occupation: '백엔드 개발자' },
  }).scenario;
  const ev = pre.primary.event.type;
  const w = pre.primary.timing;
  const cands = [
    { id: 'JOB-1', domain: 'career', kind: 'opportunity', supportsEvents: [ev],
      detail: { roleFamily: 'technical_analytical' },
      company: { name: '대덕넷웍스' }, location: { metro: '대전', district: '유성구' },
      validity: { from: `${w.from}-01`, to: `${w.to}-28` },
      source: { id: 'S1', sourceType: 'reality', provider: 'fixture' } },
  ];
  const r = answerScenario({
    birth: BIRTH, question: '나 이직하게 될까?', now: NOW, from: '2027-01', to: '2029-12',
    currentState: { employmentType: 'employed', occupation: '백엔드 개발자' },
    supporting: true, candidates: cands, narrate: { detail: 'full' },
  });
  assert.equal(r.narration.meta.auditOk, true, JSON.stringify(r.narration.meta.issues));
  assert.equal(r.realityMatch.audit.ok, true);

  const txt = r.narration.text;
  assert.match(txt, /대덕넷웍스/, '실제 후보를 붙였는데 이름이 없다');
  assert.match(txt, /운세가 짚은 회사가 아니고, 가게 된다는 뜻도 아닙니다/);
  assert.match(txt, /합격하거나 그리로 간다는 뜻이 아닙니다/);
  // 확정으로 말하지 않는다
  assert.ok(!/대덕넷웍스[^.]{0,10}(입사|갑니다|간다|합격)/.test(txt), txt);
  // 회사 이름을 말한 문장은 현실 근거를 단다
  const ids = new Set(r.realityMatch.evidence.map((c) => c.id));
  const named = r.narration.sentences.find((s) => s.text.includes('대덕넷웍스'));
  assert.ok(named.sourceRefs.some((x) => ids.has(x)), '회사 이름에 현실 근거가 없다');
  // 시나리오 자체는 여전히 회사를 비워 둔다
  assert.equal(r.scenario.primary.company, null);
  assert.equal(r.scenario.primary.location.metro, null);
  // 현실 후보가 없으면 없다고 말한다
  const none = answerScenario({
    birth: BIRTH, question: '나 이직하게 될까?', now: NOW, from: '2027-01', to: '2029-12',
    currentState: { employmentType: 'employed' }, candidates: [
      { id: 'X', domain: 'career', kind: 'opportunity', supportsEvents: ['__none__'],
        source: { id: 'S', sourceType: 'reality' } }],
  });
  assert.match(none.narration.text, /조건이 겹치는 것은 없습니다/);
});

test('14. 곁가지·현실을 붙여도 결정적이고 게이트를 넘지 않는다', () => {
  const opts = {
    birth: BIRTH, question: '나 이직하게 될까?', now: NOW, from: '2027-01', to: '2029-12',
    currentState: { employmentType: 'employed', occupation: '백엔드 개발자' },
    supporting: true, narrate: { detail: 'full' },
  };
  const a = answerScenario(opts);
  const b = answerScenario(opts);
  assert.equal(a.narration.text, b.narration.text);
  assert.deepEqual(a.supporting, b.supporting);
  // 허용 눈금보다 잘게 말하지 않는다
  if (a.scenario.primary.timing.grain !== 'month') {
    assert.ok(!/\d{4}-\d{2}\b|\d{1,2}\s*월/.test(a.narration.text), a.narration.text);
  }
  // 확률·회사형 문자열이 없다
  assert.ok(!/(\d+\s*%|확률|퍼센트|주식회사|㈜)/.test(a.narration.text));
  // short 모드에서도 선 긋는 문장은 남는다
  const short = answerScenario({ ...opts, narrate: { detail: 'short' } });
  assert.equal(short.narration.meta.auditOk, true, JSON.stringify(short.narration.meta.issues));
});

// ── 15~17. 위치 근거를 실제로 계산해 게이트에 잇는다 ───────────

/** 표본 명반 — 같은 규칙으로 만들어 늘 같은 것이 나온다 */
const PLACES = ['서울', '부산', '대구', '광주광역시', '여주', '전주', '춘천', '포항'];
const sample = (i) => ({
  name: 't', gender: i % 2 ? 'male' : 'female',
  year: 1980 + (i % 25), month: ((i * 5) % 12) + 1, day: ((i * 7) % 27) + 1,
  hour: (i * 3) % 24, minute: (i * 11) % 60,
  birthPlace: PLACES[i % PLACES.length], homePlace: PLACES[(i + 3) % PLACES.length],
});

test('15. 근거가 없으면 위치 단계를 열지 않는다', () => {
  const ev = locationEvidenceFor({ birth: BIRTH, domain: 'career' });
  assert.equal(ev.available, false);
  assert.equal(ev.metro, null);
  assert.equal(asGateEvidence(ev), null, '근거가 없는데 게이트에 넘겼다');
  assert.ok(ev.why, '왜 없는지 적는다');

  // 시각을 모르면 하우스를 못 세운다
  const noTime = locationEvidenceFor({
    birth: { ...BIRTH, hour: undefined, minute: undefined }, domain: 'career' });
  assert.equal(noTime.available, false);
  assert.match(noTime.why, /출생 시각/);
  // 위치를 볼 자리가 없는 분야는 아예 보지 않는다
  assert.match(locationEvidenceFor({ birth: BIRTH, domain: 'health' }).why, /볼 자리가 없다/);

  // 통째로 돌려도 도시가 생기지 않는다
  const r = answerScenario({
    birth: BIRTH, question: '어디로 이직할까?', now: NOW, from: '2027-01', to: '2029-12',
    currentState: { employmentType: 'employed' }, useLocation: true,
  });
  assert.ok(r.scenario.meta.allowedLevel <= 4, `위치 근거 없이 ${r.scenario.meta.allowedLevel} 단계까지 열렸다`);
  assert.equal(r.scenario.primary.location.metro, null);
  assert.ok(!/제주|강릉|대전권/.test(r.narration.text));
  assert.equal(r.narration.meta.auditOk, true, JSON.stringify(r.narration.meta.issues));
});

test('16. 한 도시로 좁혔을 때만 열고, 여럿이 걸리면 방위까지다', () => {
  // 후보가 하나뿐인 명반 — 게이트가 열린다
  const one = locationEvidenceFor({ birth: sample(16), domain: 'wealth' });
  assert.equal(one.available, true);
  assert.equal(one.metro, '제주');
  assert.equal(one.candidates.length, 1);
  assert.ok(asGateEvidence(one));
  assert.match(one.caveat, /명반이 그 도시를 가리킨 것이 아니다/);

  const r = answerScenario({
    birth: sample(16), question: '앞으로 돈은 어디쯤에서 풀릴까?', now: NOW,
    from: '2027-01', to: '2029-12', useLocation: true, narrate: { detail: 'full' },
  });
  assert.equal(r.scenario.meta.allowedLevel, 5);
  assert.equal(r.scenario.primary.location.metro, '제주');
  assert.equal(r.scenario.primary.location.sourceType, 'fortune');
  assert.ok(r.scenario.primary.provenance.location.length, '도시에 근거가 없다');
  assert.match(r.narration.text, /방위 계산으로는 제주 쪽이 걸립니다/);
  assert.equal(r.narration.meta.auditOk, true, JSON.stringify(r.narration.meta.issues));
  // 구·회사는 여전히 닫혀 있다
  assert.equal(r.scenario.primary.location.district, null);
  assert.equal(r.scenario.primary.company, null);

  // 후보가 여럿이면 도시를 짚지 않는다
  const many = locationEvidenceFor({ birth: sample(20), domain: 'career' });
  assert.equal(many.available, true);
  assert.ok(many.candidates.length > 1);
  assert.equal(many.metro, null, '여러 곳이 걸렸는데 한 곳을 골랐다');
  assert.equal(asGateEvidence(many), null);
  assert.match(many.why, /한 곳으로 좁히지 못한다/);
});

test('17. 대부분의 명반에서는 열리지 않는다 — 그것이 정상이다', () => {
  let n = 0; let opened = 0; let hasCandidates = 0;
  for (let i = 0; i < 24; i++) {
    const ev = locationEvidenceFor({ birth: sample(i), domain: 'career' });
    n++;
    if (ev.available) hasCandidates++;
    if (asGateEvidence(ev)) opened++;
  }
  assert.equal(n, 24);
  // 국내는 도시를 옮겨도 하우스가 거의 그대로다 — 후보가 나오는 쪽이 드물다
  assert.ok(hasCandidates <= n / 3, `${hasCandidates}/${n} 이면 너무 자주 열린다`);
  assert.ok(opened <= hasCandidates);
  // 열리지 않은 명반은 모두 왜 그런지 적혀 있다
  for (let i = 0; i < 24; i++) {
    const ev = locationEvidenceFor({ birth: sample(i), domain: 'career' });
    if (!ev.available) assert.ok(ev.why, `i=${i} 에 이유가 없다`);
  }
  // 같은 입력이면 같은 결과다
  assert.deepEqual(locationEvidenceFor({ birth: sample(16), domain: 'wealth' }),
    locationEvidenceFor({ birth: sample(16), domain: 'wealth' }));
});
