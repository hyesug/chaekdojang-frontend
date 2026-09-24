/**
 * scenario/index.js — **prepareScenario**. Scenario Composer 바로 앞까지
 *
 *   15체계 → 정적 해석 → timing → 사건 후보 → **여기** → Scenario Composer
 *
 * 여기서 멈춘다. 문장을 쓰는 일은 다음 층이 한다. 이 층이 하는 일은
 * **다음 층이 근거 없이 내려가지 못하게 재료를 정리해 넘기는 것**이다.
 *
 *   질문 해석   묻는 말을 공통 구조로
 *   국면        한 달의 봉우리가 아니라 준비·고비·정리
 *   충돌        갈린 것을 평균으로 지우지 않고 갈린 채로
 *   상태 기계   갈 수 없는 전이를 지움 (모르면 지우지도 않음)
 *   스냅숏·가지 예측을 사실로 승격시키지 않음
 *   구체성 게이트 어디까지 내려가도 되는가
 *   출처        각 조각이 어디서 왔는가
 */

import { predictTimeline } from '../timing/timeline.js';
import { readPerson } from '../index.js';
import { DOMAINS, DOMAIN_LABEL } from '../domains.js';
import { scoreEvents } from '../timing/events.js';
import { monthNo } from '../timing/schema.js';

import { interpretQuestion } from './question.js';
import { resolveConflict } from './conflict.js';
import { timingPhases, asPhaseShape } from './phase.js';
import { snapshotFromState, contextFor, buildBranches } from './snapshot.js';
import { stateOf, possibleTransitions, filterByState } from './graph.js';
import { specificityGate } from './specificity.js';
import { claim, evidenceFrom, auditProvenance, resetIds } from './provenance.js';

const round3 = (v) => Math.round(v * 1000) / 1000;

/**
 * Scenario Composer 가 바로 먹을 수 있는 재료를 만든다.
 *
 * @param {object} o
 *   birth         출생 정보
 *   question      자연어 질문 (없으면 domain 을 직접 줘야 한다)
 *   domain        질문 대신 분야를 직접 지정
 *   from, to      'YYYY-MM' — 없으면 질문에서 읽는다
 *   currentState  사용자가 알려준 현재 상황. **없으면 추측하지 않는다**
 *   plans         사용자가 "계획" 이라고 말한 것
 *   locationEvidence 위치를 말할 계산 근거가 실제로 있는가
 */
export function prepareScenario(o = {}) {
  const { birth, currentState = null, plans = null,
    locationEvidence = null, contextLocation = null } = o;
  resetIds();

  const question = interpretQuestion(o.question ?? '', { now: o.now });
  const domain = o.domain ?? question.domain;
  const from = o.from ?? question.horizon.from;
  const to = o.to ?? question.horizon.to;

  if (!domain || !DOMAINS.includes(domain)) {
    return {
      question, domain: null, from, to,
      timingPhases: [], resolvedSignals: [], possibleTransitions: [],
      branches: [], specificity: specificityGate({ question }), evidence: [],
      scenarioInput: { primary: null, alternatives: [] },
      note: '어느 분야를 묻는지 읽지 못했다 — 분야를 정하지 않고는 아무것도 내지 않는다',
    };
  }

  // ── 스냅숏 먼저. 예측은 여기 들어가지 않는다 ──
  const snapshot = snapshotFromState(from, currentState, plans);
  const ctx = contextFor(snapshot);

  // ── 시기 ──
  const result = predictTimeline({ birth, from, to, currentState: ctx.context, domains: [domain] });
  const natal = readPerson(birth, { domains: [domain] });
  const natalProfile = natal.domains[domain]?.profile ?? null;

  const ph = timingPhases(result, domain);
  const phases = ph.phases;

  // ── 국면마다 갈린 것을 정리한다 ──
  const state = stateOf(domain, ctx.context);
  const transitions = possibleTransitions(domain, state);

  const resolvedSignals = phases.map((p) => {
    const conflict = resolveConflict(result, domain, { from: p.start, to: p.end });
    // 그 국면의 사건 후보 — 상태로 거른다 (모르면 거르지 않는다)
    const peakCell = result.timeline[p.peak];
    const raw = peakCell?.events?.filter((e) => e.domain === domain) ?? [];
    const f = filterByState(domain, state, raw);
    return {
      phase: asPhaseShape(p),
      conflict,
      events: f.kept.slice(0, 5),
      removedEvents: f.removed,
      stateKnown: f.stateKnown,
    };
  });

  // ── 가지 ──
  const lead = resolvedSignals[0] ?? null;
  const directions = lead
    ? [lead.conflict.primaryDirection, ...lead.conflict.competingDirections].filter(Boolean)
    : [];
  const branching = buildBranches({ domain, snapshot, phases, directions });

  // ── 어디까지 내려가도 되는가 ──
  const natalSupport = natalProfile
    ? Math.min(1, Object.values(natalProfile).filter((v) => Math.abs(v) >= 0.3).length / 4)
    : null;
  const specificity = specificityGate({
    conflict: lead?.conflict ?? null, phase: phases[0] ?? null, question,
    natalSupport, locationEvidence, contextLocation,
  });

  // ── 출처 ──
  const evidence = [];
  const ctxClaims = {};
  for (const [k, v] of Object.entries(snapshot.observed)) {
    const c = claim(`현재 ${k} = ${JSON.stringify(v)}`, 'context', { value: v });
    ctxClaims[k] = c.id; evidence.push(c);
  }
  for (const [k, v] of Object.entries(snapshot.planned)) {
    evidence.push(claim(`계획: ${k} = ${JSON.stringify(v)}`, 'context',
      { value: v, caution: '계획이지 사실이 아니다' }));
  }
  const phaseClaims = resolvedSignals.map((s) => {
    const p = s.phase;
    const c = claim(
      `${p.start}~${p.end} ${DOMAIN_LABEL[domain]} 활성 (봉우리 ${p.peakMonth})`,
      'fortune',
      { level: 1, evidence: evidenceFrom(result, domain, { from: p.start, to: p.end }) });
    evidence.push(c);
    let dirId = null;
    if (s.conflict.primaryDirection && specificity.allowedLevel >= 3) {
      const d = claim(
        `방향: ${s.conflict.primaryDirection}` +
        (s.conflict.competingDirections.length
          ? ` (경쟁: ${s.conflict.competingDirections.join(', ')})` : ''),
        'derived',
        { level: 3, derivedFrom: [c.id, ...Object.values(ctxClaims)],
          caution: s.conflict.directionalAgreement === 'mixed'
            ? '방향이 갈렸다 — 하나로 단정하지 않는다' : undefined });
      evidence.push(d); dirId = d.id;
    }
    return { phase: p, claimId: c.id, directionClaimId: dirId };
  });

  // ── 다음 층이 먹을 모양 ──
  const scenarioInput = buildScenarioInput({
    domain, question, resolvedSignals, phaseClaims, specificity, branching, snapshot,
  });

  return {
    question,
    domain, from, to,
    snapshot,
    contextUsed: ctx,
    timingPhases: resolvedSignals.map((s) => s.phase),
    resolvedSignals,
    possibleTransitions: transitions.transitions,
    stateKnown: transitions.stateKnown,
    branches: branching.branches,
    branchNote: branching.note,
    specificity,
    evidence,
    provenanceAudit: auditProvenance(evidence),
    scenarioInput,
    meta: {
      phaseNote: ph.note ?? null,
      monthCount: result.meta.monthCount,
      timeKnown: result.meta.timeKnown,
      note: '여기까지가 재료다. 문장은 Scenario Composer 가 쓴다.',
      caution: '내부 점수는 근거의 두께이지 확률이 아니다.',
    },
  };
}

/**
 * primary 하나 + alternatives 최대 둘.
 *
 * **근거 차이가 거의 없으면 primary 를 세게 만들지 않는다.** 그때는
 * `distinct: false` 로 적어 다음 층이 "이쪽일 가능성이 높다"로 쓰지 못하게 한다.
 */
function buildScenarioInput(o) {
  const { domain, question, resolvedSignals, phaseClaims, specificity, branching, snapshot } = o;
  if (!resolvedSignals.length) {
    return { primary: null, alternatives: [],
      note: '국면이 없다 — "이 기간에는 뚜렷한 구간이 없다" 가 정답이다' };
  }

  const cap = specificity.allowedLevel;
  const shape = (s, i, rank) => {
    const c = s.conflict;
    const pc = phaseClaims[i];
    return {
      rank,
      domain,
      /** 허용 단계까지만 채운다. 그 아래 칸은 **비운다** */
      timing: {
        grain: specificity.timing.allowed,
        window: { from: s.phase.start, to: s.phase.end },
        peak: specificity.timing.allowed === 'month' ? s.phase.peakMonth : null,
        peakPercentile: s.phase.peakPercentile,
        persistence: s.phase.persistence,
      },
      eventType: cap >= 2 ? (s.events[0]?.type ?? c.primaryDirection ?? null) : null,
      eventLabel: cap >= 2 ? (s.events[0]?.label ?? null) : null,
      direction: cap >= 3 ? c.primaryDirection : null,
      competingDirections: cap >= 3 ? c.competingDirections : [],
      industryOrEmployment: cap >= 4 ? 'derive-from-natal' : null,
      metro: cap >= 5 ? 'derive-from-location-evidence' : null,
      district: cap >= 6 ? 'from-context-only' : null,
      company: null,                       // 어떤 경우에도 비운다
      agreement: {
        activation: c.activationAgreement,
        direction: c.directionalAgreement,
        evidenceStrength: c.evidenceStrength,
      },
      claimIds: [pc?.claimId, pc?.directionClaimId].filter(Boolean),
      candidates: s.events.map((e) => ({ type: e.type, label: e.label, score: round3(e.score) })),
      removedByState: s.removedEvents,
    };
  };

  const ranked = resolvedSignals
    .map((s, i) => ({ s, i, w: s.conflict.evidenceStrength * (s.phase.peakPercentile / 100) }))
    .sort((a, b) => b.w - a.w);

  const primary = shape(ranked[0].s, ranked[0].i, 1);
  const alternatives = ranked.slice(1, 3).map((x, k) => shape(x.s, x.i, k + 2));

  // 1위와 2위의 근거 차이가 거의 없으면 그렇다고 적는다
  const gap = ranked.length > 1 ? ranked[0].w - ranked[1].w : 1;
  const distinct = gap > 0.1;

  // 방향이 갈렸으면 그 자체가 대안이다.
  // 다만 **지금 상태에서 갈 수 없는 방향은 대안이 아니다** — 충돌 기록에는
  // 남겨 두되(체계가 실제로 그렇게 말했으니) 다음 층에 넘기지는 않는다
  const reachable = filterByState(domain, branching.startState,
    (primary.competingDirections ?? []).map((d) => ({ type: d })));
  const dirAlts = reachable.kept.map((x) => x.type).slice(0, 2).map((d, k) => ({
    rank: 90 + k, domain, sameWindowAs: 1,
    timing: primary.timing, eventType: d, direction: d,
    agreement: primary.agreement,
    note: '같은 구간, 다른 방향 — 평균으로 지우지 않고 남긴다',
    company: null,
  }));

  return {
    primary,
    alternatives: [...alternatives, ...dirAlts].slice(0, 2),
    distinct,
    stateKnown: branching.stateKnown,
    unknownFacts: snapshot.unknown,
    allowedLevel: cap,
    blocked: specificity.blocked,
    intent: question.intent,
    /** 물은 것과 엔진이 찾은 것이 다를 수 있다 — 물은 쪽을 지우지 않는다 */
    askedFor: question.targetEvents,
    answersQuestion: !question.targetEvents
      || question.targetEvents.includes(primary.eventType),
    note: distinct
      ? null
      : '1위와 2위의 근거 차이가 거의 없다 — 하나를 세게 말하지 않는다',
    caution: '비어 있는 칸(null)은 "모른다"이지 "아니다"가 아니다',
  };
}

export {
  interpretQuestion, resolveConflict, timingPhases, specificityGate,
  buildBranches, snapshotFromState, contextFor, stateOf, possibleTransitions,
  filterByState, claim, evidenceFrom, auditProvenance, scoreEvents, monthNo,
};
