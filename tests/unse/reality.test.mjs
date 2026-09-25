/**
 * Reality Matcher Core v1 — **현실이 운세를 다시 쓰지 않는가**
 *
 * 이 층에서 가장 쉽게 나는 사고는 "대전 A회사 백엔드 공고"를 보고
 * "당신은 대전 A회사로 간다"로 바꾸는 것이다. 여기서 재는 것은 맞물림의
 * 품질이 아니라 **되먹임이 일어나지 않는가** 다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  matchReality, matchScenarioReality, auditRealityMatch, composePrepared,
} from '../../public/unse/src/semantic/scenario/index.js';
import {
  eligibilityOf, timeRelationOf, COMPARABLE_FIELDS,
} from '../../public/unse/src/semantic/scenario/reality.js';

/** 손으로 만든 시나리오 — 사건·시기·상세를 원하는 모양으로 놓고 맞물림만 본다 */
const mkPrepared = (o = {}) => {
  const domain = o.domain ?? 'career';
  const phase = { id: '2028-02', start: '2028-02', end: '2028-08',
    peakMonth: '2028-05', peakPercentile: 95, persistence: 1.5, grain: 'quarter' };
  const rawEvents = o.rawEvents ?? [{ type: 'job_change', label: '이직', score: 0.4 }];
  const conflict = { primaryDirection: o.direction ?? rawEvents[0].type, competingDirections: [],
    activationAgreement: 'strong', directionalAgreement: 'unanimous', evidenceStrength: 0.7 };
  return {
    domain, from: '2028-01', to: '2028-12',
    question: { intent: 'job_change', label: '이직',
      requestedSpecificity: { timing: 'quarter', location: false, company: false } },
    snapshot: { at: '2028-01', observed: { employmentType: 'employed' },
      planned: {}, predicted: {}, unknown: [] },
    stateKnown: true,
    resolvedSignals: [{ phase, conflict, rawEvents, reachableEvents: rawEvents,
      removedEvents: [], stateKnown: true }],
    timingPhases: [phase],
    branches: [{ id: 'A', startState: 'employed', stateKnown: true, assumption: 'a',
      steps: [{ event: rawEvents[0].type, phaseId: phase.id, conditionalOn: [], assumption: 'a',
        stateBefore: { value: 'employed', kind: 'observed' },
        stateAfter: { value: 'employed', kind: 'predicted' } }],
      endState: { value: 'employed', kind: 'predicted' }, note: 'n' }],
    specificity: { allowedLevel: 4,
      timing: { requested: 'quarter', allowed: 'quarter', reasons: [] },
      blocked: [], confidenceByLevel: {} },
    natal: { domain, profile: o.profile ?? null, leading: [], spokeCount: 4, directCount: 2 },
    locationEvidenceUsed: null, contextLocationUsed: null, evidence: [], contextClaims: {},
    scenarioInput: {
      primary: { phaseId: phase.id, signalIndex: 0,
        timing: { grain: 'quarter', window: { from: phase.start, to: phase.end } },
        eventType: rawEvents[0].type, eventLabel: rawEvents[0].label,
        direction: conflict.primaryDirection, competingDirections: [], company: null,
        agreement: {}, claimIds: [], candidates: rawEvents,
        rawCandidateCount: rawEvents.length, removedByState: [] },
      alternatives: o.alternatives ?? [], distinct: true,
      answersQuestion: o.answersQuestion ?? true, askedFor: o.askedFor ?? null,
      allowedLevel: 4, blocked: [],
      branchStart: { branch: 'A', phaseId: phase.id, event: rawEvents[0].type, matchesPrimary: true },
    },
  };
};

/** 기술·분석이 뚜렷해서 roleFamily 까지 나오는 프로필 */
const TECH = { technical: 0.85, analytical: 0.8, information: 0.7, problemSolving: 0.75,
  specialist: 0.6, research: 0.3, management: 0.1, organization: 0.35, stability: 0.4,
  independence: 0.05, commercial: 0.05, creative: 0.05, aesthetic: 0.05, verbal: 0.1,
  interpersonal: 0.1, public: 0.05, physical: 0.05, care: 0.05, change: 0.2 };

const sc = (o = {}) => composePrepared(mkPrepared({ profile: TECH, ...o }));

const cand = (id, o = {}) => ({
  id, domain: o.domain ?? 'career', kind: o.kind ?? 'opportunity',
  supportsEvents: o.supportsEvents ?? ['job_change'],
  detail: o.detail ?? {},
  ...(o.company === null ? {} : { company: { name: o.company ?? `회사${id}` } }),
  ...(o.location ? { location: o.location } : {}),
  ...(o.validity ? { validity: o.validity } : {}),
  ...(o.extra ?? {}),
  ...(o.noSource ? {} : { source: { id: `SRC-${id}`, sourceType: 'reality', provider: 'fixture' } }),
});

const IN_WINDOW = { from: '2028-03-01', to: '2028-06-30' };
const OUT_WINDOW = { from: '2026-09-01', to: '2026-09-30' };

// ── 1~2. 출처 ────────────────────────────────────────────────

test('1~2. 출처가 있어야 쓰고, 없으면 초구체 값을 내지 않는다', () => {
  const s = sc();
  const r = matchReality(s, [cand('A', { validity: IN_WINDOW }), cand('B', { noSource: true })]);
  assert.equal(r.status, 'matched');
  assert.equal(r.meta.candidateCount, 2);
  assert.equal(r.meta.eligibleCount, 1);

  const a = r.primaryMatches.find((m) => m.candidateId === 'A');
  const b = r.primaryMatches.find((m) => m.candidateId === 'B');
  assert.equal(a.eligible, true);
  assert.equal(b.eligible, false);
  assert.equal(b.reason, 'missing_reality_source');
  // 출처가 없으면 회사·지역이 나오지 않는다
  assert.deepEqual(b.reality, {});
  assert.deepEqual(b.provenance.reality, []);
  assert.equal(eligibilityOf({ id: 'x', kind: 'opportunity' }, s).reason, 'missing_reality_source');
  assert.equal(r.audit.ok, true, JSON.stringify(r.audit.issues));
});

// ── 3~4. 사건 ────────────────────────────────────────────────

test('3~4. 사건이 맞아야 바로 맞는 후보다', () => {
  const s = sc();
  const r = matchReality(s, [
    cand('A', { supportsEvents: ['job_change', 'role_change'], validity: IN_WINDOW }),
    cand('B', { supportsEvents: ['promotion'], validity: IN_WINDOW }),
  ]);
  const a = r.primaryMatches.find((m) => m.candidateId === 'A');
  const b = r.primaryMatches.find((m) => m.candidateId === 'B');
  assert.equal(a.event.match, true);
  assert.equal(a.matchMode, 'direct');
  assert.equal(b.event.match, false);
  assert.equal(b.matchMode, 'not_direct');
  assert.deepEqual(b.event, { scenario: 'job_change', reality: ['promotion'], match: false });
  // 사건이 안 맞는 후보가 위로 오지 않는다
  assert.ok(r.primaryMatches.indexOf(a) < r.primaryMatches.indexOf(b));
});

// ── 5~8. 상세 비교 ───────────────────────────────────────────

test('5~7. 일치·불일치·모름을 따로 적고, 모름은 어긋남이 아니다', () => {
  const s = sc();
  assert.equal(s.primary.detail.roleFamily.key, 'technical_analytical');
  const r = matchReality(s, [cand('A', {
    validity: IN_WINDOW,
    detail: { roleFamily: 'technical_analytical', employmentSetting: 'independent' },
  })]);
  const m = r.primaryMatches[0];
  assert.ok(m.compatibility.matches.includes('roleFamily'));
  const scEmp = s.primary.detail.employmentSetting?.key;
  if (scEmp && scEmp !== 'independent') {
    assert.ok(m.compatibility.contradictions.includes('employmentSetting'));
  }
  // 시나리오가 값을 냈는데 후보에 없으면 모름 (어긋남 아님)
  for (const f of m.compatibility.unknown) {
    assert.ok(!m.compatibility.contradictions.includes(f));
    assert.ok(COMPARABLE_FIELDS.career.includes(f));
  }
  assert.equal(m.compatibility.matchedCount + m.compatibility.contradictions.length,
    m.compatibility.comparableCount);
  assert.equal(m.compatibility.scoreType, 'heuristic_compatibility_not_probability');
});

test('8~9. 모르는 것이 많은 후보가 자동 1위가 되지 않고, 순서가 고정이다', () => {
  const s = sc();
  const fields = ['roleFamily', 'workStyle', 'employmentSetting'];
  const full = {};
  for (const f of fields) if (s.primary.detail[f]) full[f] = s.primary.detail[f].key;
  const one = Object.keys(full)[0];
  assert.ok(one, '비교할 칸이 있어야 한다');

  // A: 한 칸만 알고 그 한 칸이 맞음 / B: 아는 칸 전부가 맞음
  const cands = [
    cand('A-thin', { validity: IN_WINDOW, detail: { [one]: full[one] } }),
    cand('B-deep', { validity: IN_WINDOW, detail: full }),
  ];
  const r = matchReality(s, cands);
  const ids = r.primaryMatches.map((m) => m.candidateId);
  if (Object.keys(full).length > 1) {
    assert.equal(ids[0], 'B-deep', `모름이 많은 쪽이 1위가 됐다: ${ids.join(',')}`);
  }
  const thin = r.primaryMatches.find((m) => m.candidateId === 'A-thin');
  assert.equal(thin.compatibility.coverage, 1, '한 칸만 맞아도 coverage 는 1 이다');
  assert.ok(thin.compatibility.informationDepth < 1, '얕다는 사실이 남는다');

  // 넣는 순서를 바꿔도 결과가 같다
  const rev = matchReality(s, [...cands].reverse());
  assert.deepEqual(rev.primaryMatches.map((m) => m.candidateId), ids);
  assert.deepEqual(rev.evidence, r.evidence, '근거 번호가 입력 순서에 흔들린다');
});

// ── 10~12. 시나리오를 바꾸지 않는다 ──────────────────────────

test('10~11. 현실이 잘 맞아도 대표 사건과 순위를 바꾸지 않는다', () => {
  const s = sc({
    rawEvents: [{ type: 'business_start', label: '창업·자기 판', score: 0.4 }],
    direction: 'business_start',
  });
  // 이직 공고가 아무리 많아도 대표는 창업 그대로다
  const many = ['J1', 'J2', 'J3'].map((id) => cand(id, {
    supportsEvents: ['job_change'], validity: IN_WINDOW,
    detail: { roleFamily: 'technical_analytical', workStyle: 'specialist_technical' },
  }));
  const r = matchReality(s, many);
  assert.equal(r.scenarioRef.eventType, 'business_start');
  assert.equal(r.scenarioRef.unchangedByReality, true);
  for (const m of r.primaryMatches) assert.equal(m.event.match, false);
  for (const a of r.alternativeMatches) assert.equal(a.promotedToPrimary, false);
  assert.equal(r.status, 'no_match');
  assert.equal(r.audit.ok, true, JSON.stringify(r.audit.issues));

  // 감사가 승격을 잡는다
  const faked = JSON.parse(JSON.stringify(r));
  faked.scenarioRef.eventType = 'job_change';
  if (faked.alternativeMatches[0]) faked.alternativeMatches[0].promotedToPrimary = true;
  const a2 = auditRealityMatch(faked, s, many);
  assert.equal(a2.ok, false);
  assert.ok(a2.severe.includes('scenario_event_changed'));
});

test('12. 물은 것과 다른 답이었다는 사실을 유지한다', () => {
  const s = sc({
    rawEvents: [{ type: 'resignation', label: '퇴사·공백', score: 0.4 }],
    direction: 'resignation', answersQuestion: false, askedFor: ['job_change'],
  });
  const r = matchReality(s, [cand('A', { supportsEvents: ['job_change'], validity: IN_WINDOW })]);
  assert.equal(r.status, 'question_mismatch');
  assert.equal(r.questionAnswer.answersQuestion, false);
  assert.deepEqual(r.questionAnswer.askedFor, ['job_change']);
  assert.equal(r.scenarioRef.eventType, 'resignation');
  // 숨기면 감사가 잡는다
  const hidden = JSON.parse(JSON.stringify(r));
  hidden.questionAnswer.answersQuestion = true;
  assert.ok(auditRealityMatch(hidden, s, []).severe.includes('question_mismatch_hidden'));
});

// ── 13~15. 시간 ──────────────────────────────────────────────

test('13~15. 2026년 공고를 2028년 예언으로 승격시키지 않는다', () => {
  const s = sc();
  const r = matchReality(s, [
    cand('NOW', { validity: IN_WINDOW }),
    cand('OLD', { validity: OUT_WINDOW }),
    cand('ENT', { kind: 'entity' }),
    cand('UND', {}),
  ]);
  const get = (id) => r.primaryMatches.find((m) => m.candidateId === id);
  assert.equal(get('NOW').timeRelation, 'overlap');
  assert.equal(get('NOW').directTemporalMatch, true);
  assert.equal(get('NOW').matchMode, 'direct');

  assert.equal(get('OLD').timeRelation, 'outside_window');
  assert.equal(get('OLD').directTemporalMatch, false);
  assert.equal(get('OLD').matchMode, 'illustrative_only');

  // 회사 자체는 미래의 채용으로 취급하지 않는다
  assert.equal(get('ENT').timeRelation, 'not_applicable');
  assert.equal(get('ENT').directTemporalMatch, false);
  assert.equal(get('ENT').matchMode, 'illustrative_only');

  assert.equal(get('UND').timeRelation, 'undated');
  assert.equal(get('UND').matchMode, 'illustrative_only');

  assert.equal(timeRelationOf({ kind: 'entity' }, { from: '2028-01', to: '2028-12' }), 'not_applicable');

  // 감사가 억지 승격을 잡는다
  const faked = JSON.parse(JSON.stringify(r));
  faked.primaryMatches.find((m) => m.candidateId === 'OLD').directTemporalMatch = true;
  faked.primaryMatches.find((m) => m.candidateId === 'ENT').matchMode = 'direct';
  const a = auditRealityMatch(faked, s, []);
  assert.ok(a.severe.includes('temporal_match_without_overlap'));
  assert.ok(a.severe.includes('entity_as_future_opportunity'));
});

// ── 16~20. 회사·위치 ─────────────────────────────────────────

test('16~18. 회사·위치는 reality 출처에서만 나오고 운세로 역주입되지 않는다', () => {
  const s = sc();
  assert.equal(s.primary.location.metro, null, '시나리오는 위치를 짚지 않았다');
  const r = matchReality(s, [cand('A', {
    company: '실제회사A', location: { metro: '대전', district: '유성구' }, validity: IN_WINDOW,
  })]);
  const m = r.primaryMatches[0];
  assert.deepEqual(m.reality.company,
    { value: '실제회사A', sourceType: 'reality', claimMode: 'matched_candidate_not_prediction' });
  assert.equal(m.reality.location.metro, '대전');
  assert.equal(m.reality.location.sourceType, 'reality');

  // 시나리오가 비운 위치를 현실 값으로 채우지 않는다
  assert.equal(m.locationMatch.scenarioSpecified, false);
  assert.equal(m.locationMatch.scenarioValue, null);
  assert.equal(m.locationMatch.matched, false);
  assert.match(m.locationMatch.note, /운세가 짚은 위치가 아니다/);
  assert.equal(s.primary.location.metro, null, '시나리오가 바뀌었다');

  // 회사·위치 근거는 reality 목록에 실재한다
  const ids = new Set(r.evidence.map((c) => c.id));
  for (const ref of m.provenance.reality) assert.ok(ids.has(ref), ref);
  const comp = r.evidence.find((c) => c.field === 'company.name');
  assert.equal(comp.sourceType, 'reality');
  assert.equal(comp.candidateId, 'A');
  assert.equal(comp.sourceId, 'SRC-A');
  // 운세 근거에는 회사가 없다
  for (const ref of m.provenance.scenario) assert.ok(!/^R\d/.test(ref));
});

test('19~20. 사용자 조건은 context 이고, 후보에 없는 회사는 만들지 않는다', () => {
  const s = sc();
  const cands = [cand('A', { company: '실제회사A', location: { metro: '대전' }, validity: IN_WINDOW })];
  const r = matchReality(s, cands, { contextConstraints: { region: ['대전'] } });
  const m = r.primaryMatches[0];
  assert.equal(m.contextFit.sourceType, 'context');
  assert.ok(m.contextFit.matches.some((x) => x.field === 'region'));
  assert.match(m.contextFit.note, /운세 근거가 아니다/);
  // 사용자 조건이 운세 근거 목록에 섞이지 않는다
  assert.ok(!r.evidence.some((c) => c.field === 'region'));

  // 후보에 없는 회사명을 만들면 감사가 잡는다
  const faked = JSON.parse(JSON.stringify(r));
  faked.primaryMatches[0].reality.company.value = '없는회사';
  assert.ok(auditRealityMatch(faked, s, cands).severe.includes('company_not_in_candidate'));
  // 역주입도 잡는다
  const back = JSON.parse(JSON.stringify(r));
  back.primaryMatches[0].locationMatch.matched = true;
  assert.ok(auditRealityMatch(back, s, cands).severe.includes('location_backfilled'));
});

// ── 21~23. 감사 ──────────────────────────────────────────────

test('21~22. 없는 근거와 확률 표현을 감사가 잡는다', () => {
  const s = sc();
  const cands = [cand('A', { validity: IN_WINDOW })];
  const r = matchReality(s, cands);
  assert.equal(r.audit.ok, true, JSON.stringify(r.audit.issues));
  assert.equal(r.meta.probability, false);
  assert.ok(!/확률|probability"\s*:\s*true|\d+\s*%/.test(JSON.stringify(r)));

  const bad = JSON.parse(JSON.stringify(r));
  bad.primaryMatches[0].provenance.reality.push('R999');
  assert.ok(auditRealityMatch(bad, s, cands).severe.includes('dangling_reality_ref'));

  const prob = JSON.parse(JSON.stringify(r));
  prob.primaryMatches[0].compatibility.probability = 0.82;
  assert.ok(auditRealityMatch(prob, s, cands).severe.includes('probability_language'));
});

test('23. 건강·자녀·학업은 실제 자료와 촘촘히 맞대지 않는다', () => {
  const h = sc({ domain: 'health',
    rawEvents: [{ type: 'physical_load', label: '몸에 부담이 실리는 구간', score: 0.4 }],
    direction: 'physical_load' });
  const rh = matchReality(h, [
    cand('MED', { domain: 'health', supportsEvents: ['physical_load'],
      company: '○○병원', extra: { category: 'clinic' } }),
    cand('WEL', { domain: 'health', supportsEvents: ['physical_load'],
      company: null, extra: { category: 'wellness' } }),
  ]);
  const med = rh.primaryMatches.find((m) => m.candidateId === 'MED');
  assert.equal(med.eligible, false);
  assert.ok(['health_wellness_only', 'health_medical_candidate_blocked'].includes(med.reason));
  assert.deepEqual(med.reality, {});
  assert.equal(rh.primaryMatches.find((m) => m.candidateId === 'WEL').eligible, true);

  // 의료 표시가 붙은 후보는 어떤 경우에도 막는다
  assert.equal(eligibilityOf({ id: 'z', kind: 'entity', domain: 'health', medical: true,
    category: 'wellness', source: { id: 's', sourceType: 'reality' } }, h).eligible, false);

  // 학업: 결과가 있는 후보는 쓰지 않는다
  const e = sc({ domain: 'education',
    rawEvents: [{ type: 'exam_success_window', label: '결실이 나올 만한 구간', score: 0.4 }],
    direction: 'exam_success_window' });
  const re = matchReality(e, [cand('EX', { domain: 'education',
    supportsEvents: ['exam_success_window'], extra: { result: 'pass' } })]);
  assert.equal(re.primaryMatches[0].eligible, false);
  assert.equal(re.primaryMatches[0].reason, 'education_result_not_available');
});

// ── 24. 결정성 ───────────────────────────────────────────────

test('24. 같은 입력이면 같은 결과다', () => {
  const s = sc();
  const cands = [
    cand('B', { validity: IN_WINDOW, detail: { roleFamily: 'technical_analytical' } }),
    cand('A', { validity: OUT_WINDOW }),
    cand('C', { kind: 'entity', location: { metro: '서울' } }),
  ];
  const a = matchReality(s, cands, { contextConstraints: { region: ['대전'] } });
  const b = matchReality(s, cands, { contextConstraints: { region: ['대전'] } });
  assert.deepEqual(a, b);
  assert.equal(a.meta.deterministic, true);
  // 편의 export 도 같은 것을 낸다
  assert.deepEqual(matchScenarioReality(s, cands, { contextConstraints: { region: ['대전'] } }), a);
  // 앞 층이 어긋났으면 맞대지 않는다
  const broken = { ...s, coherence: { ok: false, issues: [{ code: 'x' }] } };
  assert.equal(matchReality(broken, cands).status, 'unsafe_input');
  assert.equal(matchReality(null, cands).status, 'unsafe_input');
});
