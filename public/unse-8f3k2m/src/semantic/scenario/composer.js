/**
 * scenario/composer.js — **Scenario Composer v1 (초구체화 층)**
 *
 * 새 운세 계산기가 아니다. 앞 층이 **이미 허용한 재료**를 하나의 현실적인
 * 시나리오 구조로 조립하고, **근거보다 더 구체적으로 내려가지 않는다.**
 *
 *   prepareScenario()  →  composePrepared()  →  (다음) Narrator
 *
 * ── 이 층이 하지 않는 것 ───────────────────────────────────
 *   · 사건을 새로 만들지 않는다 (그 국면의 후보에서만 고른다)
 *   · 시기를 게이트보다 잘게 말하지 않는다
 *   · 회사 이름을 만들지 않는다 — 어떤 입력에서도 `company: null`
 *   · 질문에 맞추려고 다른 후보를 대표로 끌어올리지 않는다
 *   · 근거 차이가 없는데 "유력하다"로 만들지 않는다
 *
 * ── 마지막 방어선 ──────────────────────────────────────────
 * 중간층이 실수해도 여기서 한 번 더 자른다(`sanitize`). 자른 것은 조용히
 * 넘어가지 않고 `coherence.issues` 에 남는다.
 */

import { DOMAIN_LABEL } from '../domains.js';
import { EVENT_CANDIDATES } from '../timing/events.js';
import { detailFor, DETAIL_SLOT } from './detail.js';
import { auditCoherence } from './coherence.js';

/** 시기 눈금 — 뒤로 갈수록 잘다 */
const GRAIN = ['year', 'halfyear', 'quarter', 'month'];
const grainIdx = (g) => Math.max(0, GRAIN.indexOf(g));
/** 구체성 단계 — 이 층이 실제로 채운 가장 깊은 칸 */
const LEVEL = { domain: 1, event: 2, direction: 3, detail: 4, metro: 5, district: 6, company: 7 };

const ym = (k) => ({ y: Number(String(k).slice(0, 4)), m: Number(String(k).slice(5, 7)) });
const pad2 = (n) => String(n).padStart(2, '0');

/** 사건 후보의 주의문(출산·시험 같은 자리)을 그대로 들고 온다 */
const cautionOf = (domain, type) =>
  (EVENT_CANDIDATES[domain] ?? []).find((c) => c.key === type)?.note ?? null;
const labelOf = (domain, type) =>
  (EVENT_CANDIDATES[domain] ?? []).find((c) => c.key === type)?.label ?? null;

/**
 * 국면을 허용된 눈금으로 옮긴다.
 *
 * **봉우리 달을 눈금 밖으로 흘리지 않는다.** 분기까지만 말해도 되는데
 * "5월" 이라고 적으면, 읽는 사람은 그 달을 근거 있는 값으로 받아들인다.
 */
export function timingAt(phase, grain) {
  if (!phase) return null;
  const a = ym(phase.start); const b = ym(phase.end);
  const out = { grain, from: null, to: null, peak: null, label: null };

  if (grain === 'year') {
    out.from = `${a.y}-01`; out.to = `${b.y}-12`;
    out.label = a.y === b.y ? `${a.y}년` : `${a.y}~${b.y}년`;
  } else if (grain === 'halfyear') {
    const h0 = a.m <= 6 ? 1 : 2; const h1 = b.m <= 6 ? 1 : 2;
    out.from = `${a.y}-${h0 === 1 ? '01' : '07'}`;
    out.to = `${b.y}-${h1 === 1 ? '06' : '12'}`;
    const name = (y, h) => `${y}년 ${h === 1 ? '상반기' : '하반기'}`;
    out.label = a.y === b.y && h0 === h1 ? name(a.y, h0) : `${name(a.y, h0)}~${name(b.y, h1)}`;
  } else if (grain === 'quarter') {
    const q0 = Math.ceil(a.m / 3); const q1 = Math.ceil(b.m / 3);
    out.from = `${a.y}-${pad2(q0 * 3 - 2)}`;
    out.to = `${b.y}-${pad2(q1 * 3)}`;
    out.label = a.y === b.y && q0 === q1 ? `${a.y}년 ${q0}분기` : `${a.y}년 ${q0}분기~${b.y}년 ${q1}분기`;
  } else {
    out.from = phase.start; out.to = phase.end;
    out.peak = phase.peakMonth ?? null;
    out.label = out.peak ? `${out.peak} 무렵` : `${out.from}~${out.to}`;
  }
  return out;
}

/**
 * 이 층 안에서만 쓰는 근거 번호.
 *
 * 같은 입력이면 같은 번호가 나와야 하므로 **부르는 순서를 고정한다** —
 * primary → alternatives → branches. 순서가 흔들리면 같은 시나리오인데
 * 근거 번호가 달라지고, 그러면 되짚기가 깨진다.
 *
 * 근거마다 **어느 국면 것인지**를 함께 적는다. 대안이 주 시나리오의 근거를
 * 베껴 쓰는 일을 밖에서 잡으려면 이 표시가 필요하다.
 */
function claimBook(prepared) {
  let n = 0;
  const list = [];
  const byId = new Map();
  const add = (text, sourceType, o = {}) => {
    const c = { id: `X${String(++n).padStart(3, '0')}`, claim: text, sourceType, ...o };
    list.push(c); byId.set(c.id, c); return c.id;
  };
  // 앞 층이 만든 근거 id 는 그대로 이어 쓴다
  const prior = new Set((prepared?.evidence ?? []).map((c) => c.id));
  return { add, list, byId, prior };
}

/**
 * **prepareScenario 결과를 시나리오로 조립한다.**
 *
 * @param {object} prepared prepareScenario() 반환값
 * @param {object} options  maxBranches (기본 3)
 */
export function composePrepared(prepared, options = {}) {
  const maxBranches = options.maxBranches ?? 3;
  const book = claimBook(prepared);

  const gate = prepared?.specificity ?? { allowedLevel: 0, timing: { allowed: 'year' }, blocked: [] };
  const cap = gate.allowedLevel ?? 0;
  const grain = gate.timing?.allowed ?? 'year';
  const si = prepared?.scenarioInput ?? {};
  const domain = prepared?.domain ?? null;

  const base = {
    status: 'insufficient',
    questionAnswer: {
      intent: prepared?.question?.intent ?? 'unknown',
      answersQuestion: si.answersQuestion ?? null,
      status: 'insufficient',
      note: null,
    },
    primary: null, alternatives: [], branches: [], blocked: gate.blocked ?? [],
    selectionStatus: si.distinct === false ? 'close' : 'distinct',
    evidence: book.list,
    coherence: { ok: true, issues: [] },
    meta: {
      domain, domainLabel: domain ? DOMAIN_LABEL[domain] : null,
      maxSpecificityUsed: 0, allowedLevel: cap, allowedTiming: grain,
      deterministic: true,
      note: '내부 점수는 근거의 두께이지 확률이 아니다',
    },
  };

  if (!domain || !si.primary) {
    base.questionAnswer.note = prepared?.note
      ?? prepared?.scenarioInput?.note
      ?? '이 기간에 말할 만한 구간을 찾지 못했다 — "모르겠다"가 정답이다';
    base.coherence = auditCoherence(base, prepared);
    return base;
  }

  const sp = si.primary;
  const sig = (prepared.resolvedSignals ?? []).find((s) => s.phase.id === sp.phaseId) ?? null;
  const branchA = (prepared.branches ?? [])[0] ?? null;

  // ── 시기 ──
  const timing = timingAt(sig?.phase ?? sp.timing?.window ?? null, grain)
    ?? { grain, from: sp.timing?.window?.from ?? null, to: sp.timing?.window?.to ?? null, peak: null, label: null };
  const timingRef = book.add(
    `${timing.label ?? `${timing.from}~${timing.to}`} ${DOMAIN_LABEL[domain]} 활성`,
    'fortune', { level: LEVEL.domain, phaseId: sp.phaseId, derivedFrom: sp.claimIds ?? [] });

  // ── 사건 — **새로 만들지 않는다.** 그 국면의 후보에서만 ──
  let event = null; let eventRef = null;
  if (cap >= LEVEL.event && sp.eventType) {
    const inPhase = (sig?.rawEvents ?? []).find((e) => e.type === sp.eventType) ?? null;
    if (inPhase || !sig) {
      event = {
        type: sp.eventType,
        label: labelOf(domain, sp.eventType) ?? sp.eventLabel ?? sp.eventType,
        caution: cautionOf(domain, sp.eventType),
      };
      eventRef = book.add(`사건 후보: ${event.label}`, 'fortune',
        { level: LEVEL.event, phaseId: sp.phaseId, derivedFrom: [timingRef, ...(sp.claimIds ?? [])] });
    }
  }

  // ── 방향 ──
  //
  // **사건 점수가 고른 것과 계보 표결이 고른 것은 다른 잣대다.** 둘이
  // 갈렸는데 한 시나리오 안에 나란히 두면, 다음 층이 "퇴사하는데 승진 방향"
  // 같은 문장을 만든다. 갈렸다는 사실을 따로 적고 방향은 내보내지 않는다.
  const eventWinner = event?.type ?? null;
  const voteWinner = sp.direction ?? null;
  const conflicted = !!eventWinner && !!voteWinner && eventWinner !== voteWinner;

  let direction = null; let directionRef = null; let voteRef = null;
  if (cap >= LEVEL.direction && voteWinner) {
    // 표결이 있었다는 것 자체는 사실이므로 근거는 남긴다
    voteRef = book.add(
      `계보 방향 표결: ${voteWinner}` +
      ((sp.competingDirections ?? []).length ? ` (경쟁: ${sp.competingDirections.join(', ')})` : ''),
      'derived', { level: LEVEL.direction, phaseId: sp.phaseId,
        derivedFrom: [timingRef, eventRef].filter(Boolean) });
    direction = { key: voteWinner, competing: sp.competingDirections ?? [] };
    // **갈렸으면 detail 의 근거로 쓰지 않는다.** 아래 sanitize 가 필드 자체도 지운다
    directionRef = conflicted ? null : voteRef;
  }
  const selectionConflict = (eventWinner && voteWinner)
    ? {
      eventScoreWinner: eventWinner,
      lineageVoteWinner: voteWinner,
      agreement: !conflicted,
      note: conflicted
        ? '사건 점수와 체계 방향 표결이 다르다 — 하나로 합치지 않는다'
        : '사건 점수와 체계 방향 표결이 같은 곳을 가리킨다',
      provenance: [eventRef, voteRef].filter(Boolean),
    }
    : null;

  // ── 초구체화 — 정적 프로필에서. 새 규칙을 만들지 않는다 ──
  const profile = prepared.natal?.profile ?? null;
  const { detail, why: detailWhy } = detailFor({ domain, profile, level: cap });
  const detailRefs = {};
  const profileRef = profile
    ? book.add(
      `정적 프로필 상위 축: ${(prepared.natal?.leading ?? []).map((x) => `${x.label} ${x.value}`).join(' · ') || '없음'}`,
      'fortune',
      { level: LEVEL.direction,
        evidence: [{ system: 'semantic', what: '정적 해석 프로필',
          basis: `체계 ${prepared.natal?.spokeCount ?? 0}개 · 직접근거 ${prepared.natal?.directCount ?? 0}개` }] })
    : null;
  // 갈린 방향을 상세의 근거로 삼지 않는다 — 틀린 쪽이 설명을 떠받치게 된다
  const detailProvenanceMode = conflicted
    ? 'natal_only_due_to_selection_conflict' : 'natal_and_direction';
  for (const [k, v] of Object.entries(detail)) {
    if (v == null) continue;
    detailRefs[k] = [book.add(`${k}: ${v.label}`, 'derived',
      { level: k === 'employmentSetting' || k === 'industryFamily' ? LEVEL.detail : LEVEL.direction,
        phaseId: sp.phaseId,
        derivedFrom: [profileRef, directionRef].filter(Boolean) })];
  }

  // ── 위치 — 운세로는 좁히지 않는다 ──
  const location = { metro: null, district: null, sourceType: null };
  const locationRefs = [];
  if (cap >= LEVEL.metro && prepared.locationEvidenceUsed) {
    location.metro = prepared.locationEvidenceUsed.metro ?? null;
    location.sourceType = 'fortune';
    if (location.metro) locationRefs.push(book.add(`도시권: ${location.metro}`, 'fortune',
      { level: LEVEL.metro, phaseId: sp.phaseId, evidence: [prepared.locationEvidenceUsed] }));
  }
  if (cap >= LEVEL.district && prepared.contextLocationUsed) {
    location.district = prepared.contextLocationUsed;
    location.sourceType = 'context';
    locationRefs.push(book.add(`지역: ${location.district}`, 'context',
      { level: LEVEL.district, phaseId: sp.phaseId, value: prepared.contextLocationUsed }));
  }

  // ── 사용자가 말해 준 것은 context 로만 ──
  //
  // 값마다 근거를 단다. 근거가 없으면 아래 층에서 "계산이 말한 것"과
  // 구별할 길이 사라진다. **출처는 언제나 context 다** — 앞 층이 만든
  // 근거가 있으면 그것을 이어 단다(fortune 으로 바꾸지 않는다).
  const anchor = {};
  for (const [k, v] of Object.entries(prepared.snapshot?.observed ?? {})) {
    const prior = prepared.contextClaims?.[k] ?? null;
    const ref = book.add(`알려주신 값: ${k} = ${JSON.stringify(v)}`, 'context',
      { value: v, ...(prior ? { derivedFrom: [prior] } : {}) });
    anchor[k] = { value: v, sourceType: 'context', sourceRefs: [ref] };
  }
  const contextAnchor = Object.keys(anchor).length ? anchor : null;

  // ── 조건과 모르는 것 ──
  const conditions = [];
  if (event?.caution) conditions.push({ what: event.type, note: event.caution });
  if (!prepared.stateKnown) {
    conditions.push({ what: 'currentState', note: '현재 상태를 듣지 못했다 — 갈 수 없는 길을 지우지 못했다' });
  }
  if (sig?.conflict?.directionalAgreement === 'mixed') {
    conditions.push({ what: 'direction', note: '체계들의 방향이 갈렸다 — 하나로 단정하지 않는다' });
  }
  for (const r of sig?.removedEvents ?? []) {
    conditions.push({ what: r.event, note: `지금 상태에서는 성립하지 않아 뺐다 (${r.reason})` });
  }
  // 방향 표결과 사건 점수가 다른 자리는 숨기지 않는다 — 둘은 다른 것을 잰다
  if (conflicted) {
    const hasSignal = (sig?.rawEvents ?? []).some((e) => e.type === voteWinner);
    conditions.push({
      what: 'direction_vs_event',
      note: hasSignal
        ? `체계가 가리킨 방향(${voteWinner})과 이 국면에서 점수가 가장 높은 사건(${eventWinner})이 다르다`
        : `체계가 가리킨 방향(${voteWinner})은 이 국면에 사건 신호가 없다 — 사건 쪽은 ${eventWinner} 이다`,
    });
  }
  const unknown = [
    ...(prepared.snapshot?.unknown ?? []).map((k) => ({ what: k, why: '사용자가 알려주지 않았다' })),
    ...Object.entries(detailWhy ?? {}).filter(([k]) => k !== 'gate')
      .map(([k, w]) => ({ what: k, why: w })),
  ];

  let primary = {
    phaseId: sp.phaseId,
    signalIndex: sp.signalIndex,
    timing, event, direction, detail,
    /** 사건 점수와 계보 표결이 같은 곳을 가리켰는가 — 갈렸으면 방향은 비운다 */
    selectionConflict,
    detailProvenanceMode,
    contextAnchor,
    location,
    company: null,
    conditions, unknown,
    agreement: sp.agreement,
    candidatesInPhase: sp.candidates ?? [],
    rawCandidateCount: sp.rawCandidateCount ?? null,
    provenance: {
      timing: [timingRef],
      event: eventRef ? [eventRef] : [],
      direction: directionRef ? [directionRef] : [],
      selectionConflict: selectionConflict?.provenance ?? [],
      detail: detailRefs,
      location: locationRefs,
    },
    sourceRefs: [timingRef, eventRef, voteRef, profileRef, ...locationRefs].filter(Boolean),
  };

  // ── 대안 — 기존 후보에서만 (최대 둘) ──
  //
  // **주 시나리오의 근거를 베껴 쓰지 않는다.** 대안의 사건·방향은 그 대안이
  // 선 국면에서 나온 것이므로 근거도 거기서 나와야 한다. 같은 국면을 보는
  // 대안이면 시기 근거만 함께 쓴다.
  const alternatives = (si.alternatives ?? []).slice(0, 2).map((a) => {
    const asig = (prepared.resolvedSignals ?? []).find((s) => s.phase.id === a.phaseId) ?? null;
    const sameWindow = a.phaseId === sp.phaseId;
    const t = timingAt(asig?.phase ?? null, grain) ?? timingAt(sig?.phase ?? null, grain);
    const aTimingRef = sameWindow
      ? timingRef
      : book.add(`${t?.label ?? a.phaseId} ${DOMAIN_LABEL[domain]} 활성`, 'fortune',
        { level: LEVEL.domain, phaseId: a.phaseId, derivedFrom: a.claimIds ?? [] });

    const ev = cap >= LEVEL.event && a.eventType
      ? { type: a.eventType, label: labelOf(domain, a.eventType) ?? a.eventType,
          caution: cautionOf(domain, a.eventType) }
      : null;
    const aEventRef = ev
      ? book.add(`대안 사건 후보: ${ev.label}`, 'fortune',
        { level: LEVEL.event, phaseId: a.phaseId, derivedFrom: [aTimingRef] })
      : null;
    const dir = cap >= LEVEL.direction && a.direction ? { key: a.direction, competing: [] } : null;
    const aDirRef = dir
      ? book.add(`대안 방향: ${dir.key}`, 'derived',
        { level: LEVEL.direction, phaseId: a.phaseId, derivedFrom: [aTimingRef, aEventRef].filter(Boolean) })
      : null;

    return {
      rank: a.rank, phaseId: a.phaseId,
      timing: t,
      event: ev,
      direction: dir,
      company: null,
      agreement: a.agreement,
      note: a.note ?? null,
      sameWindowAs: a.sameWindowAs ?? null,
      provenance: {
        timing: [aTimingRef],
        event: aEventRef ? [aEventRef] : [],
        direction: aDirRef ? [aDirRef] : [],
      },
      sourceRefs: [aTimingRef, aEventRef, aDirRef].filter(Boolean),
    };
  });

  // ── 가지 — 두 번째 단계부터는 조건부 ──
  const branches = (prepared.branches ?? []).slice(0, maxBranches).map((br) => ({
    id: br.id,
    startState: { value: br.startState, kind: br.stateKnown ? 'observed' : 'unknown' },
    assumption: br.assumption,
    steps: (br.steps ?? []).map((st, i) => {
      const ssig = (prepared.resolvedSignals ?? []).find((s) => s.phase.id === st.phaseId) ?? null;
      const t = timingAt(ssig?.phase ?? null, grain);
      const tRef = book.add(`${br.id}${i + 1} 시기: ${t?.label ?? st.phaseId}`, 'fortune',
        { level: LEVEL.domain, phaseId: st.phaseId, branch: br.id, step: i });
      const eRef = book.add(`${br.id}${i + 1} 사건 후보: ${labelOf(domain, st.event) ?? st.event}`,
        'fortune', { level: LEVEL.event, phaseId: st.phaseId, branch: br.id, step: i,
          derivedFrom: [tRef] });
      // 첫 단계의 상태는 사용자가 말해 준 것(또는 모름)이고,
      // 두 번째부터는 **앞 단계가 일어났다는 가정** 위에 선 예측이다
      const first = i === 0;
      const kindOk = st.stateBefore?.kind ?? (first ? 'unknown' : 'predicted');
      const sRef = book.add(
        first
          ? `${br.id}1 출발 상태: ${st.from} (${kindOk})`
          : `${br.id}${i + 1} 조건부 상태: ${st.from} — ${(st.conditionalOn ?? []).join(' → ')} 가정`,
        first && kindOk === 'observed' ? 'context' : 'derived',
        { level: LEVEL.event, phaseId: st.phaseId, branch: br.id, step: i,
          ...(first && kindOk === 'observed' ? { value: st.from } : { derivedFrom: [eRef] }) });

      return {
        event: st.event,
        label: labelOf(domain, st.event) ?? st.label ?? st.event,
        phaseId: st.phaseId,
        timing: t,
        conditional: !first,
        conditionalOn: st.conditionalOn ?? [],
        assumption: st.assumption,
        stateBefore: st.stateBefore,
        stateAfter: st.stateAfter,
        /** 이 단계의 상태가 어디서 왔는가 — 예측을 사실로 바꾸지 않는다 */
        state: {
          sourceType: first && kindOk === 'observed' ? 'context' : 'derived',
          conditionalOn: st.conditionalOn ?? [],
          kind: st.stateAfter?.kind ?? 'predicted',
        },
        caution: cautionOf(domain, st.event),
        provenance: { timing: [tRef], event: [eRef], state: [sRef] },
        sourceRefs: [tRef, eRef, sRef],
      };
    }),
    endState: br.endState,
    note: br.note,
  }));

  // ── 질문과 답이 다른가 ──
  const asked = si.askedFor ?? null;
  const matched = si.answersQuestion !== false;
  const directAlternative = !matched && asked
    ? alternatives.find((a) => asked.includes(a.event?.type))?.event?.type ?? null
    : null;
  const questionAnswer = {
    intent: prepared.question?.intent ?? 'unknown',
    askedFor: asked,
    /** 사용자가 어디까지 물었나 — 다음 층이 "무엇을 못 말하는지"를 고를 때 쓴다 */
    requested: prepared.question?.requestedSpecificity ?? null,
    askedLabel: prepared.question?.label ?? null,
    answersQuestion: si.answersQuestion ?? null,
    status: matched ? 'answers' : 'question_mismatch',
    directAlternative,
    note: matched
      ? null
      : `${prepared.question?.label ?? '물은 것'}을 물었지만 지금 신호는 다른 방향(${primary.event?.type ?? '미정'})을 가리킨다 — 질문에 맞추려고 바꾸지 않았다`,
  };

  // ── 마지막 방어선 ──
  const cut = sanitize({ primary, alternatives, branches }, { cap, grain, prepared });
  primary = cut.primary;

  const scenario = {
    ...base,
    status: questionAnswer.status === 'question_mismatch' ? 'question_mismatch' : 'composed',
    questionAnswer,
    primary,
    alternatives: cut.alternatives,
    branches: cut.branches,
    selectionStatus: si.distinct === false ? 'close' : 'distinct',
    selectionNote: si.distinct === false
      ? '1위와 2위의 근거 차이가 거의 없다 — "가장 강하다"·"유력하다"로 쓸 근거가 없다'
      : null,
    evidence: book.list,
    meta: {
      ...base.meta,
      maxSpecificityUsed: usedLevel(primary),
      sanitized: cut.issues,
    },
  };

  const audit = auditCoherence(scenario, prepared);
  // 게이트가 제 일을 해서 잘라낸 것과, 앞 층이 넘겨서 잘라낸 것을 가른다.
  // 앞의 것은 정상 동작이고 뒤의 것은 위층의 잘못이다. 둘 다 적되 `ok` 는
  // 뒤의 것에만 반응한다
  const unexpected = cut.issues.filter((x) => !EXPECTED_CUTS.has(x.code));
  scenario.coherence = {
    ok: audit.ok && !unexpected.length,
    issues: [...cut.issues, ...audit.issues],
    expectedCuts: cut.issues.filter((x) => EXPECTED_CUTS.has(x.code)).map((x) => x.code),
  };
  return scenario;
}

/** 게이트가 설계대로 잘라낸 것 — 있어도 시나리오가 어긋난 것은 아니다 */
const EXPECTED_CUTS = new Set(['cut_conflicting_direction', 'cut_branches']);

/** 이 시나리오가 실제로 내려간 가장 깊은 단계 */
function usedLevel(p) {
  if (!p) return 0;
  if (p.company) return LEVEL.company;
  if (p.location?.district) return LEVEL.district;
  if (p.location?.metro) return LEVEL.metro;
  if (p.detail?.employmentSetting || p.detail?.industryFamily) return LEVEL.detail;
  if (p.direction || Object.values(p.detail ?? {}).some((v) => v != null)) return LEVEL.direction;
  if (p.event) return LEVEL.event;
  return LEVEL.domain;
}

/**
 * 허용 단계를 넘은 칸을 잘라낸다. **자른 사실을 함께 남긴다.**
 * 중간층이 실수해도 여기가 마지막 방어선이다.
 */
export function sanitize(out, { cap, grain, prepared }) {
  const issues = [];
  const p = out.primary;
  const kill = (obj, key, code, why) => {
    if (obj?.[key] == null) return;
    obj[key] = null;
    issues.push({ code, where: key, detail: why });
  };

  if (p) {
    if (cap < LEVEL.event) {
      kill(p, 'event', 'cut_event', `허용 단계 ${cap} — 사건 종류까지 내려가지 않는다`);
    }
    if (cap < LEVEL.direction) {
      kill(p, 'direction', 'cut_direction', `허용 단계 ${cap} — 방향까지 내려가지 않는다`);
      for (const k of Object.keys(p.detail ?? {})) {
        kill(p.detail, k, 'cut_detail', `허용 단계 ${cap} — 상세까지 내려가지 않는다`);
      }
    }
    if (cap < LEVEL.detail) {
      kill(p.detail, 'employmentSetting', 'cut_detail', `허용 단계 ${cap} — 고용형태까지 내려가지 않는다`);
      kill(p.detail, 'industryFamily', 'cut_detail', `허용 단계 ${cap} — 산업군까지 내려가지 않는다`);
    }
    // 사건 점수와 계보 표결이 갈렸으면 방향을 사용자-facing 칸에서 뺀다.
    // **`selectionConflict` 자체는 지우지 않는다** — 갈렸다는 사실을 다음 층이
    // 설명할 수 있어야 한다
    if (p.selectionConflict?.agreement === false && p.direction != null) {
      p.direction = null;
      if (p.provenance) p.provenance.direction = [];
      issues.push({ code: 'cut_conflicting_direction', where: 'direction',
        detail: 'event winner 와 lineage direction winner 가 달라 direction 을 사용자-facing 필드에서 제거' });
    }
    if (cap < LEVEL.metro || !prepared?.locationEvidenceUsed) {
      kill(p.location, 'metro', 'cut_metro', '위치를 말할 계산 근거가 없다');
    }
    if (cap < LEVEL.district || !prepared?.contextLocationUsed) {
      kill(p.location, 'district', 'cut_district', '사용자가 알려준 지역이 없다');
    }
    if (!p.location.metro && !p.location.district) p.location.sourceType = null;
    // 회사는 언제나 비운다 — 여기가 마지막 자리다
    if (p.company != null) {
      p.company = null;
      issues.push({ code: 'cut_company', where: 'company', detail: '회사는 운세로 만들지 않는다' });
    }
    // 시기가 게이트보다 잘면 굵게 되돌린다
    if (p.timing && grainIdx(p.timing.grain) > grainIdx(grain)) {
      const sig = (prepared?.resolvedSignals ?? []).find((s) => s.phase.id === p.phaseId);
      p.timing = timingAt(sig?.phase ?? null, grain) ?? { ...p.timing, grain, peak: null };
      issues.push({ code: 'cut_timing', where: 'timing', detail: `${grain} 로 되돌렸다` });
    }
    if (p.timing && p.timing.grain !== 'month' && p.timing.peak) {
      p.timing.peak = null;
      issues.push({ code: 'cut_peak', where: 'timing.peak', detail: '달 눈금이 아니라 봉우리 달을 뺐다' });
    }
    // 근거가 붙지 않은 상세는 남기지 않는다
    for (const [k, v] of Object.entries(p.detail ?? {})) {
      if (v == null) continue;
      if (!(p.provenance?.detail?.[k] ?? []).length) {
        p.detail[k] = null;
        issues.push({ code: 'cut_unsourced_detail', where: `detail.${k}`, detail: '근거가 없다' });
      }
    }
  }

  for (const a of out.alternatives ?? []) {
    a.company = null;
    if (cap < LEVEL.event) a.event = null;
    if (cap < LEVEL.direction) a.direction = null;
    if (a.timing && a.timing.grain !== 'month' && a.timing.peak) a.timing.peak = null;
  }

  // 가지는 사건의 사슬이다. 사건 종류를 말할 수 없는 단계에서는 가지도 낼 수 없다
  let branches = out.branches ?? [];
  if (cap < LEVEL.event && branches.length) {
    issues.push({ code: 'cut_branches', where: 'branches',
      detail: `허용 단계 ${cap} — 사건을 말할 수 없으므로 사건의 사슬도 내지 않는다` });
    branches = [];
  }
  for (const br of branches) {
    for (const st of br.steps ?? []) {
      if (st.timing && st.timing.grain !== 'month' && st.timing.peak) st.timing.peak = null;
    }
  }
  return { ...out, branches, issues };
}

export { DETAIL_SLOT, auditCoherence };
