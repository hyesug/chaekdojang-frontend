/**
 * dictionary.js — **해석 사전**. 기호 하나가 무슨 뜻인가
 *
 * 이 파일은 규칙을 새로 만들지 않는다. `rules.js` 에 등록된 것을 사람이
 * 읽을 수 있게 펼쳐 놓을 뿐이다. 사전이 곧 엔진이고, 엔진이 곧 사전이다 —
 * 둘이 갈라지면 "코드는 이렇게 하는데 문서에는 저렇게 적혀 있다"가 된다.
 *
 * 한 줄은 이렇게 읽는다.
 *
 *   자미두수 · 관록궁 · 탐랑
 *     미적감각 0.85 · 대인 0.75 · 상업·영업 0.70 · 창작 0.65 · 독립·자영 0.55
 *     전통강도 0.9 · 좁기 0.31 · 직접증거
 *     실측 뒷받침 0.62 (3명 · 잠정)
 *
 * `실측 뒷받침` 은 그 규칙이 실린 사람들에서 실제 직업 속성과 얼마나
 * 닮았는지의 평균이다. **없으면 없다고 적는다** — 0 으로 만들지 않는다.
 */

import { RULES, TABLE_MEAN } from './rules.js';
import { DOMAIN_RULES, DOMAIN_LABEL } from './domains.js';
import { SYSTEM_NAME, SYSTEM_IDS } from './extract.js';
import { AXIS_LABEL, AXES } from './axes.js';
import { lineageOf } from './lineage.js';

const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

/** 규칙 하나를 사람이 읽는 모양으로 */
export function entryOf(rule, topN = 6) {
  const top = Object.entries(rule.features)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([k, v]) => ({ axis: k, label: AXIS_LABEL[k] ?? k, value: r2(v) }));
  return {
    id: rule.id,
    system: rule.system, systemName: SYSTEM_NAME[rule.system] ?? rule.system,
    lineage: lineageOf(rule.system),
    where: rule.where, symbol: rule.symbol,
    features: top,
    evidenceType: rule.evidenceType,
    traditionalStrength: rule.traditionalStrength,
    specificity: rule.specificity,
    empiricalSupport: rule.empiricalSupport,
    sampleSize: rule.sampleSize,
    provisional: rule.provisional,
    nature: rule.note ?? null,
  };
}

/** 분야를 가리지 않고 규칙을 찾는다 — 직업은 rules.js, 나머지는 domains.js */
const rulesOfDomain = (domain) =>
  (domain === 'career' ? RULES : DOMAIN_RULES).filter((r) => r.domain === domain);

/** 체계별로 묶은 사전 전체 */
export function buildDictionary(domain = 'career') {
  const all = rulesOfDomain(domain);
  const out = {};
  for (const id of SYSTEM_IDS) {
    const rules = all.filter((r) => r.system === id);
    if (!rules.length) continue;
    // 같은 자리끼리 모은다 (관록궁 주성 / 보조성 / 사화 …)
    const byWhere = {};
    for (const r of rules) (byWhere[r.where ?? '—'] ??= []).push(entryOf(r));
    out[id] = {
      system: id, name: SYSTEM_NAME[id], lineage: lineageOf(id),
      places: byWhere,
      // 그 체계 표의 평균 — 기호의 값을 이것과 견주어 읽어야 한다
      tableMean: Object.fromEntries((AXES[domain] ?? [])
        .map((ax) => [ax, r2(TABLE_MEAN[id]?.[ax] ?? 0)])),
    };
  }
  return out;
}

/** 축 하나를 어느 기호들이 가리키는가 — 거꾸로 찾기 */
export function byAxis(axis, domain = 'career', floor = 0.6) {
  return rulesOfDomain(domain)
    .filter((r) => r.domain === domain && (r.features[axis] ?? 0) >= floor)
    .sort((a, b) => b.features[axis] - a.features[axis])
    .map((r) => ({
      system: SYSTEM_NAME[r.system], where: r.where, symbol: r.symbol,
      value: r2(r.features[axis]), evidenceType: r.evidenceType,
    }));
}

/** 마크다운으로 편다 */
export function toMarkdown(dict, measurement = null, domain = 'career') {
  const out = [];
  out.push(`# ${DOMAIN_LABEL[domain] ?? domain} 해석 사전 v1`);
  out.push('');
  out.push('열다섯 체계의 기호 하나하나가 **현실의 어떤 속성**을 뜻하는지 적은 표입니다.');
  out.push('규칙 등록소(`src/semantic/rules.js` · `src/semantic/domains.js`)를 그대로');
  out.push('펼친 것이라, 이 문서와 엔진이 갈라질 수 없습니다.');
  out.push('');
  out.push('- **전통강도** — 그 전통이 그 자리를 그 뜻으로 지정한 정도');
  out.push('- **좁기** — 몇 축을 세게 가리키는가 (넓게 말하는 규칙은 저절로 무게가 깎입니다)');
  out.push('- **증거등급** — `직접` 그 전통에 이 질문을 보는 자리가 있다 / `간접` 역할·재능으로 말한다 / `약함` 상징 하나로 성향만');
  out.push('- **실측** — 실제 사례에서 그 규칙이 실린 사람들의 속성 유사도 평균. 없으면 `—`');
  out.push('- **물상** — 전용 자리가 없어 기호의 전통 물상으로 옮긴 규칙. `기호 → 물상 → 축` 사슬이 남습니다');
  out.push('');

  for (const sys of Object.values(dict)) {
    const m = measurement?.bySystem?.[sys.system];
    out.push(`## ${sys.name}`);
    if (m?.n) {
      const feats = Object.entries(m.byFeature)
        .filter(([, v]) => v.spoke >= 0.3)
        .sort((a, b) => b[1].readScore - a[1].readScore);
      out.push('');
      out.push(`실제 사례 ${m.n}명에서 평균 유사도 **${m.similarity}**.`);
      out.push(`잘 읽는 축: ${feats.slice(0, 4).map(([k, v]) => `${AXIS_LABEL[k]} ${v.readScore}`).join(' · ')}`);
      out.push(`약한 축: ${feats.slice(-2).map(([k, v]) => `${AXIS_LABEL[k]} ${v.readScore}`).join(' · ')}`);
    }
    out.push('');
    for (const [where, entries] of Object.entries(sys.places)) {
      out.push(`### ${where}`);
      out.push('');
      out.push('| 기호 | 뜻 (축 · 값) | 전통강도 | 좁기 | 증거 | 실측 |');
      out.push('|---|---|---|---|---|---|');
      for (const e of entries) {
        const f = e.features.map((x) => `${x.label} ${x.value}`).join(' · ');
        const emp = e.empiricalSupport == null ? '—'
          : `${e.empiricalSupport} (${e.sampleSize}명${e.provisional ? ' · 잠정' : ''})`;
        const et = { direct: '직접', indirect: '간접', weak: '약함' }[e.evidenceType] ?? e.evidenceType;
        out.push(`| ${e.symbol}${e.nature ? ` <br><sub>${e.nature}</sub>` : ''} | ${f} | ${e.traditionalStrength} | ${e.specificity} | ${et} | ${emp} |`);
      }
      out.push('');
    }
  }
  return out.join('\n');
}
