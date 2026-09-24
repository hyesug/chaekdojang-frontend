/**
 * scenario/graph.js — **현실에서 가능한 순서만 남긴다**
 *
 * 사건 후보는 상태를 모른다. 기혼인 사람에게 '새 만남 → 결혼' 경로를
 * 만들어 주는 일이 그래서 생긴다. 여기서 상태 기계를 두고 **갈 수 없는
 * 전이를 지운다.**
 *
 * ── 모르면 지우지도 않는다 ─────────────────────────────────
 * 현재 상태를 듣지 못했으면 `unknown` 이고, 그때는 **아무것도 지우지
 * 않는다.** 명반으로 상태를 추측하지 않는다 — 그건 근거 없이 전제를
 * 만드는 일이고, 이 저장소가 `contextOk` 에서 이미 정한 규칙이다.
 */

const t = (from, to, event, o = {}) => ({ from, to, event, ...o });

/**
 * 분야별 상태와 전이.
 *
 * `event` 는 `timing/events.js` 의 후보 key 다. 둘을 같은 이름으로 묶어야
 * 사건 후보와 전이가 따로 놀지 않는다.
 */
export const STATE_GRAPH = {
  career: {
    states: ['unknown', 'unemployed', 'employed', 'freelance', 'business', 'career_break'],
    transitions: [
      t('unemployed', 'employed', 'first_job'),
      t('unemployed', 'freelance', 'freelance'),
      t('unemployed', 'business', 'business_start'),
      t('employed', 'employed', 'role_change'),
      t('employed', 'employed', 'promotion'),
      t('employed', 'employed', 'job_change'),
      t('employed', 'career_break', 'resignation'),
      t('employed', 'freelance', 'freelance'),
      t('employed', 'business', 'business_start'),
      t('freelance', 'employed', 'return_to_work'),
      t('freelance', 'business', 'business_start'),
      t('freelance', 'career_break', 'career_break'),
      t('business', 'employed', 'return_to_work'),
      t('business', 'career_break', 'career_break'),
      t('career_break', 'employed', 'return_to_work'),
      t('career_break', 'freelance', 'freelance'),
      t('career_break', 'business', 'business_start'),
    ],
  },

  relationship: {
    states: ['unknown', 'single', 'dating', 'cohabiting', 'engaged', 'married', 'separated'],
    transitions: [
      t('single', 'dating', 'new_relationship'),
      t('dating', 'dating', 'relationship_deepening'),
      t('dating', 'dating', 'conflict'),
      t('dating', 'cohabiting', 'cohabitation'),
      t('dating', 'single', 'breakup'),
      t('cohabiting', 'cohabiting', 'relationship_deepening'),
      t('cohabiting', 'cohabiting', 'conflict'),
      t('cohabiting', 'single', 'breakup'),
      t('engaged', 'engaged', 'relationship_deepening'),
      t('engaged', 'single', 'breakup'),
      t('single', 'dating', 'reconciliation', { note: '헤어진 상대와 다시' }),
      t('separated', 'separated', 'conflict'),
      t('separated', 'single', 'breakup'),
      // 기혼은 '새 만남' 으로 가지 않는다. 그 경로를 여기 두지 않는 것이
      // 곧 만들지 않는다는 뜻이다
      t('married', 'married', 'relationship_deepening'),
      t('married', 'married', 'conflict'),
      t('married', 'separated', 'breakup'),
    ],
  },

  marriage: {
    states: ['unknown', 'single', 'dating', 'engaged', 'married', 'separated'],
    transitions: [
      t('dating', 'dating', 'marriage_preparation'),
      t('dating', 'engaged', 'engagement_like_transition'),
      t('engaged', 'married', 'marriage'),
      t('dating', 'married', 'marriage'),
      t('single', 'dating', 'marriage_preparation', { note: '상대가 있어야 다음이 있다' }),
      t('separated', 'dating', 'marriage_preparation'),
      t('separated', 'married', 'marriage'),
    ],
  },

  residence: {
    states: ['unknown', 'family_home', 'rental', 'owned', 'cohabiting'],
    transitions: [
      t('family_home', 'rental', 'independence_from_family'),
      t('family_home', 'rental', 'move'),
      t('family_home', 'owned', 'home_purchase_related'),
      t('rental', 'rental', 'move'),
      t('rental', 'rental', 'rental_change'),
      t('rental', 'owned', 'home_purchase_related'),
      t('rental', 'cohabiting', 'cohabitation_move'),
      t('owned', 'owned', 'move'),
      t('owned', 'cohabiting', 'cohabitation_move'),
      t('cohabiting', 'rental', 'move'),
      t('cohabiting', 'owned', 'home_purchase_related'),
    ],
  },

  movement: {
    states: ['unknown', 'settled', 'mobile'],
    transitions: [
      t('settled', 'mobile', 'regional_move'),
      t('settled', 'settled', 'short_move'),
      t('settled', 'mobile', 'abroad'),
      t('mobile', 'mobile', 'regional_move'),
      t('mobile', 'mobile', 'short_move'),
      t('mobile', 'mobile', 'abroad'),
      t('mobile', 'settled', 'short_move'),
    ],
  },

  children: {
    states: ['unknown', 'no_children', 'child_related_transition', 'parenting'],
    transitions: [
      t('no_children', 'child_related_transition', 'pregnancy_related'),
      t('child_related_transition', 'parenting', 'birth'),
      t('parenting', 'parenting', 'parenting_transition'),
      t('parenting', 'parenting', 'child_related_change'),
      t('parenting', 'child_related_transition', 'pregnancy_related'),
    ],
  },
};

/**
 * 사용자가 알려준 상황을 상태로 옮긴다.
 * **말해 주지 않은 것은 `unknown` 이다.** 명반으로 메우지 않는다.
 */
export function stateOf(domain, ctx) {
  if (!ctx) return 'unknown';
  const g = STATE_GRAPH[domain];
  if (!g) return 'unknown';

  const rel = ctx.relationshipStatus ?? null;
  const mar = ctx.maritalStatus ?? null;

  switch (domain) {
    case 'career': {
      if (ctx.careerState && g.states.includes(ctx.careerState)) return ctx.careerState;
      const e = ctx.employmentType;
      if (e === 'none') return 'unemployed';
      if (e === 'freelance') return 'freelance';
      if (e === 'business' || e === 'self_employed') return 'business';
      if (e === 'employed' || e === 'salaried') return 'employed';
      if (ctx.employed === true) return 'employed';
      if (ctx.employed === false) return 'unemployed';
      return 'unknown';
    }
    case 'relationship':
    case 'marriage': {
      if (mar === 'married') return 'married';
      if (mar === 'separated' || mar === 'divorced') return 'separated';
      if (rel && g.states.includes(rel)) return rel;
      if (mar === 'single' && !rel) return 'single';
      return 'unknown';
    }
    case 'residence':
      return g.states.includes(ctx.housing) ? ctx.housing : 'unknown';
    case 'movement':
      return ctx.movementState && g.states.includes(ctx.movementState) ? ctx.movementState : 'unknown';
    case 'children':
      if (ctx.hasChildren === true) return 'parenting';
      if (ctx.hasChildren === false) return 'no_children';
      return 'unknown';
    default:
      return 'unknown';
  }
}

/**
 * 그 상태에서 갈 수 있는 전이.
 * 상태를 모르면 **전부 돌려주고 모른다고 적는다** — 지우지도, 고르지도 않는다.
 */
export function possibleTransitions(domain, state) {
  const g = STATE_GRAPH[domain];
  if (!g) return { domain, state: 'unknown', stateKnown: false, transitions: [], note: '이 분야에는 상태 기계가 없다' };
  if (!state || state === 'unknown') {
    return { domain, state: 'unknown', stateKnown: false, transitions: g.transitions.slice(),
      note: '현재 상태를 듣지 못했다 — 아무 경로도 지우지 않았고, 상태를 추측하지도 않았다' };
  }
  return { domain, state, stateKnown: true, transitions: g.transitions.filter((x) => x.from === state) };
}

/**
 * 사건 후보 목록에서 **갈 수 없는 것**을 지운다.
 * 상태를 모르면 하나도 지우지 않는다.
 */
export function filterByState(domain, state, events) {
  const p = possibleTransitions(domain, state);
  if (!p.stateKnown) {
    return { kept: events.slice(), removed: [], stateKnown: false, state: 'unknown', note: p.note };
  }
  const reachable = new Set(p.transitions.map((x) => x.event));
  const kept = []; const removed = [];
  for (const e of events) {
    const key = e.type ?? e.key ?? e;
    // 상태 기계에 아예 없는 사건은 이 분야의 상태로 가릴 수 없다 — 남긴다
    const known = STATE_GRAPH[domain].transitions.some((x) => x.event === key);
    if (!known || reachable.has(key)) kept.push(e);
    else removed.push({ event: key, reason: `${state} 상태에서는 갈 수 없는 전이` });
  }
  return { kept, removed, stateKnown: true, state };
}

/** 한 전이가 실제로 가능한가 (테스트·후속 층용) */
export const canTransition = (domain, from, event) =>
  (STATE_GRAPH[domain]?.transitions ?? []).some((x) => x.from === from && x.event === event);

/**
 * 그 상태에서 그 사건으로 가는 전이 하나.
 *
 * 상태를 모르면(`unknown`) **그 사건을 쓰는 전이 아무거나** 돌려주고
 * 출발 상태를 가정했다고 적는다. 모른다고 길을 막아 버리면 "모르면
 * 아무것도 못 한다"가 되고, 그건 모른다는 것과 다른 말이다.
 */
export function transitionFor(domain, from, event) {
  const all = STATE_GRAPH[domain]?.transitions ?? [];
  if (!from || from === 'unknown') {
    const any = all.find((x) => x.event === event);
    return any ? { ...any, assumedFrom: true } : null;
  }
  return all.find((x) => x.from === from && x.event === event) ?? null;
}
