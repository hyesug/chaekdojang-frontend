/**
 * narrate.js — 구조화된 결과를 **사람이 읽는 문장**으로
 *
 * ── 언어 모델이 하지 않는 일 ────────────────────────────────
 * 판단은 전부 여기까지 끝나 있다. 모델은 이 글을 다듬기만 한다.
 * 모델에게 "명반 → 직업"을 추론시키지 않는다 — 그러면 같은 명반에
 * 답이 흔들리고, 무엇을 근거로 그렇게 말했는지 되짚을 수 없다.
 *
 * ── 이 파일이 지키는 선 ────────────────────────────────────
 *   · 1·2위가 붙어 있으면 **1위를 고르지 않는다**
 *   · 막아 둔 축은 아예 문장에 오르지 않는다
 *   · 시기는 구간으로만 말하고 한 해를 짚지 않는다
 *   · 직업명은 `예시` 로만 적는다 — 범주가 답이고 이름은 보기다
 */

import { AXIS_LABEL } from './axes.js';
import { j } from '../core/josa.js';

const pct = (p) => `${Math.round(p * 100)}%`;

/** 막아 둔 출력의 우리말 이름 */
const OUTPUT_LABEL = {
  tempo: '안정형/변동형', industry: '업종', employmentForm: '고용형태',
  workStyle: '일하는 결', unionTiming: '결혼 시기 성향', mode: '거주 형태',
};

/** 상위 몇 개를 고른다. 붙어 있으면 함께 낸다 */
function topOf(dist, n = 3) {
  if (!dist?.ranked?.length) return [];
  return dist.ranked.slice(0, n);
}

/** 이 사람에게서 가장 두드러진 축 */
function leadingAxes(features, n = 4, floor = 0.15) {
  if (!features) return [];
  return Object.entries(features)
    .filter(([, v]) => v >= floor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => ({ key: k, label: AXIS_LABEL[k] ?? k, value: v }));
}

/** 직업 */
export function narrateCareer(domain) {
  if (!domain?.features) {
    return ['직업을 읽을 근거가 서지 않았습니다.',
      ...(domain?.silent ?? []).slice(0, 3).map((s) => `- ${s.name}: ${s.why}`)].join('\n');
  }
  const out = [];
  const ind = domain.categories.industry;
  const top = topOf(ind, 3);

  if (ind?.flat) {
    out.push(`직업 적성이 한쪽으로 뚜렷하게 기울지 않습니다. 가장 앞선 것이 ${top[0].label}(${pct(top[0].p)})이고 ` +
      `${top[1].label}(${pct(top[1].p)})과의 차이가 ${pct(ind.spread)}밖에 되지 않아, **하나를 고르지 않습니다.**`);
  } else {
    out.push(`직업 적성은 ${top[0].label} 계열이 가장 앞서고, 그다음은 ` +
      `${top.slice(1).map((t) => t.label).join(', ')} 순입니다.`);
  }
  out.push('');

  const axes = leadingAxes(domain.features);
  if (axes.length) {
    out.push(`${domain.spokeCount}개 체계를 모아 보면 공통적으로 높은 축은 ` +
      `${axes.map((a) => `${a.label}(${a.value.toFixed(2)})`).join(' · ')} 입니다.`);
  }

  const form = topOf(domain.categories.employmentForm, 2);
  if (form.length) {
    out.push(form[0].p - (form[1]?.p ?? 0) < 0.08
      ? `고용형태는 ${form[0].label}과 ${form[1].label}이 팽팽해 가르지 못합니다.`
      : `고용형태는 ${form[0].label}(${pct(form[0].p)}) 쪽이 조금 우세합니다.`);
  }
  const style = topOf(domain.categories.workStyle, 2);
  if (style.length) out.push(`일하는 결은 ${style[0].label} 쪽이 앞섭니다.`);

  for (const s of domain.suppressedOutputs ?? []) {
    out.push(`※ ${j(OUTPUT_LABEL[s.name] ?? s.name, '은')} 답하지 않습니다 — ${s.why}`);
  }

  const ex = [...new Set(top.flatMap((t) => t.examples ?? []))].slice(0, 5);
  if (ex.length) {
    out.push('');
    out.push(`예시 직업(범주를 설명하는 보기일 뿐, 이 직업을 짚는 것이 아닙니다): ${ex.join(', ')}`);
  }
  if (domain.weak) out.push('※ 말한 체계가 둘도 되지 않아 결론으로 쓰지 마세요.');
  return out.join('\n');
}

/** 결혼 */
export function narrateMarriage(domain, timing) {
  const out = [];
  const t = topOf(domain?.categories?.unionTiming, 3);
  if (t.length) {
    out.push(domain.categories.unionTiming.flat
      ? `결혼 시기 성향은 갈리지 않습니다 (${t.map((x) => `${x.label} ${pct(x.p)}`).join(' · ')}).`
      : `결혼 자체는 ${t[0].label}으로 읽힙니다 (${t.map((x) => `${x.label} ${pct(x.p)}`).join(' · ')}).`);
  }

  if (timing?.marriage?.bands?.length) {
    const top = timing.marriage.top;
    out.push('');
    out.push(`신호가 겹치는 구간: 1차 ${top[0]}세, 2차 ${top[1]}세.`);
    out.push('이 구간은 **통계청 혼인율이 뼈대이고** 원국은 곡선을 ' +
      `${timing.marriage.shiftYears >= 0 ? '뒤로' : '앞으로'} ${Math.abs(timing.marriage.shiftYears)}해쯤 밀었을 뿐입니다.`);
    out.push(timing.marriage.disclaimer);
    const unknownBands = timing.marriage.bands.filter((b) => b.baseUnknown).map((b) => b.ageRange);
    if (unknownBands.length) out.push(`※ ${unknownBands.join(', ')}세 구간은 공표 통계에 값이 없습니다.`);
  }

  for (const b of domain?.blockedAxes ?? []) {
    out.push(`※ ${j(AXIS_LABEL[b.axis] ?? b.axis, '은')} 말하지 않습니다 — ${b.why}`);
  }
  return out.join('\n');
}

/** 전부 */
export function narrate(result) {
  const d = result.natal.domains;
  const parts = [
    '## 직업', narrateCareer(d.career), '',
    '## 결혼', narrateMarriage(d.relationship, result.timing), '',
  ];

  const child = topOf(d.children?.categories?.count, 2);
  if (child.length) {
    parts.push('## 자녀',
      `자녀 자리는 ${child[0].label} 쪽으로 읽힙니다 (${child.map((c) => `${c.label} ${pct(c.p)}`).join(' · ')}).`,
      '자녀 수를 숫자로 단정하지 않습니다.', '');
  }
  const edu = topOf(d.education?.categories?.path, 2);
  if (edu.length) parts.push('## 학업', `학업 경로는 ${edu[0].label} 쪽입니다 (${pct(edu[0].p)}).`, '');

  parts.push('## 지금 이 순간에 대해',
    result.currentState.why, '');
  return parts.join('\n');
}
