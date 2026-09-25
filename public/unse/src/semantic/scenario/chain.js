/**
 * scenario/chain.js — **사건은 홀로 오지 않는다**
 *
 * 이직은 대개 불만 → 지원 → 입사 → 수입 변화 → (때로) 이사로 이어지고,
 * 결혼은 깊어짐 → 동거 이야기 → 거처 정리 → 준비 → 혼인으로 이어진다.
 * 사건을 하나씩 따로 찍으면 그 순서가 사라진다.
 *
 * ── 그래도 지어내지 않는다 ─────────────────────────────────
 * 사슬의 각 칸은 **가지(branch)가 이미 고른 단계**이고, 그 단계마다
 * 국면(시기)이 붙어 있어야 칸이 된다. 뒤 칸은 앞 칸이 일어났다는 가정
 * 위에 선다(`conditional: true`). 딸려 오는 다른 분야는 **켜질 수 있는
 * 후보**로만 적고 확정하지 않는다.
 *
 * ── 순서가 가능한가 ────────────────────────────────────────
 * `checkTemporalConsistency()` 가 상태 기계로 그 순서가 성립하는지 본다.
 * "2028 이별 → 2029 결혼"은 가능하고 "2029 결혼 → 2028 이별"은 시간이
 * 거꾸로 간다. 불가능한 사슬은 지우고 왜 지웠는지 적는다.
 */

import { STATE_GRAPH, transitionFor, crossDomainOf } from './graph.js';
import { attributesOf, PHASE_ROLE } from './attributes.js';

const monthNo = (k) => {
  const [y, m] = String(k ?? '').split('-').map(Number);
  return Number.isFinite(y) && Number.isFinite(m) ? y * 12 + (m - 1) : null;
};

/**
 * 한 가지를 사슬로 편다.
 *
 * @param {object} branch composePrepared() 가 낸 가지
 * @param {string} domain
 * @returns {{domain, branchId, scenarioChain, crossDomain, consistency}}
 */
export function chainOf(branch, domain) {
  const steps = branch?.steps ?? [];
  const scenarioChain = steps.map((st, i) => ({
    order: i + 1,
    event: st.event,
    label: st.label ?? st.event,
    window: st.timing?.label ?? null,
    from: st.timing?.from ?? null,
    to: st.timing?.to ?? null,
    phaseId: st.phaseId ?? null,
    /** 뒤 칸은 앞 칸이 일어났다는 가정 위에 선다 */
    conditional: i > 0,
    conditionalOn: st.conditionalOn ?? [],
    stateAfter: st.stateAfter ?? null,
    attributes: attributesOf(st.event),
    sourceRefs: st.sourceRefs ?? [],
  }));

  // 딸려 올 수 있는 다른 분야 — **후보일 뿐 확정이 아니다**
  const seen = new Set();
  const crossDomain = [];
  for (const c of scenarioChain) {
    for (const x of crossDomainOf(c.event)) {
      const key = `${c.event}>${x.domain}`;
      if (seen.has(key)) continue;
      seen.add(key);
      crossDomain.push({
        from: c.event, domain: x.domain, why: x.why ?? null,
        reason: x.reason ?? null, window: c.window,
        status: 'candidate_activation',
        note: '이 분야도 함께 봐야 한다는 뜻이지, 그 일이 일어난다는 뜻이 아니다',
      });
    }
  }

  // Composer 의 가지는 출발 상태를 `{value, kind}` 로 싸서 준다
  const start = typeof branch?.startState === 'object'
    ? branch.startState?.value : branch?.startState;

  return {
    domain, branchId: branch?.id ?? null,
    scenarioChain, crossDomain,
    phaseRoles: PHASE_ROLE,
    consistency: checkTemporalConsistency(scenarioChain, domain, start ?? 'unknown'),
  };
}

/** 가지들을 사슬로 펴고, 순서가 성립하지 않는 것은 빼 둔다 */
export function buildChains(scenario, { max = 3 } = {}) {
  const domain = scenario?.meta?.domain ?? null;
  const out = [];
  const dropped = [];
  for (const br of (scenario?.branches ?? []).slice(0, max)) {
    const c = chainOf(br, domain);
    (c.consistency.ok ? out : dropped).push(c);
  }
  return {
    domain, chains: out, dropped,
    note: dropped.length
      ? '순서가 성립하지 않는 사슬은 뺐다 — 왜 뺐는지는 consistency 에 적혀 있다'
      : null,
  };
}

/**
 * 이 순서가 실제로 가능한가.
 *
 *   · 시간이 거꾸로 가지 않는가
 *   · 상태 기계에서 그 전이가 이어지는가
 *   · 같은 사건을 두 번 세지 않았는가
 *
 * @param {Array} chain  [{event, from, to, ...}]
 * @param {string} domain
 * @param {string} startState 모르면 'unknown'
 */
export function checkTemporalConsistency(chain, domain, startState = 'unknown') {
  const issues = [];
  const g = STATE_GRAPH[domain];
  let prevEnd = null;
  let state = startState ?? 'unknown';
  const used = new Set();

  chain.forEach((c, i) => {
    // ── 시간 ──
    const from = monthNo(c.from);
    const to = monthNo(c.to);
    if (from != null && to != null && to < from) {
      issues.push({ code: 'window_inverted', at: i, detail: `${c.from}~${c.to}` });
    }
    if (prevEnd != null && from != null && from <= prevEnd) {
      issues.push({ code: 'out_of_order', at: i,
        detail: `${c.event} 가 앞 단계보다 뒤에 오지 않는다` });
    }
    if (to != null) prevEnd = to;

    // ── 같은 사건을 두 번 ──
    if (used.has(c.event)) issues.push({ code: 'repeated_event', at: i, detail: c.event });
    used.add(c.event);

    // ── 상태 전이 ──
    if (!g) return;
    const tr = transitionFor(domain, state, c.event);
    if (!tr) {
      issues.push({ code: 'impossible_transition', at: i,
        detail: `${state} 에서 ${c.event} 로 갈 수 없다` });
      return;
    }
    state = tr.to;
  });

  return {
    ok: issues.length === 0, issues,
    endState: state,
    stateKnown: (startState ?? 'unknown') !== 'unknown',
    note: 'predicted 상태 위의 검사다 — 실제로 그렇게 된다는 뜻이 아니다',
  };
}
