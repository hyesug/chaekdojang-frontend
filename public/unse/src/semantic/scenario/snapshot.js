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
import { stateOf, possibleTransitions, transitionFor, STATE_GRAPH } from './graph.js';

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
 * 한 국면에서 **그 국면의 재료만으로** 고른 사건 후보.
 *
 * 세 가지를 모두 그 국면 것으로 쓴다.
 *   1. 그 국면의 `rawEvents` — 시기 신호가 실제로 있는 사건
 *   2. 그 국면의 `conflict` 방향 — 체계들이 그쪽을 가리켰는가
 *   3. 지금(또는 앞 단계를 가정한) 상태에서 갈 수 있는 전이인가
 *
 * **다른 국면의 방향을 빌려 오지 않는다.** 2029년이 창업을 가리켰다고
 * 2028년 국면에 창업을 붙이면, 시기는 2028이고 방향은 2029인 이야기가 된다.
 *
 * 1번이 비면 후보가 없다. **상태 기계에 길이 있다는 이유만으로 사건을
 * 만들지 않는다** — 그 시기에 아무 신호가 없다는 뜻이기 때문이다.
 */
export function phaseCandidates(domain, state, signal, { exclude = new Set() } = {}) {
  const support = new Set([
    signal?.conflict?.primaryDirection,
    ...(signal?.conflict?.competingDirections ?? []),
  ].filter(Boolean));

  const out = [];
  for (const e of signal?.rawEvents ?? []) {
    if (exclude.has(e.type)) continue;
    const tr = transitionFor(domain, state, e.type);
    if (!tr) continue;                       // 그 상태에서 갈 수 없는 길
    out.push({
      event: e.type, label: e.label ?? null, score: e.score ?? 0, tr,
      supported: support.has(e.type),
      phaseId: signal.phase?.id ?? signal.phase?.start ?? null,
    });
  }
  // 체계가 지지한 쪽을 먼저, 그다음 그 국면의 사건 점수 순
  out.sort((a, b) => (Number(b.supported) - Number(a.supported)) || (b.score - a.score));
  return out;
}

/**
 * 미래 가지를 만든다.
 *
 * 한 국면에서 갈 수 있는 길이 여럿이면 **하나로 좁히지 않고** 가지를
 * 벌린다. 각 가지의 상태 변화는 전부 `predicted` 로만 적힌다.
 *
 * ── 시기와 방향을 따로 넘기지 않는다 ───────────────────────
 * 전에는 `phases` 배열과 `directions` 배열을 따로 받았다. `timingPhases()`
 * 는 봉우리 높은 순으로 주고 여기서는 날짜순으로 다시 세우므로, **가장 강한
 * 국면의 방향이 가장 이른 국면에 붙는** 어긋남이 생겼다. 이제 국면·충돌·
 * 사건 후보를 한 덩어리(`signal`)로 받아 **단계마다 그 국면 것만** 쓴다.
 *
 * ── 조건부 시뮬레이션 ──────────────────────────────────────
 * 앞 단계가 일어났다고 **가정하면** 상태는 X 다. 그 X 에서 갈 수 있는
 * 길을 다음 국면의 후보와 맞댄다. 가정은 가지 안에서만 성립하고
 * `snapshot.observed` 를 덮어쓰지 않는다. 가지 A 의 가정이 가지 B 로
 * 새지도 않는다 — 가지마다 상태를 따로 들고 간다.
 *
 * @param {object} o
 *   domain, snapshot
 *   signals        [{ phase, conflict, rawEvents }] — 순서는 상관없다
 *   primaryPhaseId 어느 국면에서 시작할지 (없으면 가장 이른 국면)
 *   maxBranches    기본 3
 *   depth          한 가지에서 이어 볼 단계 수 (기본 2)
 */
export function buildBranches(o) {
  const { domain, snapshot, signals = [], maxBranches = 3, depth = 2, primaryPhaseId = null } = o;
  const start = stateOf(domain, contextFor(snapshot).context);
  const known = possibleTransitions(domain, start).stateKnown;
  if (!STATE_GRAPH[domain]) {
    return { domain, startState: start, stateKnown: false, branches: [], phaseOrder: [],
      note: '이 분야에는 상태 기계가 없다' };
  }

  // **날짜순**으로 다시 세운다. 들어온 순서(봉우리 높은 순)를 믿지 않는다
  const ordered = signals
    .filter((s) => s?.phase?.start)
    .slice()
    .sort((a, b) => String(a.phase.start).localeCompare(String(b.phase.start)));
  const phaseOrder = ordered.map((s) => s.phase.start);
  const idOf = (s) => s.phase.id ?? s.phase.start;

  const base = { domain, startState: start, stateKnown: known, phaseOrder };
  if (!ordered.length) {
    return { ...base, branches: [], note: '국면이 없다 — 시점을 지어내지 않는다' };
  }

  // primary 가 고른 국면에서 출발한다. 그래야 primary 와 가지 1단계가 어긋나지 않는다
  const at = primaryPhaseId ? ordered.findIndex((s) => idOf(s) === primaryPhaseId) : 0;
  const startIdx = at >= 0 ? at : 0;
  const head = ordered[startIdx];

  const heads = phaseCandidates(domain, start, head).slice(0, maxBranches);
  if (!heads.length) {
    return { ...base, branches: [], startPhaseId: idOf(head),
      note: `${head.phase.start} 국면에 지금 상태에서 갈 수 있는 사건 신호가 없다 — 상태 기계만 보고 만들지 않는다` };
  }

  const branches = heads.map((h, i) => {
    const steps = [];
    // **이 가지 안에서만** 굴러가는 상태. 다른 가지와 공유하지 않는다
    let state = h.tr.assumedFrom ? h.tr.from : start;
    let idx = startIdx;
    let pick = h;
    const used = new Set();

    for (;;) {
      const sig = ordered[idx];
      const before = state;
      const assumedSoFar = steps.map((s) => s.event);
      steps.push({
        event: pick.event, label: pick.label,
        from: before, to: pick.tr.to,
        phaseId: idOf(sig),
        // 시기·방향·사건이 **같은 국면**에서 나왔다
        window: { from: sig.phase.start, to: sig.phase.end, peak: sig.phase.peakMonth ?? sig.phase.peak ?? null },
        eventScore: pick.score,
        phaseDirection: sig.conflict?.primaryDirection ?? null,
        directionSupported: pick.supported,
        sourceType: 'derived',
        stateBefore: {
          value: before,
          kind: steps.length === 0 ? (known && !h.tr.assumedFrom ? 'observed' : 'unknown') : 'predicted',
        },
        stateAfter: { value: pick.tr.to, kind: 'predicted' },
        /** 이 단계가 성립하려면 앞의 어떤 단계가 먼저 일어나야 하는가 */
        conditionalOn: assumedSoFar,
        assumption: assumedSoFar.length
          ? `${assumedSoFar.join(' → ')} 가 실제로 일어난다는 가정`
          : (known ? `현재 상태가 '${before}' 라는 사실` : '현재 상태를 모른다 — 가정한 출발점'),
        note: pick.tr.note ?? null,
      });
      state = pick.tr.to;
      used.add(pick.event);

      if (steps.length >= depth) break;
      // 다음 단계는 **바로 뒤 국면**에서만 본다. 앞으로 건너뛰며 찾지 않는다
      const nextIdx = idx + 1;
      if (nextIdx >= ordered.length) break;
      const next = phaseCandidates(domain, state, ordered[nextIdx], { exclude: used })[0];
      if (!next) break;                       // 그 국면에 맞는 사건이 없으면 거기서 끝
      pick = next; idx = nextIdx;
    }

    return {
      id: String.fromCharCode(65 + i),
      label: steps.map((s) => s.event).join(' → '),
      startState: start, stateKnown: known,
      startPhaseId: steps[0].phaseId,
      steps,
      /** 이 가지가 성립하려면 무엇이 먼저 참이어야 하는가 */
      assumption: known
        ? `현재 ${domain} 상태가 '${start}' 이라는 것`
        : '현재 상태를 듣지 못했다 — 이 가지는 상태를 가정한 것이다',
      // 두 번째 단계부터는 앞 단계가 일어났다는 가정 위에 선다
      conditionalFrom: steps.length > 1 ? steps[0].event : null,
      endState: { value: state, kind: 'predicted' },
      note: '이 가지의 상태 변화는 전부 predicted 다. 사실로 쓰지 않는다',
    };
  });

  return {
    ...base, branches, startPhaseId: idOf(head),
    note: branches.length > 1
      ? '가지를 하나로 좁히지 않았다 — 갈린 채로 다음 층에 넘긴다'
      : (known ? '이 국면에서 갈 수 있는 길이 하나다' : '현재 상태를 모른다 — 출발 상태를 가정했다'),
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
