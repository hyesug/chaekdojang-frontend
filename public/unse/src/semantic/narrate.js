/**
 * narrate.js — 구조화된 결과를 **사람이 읽는 문장**으로
 *
 * 판단은 여기 오기 전에 전부 끝나 있다. 언어 모델은 이 글을 다듬기만
 * 한다 — 모델에게 "명반 → 직업"을 추론시키면 같은 명반에 답이 흔들리고,
 * 무엇을 근거로 그렇게 말했는지 되짚을 수 없다.
 *
 * ── 이 파일이 지키는 선 ────────────────────────────────────
 *   · 근거가 약해도 **답은 낸다.** 대신 확신도를 함께 적는다
 *   · 1·2위가 붙어 있으면 둘을 함께 낸다
 *   · 직업명은 `예시` 로만 — 범주가 답이고 이름은 보기다
 *   · 서로 다른 계보가 겹친 축을 따로 짚는다 (같은 표를 두 번 읽은 것과 구별)
 */

import { AXIS_LABEL } from './axes.js';
import { INDEPENDENT_LINEAGES } from './lineage.js';

const pct = (p) => `${Math.round(p * 100)}%`;

export function narrateCareer(r) {
  if (!r?.profile) {
    return ['직업을 읽을 근거가 서지 않았습니다.',
      ...(r?.silent ?? []).slice(0, 3).map((s) => `- ${s.name}: ${s.why}`)].join('\n');
  }
  const out = [];
  const A = r.categories.levelA.ranked;
  const B = r.categories.levelB.ranked;
  const C = r.categories.levelC.ranked;

  // ── 무엇을 다루는 사람인가 ──
  const lead = r.leading.slice(0, 3);
  out.push(lead.length
    ? `이 사람은 ${lead.map((x) => x.label).join('·')} 축이 가장 강합니다.`
    : '어느 한 축으로 뚜렷하게 기울지 않습니다.');

  // ── 여러 계보가 겹친 축 ──
  const agreed = Object.entries(r.consensus ?? {})
    .filter(([, v]) => v.independent >= 2)
    .sort((a, b) => b[1].independent - a[1].independent)
    .slice(0, 3);
  if (agreed.length) {
    out.push(`계산 재료가 서로 다른 ${agreed[0][1].independent}개 계보에서 ` +
      `${agreed.map(([k]) => AXIS_LABEL[k]).join('·')}이(가) 되풀이됩니다.`);
  } else {
    out.push('서로 독립인 계보끼리 겹치는 축은 없습니다 — 한 체계의 말에 기대고 있다는 뜻입니다.');
  }
  out.push('');

  // ── 방향 ──
  out.push('직업 방향은');
  C.slice(0, 3).forEach((c, i) => out.push(`  ${i + 1}. ${c.label} (${pct(c.p)})`));
  if (r.categories.levelC.flat) {
    out.push('  ※ 1·2위가 붙어 있어 하나로 좁히지 않습니다.');
  }
  out.push('');

  out.push(`일의 본질은 ${A.slice(0, 2).map((x) => x.label).join('·')} 쪽이고, ` +
    `일하는 자리는 ${B[0].label}${B[1] && B[0].p - B[1].p < 0.08 ? `·${B[1].label}` : ''} 쪽으로 읽힙니다.`);

  if (r.categories.levelD?.length) {
    out.push('');
    out.push(`예시 직업(범주를 설명하는 보기일 뿐, 이 직업을 짚는 것이 아닙니다): ${r.categories.levelD.join(', ')}`);
  }

  // ── 확신도 ──
  out.push('');
  const c = r.confidence;
  out.push(`확신도 ${c.level} (${c.score}) — 직접 증거를 낸 체계 ${c.directSystems}개, ` +
    `독립 계보 ${c.independentLineages}개, 말한 체계 ${c.spokeCount}개.`);
  if (!r.meta.timeKnown) {
    out.push('출생 시각을 몰라 자미두수와 점성 하우스가 빠졌습니다. 답이 사주 쪽으로 기울어 있습니다.');
  }
  out.push('이 확신도는 근거의 두께이지 적중률이 아닙니다.');

  return out.join('\n');
}

/** 체계마다 따로 — 합친 답 밑에 붙인다 */
export function narrateBySystem(r, limit = 6) {
  const out = ['체계마다 따로 읽은 것 (섞기 전):'];
  for (const s of r.systems.filter((x) => x.status === 'ok').slice(0, limit)) {
    const top = s.top.map((t) => `${t.label} ${t.value.toFixed(2)}`).join(' · ');
    const et = { direct: '직접', indirect: '간접', weak: '약함' }[s.evidenceType] ?? '';
    out.push(`  ${s.name} [${et}] ${top || '—'}`);
    const e = s.evidence?.[0];
    if (e) out.push(`    근거: ${e.basis}`);
  }
  const silent = r.systems.filter((x) => x.status !== 'ok');
  if (silent.length) out.push(`  (침묵 ${silent.length}: ${silent.map((x) => x.name).join(', ')})`);
  return out.join('\n');
}

export function narrate(r) {
  return [narrateCareer(r), '', narrateBySystem(r), '', r.meta.notFromNatal].join('\n');
}
