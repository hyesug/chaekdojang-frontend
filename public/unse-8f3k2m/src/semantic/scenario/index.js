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
import { snapshotFromState, contextFor, buildBranches, conditionalStateAt } from './snapshot.js';
import { stateOf, possibleTransitions, filterByState } from './graph.js';
import { specificityGate } from './specificity.js';
import { claim, evidenceFrom, auditProvenance, resetIds } from './provenance.js';
import { composePrepared, timingAt } from './composer.js';
import { narrateScenario, auditNarration } from './narrator.js';
import { auditCoherence } from './coherence.js';
import { detailFor } from './detail.js';

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
  //
  // **오늘의 상태를 미래 전체에 미리 먹이지 않는다.** `scoreEvents` 의
  // `contextOk` 는 상태가 안 맞는 후보를 0 으로 없앤다. 여기에 오늘 상태를
  // 넣으면 지금 무직이라는 이유로 2029년 승진 후보가 **timeline 단계에서
  // 이미 사라진다** — 2027년에 취업한 뒤의 2029년을 볼 수 없게 된다.
  //
  // 그래서 원재료는 상태 중립으로 만들고, 상태는 아래 상태 기계에서
  // **단계마다** 적용한다. 상태를 모른 척하는 것이 아니라, 재료를 미리
  // 지우지 않는 것이다.
  const result = predictTimeline({ birth, from, to, currentState: null, domains: [domain] });
  const natal = readPerson(birth, { domains: [domain] });
  const natalProfile = natal.domains[domain]?.profile ?? null;

  const ph = timingPhases(result, domain);
  const phases = ph.phases;

  // ── 국면마다 갈린 것을 정리한다 ──
  const state = stateOf(domain, ctx.context);
  const transitions = possibleTransitions(domain, state);

  /** 그 국면 **전체**에서 사건 후보를 모은다 (종류마다 가장 높은 달) */
  const rawEventsOf = (p) => {
    const best = new Map();
    for (const k of p.keys ?? []) {
      for (const e of result.timeline[k]?.events ?? []) {
        if (e.domain !== domain) continue;
        const cur = best.get(e.type);
        if (!cur || e.score > cur.score) {
          best.set(e.type, { type: e.type, label: e.label, score: e.score, at: k, parts: e.parts });
        }
      }
    }
    return [...best.values()].sort((a, b) => b.score - a.score);
  };

  const resolvedSignals = phases.map((p) => {
    // 국면·충돌·사건 후보를 **한 덩어리로 묶어** 둔다. 이 셋이 흩어지면
    // 다른 국면의 방향이 이 국면의 시기에 붙는다
    const conflict = resolveConflict(result, domain, { from: p.start, to: p.end });
    const rawEvents = rawEventsOf(p);
    const f = filterByState(domain, state, rawEvents);
    return {
      phase: asPhaseShape(p),
      conflict,
      /** 상태를 적용하지 않은 시기 후보 — **지우지 않는다** */
      rawEvents,
      /** 지금 상태에서 갈 수 있는 것 (상태를 모르면 전부) */
      reachableEvents: f.kept.slice(0, 5),
      /** 상태 때문에 빠진 것. 시기 신호가 없는 것과 구별하려고 남긴다 */
      removedEvents: f.removed,
      stateKnown: f.stateKnown,
    };
  });

  // ── 어느 국면을 주 시나리오로 삼는가 ──
  // 가지도 여기서 출발해야 primary 와 1단계가 어긋나지 않는다
  const scored = resolvedSignals.map((s, i) =>
    ({ s, i, w: s.conflict.evidenceStrength * (s.phase.peakPercentile / 100) }));
  const withEvents = scored.filter((x) => x.s.reachableEvents.length);
  const ranked = (withEvents.length ? withEvents : scored).sort((a, b) => b.w - a.w);
  const primaryIndex = ranked[0]?.i ?? null;
  const primaryPhaseId = primaryIndex != null ? resolvedSignals[primaryIndex].phase.id : null;

  // ── 가지 ──
  // 시기와 방향을 따로 넘기지 않는다. 국면 덩어리를 그대로 넘겨
  // 단계마다 **그 국면의** 시기·방향·사건만 쓰게 한다
  const branching = buildBranches({ domain, snapshot, signals: resolvedSignals, primaryPhaseId });

  // ── 어디까지 내려가도 되는가 ──
  const lead = primaryIndex != null ? resolvedSignals[primaryIndex] : null;
  const leadPhase = primaryIndex != null ? phases.find((p) => p.id === primaryPhaseId) ?? null : null;
  const natalSupport = natalProfile
    ? Math.min(1, Object.values(natalProfile).filter((v) => Math.abs(v) >= 0.3).length / 4)
    : null;
  const specificity = specificityGate({
    conflict: lead?.conflict ?? null, phase: leadPhase, question,
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
    ranked, primaryIndex,
  });

  return {
    question,
    domain, from, to,
    snapshot,
    contextUsed: ctx,
    /** 위치를 말할 근거가 실제로 들어왔는가 — 없으면 아래 층이 도시를 만들 수 없다 */
    locationEvidenceUsed: locationEvidence ?? null,
    contextLocationUsed: contextLocation ?? null,
    /** 정적 해석 — 초구체화는 여기서 나온다. 새 운세 규칙을 만들지 않으려고 */
    natal: {
      domain,
      profile: natalProfile,
      leading: natal.domains[domain]?.leading ?? [],
      spokeCount: natal.domains[domain]?.spokeCount ?? 0,
      directCount: natal.domains[domain]?.directCount ?? 0,
    },
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
      /** 시기·사건 원재료는 상태를 넣지 않고 만들었다 (미리 지우지 않으려고) */
      stateNeutralTimeline: true,
      primaryPhaseId,
      primarySignalIndex: primaryIndex,
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
  const { domain, question, resolvedSignals, phaseClaims, specificity, branching, snapshot,
    ranked, primaryIndex } = o;
  if (!resolvedSignals.length || primaryIndex == null) {
    return { primary: null, alternatives: [],
      note: '국면이 없다 — "이 기간에는 뚜렷한 구간이 없다" 가 정답이다' };
  }

  const cap = specificity.allowedLevel;
  // 주 시나리오의 1단계는 **가지 A 의 1단계와 같은 것**이어야 한다.
  // 둘이 어긋나면 "2029 창업" 이라 말하고 가지는 2028 에서 시작하게 된다
  const branchA = branching.branches[0] ?? null;
  const step1 = branchA?.steps?.[0] ?? null;

  const shape = (s, i, rank, head = null) => {
    const c = s.conflict;
    const pc = phaseClaims[i];
    const ev = head ?? s.reachableEvents[0] ?? null;
    return {
      rank,
      domain,
      /** 어느 국면에서 나온 말인가 — 가지와 맞대어 볼 수 있게 남긴다 */
      phaseId: s.phase.id,
      signalIndex: i,
      /** 허용 단계까지만 채운다. 그 아래 칸은 **비운다** */
      timing: {
        grain: specificity.timing.allowed,
        window: { from: s.phase.start, to: s.phase.end },
        peak: specificity.timing.allowed === 'month' ? s.phase.peakMonth : null,
        peakPercentile: s.phase.peakPercentile,
        persistence: s.phase.persistence,
      },
      eventType: cap >= 2 ? (ev?.event ?? ev?.type ?? null) : null,
      eventLabel: cap >= 2 ? (ev?.label ?? null) : null,
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
      candidates: s.reachableEvents.map((e) => ({ type: e.type, label: e.label, score: round3(e.score) })),
      /** 시기 신호 자체가 없는 것과 상태 때문에 막힌 것을 구별한다 */
      rawCandidateCount: s.rawEvents.length,
      removedByState: s.removedEvents,
    };
  };

  const primary = shape(ranked[0].s, ranked[0].i, 1, step1);
  const alternatives = ranked.slice(1, 3).map((x, k) => shape(x.s, x.i, k + 2));

  // 1위와 2위의 근거 차이가 거의 없으면 그렇다고 적는다
  const gap = ranked.length > 1 ? ranked[0].w - ranked[1].w : 1;
  const distinct = gap > 0.1;

  // 방향이 갈렸으면 그 자체가 대안이다.
  // 다만 **그 국면에 시기 신호가 있고 지금 상태에서 갈 수 있는 방향만** 넘긴다 —
  // 충돌 기록에는 남겨 두되(체계가 실제로 그렇게 말했으니) 다음 층에는 넘기지 않는다
  const leadSignal = ranked[0].s;
  const hasSignal = new Set(leadSignal.reachableEvents.map((e) => e.type));
  const dirAlts = (primary.competingDirections ?? [])
    .filter((d) => hasSignal.has(d) && d !== primary.eventType)
    .slice(0, 2)
    .map((d, k) => ({
      rank: 90 + k, domain, sameWindowAs: 1, phaseId: primary.phaseId,
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
    /** 주 시나리오와 가지 A 가 같은 국면·같은 사건에서 출발하는가 */
    branchStart: step1
      ? { branch: branchA.id, phaseId: step1.phaseId, event: step1.event,
          matchesPrimary: step1.phaseId === primary.phaseId && step1.event === primary.eventType }
      : { branch: null, phaseId: null, event: null, matchesPrimary: primary.eventType == null,
          note: branching.note },
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

/**
 * 편의 API — 재료를 만들고 바로 조립까지 한다.
 *
 * `composer.js` 는 이 파일을 import 하지 않는다. 한쪽 방향으로만 의존한다.
 */
export function composeScenario(o = {}) {
  const prepared = prepareScenario(o);
  return { prepared, scenario: composePrepared(prepared, o.compose ?? {}) };
}

/** 재료 → 조립 → 한국어까지 한 번에. 각 층은 여전히 따로 부를 수 있다 */
export function answerScenario(o = {}) {
  const { prepared, scenario } = composeScenario(o);
  return { prepared, scenario, narration: narrateScenario(scenario, o.narrate ?? {}) };
}

export {
  composePrepared, auditCoherence, detailFor, timingAt,
  narrateScenario, auditNarration,
  interpretQuestion, resolveConflict, timingPhases, specificityGate,
  buildBranches, conditionalStateAt, snapshotFromState, contextFor, stateOf, possibleTransitions,
  filterByState, claim, evidenceFrom, auditProvenance, scoreEvents, monthNo,
};
