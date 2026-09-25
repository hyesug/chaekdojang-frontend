/**
 * scenario/reality.js — **Reality Matcher Core v1**
 *
 *   fortune  →  넓은 시나리오   (앞 층이 만든다)
 *   reality  →  실제 후보        (밖에서 정규화되어 들어온다)
 *   matcher  →  **둘이 얼마나 맞물리는가**
 *
 * 인터넷을 뒤지는 층이 아니다. 이미 수집·정규화되어 들어온 실제 공고·회사·
 * 지역을 시나리오와 맞대 보기만 한다. 다음 단계에서 provider adapter 가
 * 붙는다.
 *
 * ── 절대 하지 않는 것 ──────────────────────────────────────
 * **현실 자료를 운세 근거로 되먹이지 않는다.** "대전 A회사 백엔드 공고"를
 * 보고 "당신은 대전 A회사로 간다"로 바꾸는 일이 이 층에서 가장 쉽게
 * 일어나는 사고다. 그래서
 *
 *   · 시나리오의 대표 사건·순위를 바꾸지 않는다 (현실이 더 잘 맞아도)
 *   · 시나리오가 비워 둔 칸(위치 null)에 현실 값을 채워 넣지 않는다
 *   · 회사·지역 같은 초구체 값은 **reality 출처일 때만** 나온다
 *   · 확률을 만들지 않는다 — 맞은 칸 수와 비교 가능한 칸 수를 따로 낸다
 *   · 자유문장을 분류하지 않는다. 정규화는 adapter 의 몫이고 여기서는
 *     값이 없으면 `unknown` 이다 (mismatch 가 아니다)
 */

import { HEALTH_FORBIDDEN, CERTAINTY_FORBIDDEN } from './coherence.js';

/** 후보의 종류 */
export const CANDIDATE_KINDS = ['opportunity', 'entity', 'fact'];

/** 분야마다 맞대 볼 수 있는 상세 칸 (Composer 가 실제로 내는 것만) */
export const COMPARABLE_FIELDS = {
  career: ['roleFamily', 'workStyle', 'employmentSetting', 'industryFamily'],
  relationship: ['relationshipStyle'], marriage: ['marriageDetail'],
  children: ['childrenMode'], education: ['educationMode'], wealth: ['wealthMode'],
  residence: ['residenceMode'], movement: ['movementMode'], health: ['healthMode'],
  majorChange: ['changeMode'],
};

const CAUTION =
  '실제 후보와 시나리오의 호환성을 본 것이며, 입사·합격·미래 결과를 뜻하지 않는다';

const ym = (s) => String(s ?? '').slice(0, 7);
const asKey = (v) => (v && typeof v === 'object' ? v.key ?? null : v ?? null);

/** 되짚을 수 있는 현실 근거 번호 — 후보 id 순으로 매겨 입력 순서에 흔들리지 않는다 */
function realityBook() {
  let n = 0;
  const list = [];
  const add = (candidate, field, value) => {
    const id = `R${String(++n).padStart(3, '0')}`;
    list.push({
      id, sourceType: 'reality',
      candidateId: candidate.id ?? null,
      sourceId: candidate.source?.id ?? null,
      provider: candidate.source?.provider ?? null,
      retrievedAt: candidate.source?.retrievedAt ?? null,
      field, value,
    });
    return id;
  };
  return { add, list };
}

/**
 * 이 후보를 쓸 수 있는가.
 * **출처가 없는 현실 자료는 쓰지 않는다** — 회사 이름 같은 초구체 값이
 * 어디서 왔는지 말할 수 없으면 그것은 근거가 아니라 소문이다.
 */
export function eligibilityOf(candidate, scenario) {
  const domain = scenario?.meta?.domain ?? null;
  if (!candidate || typeof candidate !== 'object') {
    return { eligible: false, reason: 'not_a_candidate' };
  }
  if (!candidate.id) return { eligible: false, reason: 'missing_candidate_id' };
  if (!candidate.source?.id || candidate.source?.sourceType !== 'reality') {
    return { eligible: false, reason: 'missing_reality_source' };
  }
  if (!CANDIDATE_KINDS.includes(candidate.kind)) {
    return { eligible: false, reason: 'unknown_candidate_kind' };
  }
  if (domain && candidate.domain && candidate.domain !== domain) {
    return { eligible: false, reason: 'domain_mismatch' };
  }

  // ── 고위험 분야는 실제 자료와 촘촘히 맞대지 않는다 ──
  const text = JSON.stringify({
    n: candidate.company?.name ?? null, t: candidate.title ?? null,
    l: candidate.label ?? null, c: candidate.category ?? null,
  });
  if (domain === 'health') {
    if (HEALTH_FORBIDDEN.test(text) || candidate.medical === true) {
      return { eligible: false, reason: 'health_medical_candidate_blocked' };
    }
    if (candidate.category !== 'wellness') {
      return { eligible: false, reason: 'health_wellness_only' };
    }
  }
  if (domain === 'children' && (candidate.assertsEvent === true || CERTAINTY_FORBIDDEN.test(text))) {
    return { eligible: false, reason: 'children_actual_event_not_matched' };
  }
  if (domain === 'education' && candidate.result != null) {
    return { eligible: false, reason: 'education_result_not_available' };
  }
  return { eligible: true, reason: null };
}

/** 기회(공고)의 유효 기간이 그 구간과 겹치는가 */
export function timeRelationOf(candidate, timing) {
  if (candidate.kind !== 'opportunity') return 'not_applicable';
  const v = candidate.validity;
  if (!v?.from && !v?.to) return 'undated';
  const from = ym(v.from ?? v.to);
  const to = ym(v.to ?? v.from);
  const wf = ym(timing?.from);
  const wt = ym(timing?.to);
  if (!wf || !wt) return 'undated';
  return from <= wt && to >= wf ? 'overlap' : 'outside_window';
}

/** 시나리오가 값을 낸 칸만 맞대 본다. 후보에 값이 없으면 **모름**이다 */
function compareDetail(scenarioDetail, candidateDetail, fields) {
  const matches = []; const contradictions = []; const unknown = [];
  for (const f of fields) {
    const s = asKey(scenarioDetail?.[f]);
    if (s == null) continue;                       // 시나리오가 비운 칸은 비교하지 않는다
    const r = asKey(candidateDetail?.[f]);
    if (r == null) { unknown.push(f); continue; }  // 모르는 것은 어긋난 것이 아니다
    (s === r ? matches : contradictions).push({ field: f, scenario: s, reality: r });
  }
  return { matches, contradictions, unknown };
}

/**
 * 후보마다 현실 근거를 **한 번만** 매긴다.
 *
 * 갈래(primary·alternative)마다 다시 매기면 같은 회사 이름이 갈래 수만큼
 * 다른 번호를 갖게 되어 되짚기가 흐려진다. 후보 id 순으로 한 번 매기고
 * 모든 갈래가 그것을 가리킨다.
 */
function mintClaims(sorted, scenario, book) {
  const map = new Map();
  const fields = COMPARABLE_FIELDS[scenario.meta?.domain] ?? [];
  for (const c of sorted) {
    if (!eligibilityOf(c, scenario).eligible) { map.set(c.id, null); continue; }
    const e = { company: null, metro: null, district: null, supports: null, validity: null, detail: {} };
    if (c.company?.name) e.company = book.add(c, 'company.name', c.company.name);
    if (c.location?.metro) e.metro = book.add(c, 'location.metro', c.location.metro);
    if (c.location?.district) e.district = book.add(c, 'location.district', c.location.district);
    if (Array.isArray(c.supportsEvents)) e.supports = book.add(c, 'supportsEvents', c.supportsEvents);
    if (c.validity) e.validity = book.add(c, 'validity', c.validity);
    for (const f of fields) {
      const v = asKey(c.detail?.[f]);
      if (v != null) e.detail[f] = book.add(c, `detail.${f}`, v);
    }
    map.set(c.id, e);
  }
  return map;
}

/** 한 후보를 한 갈래(primary / alternative)에 맞대 본다 */
function evaluate(track, ref, candidate, scenario, claims, options) {
  const domain = scenario.meta?.domain ?? null;
  const fields = COMPARABLE_FIELDS[domain] ?? [];
  const el = eligibilityOf(candidate, scenario);

  const eventType = ref.event?.type ?? null;
  const supports = Array.isArray(candidate.supportsEvents) ? candidate.supportsEvents : null;
  const eventMatch = !!eventType && !!supports && supports.includes(eventType);
  const timeRelation = timeRelationOf(candidate, ref.timing);
  // 공고는 그 구간에 살아 있을 때만 '바로 맞는 후보'다. 회사 자체(entity)는
  // 성격 비교에만 쓴다 — "2028년에 그 회사가 뽑는다"는 근거가 아니다
  const directTemporalMatch = candidate.kind === 'opportunity' && timeRelation === 'overlap';
  const matchMode = !eventMatch ? 'not_direct'
    : directTemporalMatch ? 'direct' : 'illustrative_only';

  const cmp = compareDetail(ref.detail ?? {}, candidate.detail, fields);
  const comparableCount = cmp.matches.length + cmp.contradictions.length;
  const scenarioFieldCount = fields.filter((f) => asKey(ref.detail?.[f]) != null).length;

  // ── 현실에서만 나올 수 있는 값 ──
  const e = claims.get(candidate.id) ?? null;
  const reality = {};
  const realityRefs = [];
  if (el.eligible && e) {
    if (candidate.company?.name) {
      realityRefs.push(e.company);
      reality.company = {
        value: candidate.company.name, sourceType: 'reality',
        claimMode: 'matched_candidate_not_prediction',
      };
    }
    if (candidate.location?.metro || candidate.location?.district) {
      realityRefs.push(e.metro, e.district);
      reality.location = {
        metro: candidate.location.metro ?? null, district: candidate.location.district ?? null,
        sourceType: 'reality', claimMode: 'matched_candidate_not_prediction',
      };
    }
    realityRefs.push(e.supports, e.validity);
    for (const m of [...cmp.matches, ...cmp.contradictions]) realityRefs.push(e.detail[m.field]);
  }

  // 시나리오가 위치를 짚지 않았으면 **현실 후보의 위치일 뿐**이다
  const locationMatch = {
    scenarioSpecified: !!(ref.location?.metro),
    scenarioValue: ref.location?.metro ?? null,
    realityValue: candidate.location?.metro ?? null,
    matched: !!(ref.location?.metro && candidate.location?.metro
      && ref.location.metro === candidate.location.metro),
    note: ref.location?.metro
      ? null
      : '현실 후보의 위치일 뿐 운세가 짚은 위치가 아니다',
  };

  // 사용자 조건은 **context** 다. 운세 근거가 아니고 순위도 바꾸지 않는다
  const contextFit = matchContext(candidate, options?.contextConstraints);

  const scenarioRefs = [
    ...(ref.provenance?.timing ?? []),
    ...(eventMatch ? ref.provenance?.event ?? [] : []),
    ...[...cmp.matches, ...cmp.contradictions]
      .flatMap((m) => ref.provenance?.detail?.[m.field] ?? []),
  ];

  return {
    candidateId: candidate.id ?? null,
    track,
    trackRank: ref.rank ?? null,
    phaseId: ref.phaseId ?? null,
    kind: candidate.kind ?? null,
    eligible: el.eligible,
    ...(el.eligible ? {} : { reason: el.reason }),
    matchMode: el.eligible ? matchMode : 'not_eligible',
    event: { scenario: eventType, reality: supports, match: eventMatch },
    timeRelation,
    directTemporalMatch,
    compatibility: {
      matches: cmp.matches.map((m) => m.field),
      contradictions: cmp.contradictions.map((m) => m.field),
      unknown: cmp.unknown,
      detail: [...cmp.matches, ...cmp.contradictions],
      matchedCount: cmp.matches.length,
      comparableCount,
      scenarioFieldCount,
      /** 맞은 칸 ÷ 맞대 본 칸. **확률이 아니다** */
      coverage: comparableCount ? Math.round((cmp.matches.length / comparableCount) * 100) / 100 : null,
      /** 맞대 본 칸 ÷ 시나리오가 낸 칸 — 모르는 것이 많은 후보를 가려낸다 */
      informationDepth: scenarioFieldCount
        ? Math.round((comparableCount / scenarioFieldCount) * 100) / 100 : null,
      scoreType: 'heuristic_compatibility_not_probability',
    },
    locationMatch,
    contextFit,
    reality: el.eligible ? reality : {},
    provenance: { scenario: [...new Set(scenarioRefs)], reality: realityRefs.filter(Boolean) },
    caution: CAUTION,
  };
}

/** 사용자가 준 조건과 맞는가 — 기록만 하고 순위는 건드리지 않는다 */
function matchContext(candidate, constraints) {
  if (!constraints) return null;
  const matches = []; const contradictions = []; const unknown = [];
  for (const [k, want] of Object.entries(constraints)) {
    const got = k === 'region'
      ? (candidate.location?.metro ?? candidate.location?.district ?? null)
      : asKey(candidate.detail?.[k] ?? candidate[k]);
    if (got == null) { unknown.push(k); continue; }
    const ok = Array.isArray(want) ? want.includes(got) : want === got;
    (ok ? matches : contradictions).push({ field: k, want, got });
  }
  return { sourceType: 'context', matches, contradictions, unknown,
    note: '사용자가 준 조건이고 운세 근거가 아니다' };
}

/** 사전식 정렬 — 가중치를 만들지 않는다 */
function rank(a, b) {
  const hard = (x) => (x.eligible ? 0 : 1);
  const bool = (x) => (x ? 0 : 1);
  return hard(a) - hard(b)
    || bool(a.event.match) - bool(b.event.match)
    || bool(a.directTemporalMatch) - bool(b.directTemporalMatch)
    // 맞은 칸이 많은 쪽이 먼저다. 모르는 것이 많아 "틀린 게 없는" 후보가
    // 자동으로 1위가 되지 않게 하는 자리다
    || b.compatibility.matchedCount - a.compatibility.matchedCount
    || a.compatibility.contradictions.length - b.compatibility.contradictions.length
    || (b.compatibility.coverage ?? 0) - (a.compatibility.coverage ?? 0)
    || b.compatibility.comparableCount - a.compatibility.comparableCount
    || String(a.candidateId).localeCompare(String(b.candidateId));
}

/**
 * 시나리오와 실제 후보를 맞댄다.
 *
 * @param {object} scenario   composePrepared() 결과 (문장이 아니라 구조를 쓴다)
 * @param {Array}  candidates 정규화되어 들어온 실제 후보
 * @param {object} options    contextConstraints, maxPerTrack
 */
export function matchReality(scenario, candidates = [], options = {}) {
  const maxPerTrack = options.maxPerTrack ?? 5;
  const book = realityBook();
  const base = {
    status: 'insufficient',
    scenarioRef: null,
    primaryMatches: [], alternativeMatches: [],
    evidence: book.list,
    audit: { ok: true, issues: [] },
    meta: {
      deterministic: true, probability: false,
      candidateCount: Array.isArray(candidates) ? candidates.length : 0,
      eligibleCount: 0,
      note: '현실 후보는 시나리오를 바꾸지 않는다 — 맞물리는 정도만 본다',
      caution: CAUTION,
    },
  };

  if (!scenario) return { ...base, status: 'unsafe_input' };
  if (scenario.coherence?.ok === false) {
    return { ...base, status: 'unsafe_input',
      audit: { ok: false, issues: [{ code: 'upstream_incoherent' }] } };
  }
  const p = scenario.primary;
  if (!p) return base;

  // 후보 id 순으로 본다 — 들어온 순서가 근거 번호를 흔들지 않게
  const sorted = (Array.isArray(candidates) ? candidates : [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => String(a?.id ?? '').localeCompare(String(b?.id ?? '')));

  // 현실 근거는 후보마다 한 번만 매긴다 (갈래마다 다시 매기지 않는다)
  const claims = mintClaims(sorted, scenario, book);

  const primaryMatches = sorted
    .map((c) => evaluate('primary', p, c, scenario, claims, options))
    .sort(rank)
    .slice(0, maxPerTrack);

  // 대안은 **대안 갈래로만** 남는다. 현실에서 잘 맞아도 대표로 올리지 않는다
  const alternativeMatches = (scenario.alternatives ?? []).map((a) => ({
    track: 'alternative',
    rank: a.rank ?? null,
    phaseId: a.phaseId ?? null,
    eventType: a.event?.type ?? null,
    /** 현실이 아무리 잘 맞아도 여기는 언제나 거짓이다 */
    promotedToPrimary: false,
    matches: sorted
      .map((c) => evaluate('alternative', a, c, scenario, claims, options))
      .sort(rank)
      .slice(0, maxPerTrack),
  }));

  // 물은 것과 다른 답이었으면 그 사실을 그대로 들고 간다
  const qa = scenario.questionAnswer ?? {};
  if (qa.answersQuestion === false) {
    const da = qa.directAlternative ?? null;
    const hit = alternativeMatches.find((x) => x.eventType === da);
    if (hit) hit.track = 'direct_question_alternative';
  }

  const eligibleCount = sorted.filter((c) => eligibilityOf(c, scenario).eligible).length;
  const anyDirect = primaryMatches.some((m) => m.eligible && m.matchMode === 'direct');
  const anyUsable = primaryMatches.some((m) => m.eligible && m.event.match);

  const result = {
    ...base,
    status: qa.answersQuestion === false ? 'question_mismatch'
      : anyDirect || anyUsable ? 'matched' : 'no_match',
    scenarioRef: {
      domain: scenario.meta?.domain ?? null,
      phaseId: p.phaseId ?? null,
      eventType: p.event?.type ?? null,
      /** 이 층이 바꾸지 않았다는 표시 */
      unchangedByReality: true,
    },
    questionAnswer: {
      answersQuestion: qa.answersQuestion ?? null,
      askedFor: qa.askedFor ?? null,
      directAlternative: qa.directAlternative ?? null,
    },
    primaryMatches, alternativeMatches,
    evidence: book.list,
    meta: { ...base.meta, eligibleCount },
  };
  result.audit = auditRealityMatch(result, scenario, sorted);
  if (result.audit.severe?.length) result.status = 'unsafe_match';
  return result;
}

/**
 * 결과가 선을 넘지 않았는지 본다.
 * 넘었으면 `unsafe_match` 로 두고 무엇이 넘었는지 적는다.
 */
export function auditRealityMatch(result, scenario, candidates = []) {
  const issues = []; const severe = [];
  const add = (code, detail, bad = false) => { issues.push({ code, detail }); if (bad) severe.push(code); };
  const p = scenario?.primary ?? null;
  const ids = new Set((result?.evidence ?? []).map((c) => c.id));
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const all = [
    ...(result?.primaryMatches ?? []),
    ...(result?.alternativeMatches ?? []).flatMap((a) => a.matches ?? []),
  ];

  // 1. 시나리오의 대표 사건이 바뀌지 않았는가
  if (p && result?.scenarioRef?.eventType !== (p.event?.type ?? null)) {
    add('scenario_event_changed', '현실 후보를 보고 대표 사건을 바꿨다', true);
  }
  // 2. 대안을 대표로 올리지 않았는가
  for (const a of result?.alternativeMatches ?? []) {
    if (a.promotedToPrimary) add('alternative_promoted', `${a.eventType}`, true);
  }
  // 12. 물은 것과 다른 답을 숨기지 않았는가
  if (scenario?.questionAnswer?.answersQuestion === false
    && result?.questionAnswer?.answersQuestion !== false) {
    add('question_mismatch_hidden', '물은 것과 다른 답인데 그렇게 적지 않았다', true);
  }

  for (const m of all) {
    const c = byId.get(m.candidateId);
    // 3. 출처 없는 후보가 초구체 값을 내지 않았는가
    if (!m.eligible && (m.reality?.company || m.reality?.location)) {
      add('ineligible_exposes_exact', `${m.candidateId}`, true);
    }
    // 4~5. 회사·위치는 reality 출처여야 하고, 운세가 짚은 것처럼 적히면 안 된다
    for (const k of ['company', 'location']) {
      const v = m.reality?.[k];
      if (!v) continue;
      if (v.sourceType !== 'reality') add(`${k}_not_reality_source`, `${m.candidateId}`, true);
      if (v.claimMode !== 'matched_candidate_not_prediction') {
        add(`${k}_claim_mode_wrong`, `${m.candidateId}`, true);
      }
      if ((m.provenance?.reality ?? []).length === 0) {
        add(`${k}_without_reality_ref`, `${m.candidateId}`, true);
      }
    }
    // 9. 후보에 없는 회사·지역을 만들지 않았는가
    if (m.reality?.company && m.reality.company.value !== c?.company?.name) {
      add('company_not_in_candidate', `${m.candidateId}`, true);
    }
    if (m.reality?.location?.metro && m.reality.location.metro !== c?.location?.metro) {
      add('location_not_in_candidate', `${m.candidateId}`, true);
    }
    // 6~7. 기간이 안 겹치는 공고·회사 자체를 '바로 맞는 후보'로 올리지 않았는가
    if (m.directTemporalMatch && m.timeRelation !== 'overlap') {
      add('temporal_match_without_overlap', `${m.candidateId}`, true);
    }
    if (m.kind !== 'opportunity' && m.matchMode === 'direct') {
      add('entity_as_future_opportunity', `${m.candidateId}`, true);
    }
    // 11. 사건이 안 맞는데 바로 맞는 후보로 통과시키지 않았는가
    if (!m.event.match && m.matchMode === 'direct') {
      add('event_contradiction_as_direct', `${m.candidateId}`, true);
    }
    // 10. 시나리오가 비운 칸을 현실 값으로 채우지 않았는가
    if (!m.locationMatch?.scenarioSpecified && m.locationMatch?.matched) {
      add('location_backfilled', `${m.candidateId}`, true);
    }
    // 8. 없는 근거를 가리키지 않았는가
    for (const r of m.provenance?.reality ?? []) {
      if (!ids.has(r)) add('dangling_reality_ref', r, true);
    }
    // 사용자 조건을 운세 근거로 바꾸지 않았는가
    if (m.contextFit && m.contextFit.sourceType !== 'context') {
      add('context_not_context_source', `${m.candidateId}`, true);
    }
  }

  // 13. 확률처럼 읽히는 값이 없는가
  const text = JSON.stringify(result ?? {});
  if (/"probability"\s*:\s*(?!false)/.test(text) || /확률|가능성\s*\d|\d+\s*%/.test(text)) {
    add('probability_language', '확률처럼 읽히는 값이 있다', true);
  }

  return { ok: issues.length === 0, issues, severe };
}
