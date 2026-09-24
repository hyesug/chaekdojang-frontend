/**
 * scenario/snapshot.js — **예측을 사실로 승격시키지 않는다**
 *
 * currentState 를 한 번 굳혀 미래 전체에 쓰면, 2028년 계산에 2024년 상태가
 * 들어간다. 더 나쁜 것은 그 반대다 — 앞 단계가 "2027년에 결혼" 이라고
 * 예측하면 그것이 2029년 계산에 **사실처럼** 들어간다. 그러면 근거 하나가
 * 사슬을 타고 여러 결론을 떠받치게 된다.
 *
 * 그래서 시점마다 스냅숏을 두고 출처를 네 칸으로 가른다.
 *
 *   observed   사용자가 실제로 알려준 사실
 *   planned    사용자가 "그럴 계획이다" 라고 말한 것
 *   predicted  엔진이 앞 단계에서 뽑은 것        ← 다음 계산에 넣지 않는다
 *   unknown    모른다                           ← 채우지 않는다
 *
 * 미래 사건이 다음 사건의 전제가 될 때는 사실로 만들지 않고 **가지(branch)**
 * 로 남긴다. 사귀는 중이라면 '깊어짐 → 동거 → 결혼' 과 '갈등 → 이별' 을
 * 둘 다 살려 둔다.
 */

import { monthNo } from '../timing/schema.js';
import { stateOf, possibleTransitions, STATE_GRAPH } from './graph.js';

/** 빈 스냅숏 한 벌 */
export function makeSnapshot(at, o = {}) {
  return {
    at,
    observed: { ...(o.observed ?? {}) },
    planned: { ...(o.planned ?? {}) },
    predicted: { ...(o.predicted ?? {}) },
    unknown: [...(o.unknown ?? [])],
  };
}

const CTX_KEYS = ['employmentType', 'employed', 'occupation', 'relationshipStatus',
  'maritalStatus', 'hasChildren', 'housing', 'careerState', 'movementState'];

/**
 * 사용자가 준 현재 상황을 스냅숏으로 옮긴다.
 * 말하지 않은 칸은 **`unknown` 에 이름만 적고 비운다.**
 */
export function snapshotFromState(at, currentState = null, plans = null) {
  const observed = {}; const planned = {}; const unknown = [];
  for (const k of CTX_KEYS) {
    if (currentState && currentState[k] != null) observed[k] = currentState[k];
    else if (!plans || plans[k] == null) unknown.push(k);
  }
  for (const [k, v] of Object.entries(plans ?? {})) if (v != null) planned[k] = v;
  return makeSnapshot(at, { observed, planned, unknown });
}

/**
 * 사건 후보를 거를 때 쓸 상황.
 *
 * **`predicted` 는 넣지 않는다.** 계획(`planned`)은 넣되 그렇다고 적는다 —
 * 계획은 사용자가 말한 것이라 사실에 가깝지만 아직 일어나지 않았다.
 */
export function contextFor(snapshot, { includePlanned = true } = {}) {
  const out = { ...snapshot.observed };
  const from = Object.fromEntries(Object.keys(snapshot.observed).map((k) => [k, 'observed']));
  if (includePlanned) {
    for (const [k, v] of Object.entries(snapshot.planned)) {
      if (out[k] == null) { out[k] = v; from[k] = 'planned'; }
    }
  }
  return { context: Object.keys(out).length ? out : null, sourceOf: from,
    excluded: Object.keys(snapshot.predicted),
    note: 'predicted 는 넣지 않았다 — 예측을 사실로 쓰면 근거 하나가 여러 결론을 떠받친다' };
}

/**
 * 미래 가지를 만든다.
 *
 * 한 국면에서 갈 수 있는 전이가 여럿이면 **하나로 좁히지 않고** 가지를
 * 벌린다. 각 가지의 상태 변화는 전부 `predicted` 로만 적힌다.
 *
 * ── 두 가지 순서를 가른다 ──────────────────────────────────
 * `timingPhases()` 는 **좋은 국면 순서**(봉우리 높은 순)로 준다. 가지는
 * **시간 순서**로 이어져야 한다. 둘을 같은 배열로 쓰면
 * "2029 창업 → 2028 공백" 같은 역행이 나온다. 그래서 여기서 **날짜순으로
 * 다시 세우고**, 다음 단계는 앞 단계보다 **뒤에 오는 국면만** 쓴다.
 * 뒤에 국면이 없으면 **다음 사건을 만들지 않고 끝낸다.** 한 국면을 두
 * 단계에 겹쳐 쓰지도 않는다.
 *
 * ── 조건부 시뮬레이션 ──────────────────────────────────────
 * 앞 단계가 일어났다고 **가정하면** 상태는 X 다. 그 X 에서 갈 수 있는
 * 길을 다음 후보로 본다. 이것은 가지 안에서만 성립하는 가정이고,
 * `snapshot.observed` 를 덮어쓰지 않는다. 가지 A 의 가정이 가지 B 로
 * 새지도 않는다 — 가지마다 상태를 따로 들고 간다.
 *
 * @param {object} o
 *   domain, snapshot, phases, directions  (conflict 가 고른 방향들)
 *   maxBranches  기본 3
 *   depth        한 가지에서 이어 볼 단계 수 (기본 2)
 */
export function buildBranches(o) {
  const { domain, snapshot, phases = [], directions = [], maxBranches = 3, depth = 2 } = o;
  const start = stateOf(domain, contextFor(snapshot).context);
  const p = possibleTransitions(domain, start);
  const graph = STATE_GRAPH[domain];
  if (!graph) return { domain, startState: start, stateKnown: false, branches: [], note: '이 분야에는 상태 기계가 없다' };

  // **날짜순**으로 다시 세운다. 들어온 순서(봉우리 높은 순)를 믿지 않는다
  const ordered = phases
    .filter((x) => x && x.start)
    .slice()
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));

  // 방향이 지목한 전이를 앞에 둔다. 방향이 없으면 갈 수 있는 순서대로
  const order = new Map(directions.map((d, i) => [d, i]));
  const byOrder = (a, b) => (order.get(a.event) ?? 99) - (order.get(b.event) ?? 99);

  // 같은 사건으로 가는 전이가 여럿이면 하나만
  const seen = new Set();
  const heads = [];
  for (const tr of p.transitions.slice().sort(byOrder)) {
    if (seen.has(tr.event)) continue;
    seen.add(tr.event); heads.push(tr);
    if (heads.length >= maxBranches) break;
  }

  const branches = heads.map((head, i) => {
    const steps = [];
    // **이 가지 안에서만** 굴러가는 상태. 다른 가지와 공유하지 않는다
    let state = head.from === 'unknown' ? start : head.from;
    let phaseIdx = -1;                    // 마지막으로 쓴 국면
    const usedEvents = new Set();

    const push = (tr) => {
      phaseIdx += 1;                      // 앞 단계보다 **뒤** 국면만 쓴다
      const ph = ordered[phaseIdx] ?? null;
      const before = state;
      const assumedSoFar = steps.map((s) => s.event);
      steps.push({
        event: tr.event, from: before, to: tr.to,
        // 국면이 있으면 그 구간에 얹는다. 없으면 시점을 지어내지 않는다
        window: ph ? { from: ph.start, to: ph.end, peak: ph.peak } : null,
        sourceType: 'derived',
        stateBefore: {
          value: before,
          kind: steps.length === 0 ? (p.stateKnown ? 'observed' : 'unknown') : 'predicted',
        },
        stateAfter: { value: tr.to, kind: 'predicted' },
        /** 이 단계가 성립하려면 앞의 어떤 단계가 먼저 일어나야 하는가 */
        conditionalOn: assumedSoFar,
        assumption: assumedSoFar.length
          ? `${assumedSoFar.join(' → ')} 가 실제로 일어난다는 가정`
          : (p.stateKnown ? `현재 상태가 '${before}' 라는 사실` : '현재 상태를 모른다 — 가정한 출발점'),
        note: tr.note ?? null,
      });
      state = tr.to;
      usedEvents.add(tr.event);
    };

    push(head);
    for (let d = 1; d < depth; d++) {
      // 뒤에 쓸 국면이 없으면 다음 사건을 억지로 만들지 않는다
      if (phaseIdx + 1 >= ordered.length) break;
      // **앞 단계가 일어났다고 가정한 상태**에서 갈 수 있는 길
      const next = graph.transitions
        .filter((x) => x.from === state && !usedEvents.has(x.event))
        .sort(byOrder)[0];
      if (!next) break;
      push(next);
    }

    return {
      id: String.fromCharCode(65 + i),
      label: steps.map((s) => s.event).join(' → '),
      startState: start, stateKnown: p.stateKnown,
      steps,
      /** 이 가지가 성립하려면 무엇이 먼저 참이어야 하는가 */
      assumption: p.stateKnown
        ? `현재 ${domain} 상태가 '${start}' 이라는 것`
        : '현재 상태를 듣지 못했다 — 이 가지는 상태를 가정한 것이다',
      // 두 번째 단계부터는 앞 단계가 일어났다는 가정 위에 선다
      conditionalFrom: steps.length > 1 ? steps[0].event : null,
      endState: { value: state, kind: 'predicted' },
      note: '이 가지의 상태 변화는 전부 predicted 다. 사실로 쓰지 않는다',
    };
  });

  return {
    domain, startState: start, stateKnown: p.stateKnown,
    branches,
    phaseOrder: ordered.map((x) => x.start),
    note: branches.length > 1
      ? '가지를 하나로 좁히지 않았다 — 갈린 채로 다음 층에 넘긴다'
      : (p.stateKnown ? '이 상태에서 갈 수 있는 길이 하나다' : p.note),
  };
}

/**
 * 가지의 n 번째 단계 **직전** 상태.
 *
 * 다음 층(Scenario Composer)이 "이 단계는 무엇을 전제하는가"를 물을 때
 * 쓴다. 관측이 아닌 것은 반드시 `predicted` 로 표시되어 나간다.
 */
export function conditionalStateAt(branch, stepIndex) {
  const s = branch?.steps?.[stepIndex];
  if (!s) return null;
  return {
    value: s.stateBefore.value,
    kind: s.stateBefore.kind,
    assumedEvents: s.conditionalOn,
    assumption: s.assumption,
    note: s.stateBefore.kind === 'predicted'
      ? '가정 위의 상태다 — 사실로 쓰지 않는다'
      : null,
  };
}

/** 스냅숏을 시점만 옮긴다 (관측은 그대로, 예측은 버린다) */
export function rollForward(snapshot, at) {
  if (monthNo(at) < monthNo(snapshot.at)) return snapshot;
  return makeSnapshot(at, {
    observed: snapshot.observed, planned: snapshot.planned,
    predicted: {},                   // **예측은 넘기지 않는다**
    unknown: snapshot.unknown,
  });
}
