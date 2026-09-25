/**
 * systems.js — LEVEL 2. **체계마다 따로 말한다**
 *
 * 열다섯이 각자 자기 전통의 자리에서 읽은 것을 축 벡터로 낸다.
 * 여기서는 아무것도 합치지 않는다. 합치는 일은 ensemble.js 가 하고,
 * 그전에 각자가 무엇을 근거로 무엇을 말했는지가 그대로 남아야 한다.
 *
 * ── 한 체계 안에서 여러 기호가 걸릴 때 ──────────────────────
 * 자미 관록궁에 별이 둘이거나, 점성 10하우스에 행성이 셋일 수 있다.
 * 이때도 **평균 내지 않는다.** 평균은 강한 신호를 약한 신호로 희석한다.
 * 증거를 누적하는 noisy-OR 로 모은다.
 *
 *   support(축) = 1 − Π(1 − w_i · f_i)
 *
 * 둘이 같은 축을 가리키면 더 높아지고, 한쪽만 가리켜도 그 값이 남는다.
 */

import { AXES, zero, round3, isEmpty } from './axes.js';
import { ruleFor, EVIDENCE_WEIGHT } from './rules.js';
import { extractCareer, SYSTEM_IDS, SYSTEM_NAME } from './extract.js';
import { lineageOf } from './lineage.js';

/** 증거를 누적한다. 평균이 아니다 */
export function noisyOr(domain, contributions) {
  const acc = Object.fromEntries(AXES[domain].map((k) => [k, 1]));
  for (const { features, weight } of contributions) {
    for (const [k, v] of Object.entries(features)) {
      if (!(k in acc)) continue;
      acc[k] *= (1 - Math.max(0, Math.min(0.95, v * weight)));
    }
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, 1 - v]));
}

/**
 * 한 체계가 직업에 대해 말하는 것.
 *
 * @returns {{system, systemName, lineage, status, features, evidence, evidenceType, confidence}}
 */
export function interpretOneCareer(systemId, read) {
  const base = { system: systemId, systemName: SYSTEM_NAME[systemId], lineage: lineageOf(systemId), domain: 'career' };
  if (read.status !== 'ok') {
    return { ...base, status: read.status, why: read.why, features: null, evidence: [] };
  }

  const evidence = [];
  const missing = [];
  let bestType = 'weak';
  let stSum = 0, spSum = 0, n = 0;

  // ── 묶음별로 모은다 ──────────────────────────────────────
  // MC 사인 · MC 주인 · MC 주인의 하우스는 **같은 MC 에서 파생**된다.
  // 따로 더하면 MC 를 세 번 세는 것이므로, 묶음 안에서는 축마다
  // 가장 센 것만 쓴다.
  const groups = new Map();

  for (const h of read.hits) {
    const rule = ruleFor(systemId, 'career', h.condition);
    if (!rule) { missing.push(h.condition); continue; }
    const w = h.weight * EVIDENCE_WEIGHT[rule.evidenceType] * rule.traditionalStrength;
    const g = h.group ?? rule.where ?? 'default';
    const acc = groups.get(g) ?? zero('career');
    for (const [k, v] of Object.entries(rule.features)) {
      if (!(k in acc)) continue;
      acc[k] = Math.max(acc[k], v * w);     // 묶음 안에서는 최댓값
    }
    groups.set(g, acc);
    evidence.push({
      rule: rule.id, source: rule.where, value: String(rule.symbol), basis: h.basis,
      group: g,
      evidenceType: rule.evidenceType,
      traditionalStrength: rule.traditionalStrength,
      specificity: rule.specificity,
      empiricalSupport: rule.empiricalSupport,
      sampleSize: rule.sampleSize,
      provisional: rule.provisional,
      contribution: rule.features,
      weight: Math.round(w * 1000) / 1000,
    });
    if (rule.evidenceType === 'direct') bestType = 'direct';
    else if (rule.evidenceType === 'indirect' && bestType !== 'direct') bestType = 'indirect';
    stSum += rule.traditionalStrength; spSum += rule.specificity; n++;
  }

  // ── 정보량 불균형 보정 ───────────────────────────────────
  // 근거를 여덟 묶음 내는 체계와 한 묶음 내는 체계를 그대로 누적하면,
  // **깊게 읽은 체계가 무조건 큰 벡터**를 갖는다. 깊이가 좋게 하는 것은
  // 벡터의 **방향**이지 크기가 아니므로, 묶음 수의 제곱근으로 나눠
  // 체계마다의 총 증거량을 비슷하게 맞춘다.
  const G = groups.size;
  const scale = G ? 1 / Math.sqrt(G) : 1;
  const contributions = [...groups.values()].map((features) => ({ features, weight: scale }));

  if (!contributions.length) {
    return { ...base, status: 'empty',
      why: missing.length ? `규칙표에 없는 기호: ${missing.join('·')}` : '축으로 옮길 근거가 없다',
      features: null, evidence: [] };
  }

  const features = round3(noisyOr('career', contributions));
  if (isEmpty(features)) return { ...base, status: 'empty', why: '모든 축이 0', features: null, evidence };

  return {
    ...base, status: 'ok', features, evidence,
    evidenceType: bestType,
    // 이 체계가 이번 판에서 얼마나 믿을 만한가 — 전통 강도 × 좁기 × 증거 등급
    confidence: round3({ v: (stSum / n) * (0.5 + 0.5 * (spSum / n)) * EVIDENCE_WEIGHT[bestType] }).v,
    ...(missing.length ? { missingSymbols: missing } : {}),
  };
}

/**
 * 한 사람 × 열다섯 체계 (직업).
 *
 * @param {object} fortune `readFortune` 결과
 * @param {object|null} stack `ZW.stackAt` 결과
 */
export function interpretCareer(fortune, stack) {
  const reads = extractCareer(fortune, stack);
  return SYSTEM_IDS.map((id) => interpretOneCareer(id, reads[id]));
}

/** 옛 이름 — 다른 분야로 넓힐 때를 위해 남겨 둔다 */
export function interpretSystems(fortune, stack) {
  return { byDomain: { career: interpretCareer(fortune, stack) } };
}
