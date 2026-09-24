/**
 * scenario/evidence.js — **왜 그렇게 봤는지 물으면 그 자리만 꺼낸다**
 *
 * 근거를 전부 쏟아 놓으면 아무것도 읽히지 않는다. "왜 이직이라고 봐?"와
 * "왜 2028년이야?"와 "왜 대전이야?"는 서로 다른 자리를 묻는 말이고, 답도
 * 그 자리만 나와야 한다.
 *
 * ── 고르기만 한다 ──────────────────────────────────────────
 * 여기서 새 근거를 만들지 않는다. 시나리오가 이미 들고 있는 근거 가운데
 * 그 물음에 해당하는 것만 추린다. 없으면 **없다고 답한다.**
 *
 * ── 출처를 섞지 않는다 ─────────────────────────────────────
 * 같은 문단에 놓더라도 fortune · context · reality · derived 를 갈라
 * 적는다. "대전"이 사용자가 말해 준 것인지 계산이 짚은 것인지가
 * 여기서 흐려지면 아래 층은 되돌릴 방법이 없다.
 */

/** 물을 수 있는 것들 */
export const QUESTION_TYPES = [
  'why_event', 'why_timing', 'why_direction', 'why_location',
  'why_not_narrower', 'why_conflict', 'why_alternative',
];

const byIdOf = (scenario) => new Map((scenario?.evidence ?? []).map((c) => [c.id, c]));

const pick = (scenario, refs) => {
  const by = byIdOf(scenario);
  const out = [];
  const seen = new Set();
  for (const r of refs ?? []) {
    if (!r || seen.has(r)) continue;
    const c = by.get(r);
    if (!c) continue;
    seen.add(r);
    out.push({
      id: c.id, sourceType: c.sourceType, claim: c.claim,
      ...(c.evidence ? { systems: c.evidence.map((e) => ({ system: e.system, what: e.what, basis: e.basis })) } : {}),
      ...(c.value !== undefined && c.sourceType === 'context' ? { value: c.value } : {}),
      ...(c.derivedFrom ? { derivedFrom: c.derivedFrom } : {}),
    });
  }
  return out;
};

const group = (items) => {
  const g = { fortune: [], context: [], reality: [], derived: [] };
  for (const x of items) (g[x.sourceType] ?? g.derived).push(x);
  return g;
};

/**
 * 그 물음에 해당하는 근거만 고른다.
 *
 * @param {object} o
 *   scenario      composePrepared() 결과
 *   questionType  QUESTION_TYPES 중 하나
 *   realityMatch  matchReality() 결과 (선택 — 있으면 현실 근거도 함께 고른다)
 */
export function selectEvidence(o = {}) {
  const { scenario, questionType, realityMatch = null } = o;
  const p = scenario?.primary ?? null;
  const base = {
    questionType, answerable: false, refs: [], items: [], bySource: group([]),
    note: null, blocked: null,
  };
  if (!QUESTION_TYPES.includes(questionType)) {
    return { ...base, note: `모르는 물음 종류: ${questionType}` };
  }
  if (!p) return { ...base, note: '고를 근거가 없다 — 시나리오가 비어 있다' };

  let refs = [];
  let note = null;
  let blocked = null;

  switch (questionType) {
    case 'why_event':
      // 사건을 그렇게 본 까닭 — 활성·방향·그 국면의 후보
      refs = [...(p.provenance?.event ?? []), ...(p.provenance?.direction ?? []),
        ...(p.provenance?.timing ?? [])];
      if (!p.event) note = '어떤 사건인지까지 좁히지 않았다 — 그 물음에 답할 근거가 없다';
      break;

    case 'why_timing':
      // 시기 근거만. 체계별 근거가 달려 있으면 그것이 알맹이다
      refs = p.provenance?.timing ?? [];
      break;

    case 'why_direction':
      refs = [...(p.provenance?.direction ?? []), ...(p.provenance?.selectionConflict ?? [])];
      if (!p.direction) {
        note = p.selectionConflict?.agreement === false
          ? '사건 점수와 체계 방향 표결이 갈려 방향을 하나로 적지 않았다'
          : '방향까지 좁힐 근거가 없다';
      }
      break;

    case 'why_location':
      refs = p.provenance?.location ?? [];
      if (!p.location?.metro && !p.location?.district) {
        blocked = (scenario.blocked ?? []).filter((b) => [5, 6].includes(b.level));
        note = '위치를 짚을 근거가 없다 — 계산이 도시를 말하지 않았다';
      }
      break;

    case 'why_conflict':
      refs = p.provenance?.selectionConflict ?? [];
      if (!p.selectionConflict) note = '갈린 자리가 없다';
      break;

    case 'why_alternative':
      refs = (scenario.alternatives ?? [])
        .flatMap((a) => [...(a.provenance?.timing ?? []), ...(a.provenance?.event ?? [])]);
      if (!refs.length) note = '남은 다른 흐름이 없다';
      break;

    case 'why_not_narrower':
      // 왜 더 못 좁히는가 — 근거가 아니라 막힌 자리를 보여 준다
      blocked = scenario.blocked ?? [];
      refs = Object.values(p.provenance?.detail ?? {}).flat();
      note = '더 좁히지 못하는 까닭은 근거가 거기서 끊기기 때문이다';
      break;

    default:
      break;
  }

  const items = pick(scenario, refs);

  // 현실 자료를 썼으면 **따로** 적는다. 운세 근거와 같은 칸에 두지 않는다
  let reality = null;
  if (realityMatch && ['why_location', 'why_event', 'why_alternative'].includes(questionType)) {
    const used = (realityMatch.primaryMatches ?? []).filter((m) => m.eligible);
    const ids = new Set(used.flatMap((m) => m.provenance?.reality ?? []));
    reality = (realityMatch.evidence ?? []).filter((c) => ids.has(c.id)).map((c) => ({
      id: c.id, sourceType: 'reality', field: c.field, value: c.value,
      candidateId: c.candidateId, sourceId: c.sourceId,
    }));
    if (reality.length) {
      note = [note, '현실 후보에서 온 것은 따로 적었다 — 운세가 짚은 것이 아니다']
        .filter(Boolean).join(' ');
    }
  }

  return {
    questionType,
    answerable: items.length > 0 || (blocked?.length ?? 0) > 0,
    refs: items.map((x) => x.id),
    items,
    bySource: group(items),
    ...(reality?.length ? { reality } : {}),
    blocked,
    note,
  };
}

/**
 * 사용자가 "왜?"라고 물었을 때 무엇을 묻는 것인지 고른다.
 *
 * **지명을 알아맞히지 않는다.** "왜 대전이야?"의 '대전'이 지명인 줄 알려면
 * 지명 사전이 있어야 하고, 그 추론은 이 층의 일이 아니다. 대신 이미 아는
 * 지명(사용자가 말해 준 지역·현실 후보의 지역)을 `places` 로 받아 맞춘다.
 *
 * @param {string} text
 * @param {{places?: string[]}} o 이미 아는 지명들
 */
export function questionTypeOf(text, o = {}) {
  const t = String(text ?? '');
  for (const pl of o.places ?? []) {
    if (pl && t.includes(pl)) return 'why_location';
  }
  if (/어디|지역|도시/.test(t)) return 'why_location';
  if (/왜 그 ?때|왜 \d{4}|언제.*왜|시기.*왜/.test(t)) return 'why_timing';
  if (/갈린|다르게|why.*conflict|왜 갈/.test(t)) return 'why_conflict';
  if (/다른 |대안|또 뭐/.test(t)) return 'why_alternative';
  if (/더 좁|더 구체|왜 모/.test(t)) return 'why_not_narrower';
  if (/방향|어느 쪽/.test(t)) return 'why_direction';
  return 'why_event';
}
