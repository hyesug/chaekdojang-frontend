/**
 * systems.js — LEVEL 2. **체계마다 따로 말한다**
 *
 * 열다섯이 각자 자기 전통의 자리에서 읽은 것을 **구조화된 점수**로 낸다.
 * 여기서는 아무것도 합치지 않는다. 합치는 일은 ensemble.js 가 하고,
 * 그전에 각자가 무엇을 근거로 무엇을 말했는지가 그대로 남아 있어야 한다.
 *
 * `hires/interpret.js` 의 "섞기 전에 각자 말하게 한다"를 그대로 이어받되,
 * 결과를 문자열이 아니라 축 벡터로 낸다 — 문자열은 채점할 수가 없다.
 */

import { AXES, zero, add, clamp01, round3, isEmpty } from './axes.js';
import { careerRuleFor, factRuleFor, formOf, FORM_CONTRIBUTION } from './rules.js';
import { extractAll, SYSTEM_IDS, SYSTEM_NAME } from './extract.js';

/**
 * 읽기 하나를 규칙에 걸어 축 기여로 바꾼다.
 * 규칙이 없으면 **조용히 0 을 주지 않고** 그 사실을 적는다.
 */
function applyRules(read) {
  const { system, domain } = read;
  const hits = [];

  if (domain === 'career') {
    for (const symbol of read.symbols ?? []) {
      const r = careerRuleFor(system, symbol);
      if (r) hits.push({ rule: r, symbol });
      else hits.push({ rule: null, symbol, missing: true });
    }
  } else if (read.condition) {
    const r = factRuleFor(system, domain, read.condition);
    if (r) hits.push({ rule: r, symbol: read.condition });
    else hits.push({ rule: null, symbol: read.condition, missing: true });
  }
  return hits;
}

/** 한 체계 × 한 분야 */
function interpretOne(reads, system, domain) {
  const mine = reads.filter((x) => x.system === system && x.domain === domain);
  if (!mine.length) return null;

  const bad = mine.find((x) => x.status !== 'ok');
  const ok = mine.filter((x) => x.status === 'ok');
  if (!ok.length) {
    return {
      system, systemName: SYSTEM_NAME[system], domain,
      status: bad?.status ?? 'unavailable', why: bad?.why ?? null,
      features: null, evidence: [],
    };
  }

  let vec = zero(domain);
  const evidence = [];
  const missing = [];

  for (const read of ok) {
    for (const { rule, symbol, missing: miss } of applyRules(read)) {
      if (miss) { missing.push(symbol); continue; }
      vec = add(vec, rule.contribution);
      evidence.push({
        rule: rule.id,
        source: read.basis ?? rule.condition,
        value: String(symbol),
        reason: rule.text ?? rule.note ?? rule.condition,
        words: rule.words ?? undefined,
        contribution: rule.contribution,
        kind: rule.source,
      });
    }
    // 점성술만 '자기 판/조직'을 사인의 활동/고정에서 읽는다.
    // 기호(사인 이름)와 그 성질이 다른 값이라 규칙표에 미리 못 넣는다.
    const form = read.form ? formOf(read.system, read.form) : null;
    if (form) {
      vec = add(vec, FORM_CONTRIBUTION[form]);
      evidence.push({
        rule: `${read.system}|${domain}|form:${read.form}`,
        source: read.basis, value: read.form,
        reason: form === 'self' ? '활동궁 — 자기 판 쪽' : '고정궁 — 조직 쪽',
        contribution: FORM_CONTRIBUTION[form], kind: 'traditional',
      });
    }
  }

  if (isEmpty(vec)) {
    return {
      system, systemName: SYSTEM_NAME[system], domain,
      status: 'empty',
      why: missing.length ? `규칙표에 없는 기호: ${missing.join('·')}` : '축으로 옮길 낱말이 없다',
      features: null, evidence,
    };
  }

  return {
    system, systemName: SYSTEM_NAME[system], domain, status: 'ok',
    features: round3(clamp01(vec)),
    evidence,
    ...(missing.length ? { missingSymbols: missing } : {}),
  };
}

/**
 * 한 사람 × 열다섯 체계 × 일곱 분야.
 *
 * @param {object} fortune `readFortune` 결과
 * @param {object|null} stack `ZW.stackAt` 결과
 * @returns {{byDomain: Record<string, object[]>, facts: object}}
 */
export function interpretSystems(fortune, stack) {
  const { byDomain, facts } = extractAll(fortune, stack);
  const out = {};
  for (const domain of Object.keys(AXES)) {
    out[domain] = SYSTEM_IDS
      .map((id) => interpretOne(byDomain[domain], id, domain))
      .filter(Boolean);
  }
  return { byDomain: out, facts, raw: byDomain };
}
