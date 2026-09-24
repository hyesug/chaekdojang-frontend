/**
 * scenario/narrator.js — **Narrator v1**. 구조를 한국어로 옮긴다
 *
 *   composePrepared()  →  narrateScenario()  →  사람이 읽는 답
 *
 * 새 운세 계산기가 아니다. **Composer 가 주지 않은 것은 여기에도 없다.**
 * 여기서 새로 추론하는 사실·사건·시기·직업·지역은 하나도 없고, 문장은 전부
 * 붙박이 틀에 시나리오 값을 끼워 만든다(같은 입력이면 같은 문장).
 *
 * ── 말투 ───────────────────────────────────────────────────
 * 점쟁이식 수사도, 내부 변수명도 쓰지 않는다.
 *   × 운명의 문이 열립니다 / 강한 기운이 당신을 이끕니다
 *   × allowedLevel 은 4 입니다 / eventScoreWinner 는 resignation 입니다
 *   ○ 이 계산에서는 이 시기를 직업 변화가 두드러지는 구간으로 봅니다
 *
 * ── 맞물린 규칙 ────────────────────────────────────────────
 *   · `null` 은 "아니다"가 아니라 **"여기까지는 좁힐 근거가 없다"** 다
 *   · Composer 보다 잘게 말하지 않는다 (분기까지면 달을 말하지 않는다)
 *   · 확정으로 말하지 않는다 (퇴사합니다 ×, 퇴사 쪽 후보가 잡힙니다 ○)
 *   · 내부 점수를 확률로 옮기지 않는다 (상위 95% → 가능성 95% ×)
 *   · `coherence.ok === false` 면 답을 만들지 않는다 (fail-closed)
 */

import { EVENT_CANDIDATES } from '../timing/events.js';
import { HEALTH_FORBIDDEN, CERTAINTY_FORBIDDEN, COMPANY_LIKE } from './coherence.js';

const labelOf = (domain, key) =>
  (EVENT_CANDIDATES[domain] ?? []).find((c) => c.key === key)?.label ?? key ?? null;

/** 분야별 상세 칸을 부르는 말 */
const SLOT_WORD = {
  relationshipStyle: '관계의 결', marriageDetail: '결혼 쪽 결', childrenMode: '자녀 쪽 결',
  educationMode: '학업의 결', wealthMode: '재물의 결', residenceMode: '주거의 결',
  movementMode: '이동의 결', healthMode: '몸 쪽 결', changeMode: '전환의 결',
};

/** 분야마다 반드시 덧붙이는 선 — 확정으로 읽히지 않게 */
const DOMAIN_CAVEAT = {
  health: '진단이나 질환을 말하는 것이 아니라, 몸에 실리는 부담의 흐름까지입니다.',
  children: '임신이나 출산이 일어난다는 뜻이 아니라, 그와 관련된 생활 변화가 부각되는 구간이라는 뜻입니다.',
  education: '결과가 정해진다는 뜻은 아닙니다. 붙고 떨어지는 것은 바깥 상대가 정합니다.',
  wealth: '수익을 보장한다는 뜻이 아니라 재정 변동이 커지는 흐름이라는 뜻입니다.',
};

/**
 * 문장 하나 — 어떤 값을 읽어 만들었는지 함께 들고 다닌다.
 *
 * `requiresSource` 를 **문장마다 직접 적는다.** 전에는 `kind` 목록으로
 * 판정했는데, 그러면 새 종류를 더할 때마다 또 빠진다. 시나리오의 구체
 * 값(시기·사건·상세·대안·가지·알려준 값·위치·갈림의 양쪽)을 문장에 넣었으면
 * 참이고, "회사까지는 좁힐 수 없습니다" 처럼 새 사실을 주장하지 않는
 * 안내·한계 문장은 거짓이다.
 */
const S = (kind, text, sourceRefs = [], o = {}) => ({
  kind, text, sourceRefs: sourceRefs.filter(Boolean),
  requiresSource: o.requiresSource ?? false,
});
/** 값을 말하는 문장 */
const V = (kind, text, sourceRefs) => S(kind, text, sourceRefs, { requiresSource: true });

/** `requiresSource` 가 안 적힌 옛 문장을 위한 뒷받침 */
const FACTUAL = new Set(['answer', 'timing', 'event', 'detail', 'alternative', 'branch', 'conflict']);
const needsSource = (s) => s.requiresSource === true
  || (s.requiresSource === undefined && FACTUAL.has(s.kind));

/** 그 근거들 가운데 이 출처인 것만 */
const refsOf = (scenario, refs, sourceType) => {
  const by = new Map((scenario?.evidence ?? []).map((c) => [c.id, c]));
  return (refs ?? []).filter((r) => by.get(r)?.sourceType === sourceType);
};

const SECTION_OF = {
  answer: 'answer', mismatch: 'answer',
  timing: 'timing', event: 'timing',
  detail: 'detail', context: 'detail',
  supporting: 'supporting',
  reality: 'reality',
  conflict: 'alternatives', close: 'alternatives', alternative: 'alternatives',
  branch: 'branches',
  limit: 'uncertainty', caveat: 'uncertainty',
};
const SECTION_ORDER = ['answer', 'timing', 'detail', 'supporting', 'reality',
  'alternatives', 'branches', 'uncertainty'];

/** 모드별로 어떤 절까지 싣는가. **어느 모드도 새 사실을 만들지 않는다** */
const MODES = {
  short: new Set(['answer', 'timing']),
  // 실제 자료를 붙여 물었으면 그 절은 기본 모드에서도 뺄 수 없다
  normal: new Set(['answer', 'timing', 'detail', 'supporting', 'reality', 'alternatives', 'uncertainty']),
  full: new Set(SECTION_ORDER),
};

/** 모드와 상관없이 남는 문장 — 갈림·불일치·주의는 줄일 대상이 아니다 */
const ALWAYS_KEEP = new Set(['mismatch', 'conflict', 'close', 'caveat']);

const FAIL_TEXT =
  '현재 계산 결과 안에 서로 맞지 않는 부분이 있어, 구체적인 답을 만들지 않았습니다.';

/**
 * 시나리오를 한국어로 옮긴다.
 *
 * @param {object} scenario composePrepared() 결과
 * @param {object} options  detail: 'short' | 'normal' | 'full'
 */
export function narrateScenario(scenario, options = {}) {
  const mode = MODES[options.detail] ? options.detail : 'normal';
  const want = MODES[mode];

  const fail = (status, text, issues = []) => ({
    status, text,
    sections: Object.fromEntries(SECTION_ORDER.map((k) => [k, k === 'answer' ? text : ''])),
    sentences: [S('answer', text)],
    meta: { deterministic: true, generatedFacts: 0, mode, auditOk: issues.length === 0, issues },
  });

  if (!scenario) return fail('unsafe_input', FAIL_TEXT, [{ code: 'no_scenario' }]);
  // 앞 층이 어긋났다고 말하면 그것을 적당히 다듬어 답으로 만들지 않는다
  if (scenario.coherence?.ok === false) {
    return fail('unsafe_input', FAIL_TEXT,
      (scenario.coherence.issues ?? []).map((x) => ({ code: `upstream:${x.code}`, where: x.where })));
  }

  const p = scenario.primary;
  const domain = scenario.meta?.domain ?? null;
  const dl = scenario.meta?.domainLabel ?? '이 분야';
  const qa = scenario.questionAnswer ?? {};
  const asked = qa.requested ?? {};

  if (!p) {
    const t = scenario.status === 'insufficient'
      ? (qa.note ?? '이 기간에는 뚜렷하게 잡히는 구간이 없습니다. 여기서는 모르겠다고 답하는 것이 맞습니다.')
      : '답을 만들 재료가 모자랍니다.';
    return { ...fail('insufficient', t), status: 'insufficient' };
  }

  const out = [];
  const grain = p.timing?.grain ?? 'year';
  const when = p.timing?.label ?? `${p.timing?.from}~${p.timing?.to}`;
  const tRef = p.provenance?.timing ?? [];
  const eRef = p.provenance?.event ?? [];

  // ── ① 질문에 바로 답한다 ──
  if (qa.answersQuestion === false) {
    const askedName = qa.askedLabel ?? (qa.askedFor?.length ? labelOf(domain, qa.askedFor[0]) : null);
    const gotName = p.event?.label ?? null;
    if (askedName && gotName) {
      out.push(V('mismatch',
        `${askedName} 시기를 물으셨지만, 이 계산에서는 ${askedName}보다 ${gotName} 쪽 신호가 먼저 잡힙니다.`,
        eRef));
    } else {
      out.push(S('mismatch', '물으신 것과 이 계산이 짚는 자리가 다릅니다.'));
    }
    if (askedName) {
      // 시기 값을 그대로 쓰므로 시기 근거가 따라붙는다
      out.push(V('mismatch', `그래서 이 결과만으로 "${when}에 ${askedName}한다"고 답하기는 어렵습니다.`, tRef));
    } else {
      out.push(S('mismatch', '그래서 물으신 것에 그대로 답하기는 어렵습니다.'));
    }
    if (qa.directAlternative) {
      // 주 시나리오 근거를 베끼지 않는다 — 그 대안 자신의 근거를 찾는다
      const hit = (scenario.alternatives ?? []).find((a) => a.event?.type === qa.directAlternative);
      out.push(V('mismatch',
        `물으신 쪽(${labelOf(domain, qa.directAlternative)})은 아래 다른 흐름에 남아 있습니다.`,
        hit?.provenance?.event ?? []));
    }
  } else if (p.event) {
    out.push(V('answer', `이 계산에서 ${dl} 쪽 변화가 가장 두드러지는 구간은 ${when}입니다.`, tRef));
  } else {
    out.push(V('answer', `${when}에 ${dl} 쪽이 움직이는 신호가 두드러집니다.`, tRef));
    out.push(S('answer', '다만 그 움직임이 어떤 사건인지까지 좁힐 근거는 모자랍니다.'));
  }

  // ── ② 시기 · 사건 · 상세 ──
  if (qa.answersQuestion === false) {
    out.push(V('timing', `그 신호가 실리는 구간은 ${when}입니다.`, tRef));
  }
  if (p.event) {
    out.push(V('event', `이 구간에서는 ${p.event.label} 쪽 사건 후보가 잡힙니다.`, eRef));
    if (p.event.caution) out.push(S('caveat', p.event.caution, eRef));
  }
  if (DOMAIN_CAVEAT[domain]) out.push(S('caveat', DOMAIN_CAVEAT[domain]));

  const d = p.detail ?? {};
  const dref = (k) => p.provenance?.detail?.[k] ?? [];
  if (d.roleFamily) out.push(V('detail', `일의 성격은 ${d.roleFamily.label} 쪽으로 읽힙니다.`, dref('roleFamily')));
  if (d.workStyle) out.push(V('detail', `역할은 ${d.workStyle.label}에 가깝습니다.`, dref('workStyle')));
  if (d.employmentSetting) {
    out.push(V('detail', `버는 방식은 ${d.employmentSetting.label}입니다.`, dref('employmentSetting')));
  }
  if (d.industryFamily) {
    out.push(V('detail', `산업군까지 보면 ${d.industryFamily.label} 언저리입니다.`, dref('industryFamily')));
  }
  for (const [k, w] of Object.entries(SLOT_WORD)) {
    if (!d[k]) continue;
    // SLOT_WORD 는 모두 '결' 로 끝난다 (받침 있음) — 조사는 '은'
    out.push(V('detail', `${w}은 ${d[k].label} 쪽이 두드러집니다.`, dref(k)));
  }
  if (domain === 'career' && !d.roleFamily && (scenario.meta?.allowedLevel ?? 0) >= 3) {
    out.push(S('limit', '어떤 일의 갈래인지는 축이 한쪽으로 모이지 않아 좁히지 않았습니다.'));
  }

  // 사용자가 말해 준 것과 계산이 말한 것을 섞지 않는다
  const occAnchor = p.contextAnchor?.occupation ?? null;
  if (occAnchor?.value) {
    out.push(V('context',
      `지금 ${occAnchor.value}로 일하고 있다는 것은 알려주신 사실이고, 계산이 맞힌 것이 아닙니다. 위 이야기는 그 전제를 함께 놓고 읽은 것입니다.`,
      occAnchor.sourceRefs ?? []));
  }

  // ── ②-b 딸려 오는 분야 — 주 사건이 켠 것만, 한 단계 얕게 ──
  for (const s of options.supporting?.reads ?? []) {
    if (!s.activation?.band) continue;
    const what = s.detail?.label ?? null;
    out.push(V('supporting',
      what
        ? `${s.label} 쪽은 같은 구간에서 ${s.activation.join ?? s.activation.label}, 결로는 ${what} 쪽입니다.`
        : `${s.label} 쪽은 같은 구간에서 ${s.activation.label}`,
      // 곁가지는 그 분야를 따로 계산한 것이라 주 시나리오의 근거를 빌리지 않는다
      [...(p.provenance?.timing ?? [])]));
    if (s.candidate) {
      out.push(S('caveat',
        `${s.label} 쪽에서는 ${s.candidate.label} 후보가 잡히지만, 그 분야를 따로 물어본 것이 아니라 이 사건에 딸려 본 것입니다.`));
    }
  }

  // ── ②-c 현실 후보 — **운세가 짚은 것이 아니다** ──
  const rm = options.realityMatch ?? null;
  if (rm) out.push(...realitySentences(rm, dl));

  // ── ③ 갈림 ──
  const sc = p.selectionConflict;
  if (sc && sc.agreement === false) {
    // 양쪽 승자를 모두 말하므로 **양쪽 근거를 모두** 단다
    out.push(V('conflict',
      `사건 후보 점수로는 ${labelOf(domain, sc.eventScoreWinner)} 쪽이 잡히지만, 체계별 방향 표결은 ${labelOf(domain, sc.lineageVoteWinner)} 쪽으로 갈렸습니다.`,
      sc.provenance ?? p.provenance?.selectionConflict ?? []));
    out.push(S('conflict', '두 신호가 같은 결론을 내는 상태가 아니라서, 방향은 하나로 적지 않았습니다.',
      sc.provenance ?? p.provenance?.selectionConflict ?? []));
  }
  if (scenario.selectionStatus === 'close') {
    out.push(S('close', '한쪽이 뚜렷하게 앞선 결과는 아닙니다. 비슷한 수준의 흐름이 함께 남아 있습니다.'));
  }

  // ── ④ 다른 흐름 — **각 대안의 자기 시기**를 쓴다 ──
  const alts = (scenario.alternatives ?? []).filter((a) => a.event);
  if (alts.length) {
    const parts = alts.map((a) => `${a.timing?.label ?? ''} ${a.event.label}`.trim());
    out.push(V('alternative', `다른 흐름으로는 ${parts.join(', ')} 쪽도 남아 있습니다.`,
      alts.flatMap((a) => [...(a.provenance?.timing ?? []), ...(a.provenance?.event ?? [])])));
  }

  // ── ⑤ 조건부 미래 ──
  const seen = new Set();
  for (const br of (scenario.branches ?? []).slice(0, 3)) {
    const sig = (br.steps ?? []).map((x) => x.event).join('>');
    if (!sig || seen.has(sig)) continue;
    seen.add(sig);
    const [s1, s2] = br.steps;
    if (!s1) continue;
    const refs = [...(s1.provenance?.timing ?? []), ...(s1.provenance?.event ?? [])];
    if (!s2) {
      out.push(V('branch',
        `${s1.timing?.label ?? ''} 무렵 ${s1.label} 쪽으로 가는 흐름이 하나 있습니다.`.trim(), refs));
      continue;
    }
    // 두 단계의 시기·사건을 모두 말하고, 조건부 상태도 말하므로 state 근거까지 단다
    out.push(V('branch',
      `${s1.timing?.label ?? ''} 무렵 ${s1.label} 쪽으로 간다면, 그 단계가 실제로 일어난다는 전제에서 ${s2.timing?.label ?? ''}에는 ${s2.label} 쪽 신호를 볼 수 있습니다.`.trim(),
      [...refs, ...(s2.provenance?.timing ?? []), ...(s2.provenance?.event ?? []),
        ...(s2.provenance?.state ?? [])]));
  }
  if (seen.size) {
    out.push(S('caveat', '뒤 단계는 앞 단계가 일어난다는 가정 위의 이야기이고, 정해진 순서가 아닙니다.'));
  }

  // ── ⑥ 어디까지 모르는가 — **질문과 관련 있는 것만** ──
  if (asked.location) {
    if (!p.location?.metro) {
      out.push(S('limit',
        `${dl} 변화의 방향까지는 볼 수 있지만, 어느 도시로 옮기는지까지 좁힐 위치 근거는 이 계산에 없습니다.`));
    } else {
      out.push(V('detail', `방위 계산으로는 ${p.location.metro} 쪽이 걸립니다.`,
        refsOf(scenario, p.provenance?.location, 'fortune')));
    }
    if (p.location?.district && p.location.sourceType === 'context') {
      out.push(V('context',
        `${p.location.district}는 알려주신 현재 지역이고, 계산이 짚은 지역이 아닙니다.`,
        refsOf(scenario, p.provenance?.location, 'context')));
    }
  }
  if (asked.company) {
    out.push(S('limit', '어느 회사인지까지는 이 계산으로 좁힐 수 없습니다. 명반에 회사 이름은 들어 있지 않습니다.'));
  }
  if (!scenario.branches?.length && (scenario.meta?.allowedLevel ?? 0) < 2) {
    out.push(S('limit', `${dl}가 움직인다는 것까지가 이 계산이 말할 수 있는 전부입니다.`));
  }

  // ── 절로 묶어 글을 만든다 ──
  // **선을 긋는 문장은 어느 모드에서도 빠지지 않는다.** 짧게 달라고 해서
  // "갈렸다"·"확정이 아니다"를 지우면, 짧아진 것이 아니라 틀린 답이 된다
  const kept = out.filter((s) => ALWAYS_KEEP.has(s.kind) || want.has(SECTION_OF[s.kind] ?? 'uncertainty'));
  const sections = Object.fromEntries(SECTION_ORDER.map((k) => [
    k, kept.filter((s) => (SECTION_OF[s.kind] ?? 'uncertainty') === k).map((s) => s.text).join(' '),
  ]));
  const text = SECTION_ORDER.map((k) => sections[k]).filter(Boolean).join('\n\n');

  const narration = {
    status: scenario.status === 'question_mismatch' ? 'question_mismatch' : 'answered',
    text, sections, sentences: kept,
    meta: { deterministic: true, generatedFacts: 0, mode, grain, auditOk: true, issues: [] },
  };

  const audit = auditNarration(narration, scenario, options);
  narration.meta.auditOk = audit.ok;
  narration.meta.issues = audit.issues;
  // 넘지 말아야 할 선을 넘었으면 글을 내보내지 않는다
  if (audit.severe.length) {
    return { ...fail('unsafe_output', FAIL_TEXT, audit.issues), meta: {
      deterministic: true, generatedFacts: 0, mode, auditOk: false, issues: audit.issues } };
  }
  return narration;
}

/**
 * 쓸 수 있는 주의문 전부 — 우리가 표에 못 박아 둔 것뿐이다.
 * 시나리오 값에서 만들어진 문장이 여기 낄 수 없다.
 */
const SAFE_CAVEATS = new Set([
  ...Object.values(DOMAIN_CAVEAT),
  ...Object.values(EVENT_CANDIDATES).flat().map((c) => c.note).filter(Boolean),
  '뒤 단계는 앞 단계가 일어난다는 가정 위의 이야기이고, 정해진 순서가 아닙니다.',
  '실제 후보와 조건이 겹친다는 것뿐이고, 합격하거나 그리로 간다는 뜻이 아닙니다.',
]);
/** 곁가지·현실 절에서 만들어지는 주의문은 틀이 정해져 있다 */
const SAFE_CAVEAT_SHAPES = [
  /^.+ 쪽에서는 .+ 후보가 잡히지만, 그 분야를 따로 물어본 것이 아니라 이 사건에 딸려 본 것입니다\.$/,
];

/**
 * 현실 후보를 말하는 문장.
 *
 * **여기서 지키는 선이 하나 있다** — 회사·지역은 실제 자료에서 온 것이지
 * 운세가 짚은 것이 아니다. 그래서 "간다"·"입사한다"로 쓰지 않고 "지금 열려
 * 있는 후보 가운데 조건이 겹치는 것"까지만 쓴다. 날짜는 적지 않는다(공고의
 * 유효 기간을 시나리오의 시기처럼 읽게 만들기 때문이다).
 */
function realitySentences(rm, domainLabel) {
  const out = [];
  if (rm.status === 'unsafe_input' || rm.status === 'unsafe_match') {
    return [S('reality', '실제 후보 자료에 맞지 않는 데가 있어 그 부분은 붙이지 않았습니다.')];
  }
  const direct = (rm.primaryMatches ?? []).filter((m) => m.eligible && m.matchMode === 'direct');
  const illus = (rm.primaryMatches ?? []).filter((m) => m.eligible && m.matchMode === 'illustrative_only');

  if (!direct.length && !illus.length) {
    return [S('reality',
      `지금 들어와 있는 실제 후보 가운데 이 ${domainLabel} 시나리오와 조건이 겹치는 것은 없습니다.`)];
  }

  if (direct.length) {
    const metros = [...new Set(direct.map((m) => m.reality?.location?.metro).filter(Boolean))];
    const names = [...new Set(direct.map((m) => m.reality?.company?.value).filter(Boolean))];
    const refs = direct.flatMap((m) => m.provenance?.reality ?? []);
    const where = metros.length ? `${metros.join('·')} 쪽 ` : '';
    out.push(V('reality',
      `현실 조건까지 합치면, 지금 열려 있는 실제 후보 가운데 ${where}${direct.length}곳이 이 시나리오와 조건이 겹칩니다.`,
      refs));
    if (names.length) {
      out.push(V('reality',
        `이름을 대면 ${names.join('·')}입니다. 이것은 실제 자료에서 찾은 후보이지 운세가 짚은 회사가 아니고, 가게 된다는 뜻도 아닙니다.`,
        direct.flatMap((m) => (m.reality?.company ? m.provenance?.reality ?? [] : []))));
    }
    const fields = [...new Set(direct.flatMap((m) => m.compatibility?.matches ?? []))];
    const clash = [...new Set(direct.flatMap((m) => m.compatibility?.contradictions ?? []))];
    if (fields.length) {
      out.push(S('reality', `겹치는 자리는 ${fields.join('·')} 이고, 어긋나는 자리는 ${clash.length ? clash.join('·') : '없습니다'}.`));
    }
  }
  if (illus.length) {
    out.push(S('reality',
      `기간이 지났거나 회사 자체만 있는 후보 ${illus.length}건은 성격을 견주는 데만 썼습니다. 그때 그곳이 뽑는다는 근거는 아닙니다.`));
  }
  out.push(S('caveat',
    '실제 후보와 조건이 겹친다는 것뿐이고, 합격하거나 그리로 간다는 뜻이 아닙니다.'));
  return out;
}

/** 확률처럼 읽히는 말 */
const PERCENT_LIKE = /(\d+\s*%|확률|가능성\s*\d|퍼센트)/;
/** 하나를 골랐다는 말 */
const DECISIVE = /(유력|가장 가능성|1순위|제일 유력|가장 높은)/;
/** 날짜가 허용 눈금보다 잘아진 자리 */
const MONTH_LIKE = /(\d{4}-\d{2}\b|\d{1,2}\s*월)/;

/**
 * 글이 시나리오를 넘어서지 않았는지 본다.
 *
 * `severe` 에 걸리면 글을 내보내지 않는다 — 넘은 선을 다듬어 내보내면
 * 넘었다는 사실이 사라진다.
 */
export function auditNarration(narration, scenario, options = {}) {
  const issues = [];
  const severe = [];
  const add = (code, detail, bad = false) => {
    issues.push({ code, detail });
    if (bad) severe.push(code);
  };
  const text = narration?.text ?? '';
  const p = scenario?.primary ?? null;
  // 근거는 두 곳에 있다 — 시나리오(X…)와 현실 자료(R…). 둘 다 실재해야 한다
  const realityIds = new Set((options.realityMatch?.evidence ?? []).map((c) => c.id));
  const ids = new Set([
    ...(scenario?.evidence ?? []).map((c) => c.id),
    ...realityIds,
  ]);

  // 1. 회사 이름을 만들지 않았는가
  if (COMPANY_LIKE.test(text)) add('company_generated', '회사 이름 같은 문자열', true);

  // 2. 허용 눈금보다 잘게 말하지 않았는가
  if ((p?.timing?.grain ?? 'year') !== 'month' && MONTH_LIKE.test(text)) {
    add('month_leaked', `${p?.timing?.grain} 까지만 말할 수 있는데 달이 나왔다`, true);
  }

  // 3. 없는 도시를 만들지 않았는가 (도시는 location 절에서만 나온다)
  if (!p?.location?.metro) {
    const leaked = (narration.sentences ?? []).some((s) =>
      s.kind === 'detail' && /방위 계산으로는/.test(s.text));
    if (leaked) add('location_generated', '위치 근거가 없는데 도시를 말했다', true);
  }

  // 4. 질문과 다른 답을 숨기지 않았는가
  if (scenario?.questionAnswer?.answersQuestion === false
    && !(narration.sentences ?? []).some((s) => s.kind === 'mismatch')) {
    add('question_mismatch_hidden', '물은 것과 다른 답인데 그렇게 적지 않았다', true);
  }

  // 5. 팽팽한데 하나를 고른 것처럼 말하지 않았는가
  if (scenario?.selectionStatus === 'close' && DECISIVE.test(text)) {
    add('decisive_when_close', '근거 차이가 없는데 유력하다고 말했다', true);
  }

  // 6. 갈린 두 쪽을 한 사건처럼 붙이지 않았는가
  const sc = p?.selectionConflict;
  if (sc && sc.agreement === false) {
    const a = labelOf(scenario.meta?.domain, sc.eventScoreWinner);
    const b = labelOf(scenario.meta?.domain, sc.lineageVoteWinner);
    for (const s of narration.sentences ?? []) {
      if (!s.text.includes(a) || !s.text.includes(b)) continue;
      if (!/지만|갈렸|다릅|다른/.test(s.text)) {
        add('conflict_merged', `갈린 두 쪽을 한 문장으로 붙였다: ${s.text}`, true);
      }
    }
    if (!(narration.sentences ?? []).some((s) => s.kind === 'conflict')) {
      add('conflict_hidden', '갈렸는데 그 사실을 적지 않았다', true);
    }
  }

  // 7. 뒤 단계를 조건부로 적었는가
  for (const s of narration.sentences ?? []) {
    if (s.kind !== 'branch') continue;
    if (/그 단계가 실제로 일어난다는 전제/.test(s.text)) continue;
    if (/전제|만약/.test(s.text)) continue;
    // 한 단계짜리 가지는 조건문이 없어도 된다
    if (!/에는 .* 신호를 볼 수 있습니다/.test(s.text)) continue;
    add('branch_not_conditional', `조건부 표시가 없다: ${s.text}`, true);
  }

  // 8~9. 분야별 금지어.
  //
  // **못 박아 둔 주의문은 빼고 본다.** "진단이나 질환을 말하는 것이 아니라"
  // 같은 선 긋기 문장에는 그 낱말이 들어갈 수밖에 없고, 그것까지 걸면
  // 선을 긋지 못하게 된다. 대신 주의문이 **우리가 정해 둔 것 그대로인지**를
  // 따로 본다 — 시나리오 값에서 만들어진 문장이 아니어야 한다.
  const claimed = (narration.sentences ?? [])
    .filter((s) => s.kind !== 'caveat').map((s) => s.text).join(' ');
  for (const s of (narration.sentences ?? []).filter((x) => x.kind === 'caveat')) {
    if (SAFE_CAVEATS.has(s.text)) continue;
    if (SAFE_CAVEAT_SHAPES.some((re) => re.test(s.text))) continue;
    add('unknown_caveat', `정해 두지 않은 주의문: ${s.text}`, true);
  }
  if (scenario?.meta?.domain === 'health' && HEALTH_FORBIDDEN.test(claimed)) {
    add('health_medical_language', '진단·질환·수술을 말했다', true);
  }
  if (CERTAINTY_FORBIDDEN.test(claimed)) add('certainty_language', '결과를 단정했다', true);

  // 10. 내부 점수를 확률로 옮기지 않았는가
  if (PERCENT_LIKE.test(text)) add('probability_language', '내부 점수를 확률처럼 말했다', true);

  // 11~12. 값을 말한 문장에는 근거가 있고, 그 근거가 실제로 있는가
  const byId = new Map((scenario?.evidence ?? []).map((c) => [c.id, c]));
  const has = (s, refs) => (refs ?? []).some((r) => s.sourceRefs.includes(r));
  for (const s of narration.sentences ?? []) {
    if (needsSource(s) && !s.sourceRefs.length) {
      add('sentence_without_source', `${s.kind}: ${s.text}`, true);
    }
    for (const r of s.sourceRefs) {
      if (!ids.has(r)) add('dangling_source_ref', `없는 근거 ${r}`, true);
    }

    // 알려준 값을 말했으면 **context 근거**가 있어야 한다.
    // 여기에 fortune 근거를 달면 "계산이 맞혔다"가 되어 버린다
    if (s.kind === 'context') {
      if (!s.sourceRefs.some((r) => byId.get(r)?.sourceType === 'context')) {
        add('context_without_context_ref', s.text, true);
      }
      if (s.sourceRefs.some((r) => byId.get(r)?.sourceType === 'fortune')) {
        add('context_ref_wrong_source', `알려준 값에 운세 근거를 달았다: ${s.text}`, true);
      }
    }

    // 물은 것과 다르다고 말하면서 시기·사건 값을 쓰면 그 근거가 있어야 한다
    if (s.kind === 'mismatch') {
      if (p?.timing?.label && s.text.includes(p.timing.label) && !has(s, p.provenance?.timing)) {
        add('mismatch_without_ref', `시기를 말했는데 시기 근거가 없다: ${s.text}`, true);
      }
      if (p?.event?.label && s.text.includes(p.event.label) && !has(s, p.provenance?.event)) {
        add('mismatch_without_ref', `사건을 말했는데 사건 근거가 없다: ${s.text}`, true);
      }
      const da = scenario?.questionAnswer?.directAlternative;
      if (da) {
        const alt = (scenario.alternatives ?? []).find((a) => a.event?.type === da);
        if (s.text.includes(labelOf(scenario.meta?.domain, da)) && !has(s, alt?.provenance?.event)) {
          add('alternative_ref_missing', `${da} 를 말했는데 그 대안의 근거가 없다`, true);
        }
      }
    }

    // 갈림은 양쪽 승자를 모두 말하므로 양쪽 근거가 다 있어야 한다
    if (s.kind === 'conflict' && sc && sc.agreement === false) {
      const a = labelOf(scenario.meta?.domain, sc.eventScoreWinner);
      const b = labelOf(scenario.meta?.domain, sc.lineageVoteWinner);
      if (s.text.includes(a) && s.text.includes(b)) {
        const need = sc.provenance ?? p?.provenance?.selectionConflict ?? [];
        if (!need.length || !need.every((r) => s.sourceRefs.includes(r))) {
          add('conflict_ref_incomplete', `갈림의 양쪽 근거가 다 붙지 않았다: ${s.text}`, true);
        }
      }
    }

    // 도시를 말했으면 위치 근거가 있어야 한다
    if (p?.location?.metro && s.text.includes(p.location.metro)
      && !has(s, p.provenance?.location)) {
      add('location_without_ref', `${p.location.metro} 를 말했는데 위치 근거가 없다`, true);
    }

    // 현실 값을 말했으면 그 근거는 **현실 자료**에서 온 것이어야 한다
    if (s.kind === 'reality' && s.requiresSource) {
      if (realityIds.size && !s.sourceRefs.some((r) => realityIds.has(r))) {
        add('reality_without_reality_ref', s.text, true);
      }
    }

    // 대안의 시기·사건을 말했으면 그 대안의 근거여야 한다
    if (s.kind === 'alternative') {
      for (const a of scenario?.alternatives ?? []) {
        if (!a.event || !s.text.includes(a.event.label)) continue;
        if (!has(s, a.provenance?.event) || !has(s, a.provenance?.timing)) {
          add('alternative_ref_missing', `대안 ${a.event.type} 의 근거가 다 붙지 않았다`, true);
        }
      }
    }

    // 조건부 뒤 단계를 말했으면 그 단계의 상태 근거까지 있어야 한다
    if (s.kind === 'branch' && /전제/.test(s.text)) {
      const br = (scenario?.branches ?? []).find((b) =>
        b.steps?.[0] && s.text.includes(b.steps[0].label) && b.steps[1]);
      if (br && !has(s, br.steps[1].provenance?.state)) {
        add('branch_state_ref_missing', `${br.id} 뒤 단계의 상태 근거가 없다`, true);
      }
      if (br && !has(s, br.steps[1].provenance?.timing)) {
        add('branch_state_ref_missing', `${br.id} 뒤 단계의 시기 근거가 없다`, true);
      }
    }
  }

  // 13. 내부 용어가 새어 나오지 않았는가
  if (/allowedLevel|evidenceStrength|percentile|phaseId|rawEvents|eventScoreWinner|lineageVoteWinner|\bX\d{3}\b/.test(text)) {
    add('internal_term_leaked', '내부 용어가 그대로 나왔다', true);
  }

  return { ok: issues.length === 0, issues, severe };
}

export { labelOf };
