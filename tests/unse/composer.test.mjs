/**
 * Scenario Composer v1 — **근거보다 더 구체적으로 내려가지 않는가**
 *
 * 여기서 재는 것은 운세의 정확도가 아니라 **말을 어디서 멈추는가** 다.
 * 다음 층(Narrator)이 그럴듯한 문장을 쓰기 전에, 그 문장에 들어갈 재료가
 * 근거를 넘지 않았는지 고정한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  composePrepared, composeScenario, prepareScenario, auditCoherence, timingAt,
} from '../../public/unse-8f3k2m/src/semantic/scenario/index.js';
import { sanitize } from '../../public/unse-8f3k2m/src/semantic/scenario/composer.js';
import { detailFor, CAREER_FAMILIES } from '../../public/unse-8f3k2m/src/semantic/scenario/detail.js';
import {
  HEALTH_FORBIDDEN, CERTAINTY_FORBIDDEN, COMPANY_LIKE,
} from '../../public/unse-8f3k2m/src/semantic/scenario/coherence.js';

const BIRTH = {
  name: 'x', gender: 'female', year: 1992, month: 1, day: 30,
  hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전',
};
const NOW = new Date('2026-09-24T00:00:00Z');

let cached = null;
const career = () => (cached ??= composeScenario({
  birth: BIRTH, question: '2027년부터 2030년 사이에 어디로 이직할까?', now: NOW,
  currentState: { employmentType: 'employed', occupation: '개발자' },
}));

/**
 * 손으로 만든 `prepared`. 게이트를 원하는 단계로 놓고 **자르는지**만 본다.
 * (엔진을 돌리면 게이트 값이 명반에 따라 흔들려 원하는 단계를 못 만든다)
 */
const mkPrepared = (o = {}) => {
  const domain = o.domain ?? 'career';
  const phase = { id: '2028-02', start: '2028-02', end: '2028-08',
    peakMonth: '2028-05', peakPercentile: 95, persistence: 1.5, grain: 'quarter' };
  const rawEvents = o.rawEvents ?? [{ type: 'job_change', label: '이직', score: 0.31 }];
  const conflict = {
    primaryDirection: o.direction ?? 'job_change', competingDirections: o.competing ?? [],
    activationAgreement: 'strong', directionalAgreement: 'unanimous', evidenceStrength: 0.7,
  };
  const signal = { phase, conflict, rawEvents, reachableEvents: rawEvents, removedEvents: [], stateKnown: true };
  return {
    domain, from: '2028-01', to: '2028-12',
    question: { intent: o.intent ?? 'job_change', label: '이직' },
    snapshot: { at: '2028-01', observed: o.observed ?? { employmentType: 'employed' },
      planned: {}, predicted: {}, unknown: ['maritalStatus'] },
    stateKnown: true,
    resolvedSignals: [signal],
    timingPhases: [phase],
    branches: o.branches ?? [{
      id: 'A', startState: 'employed', stateKnown: true, assumption: '현재 employed',
      steps: [{ event: rawEvents[0].type, phaseId: phase.id,
        window: { from: phase.start, to: phase.end, peak: phase.peakMonth },
        conditionalOn: [], assumption: '현재 상태가 employed 라는 사실',
        stateBefore: { value: 'employed', kind: 'observed' },
        stateAfter: { value: 'employed', kind: 'predicted' } }],
      endState: { value: 'employed', kind: 'predicted' }, note: 'n',
    }],
    specificity: {
      allowedLevel: o.cap ?? 4,
      timing: { requested: 'month', allowed: o.grain ?? 'quarter', reasons: [] },
      blocked: [], confidenceByLevel: {},
    },
    natal: { domain, profile: o.profile ?? null, leading: [], spokeCount: 4, directCount: 2 },
    locationEvidenceUsed: o.locationEvidence ?? null,
    contextLocationUsed: o.contextLocation ?? null,
    evidence: [],
    scenarioInput: {
      primary: {
        phaseId: phase.id, signalIndex: 0,
        timing: { grain: o.grain ?? 'quarter', window: { from: phase.start, to: phase.end },
          peak: null, peakPercentile: 95, persistence: 1.5 },
        eventType: rawEvents[0]?.type ?? null, eventLabel: rawEvents[0]?.label ?? null,
        direction: conflict.primaryDirection, competingDirections: conflict.competingDirections,
        company: null, agreement: { activation: 'strong', direction: 'unanimous', evidenceStrength: 0.7 },
        claimIds: [], candidates: rawEvents, rawCandidateCount: rawEvents.length, removedByState: [],
      },
      alternatives: [], distinct: o.distinct ?? true,
      answersQuestion: o.answersQuestion ?? true, askedFor: o.askedFor ?? null,
      allowedLevel: o.cap ?? 4, blocked: [],
      branchStart: { branch: 'A', phaseId: phase.id, event: rawEvents[0]?.type ?? null, matchesPrimary: true },
    },
  };
};

// ── 1~2. 게이트가 최종 권한 ──────────────────────────────────

test('1. allowedLevel 1 이면 사건·역할·위치를 만들지 않는다', () => {
  const s = composePrepared(mkPrepared({ cap: 1, profile: { technical: 0.9, analytical: 0.8 } }));
  assert.equal(s.primary.event, null, '사건 종류까지 내려갔다');
  assert.equal(s.primary.direction, null);
  for (const v of Object.values(s.primary.detail)) assert.equal(v, null);
  assert.equal(s.primary.location.metro, null);
  assert.equal(s.primary.company, null);
  assert.ok(s.primary.timing.from, '분야가 움직이는 구간까지는 말한다');
  assert.equal(s.meta.maxSpecificityUsed, 1);
  assert.ok(s.meta.maxSpecificityUsed <= s.meta.allowedLevel);
  assert.deepEqual(s.branches, [], '사건을 말할 수 없으면 사건의 사슬도 내지 않는다');
  assert.ok(s.meta.sanitized.some((x) => x.code === 'cut_branches'));
  assert.ok(s.coherence.issues.some((x) => x.code === 'cut_branches'), '잘랐으면 적어 둔다');
  assert.equal(s.coherence.ok, true, '게이트가 제 일을 한 것은 어긋남이 아니다');

  // 앞 층이 실수로 더 채워 보내도 여기서 잘리고 **기록된다**
  const over = sanitize({
    primary: {
      phaseId: '2028-02',
      timing: { grain: 'month', from: '2028-02', to: '2028-08', peak: '2028-05' },
      event: { type: 'job_change', label: '이직' },
      direction: { key: 'job_change', competing: [] },
      detail: { roleFamily: { key: 'x', label: '기술 계열' }, employmentSetting: { key: 'y', label: '조직형' } },
      location: { metro: '대전권', district: '대덕구', sourceType: 'fortune' },
      company: '어떤회사',
      provenance: { detail: { roleFamily: ['X1'], employmentSetting: ['X2'] } },
    },
    alternatives: [], branches: [],
  }, { cap: 1, grain: 'year', prepared: mkPrepared({ cap: 1 }) });

  assert.equal(over.primary.event, null);
  assert.equal(over.primary.direction, null);
  assert.equal(over.primary.detail.roleFamily, null);
  assert.equal(over.primary.location.metro, null);
  assert.equal(over.primary.location.district, null);
  assert.equal(over.primary.company, null);
  assert.equal(over.primary.timing.grain, 'year');
  assert.equal(over.primary.timing.peak, null);
  const codes = over.issues.map((x) => x.code);
  for (const c of ['cut_event', 'cut_direction', 'cut_detail', 'cut_metro', 'cut_district',
    'cut_company', 'cut_timing']) {
    assert.ok(codes.includes(c), `${c} 를 기록하지 않았다: ${codes.join(',')}`);
  }
});

test('2. 분기까지만 허용되면 달이 최종 출력에 나오지 않는다', () => {
  const s = composePrepared(mkPrepared({ grain: 'quarter' }));
  assert.equal(s.primary.timing.grain, 'quarter');
  assert.equal(s.primary.timing.peak, null, '봉우리 달이 새어 나갔다');
  assert.equal(s.primary.timing.from, '2028-01');
  assert.equal(s.primary.timing.to, '2028-09');
  assert.match(s.primary.timing.label, /분기/);
  assert.ok(!JSON.stringify(s.primary.timing).includes('2028-05'), '내부 봉우리 달이 그대로 나갔다');

  // 눈금별로 실제 구간이 달라진다
  const ph = { start: '2028-02', end: '2028-08', peakMonth: '2028-05' };
  assert.deepEqual(timingAt(ph, 'year'), { grain: 'year', from: '2028-01', to: '2028-12', peak: null, label: '2028년' });
  assert.equal(timingAt(ph, 'halfyear').label, '2028년 상반기~2028년 하반기');
  assert.equal(timingAt(ph, 'month').peak, '2028-05');
  // 달 눈금일 때만 달을 낸다
  assert.equal(composePrepared(mkPrepared({ grain: 'month' })).primary.timing.peak, '2028-05');
});

// ── 3. 사건을 새로 만들지 않는다 ─────────────────────────────

test('3. 사건은 그 국면의 후보에서만 나온다', () => {
  const { prepared, scenario: s } = career();
  const sig = prepared.resolvedSignals.find((x) => x.phase.id === s.primary.phaseId);
  assert.ok(sig.rawEvents.some((e) => e.type === s.primary.event.type),
    `${s.primary.phaseId} 국면에 없는 사건 ${s.primary.event.type}`);
  for (const a of s.alternatives) {
    if (!a.event) continue;
    const as = prepared.resolvedSignals.find((x) => x.phase.id === a.phaseId);
    assert.ok(as.rawEvents.some((e) => e.type === a.event.type));
  }
  // 가지의 단계도 그 국면 것이다
  for (const br of s.branches) {
    for (const st of br.steps) {
      const bs = prepared.resolvedSignals.find((x) => x.phase.id === st.phaseId);
      assert.ok(bs.rawEvents.some((e) => e.type === st.event), `${st.phaseId}/${st.event}`);
    }
  }
  // primary 와 가지 1단계가 같은 자리에서 출발한다
  assert.equal(s.branches[0].steps[0].phaseId, s.primary.phaseId);
  assert.equal(s.branches[0].steps[0].event, s.primary.event.type);
});

// ── 4~5. 질문과 결과 ─────────────────────────────────────────

test('4. 물은 것과 다른 답이면 그렇게 적고 억지로 바꾸지 않는다', () => {
  const p = mkPrepared({
    intent: 'job_change', answersQuestion: false, askedFor: ['job_change', 'role_change'],
    rawEvents: [{ type: 'business_start', label: '창업·자기 판', score: 0.4 }],
    direction: 'business_start',
  });
  const s = composePrepared(p);
  assert.equal(s.status, 'question_mismatch');
  assert.equal(s.questionAnswer.answersQuestion, false);
  assert.equal(s.questionAnswer.status, 'question_mismatch');
  assert.match(s.questionAnswer.note, /질문에 맞추려고 바꾸지 않았다/);
  // 질문에 맞는 후보를 대표로 끌어올리지 않았다
  assert.equal(s.primary.event.type, 'business_start');
  assert.deepEqual(s.questionAnswer.askedFor, ['job_change', 'role_change']);
  // 숨기지 않았으므로 coherence 는 이것으로 실패하지 않는다
  assert.ok(!s.coherence.issues.some((x) => x.code === 'question_mismatch_hidden'));
});

test('5. 근거 차이가 없으면 대표를 확정처럼 내지 않는다', () => {
  const s = composePrepared(mkPrepared({ distinct: false }));
  assert.equal(s.selectionStatus, 'close');
  assert.match(s.selectionNote, /유력하다|가장 강하다/);
  assert.ok(!s.coherence.issues.some((x) => x.code === 'close_but_decisive'));
  // 반대로 distinct 면 close 가 아니다
  assert.equal(composePrepared(mkPrepared({ distinct: true })).selectionStatus, 'distinct');
});

// ── 6~8. 초구체화 ────────────────────────────────────────────

test('6. 축이 뚜렷하면 넓은 역할 갈래까지 옮긴다', () => {
  const profile = { technical: 0.85, analytical: 0.8, information: 0.7, problemSolving: 0.75,
    specialist: 0.6, research: 0.3, management: 0.1, organization: 0.35, stability: 0.4,
    independence: 0.1, commercial: 0.05, creative: 0.1, aesthetic: 0.05,
    verbal: 0.1, interpersonal: 0.15, public: 0.1, physical: 0.05, care: 0.05, change: 0.2 };
  const { detail } = detailFor({ domain: 'career', profile, level: 4 });
  assert.equal(detail.roleFamily.key, 'technical_analytical');
  assert.match(detail.roleFamily.label, /기술·분석/);
  assert.ok(detail.workStyle, '일하는 방식도 나온다');
  // 하나의 구체 직업을 만들지 않는다
  const txt = JSON.stringify(detail);
  assert.ok(!/개발자|의사|변호사|교사|자바|Java/.test(txt), txt);
  // 갈래 표는 넓은 계열만 담는다
  for (const f of CAREER_FAMILIES) assert.ok(!/개발자|의사|변호사/.test(f.label));
});

test('7. 갈리거나 얕은 프로필이면 산업군은 null 이 정상이다', () => {
  // 1위와 2위가 팽팽하다
  const tie = { technical: 0.5, analytical: 0.5, information: 0.5, problemSolving: 0.5,
    research: 0.5, specialist: 0.5, management: 0.5, organization: 0.5, interpersonal: 0.5 };
  const a = detailFor({ domain: 'career', profile: tie, level: 4 });
  assert.equal(a.detail.roleFamily, null);
  assert.equal(a.detail.industryFamily, null);
  assert.match(a.why.roleFamily, /팽팽/);

  // 전부 얕다
  const flat = Object.fromEntries(Object.keys(tie).map((k) => [k, 0.05]));
  const b = detailFor({ domain: 'career', profile: flat, level: 4 });
  assert.equal(b.detail.roleFamily, null);
  assert.match(b.why.roleFamily, /얕다/);

  // 프로필 자체가 없으면 만들지 않는다
  assert.equal(detailFor({ domain: 'career', profile: null, level: 4 }).detail.roleFamily, null);
});

test('8. 현재 직업은 context 로만 쓰고 운세가 맞혔다고 하지 않는다', () => {
  const { scenario: s } = career();
  assert.equal(s.primary.contextAnchor.occupation.value, '개발자');
  assert.equal(s.primary.contextAnchor.occupation.sourceType, 'context');
  // 운세 근거 목록에 '개발자' 가 들어가지 않는다
  for (const c of s.evidence.filter((x) => x.sourceType === 'fortune')) {
    assert.ok(!/개발자/.test(c.claim), c.claim);
  }
  // 상세도 직업명을 담지 않는다
  assert.ok(!/개발자/.test(JSON.stringify(s.primary.detail)));
});

// ── 9~11. 위치와 회사 ────────────────────────────────────────

test('9~11. 위치 근거가 없으면 도시·구는 null, 회사는 언제나 null', () => {
  const none = composePrepared(mkPrepared({ cap: 6 }));
  assert.equal(none.primary.location.metro, null);
  assert.equal(none.primary.location.district, null);
  assert.equal(none.primary.location.sourceType, null);

  // 근거가 있으면 그때만 도시권
  const withEv = composePrepared(mkPrepared({ cap: 6,
    locationEvidence: { metro: '대전권', what: '아스트로카토그래피' }, contextLocation: '대덕구' }));
  assert.equal(withEv.primary.location.metro, '대전권');
  assert.equal(withEv.primary.location.district, '대덕구');
  assert.ok(withEv.primary.provenance.location.length);

  // 회사는 어떤 입력에서도 null
  for (const cap of [1, 2, 3, 4, 5, 6, 7]) {
    const s = composePrepared(mkPrepared({ cap,
      locationEvidence: { metro: '대전권' }, contextLocation: '대덕구' }));
    assert.equal(s.primary.company, null, `cap ${cap} 에서 회사가 생겼다`);
    assert.ok(!COMPANY_LIKE.test(JSON.stringify(s.primary)), `cap ${cap}`);
  }
  // placeholder 문자열을 그대로 내보내지 않는다
  const { scenario } = career();
  assert.ok(!/derive-from-|from-context-only/.test(JSON.stringify(scenario.primary)));
});

// ── 12~13. 가지 ──────────────────────────────────────────────

test('12~13. 두 번째 단계는 조건부이고 예측이 사실로 올라가지 않는다', () => {
  const { prepared, scenario: s } = career();
  assert.ok(s.branches.length >= 1 && s.branches.length <= 3);
  for (const br of s.branches) {
    br.steps.forEach((st, i) => {
      assert.equal(st.conditional, i > 0, `${br.id} step${i} conditional`);
      assert.equal(st.stateAfter.kind, 'predicted');
      if (i > 0) {
        assert.ok(st.conditionalOn.length, '무엇을 전제하는지 적는다');
        assert.equal(st.stateBefore.kind, 'predicted');
        assert.match(st.assumption, /가정/);
      }
    });
  }
  // 가지 A 의 가정이 B 로 새지 않는다
  const starts = new Set(s.branches.map((b) => b.startState.value));
  assert.equal(starts.size, 1, '출발 상태가 가지마다 달라졌다');
  // 관측 칸은 그대로다
  assert.deepEqual(Object.keys(prepared.snapshot.predicted), []);
  assert.equal(prepared.snapshot.observed.employmentType, 'employed');
});

// ── 14~16. 분야별 guard ──────────────────────────────────────

test('14. 건강에서 질환·수술·진단을 만들지 않는다', () => {
  const { scenario: s } = composeScenario({
    birth: BIRTH, question: '2027년부터 2029년 사이에 건강은 어때?', now: NOW,
    currentState: { employmentType: 'employed' },
  });
  assert.equal(s.meta.domain, 'health');
  const txt = JSON.stringify({ e: s.primary?.event, d: s.primary?.detail, c: s.primary?.conditions });
  assert.ok(!HEALTH_FORBIDDEN.test(txt), txt);
  if (s.primary?.event) {
    assert.ok(['physical_load', 'recovery_need', 'health_attention_period'].includes(s.primary.event.type),
      s.primary.event.type);
  }
  assert.ok(!s.coherence.issues.some((x) => x.code === 'health_medical_language'));
});

test('15~16. 출산·시험을 확정으로 바꾸지 않는다', () => {
  for (const [q, dom] of [['2027년부터 2029년 사이에 아이는?', 'children'],
    ['2027년부터 2029년 사이에 시험 어때?', 'education']]) {
    const { scenario: s } = composeScenario({ birth: BIRTH, question: q, now: NOW });
    assert.equal(s.meta.domain, dom);
    const txt = JSON.stringify(s.primary ?? {});
    assert.ok(!CERTAINTY_FORBIDDEN.test(txt), `${dom}: ${txt.slice(0, 200)}`);
    // 후보가 달고 있던 주의문을 그대로 들고 온다
    if (s.primary?.event?.type === 'exam_success_window') {
      assert.match(s.primary.event.caution, /합격을 단정하지 않는다/);
    }
  }
  // 후보 라벨 자체를 바꾸지 않는다 (임신 확정으로 고치지 않는다)
  const p = mkPrepared({ domain: 'children',
    rawEvents: [{ type: 'birth', label: '출산 관련 구간', score: 0.4 }], direction: 'birth' });
  const s = composePrepared(p);
  assert.equal(s.primary.event.label, '출산 관련 구간');
  assert.ok(!CERTAINTY_FORBIDDEN.test(JSON.stringify(s.primary)));
});

// ── 17~18. 출처와 감사 ───────────────────────────────────────

test('17. 값이 있는 주요 칸에는 근거가 붙어 있다', () => {
  const { scenario: s } = career();
  const ids = new Set(s.evidence.map((c) => c.id));
  assert.ok(s.primary.provenance.timing.length);
  for (const id of s.primary.sourceRefs) assert.ok(ids.has(id), id);
  if (s.primary.event) assert.ok(s.primary.provenance.event.length);
  for (const [k, v] of Object.entries(s.primary.detail)) {
    if (v == null) continue;
    assert.ok((s.primary.provenance.detail[k] ?? []).length, `${k} 에 근거가 없다`);
  }
  // 출처 종류가 네 가지 안에 있다
  for (const c of s.evidence) {
    assert.ok(['fortune', 'context', 'reality', 'derived'].includes(c.sourceType), c.sourceType);
  }
  // 이 단계에는 reality 가 없다
  assert.equal(s.evidence.filter((c) => c.sourceType === 'reality').length, 0);
});

test('18. 근거 없는 상세는 감사에서 잡히고 잘려 나간다', () => {
  const { scenario: s } = career();
  // 근거를 지운 채로 감사하면 잡아낸다
  const broken = JSON.parse(JSON.stringify(s));
  broken.primary.detail.roleFamily = { key: 'x', label: '만들어 낸 갈래' };
  broken.primary.provenance.detail = {};
  broken.primary.company = '어떤회사';
  broken.primary.timing.peak = '2028-05';
  const a = auditCoherence(broken, career().prepared);
  assert.equal(a.ok, false);
  const codes = a.issues.map((x) => x.code);
  assert.ok(codes.includes('detail_without_provenance'));
  assert.ok(codes.includes('company_generated'));
  assert.ok(codes.includes('peak_month_leaked'));
  // 제대로 만든 것은 통과한다 (게이트가 설계대로 자른 것은 어긋남이 아니다)
  assert.equal(s.coherence.ok, true, JSON.stringify(s.coherence.issues));
  for (const x of s.coherence.issues) {
    assert.ok(s.coherence.expectedCuts.includes(x.code), `예상 못 한 문제: ${x.code}`);
  }
});

// ── 19. 다른 분야 ────────────────────────────────────────────

test('19. 직업 전용이 아니다 — 다른 분야도 자기 축으로 상세를 낸다', () => {
  const p = mkPrepared({ domain: 'relationship', cap: 4,
    rawEvents: [{ type: 'relationship_deepening', label: '관계가 깊어짐', score: 0.4 }],
    direction: 'relationship_deepening',
    profile: { bonding: 0.8, commitment: 0.4, autonomy: 0.1, passion: 0.3, stability: 0.2, volatility: 0.1 } });
  const s = composePrepared(p);
  assert.equal(s.primary.detail.relationshipStyle.key, 'bonding');
  assert.ok(s.primary.detail.relationshipStyle.label);
  assert.equal(s.primary.detail.roleFamily, null, '직업 칸을 다른 분야에 채우면 안 된다');
  assert.ok(s.primary.provenance.detail.relationshipStyle.length);

  // 재물도 같은 방식
  const w = composePrepared(mkPrepared({ domain: 'wealth', cap: 4,
    rawEvents: [{ type: 'asset_accumulation', label: '자산이 쌓임', score: 0.4 }],
    direction: 'asset_accumulation',
    profile: { accumulation: 0.75, incomeStability: 0.3, speculation: 0.1, enterprise: 0.1, wealthVolatility: 0.1 } }));
  assert.equal(w.primary.detail.wealthMode.key, 'accumulation');
});

// ── 20. 결정성 ───────────────────────────────────────────────

test('20. 같은 입력이면 같은 결과다', () => {
  const opts = { birth: BIRTH, question: '2027년부터 2030년 사이에 이직할까?', now: NOW,
    currentState: { employmentType: 'employed' } };
  const a = composeScenario(opts).scenario;
  const b = composeScenario(opts).scenario;
  assert.deepEqual(a, b, '같은 입력에 다른 시나리오가 나왔다');
  // 같은 prepared 를 두 번 조립해도 근거 번호까지 같다
  const prepared = prepareScenario(opts);
  assert.deepEqual(composePrepared(prepared), composePrepared(prepared));
  assert.equal(a.meta.deterministic, true);
});

// ── 21. 재료가 없을 때 ───────────────────────────────────────

test('21. 말할 것이 없으면 "모르겠다"가 정상 결과다', () => {
  const { scenario: s } = composeScenario({ birth: BIRTH, question: '오늘 점심 뭐 먹지', now: NOW });
  assert.equal(s.status, 'insufficient');
  assert.equal(s.primary, null);
  assert.deepEqual(s.alternatives, []);
  assert.ok(s.questionAnswer.note);
  assert.equal(s.meta.maxSpecificityUsed, 0);
});

// ── 22~26. 사건-방향 충돌 분리와 근거 계약 ─────────────────────

test('22. 사건 점수와 계보 표결이 갈리면 방향을 내보내지 않는다', () => {
  const s = composePrepared(mkPrepared({
    rawEvents: [{ type: 'resignation', label: '퇴사·공백', score: 0.4 }],
    direction: 'promotion',
  }));
  assert.equal(s.primary.event.type, 'resignation');
  assert.deepEqual(
    { e: s.primary.selectionConflict.eventScoreWinner, v: s.primary.selectionConflict.lineageVoteWinner },
    { e: 'resignation', v: 'promotion' });
  assert.equal(s.primary.selectionConflict.agreement, false);
  assert.equal(s.primary.direction, null, '갈린 방향이 정상 방향처럼 남았다');
  assert.deepEqual(s.primary.provenance.direction, []);
  assert.ok(s.meta.sanitized.some((x) => x.code === 'cut_conflicting_direction'));
  // 갈림 자체는 지우지 않는다 — 다음 층이 설명할 수 있어야 한다
  assert.ok(s.primary.selectionConflict.provenance.length);
  assert.ok(s.primary.conditions.some((c) => c.what === 'direction_vs_event'));
  // 이것은 설계대로 자른 것이지 어긋남이 아니다
  assert.equal(s.coherence.ok, true, JSON.stringify(s.coherence.issues));
});

test('23. 같은 곳을 가리키면 방향을 그대로 쓴다', () => {
  const s = composePrepared(mkPrepared({
    rawEvents: [{ type: 'promotion', label: '승진·보상 조정', score: 0.4 }],
    direction: 'promotion',
  }));
  assert.equal(s.primary.selectionConflict.agreement, true);
  assert.equal(s.primary.direction.key, 'promotion');
  assert.ok(s.primary.provenance.direction.length);
  assert.ok(!s.meta.sanitized.some((x) => x.code === 'cut_conflicting_direction'));
  assert.ok(!s.primary.conditions.some((c) => c.what === 'direction_vs_event'));
});

test('24. 갈렸으면 상세의 근거에서 그 방향을 뺀다', () => {
  const profile = { technical: 0.85, analytical: 0.8, information: 0.7, problemSolving: 0.75,
    specialist: 0.6, management: 0.1, organization: 0.3, independence: 0.05, commercial: 0.05,
    creative: 0.05, aesthetic: 0.05, verbal: 0.1, interpersonal: 0.1, public: 0.05,
    physical: 0.05, care: 0.05, stability: 0.2, change: 0.2, research: 0.3 };

  const clash = composePrepared(mkPrepared({
    profile, rawEvents: [{ type: 'resignation', label: '퇴사·공백', score: 0.4 }],
    direction: 'promotion',
  }));
  assert.equal(clash.primary.detailProvenanceMode, 'natal_only_due_to_selection_conflict');
  const voteRefs = new Set(clash.primary.selectionConflict.provenance);
  const byId = new Map(clash.evidence.map((c) => [c.id, c]));
  for (const refs of Object.values(clash.primary.provenance.detail)) {
    for (const r of refs) {
      for (const from of byId.get(r).derivedFrom ?? []) {
        assert.ok(!voteRefs.has(from), `상세가 갈린 방향(${from})을 근거로 썼다`);
      }
    }
  }
  // 상세 자체는 정적 프로필에서 나오므로 살아 있다
  assert.ok(clash.primary.detail.roleFamily);
  assert.ok(!clash.coherence.issues.some((x) => x.code === 'detail_uses_conflicting_direction'));

  // 갈리지 않았으면 방향을 근거로 쓸 수 있다
  const same = composePrepared(mkPrepared({
    profile, rawEvents: [{ type: 'job_change', label: '이직', score: 0.4 }], direction: 'job_change',
  }));
  assert.equal(same.primary.detailProvenanceMode, 'natal_and_direction');
  const dirRef = same.primary.provenance.direction[0];
  const sameById = new Map(same.evidence.map((c) => [c.id, c]));
  const used = Object.values(same.primary.provenance.detail)
    .flat().flatMap((r) => sameById.get(r).derivedFrom ?? []);
  assert.ok(used.includes(dirRef), '갈리지 않았는데 방향을 근거로 쓰지 않았다');
});

test('25. 대안과 가지도 자기 근거를 갖는다', () => {
  const { scenario: s } = career();
  const ids = new Set(s.evidence.map((c) => c.id));
  const byId = new Map(s.evidence.map((c) => [c.id, c]));

  for (const a of s.alternatives) {
    for (const k of ['timing', 'event', 'direction']) {
      if (a[k] == null) continue;
      assert.ok((a.provenance[k] ?? []).length, `대안 ${a.rank} 의 ${k} 에 근거가 없다`);
    }
    for (const r of a.sourceRefs) assert.ok(ids.has(r), r);
    // 다른 국면이면 그 국면의 시기 근거를 쓴다 — 주 시나리오 것을 베끼지 않는다
    if (a.phaseId !== s.primary.phaseId) {
      assert.equal(byId.get(a.provenance.timing[0]).phaseId, a.phaseId);
      assert.notEqual(a.provenance.timing[0], s.primary.provenance.timing[0]);
      for (const r of [...a.provenance.event, ...a.provenance.direction]) {
        assert.ok(!s.primary.sourceRefs.includes(r), `주 시나리오 근거 ${r} 를 베꼈다`);
      }
    }
  }

  for (const br of s.branches) {
    br.steps.forEach((st, i) => {
      for (const k of ['timing', 'event', 'state']) {
        assert.ok((st.provenance[k] ?? []).length, `${br.id}${i} 의 ${k} 근거가 없다`);
      }
      for (const r of st.sourceRefs) assert.ok(ids.has(r), r);
      assert.equal(byId.get(st.provenance.timing[0]).phaseId, st.phaseId);
      if (i === 0) {
        assert.equal(st.state.sourceType, st.stateBefore.kind === 'observed' ? 'context' : 'derived');
      } else {
        // 두 번째부터는 앞 단계를 가정한 예측이다
        assert.equal(st.state.sourceType, 'derived');
        assert.equal(st.state.kind, 'predicted');
        assert.ok(st.state.conditionalOn.length);
        assert.notEqual(byId.get(st.provenance.state[0]).sourceType, 'context');
      }
    });
  }
  assert.ok(!s.coherence.issues.some((x) =>
    ['alternative_without_provenance', 'branch_step_without_provenance',
      'alternative_copies_primary', 'branch_state_context_leak'].includes(x.code)));
});

test('26. 없는 근거를 가리키거나 남의 국면 근거를 쓰면 감사가 잡는다', () => {
  const { prepared, scenario: s } = career();
  const broken = JSON.parse(JSON.stringify(s));
  broken.primary.sourceRefs.push('X999');
  if (broken.alternatives[0]) {
    broken.alternatives[0].provenance.timing = [s.primary.provenance.timing[0]];
    broken.alternatives[0].provenance.event = [];
  }
  if (broken.branches[0]?.steps?.[1]) {
    broken.branches[0].steps[1].state = { sourceType: 'context', conditionalOn: [], kind: 'observed' };
  }
  // 갈렸는데 같다고 적으면 잡는다
  if (broken.primary.selectionConflict) {
    broken.primary.selectionConflict.agreement = true;
    broken.primary.direction = { key: broken.primary.selectionConflict.lineageVoteWinner, competing: [] };
  }
  const a = auditCoherence(broken, prepared);
  const codes = a.issues.map((x) => x.code);
  assert.equal(a.ok, false);
  assert.ok(codes.includes('dangling_source_ref'), codes.join(','));
  if (s.alternatives.length && s.alternatives[0].phaseId !== s.primary.phaseId) {
    assert.ok(codes.includes('foreign_phase_ref') || codes.includes('alternative_copies_primary'), codes.join(','));
  }
  if (s.primary.selectionConflict) {
    assert.ok(codes.includes('selection_conflict_mislabeled'), codes.join(','));
    assert.ok(codes.includes('conflicting_direction_leaked'), codes.join(','));
  }
  if (s.branches[0]?.steps?.[1]) {
    assert.ok(codes.includes('branch_state_source_wrong'), codes.join(','));
    assert.ok(codes.includes('branch_state_context_leak') || codes.includes('branch_state_kind_wrong'),
      codes.join(','));
  }
});

test('27. 근거 번호는 primary → alternatives → branches 순으로 고정이다', () => {
  const opts = { birth: BIRTH, question: '2027년부터 2030년 사이에 이직할까?', now: NOW,
    currentState: { employmentType: 'employed' } };
  const prepared = prepareScenario(opts);
  const a = composePrepared(prepared);
  const b = composePrepared(prepared);
  assert.deepEqual(a.evidence.map((c) => c.id), b.evidence.map((c) => c.id));
  assert.deepEqual(a, b);

  // 순서: 주 시나리오 근거가 대안보다, 대안이 가지보다 앞선다
  const pos = (id) => a.evidence.findIndex((c) => c.id === id);
  const lastPrimary = Math.max(...a.primary.sourceRefs.map(pos));
  for (const alt of a.alternatives) {
    for (const r of alt.sourceRefs) {
      if (r === a.primary.provenance.timing[0]) continue;   // 같은 국면이면 시기 근거를 함께 쓴다
      assert.ok(pos(r) > lastPrimary, `대안 근거 ${r} 가 주 시나리오보다 앞에 있다`);
    }
  }
  const lastAlt = a.alternatives.length
    ? Math.max(...a.alternatives.flatMap((x) => x.sourceRefs.map(pos))) : lastPrimary;
  for (const br of a.branches) {
    for (const st of br.steps) {
      for (const r of st.sourceRefs) assert.ok(pos(r) > lastAlt, `가지 근거 ${r} 가 앞에 있다`);
    }
  }
});
