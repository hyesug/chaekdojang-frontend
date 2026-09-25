/**
 * scenario/conflict.js — **갈린 것을 평균으로 지우지 않는다**
 *
 * 열다섯을 하나로 버무리는 방식은 이 저장소에서 세 번 실패했다. 섞을수록
 * 가장 흔한 답으로 수렴하기 때문이다. 그래서 여기서는 **합치지 않고 가른다.**
 *
 *   agreement     같은 쪽을 가리킨 것
 *   disagreements 반대쪽을 가리킨 것
 *   alternatives  1위가 아니지만 살아 있는 방향
 *   unresolved    말할 근거가 없거나 갈라 놓고 못 고른 것
 *
 * "활성도는 여러 계보가 동의하는데 방향이 이직/직무변경으로 갈렸다" 면
 * **이직 확정으로 만들지 않는다.** 그 갈림 자체가 결과다.
 *
 * ── 여기 숫자는 확률이 아니다 ──────────────────────────────
 * `evidenceStrength` 는 "근거가 몇 갈래에서 얼마나 두껍게 겹쳤나"이고
 * "그 일이 일어날 확률"이 아니다. 둘은 다른 것이고, 이 저장소는 그 둘을
 * 섞어 생각해 여러 번 틀렸다.
 */

import { lineageOf, INDEPENDENT_LINEAGES } from '../lineage.js';
import { SYSTEM_IDS, SYSTEM_NAME } from '../extract.js';
import { EVENT_CANDIDATES, match, penalty } from '../timing/events.js';
import { clamp01 } from '../timing/schema.js';

const CORE = new Set(['saju', 'jamidusu', 'astrology', 'vedic']);

/** 한 계보가 그 분야에서 가리키는 방향 = 그 계보의 축 이동에 가장 맞는 사건 후보 */
function topDirections(domain, shift, n = 2) {
  const out = [];
  for (const c of EVENT_CANDIDATES[domain] ?? []) {
    const s = match(shift, c.needs) * penalty(shift, c.avoid);
    if (s > 0) out.push({ key: c.key, label: c.label, fit: Math.round(s * 1000) / 1000 });
  }
  out.sort((a, b) => b.fit - a.fit);
  return out.slice(0, n);
}

const LABEL = {
  strong: '여러 독립 계보가 같은 쪽', partial: '일부만', weak: '거의 없다', none: '말할 근거가 없다',
  unanimous: '한 방향', majority: '다수 한 방향', mixed: '갈렸다', unknown: '방향을 말한 계보가 없다',
};

/**
 * 한 기간 한 분야에서 열다섯이 무엇에 동의하고 무엇에서 갈렸는가.
 *
 * @param {object} result   predictTimeline 결과
 * @param {string} domain
 * @param {{from:string, to:string}} window  볼 구간 ('YYYY-MM')
 */
export function resolveConflict(result, domain, window) {
  const keys = Object.keys(result.timeline).sort()
    .filter((k) => (!window?.from || k >= window.from) && (!window?.to || k <= window.to));
  if (!keys.length) {
    return { domain, window, activationAgreement: 'none', directionalAgreement: 'unknown',
      primaryDirection: null, competingDirections: [], evidenceStrength: 0,
      agreement: [], disagreements: [], alternatives: [], unresolved: [{ what: '구간에 달이 없다' }],
      lineages: [], note: '이 숫자는 확률이 아니다' };
  }

  // ── 체계마다 그 구간의 평균 활성도와 방향을 모은다 ──
  const perSystem = [];
  for (const id of SYSTEM_IDS) {
    const months = result.systemResults[id]?.months ?? {};
    const acts = [];
    const shiftSum = {}; const shiftN = {};
    let usable = 0, flat = 0, na = 0;
    for (const k of keys) {
      const m = months[k];
      if (!m) { na++; continue; }
      if (!m.available || m.resolution === 'none') { na++; continue; }
      const v = m.rawActivations?.[domain];
      if (!Number.isFinite(v)) { na++; continue; }
      usable++; acts.push(v);
      for (const [ax, x] of Object.entries(m.featureShift?.[domain] ?? {})) {
        if (!Number.isFinite(x)) continue;
        shiftSum[ax] = (shiftSum[ax] ?? 0) + x; shiftN[ax] = (shiftN[ax] ?? 0) + 1;
      }
    }
    if (!usable) {
      perSystem.push({ system: id, name: SYSTEM_NAME[id], lineage: lineageOf(id),
        unavailable: true, why: Object.values(months).find(Boolean)?.why ?? '그 분야를 말하지 않는다' });
      continue;
    }
    if (new Set(acts).size <= 1) flat = usable;
    const shift = Object.fromEntries(Object.entries(shiftSum).map(([ax, s]) => [ax, s / shiftN[ax]]));
    // 방향은 크기를 벗기고 부호만 비교한다 (합친 층과 같은 규칙)
    const peak = Math.max(0, ...Object.values(shift).map(Math.abs));
    const dir = Object.fromEntries(Object.entries(shift).map(([ax, v]) =>
      [ax, peak > 1e-9 ? v / peak : 0]));
    perSystem.push({
      system: id, name: SYSTEM_NAME[id], lineage: lineageOf(id), unavailable: false,
      activation: Math.round((acts.reduce((a, b) => a + b, 0) / acts.length) * 1000) / 1000,
      months: usable, noVariation: flat > 0,
      shiftMagnitude: Math.round(peak * 1000) / 1000,
      directions: peak > 1e-9 ? topDirections(domain, dir) : [],
    });
  }

  // ── 같은 계보는 한 표다 ────────────────────────────────────
  // 카발라와 타로는 둘 다 수(數)에서 나온다. 두 표로 세면 계보 하나가
  // 두 몫을 갖는다 — 기존 계보 정보를 그대로 쓴다.
  const byLineage = new Map();
  for (const s of perSystem) {
    if (s.unavailable) continue;
    const cur = byLineage.get(s.lineage) ?? [];
    cur.push(s); byLineage.set(s.lineage, cur);
  }
  const lineages = [...byLineage.entries()].map(([L, xs]) => {
    // 그 계보의 대표는 **핵심 체계 우선, 그다음 방향이 선명한 쪽**이다
    const rep = xs.slice().sort((a, b) =>
      (CORE.has(b.system) ? 1 : 0) - (CORE.has(a.system) ? 1 : 0)
      || b.shiftMagnitude - a.shiftMagnitude)[0];
    return {
      lineage: L, independent: INDEPENDENT_LINEAGES.includes(L),
      systems: xs.map((x) => x.system), representative: rep.system,
      activation: rep.activation, noVariation: xs.every((x) => x.noVariation),
      directions: rep.directions, shiftMagnitude: rep.shiftMagnitude,
    };
  });

  // ── 활성도 합의 — 독립 계보만 센다 ──
  const indep = lineages.filter((l) => l.independent && !l.noVariation);
  const up = indep.filter((l) => l.activation >= 0.5);
  const ratio = indep.length ? up.length / indep.length : 0;
  const activationAgreement = !indep.length ? 'none'
    : ratio >= 0.75 ? 'strong' : ratio >= 0.4 ? 'partial' : 'weak';

  // ── 방향 합의 — 계보마다 1표, 같은 후보를 가리키면 동의 ──
  const votes = new Map();
  for (const l of lineages) {
    const d = l.directions[0];
    if (!d || l.shiftMagnitude < 0.05) continue;    // 흔들림이 없으면 방향을 말한 것이 아니다
    const w = l.independent ? 1 : 0.45;
    const cur = votes.get(d.key) ?? { key: d.key, label: d.label, weight: 0, lineages: [], fit: 0 };
    cur.weight += w; cur.lineages.push(l.lineage); cur.fit = Math.max(cur.fit, d.fit);
    votes.set(d.key, cur);
  }
  const ranked = [...votes.values()].sort((a, b) => b.weight - a.weight || b.fit - a.fit);
  const total = ranked.reduce((a, v) => a + v.weight, 0);
  const lead = ranked[0] ?? null;
  const share = lead && total ? lead.weight / total : 0;
  const directionalAgreement = !ranked.length ? 'unknown'
    : ranked.length === 1 ? 'unanimous'
    : share >= 0.6 ? 'majority' : 'mixed';

  // ── 근거의 두께 — 확률이 아니다 ──
  // 독립 계보가 몇 갈래나 켜졌는지 × 방향이 얼마나 한쪽인지
  const evidenceStrength = Math.round(clamp01(
    0.6 * ratio + 0.4 * (directionalAgreement === 'unknown' ? 0 : share)) * 100) / 100;

  const agreement = [];
  const disagreements = [];
  const alternatives = [];
  const unresolved = [];

  if (indep.length) {
    agreement.push({ what: `${domain} 활성`, level: activationAgreement,
      lineages: up.map((l) => l.lineage), of: indep.map((l) => l.lineage),
      note: LABEL[activationAgreement] });
  } else {
    unresolved.push({ what: `${domain} 활성`, why: '이 구간에서 독립 계보가 시기를 가르지 못한다' });
  }
  if (lead) {
    agreement.push({ what: '방향', level: directionalAgreement, direction: lead.key,
      lineages: lead.lineages, note: LABEL[directionalAgreement] });
    for (const v of ranked.slice(1)) {
      // 1위와 무게 차이가 거의 없으면 **경쟁 방향**이고, 크면 곁가지다.
      // 방향이 갈렸다고(`mixed`) 판정해 놓고 경쟁 방향을 비워 두면 말이 안 된다
      const close = v.weight >= lead.weight * 0.6 || directionalAgreement === 'mixed';
      (close ? disagreements : alternatives).push({
        what: '방향', direction: v.key, label: v.label,
        lineages: v.lineages, weight: Math.round(v.weight * 100) / 100,
        note: close ? '1위와 근거 차이가 거의 없다 — 하나로 단정하지 않는다' : '살아 있는 곁가지',
      });
    }
  } else {
    unresolved.push({ what: '방향', why: '방향을 말한 계보가 없다 (흔들림이 없다)' });
  }
  for (const s of perSystem.filter((x) => x.unavailable)) {
    unresolved.push({ what: s.name, why: s.why, system: s.system });
  }
  for (const l of lineages.filter((x) => x.noVariation)) {
    unresolved.push({ what: l.lineage, why: '이 구간 값이 달마다 같다 — 시기를 가르지 못한다' });
  }

  return {
    domain, window: { from: keys[0], to: keys[keys.length - 1] },
    activationAgreement, directionalAgreement,
    primaryDirection: lead?.key ?? null,
    competingDirections: disagreements.map((d) => d.direction),
    evidenceStrength,
    agreement, disagreements, alternatives, unresolved,
    lineages,
    note: 'evidenceStrength 는 근거의 두께이지 확률이 아니다',
  };
}

export { topDirections };
