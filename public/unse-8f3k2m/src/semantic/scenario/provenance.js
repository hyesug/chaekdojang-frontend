/**
 * scenario/provenance.js — **이 말이 어디서 나왔는가**
 *
 * 최종 문장은 출처가 다른 조각이 섞여 만들어진다. "현재 개발자이고 2028년
 * 상반기에 직업이 움직이며 기술직을 유지할 가능성" 에서
 *
 *   현재 개발자        사용자가 말해 준 것   context
 *   2028 상반기 변화   명반에서 나온 것      fortune
 *   기술직 유지        앞 둘에서 끌어낸 것   derived
 *
 * 셋의 무게가 전혀 다른데 한 문장이 되면 같아 보인다. 그래서 조각마다
 * 출처를 달고, `derived` 는 무엇에서 끌어냈는지 사슬로 남긴다.
 *
 * `reality` 는 실제 자료(채용 공고·통계)와 맞댄 것이다. **이 단계에는
 * 아직 없다.** 없는 것을 있다고 적지 않는다.
 */

export const SOURCE_TYPES = ['fortune', 'context', 'reality', 'derived'];

let seq = 0;
/** 같은 입력이면 같은 id 가 나오도록, 부를 때마다가 아니라 묶음마다 센다 */
export const resetIds = () => { seq = 0; };
const nextId = (prefix) => `${prefix}${String(++seq).padStart(3, '0')}`;

/**
 * 주장 하나.
 *
 * @param {string} text
 * @param {'fortune'|'context'|'reality'|'derived'} sourceType
 * @param {object} o
 *   evidence     fortune 일 때 — [{system, what, basis, weight}]
 *   value        context 일 때 — 사용자가 준 값
 *   derivedFrom  derived 일 때 — 앞 주장들의 id
 *   level        specificity 단계
 */
export function claim(text, sourceType, o = {}) {
  if (!SOURCE_TYPES.includes(sourceType)) {
    throw new Error(`알 수 없는 출처: ${sourceType}`);
  }
  const c = {
    id: nextId(sourceType[0].toUpperCase()),
    claim: text, sourceType,
    ...(o.level != null ? { level: o.level } : {}),
  };
  if (sourceType === 'fortune') {
    c.evidence = (o.evidence ?? []).map((e) => ({ ...e }));
    if (!c.evidence.length) c.warning = '근거를 달지 않은 fortune 주장이다';
  }
  if (sourceType === 'context') c.value = o.value ?? null;
  if (sourceType === 'reality') c.source = o.source ?? null;
  if (sourceType === 'derived') {
    c.derivedFrom = [...(o.derivedFrom ?? [])];
    if (!c.derivedFrom.length) c.warning = '무엇에서 끌어냈는지 적히지 않았다';
  }
  if (o.caution) c.caution = o.caution;
  return c;
}

/** 체계별 근거를 fortune 주장에 달 모양으로 뽑는다 */
export function evidenceFrom(result, domain, window, { max = 6 } = {}) {
  const keys = Object.keys(result.timeline).sort()
    .filter((k) => (!window?.from || k >= window.from) && (!window?.to || k <= window.to));
  const out = [];
  for (const [id, sys] of Object.entries(result.systemResults ?? {})) {
    for (const k of keys) {
      const m = sys.months?.[k];
      if (!m?.available) continue;
      const a = m.rawActivations?.[domain];
      if (!Number.isFinite(a) || a < 0.4) continue;
      for (const e of m.evidence ?? []) {
        if (e.domain && e.domain !== domain) continue;
        out.push({ system: id, name: sys.name, period: k,
          what: e.what, basis: e.basis ?? null, weight: e.weight ?? null,
          activation: Math.round(a * 1000) / 1000 });
      }
    }
  }
  out.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || b.activation - a.activation);
  // 한 체계가 목록을 다 차지하지 않게 한 체계당 둘까지
  const per = new Map(); const kept = [];
  for (const e of out) {
    const n = per.get(e.system) ?? 0;
    if (n >= 2) continue;
    per.set(e.system, n + 1); kept.push(e);
    if (kept.length >= max) break;
  }
  return kept;
}

/** 사슬을 따라간다 — 어떤 주장이 결국 무엇에 기대고 있나 */
export function trace(claims, id, seen = new Set()) {
  const byId = claims instanceof Map ? claims : new Map(claims.map((c) => [c.id, c]));
  const c = byId.get(id);
  if (!c || seen.has(id)) return null;
  seen.add(id);
  return {
    id: c.id, claim: c.claim, sourceType: c.sourceType,
    ...(c.evidence ? { evidence: c.evidence } : {}),
    ...(c.value !== undefined && c.sourceType === 'context' ? { value: c.value } : {}),
    ...(c.derivedFrom ? { from: c.derivedFrom.map((x) => trace(byId, x, seen)).filter(Boolean) } : {}),
  };
}

/** 근거 없는 주장이 섞였는지 본다 — 조용히 넘어가지 않게 */
export function auditProvenance(claims) {
  const ids = new Set(claims.map((c) => c.id));
  const problems = [];
  for (const c of claims) {
    if (!SOURCE_TYPES.includes(c.sourceType)) problems.push({ id: c.id, why: '출처 종류가 없다' });
    if (c.sourceType === 'fortune' && !(c.evidence ?? []).length) problems.push({ id: c.id, why: '체계 근거가 없다' });
    if (c.sourceType === 'derived') {
      if (!(c.derivedFrom ?? []).length) problems.push({ id: c.id, why: '끌어낸 출처가 없다' });
      for (const f of c.derivedFrom ?? []) {
        if (!ids.has(f)) problems.push({ id: c.id, why: `없는 주장을 가리킨다: ${f}` });
      }
    }
  }
  return { ok: !problems.length, problems, counts: countBy(claims) };
}

const countBy = (claims) => claims.reduce((a, c) => {
  a[c.sourceType] = (a[c.sourceType] ?? 0) + 1; return a;
}, {});
