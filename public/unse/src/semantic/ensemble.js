/**
 * ensemble.js — LEVEL 5. 열다섯을 **어떻게** 합치는가
 *
 * ── 평균을 버린 이유 (실측) ────────────────────────────────
 * 처음엔 가중 평균을 썼다. 열한 명으로 재 보니 이렇게 나왔다.
 *
 *   체계 하나하나는 사람을 잘 구별한다     사람 사이 코사인 0.22~0.31
 *   그런데 평균을 내면 모두가 같아진다      **0.906**
 *   축 최댓값 1.00 이 평균에서 0.13~0.29 로 주저앉는다
 *
 * 열다섯 중 셋이 '기술'을 세게 가리켜도 나머지 열둘이 0 이면 평균은
 * 0.2 가 된다. **강한 소수 의견이 구조적으로 진다.**
 *
 * ── 그래서 증거를 누적한다 (noisy-OR) ──────────────────────
 *
 *   support(축) = 1 − Π(1 − w_i · f_i)
 *
 * 셋이 가리키면 셋 다 남고, 침묵한 열둘은 깎지 않는다. 침묵은 반대가
 * 아니라 **말하지 않은 것**이기 때문이다.
 *
 * ── 기여 무게 ─────────────────────────────────────────────
 *
 *   w = featureStrength × traditionalStrength × specificity
 *       × evidenceWeight × independenceFactor × empiricalCorrection
 *
 *   traditionalStrength  전통이 그 자리를 그 뜻으로 지정한 강도
 *   specificity          좁게 말할수록 높다 (넓게 말하면 저절로 깎인다)
 *   evidenceWeight       direct 1.0 · indirect 0.55 · weak 0.3
 *   independenceFactor   같은 계보가 여럿이면 1/n (팔괘 셋은 한 표)
 *   empiricalCorrection  **속성별로** 다르다 — 그 축을 잘 읽는 체계에 조금 더
 *
 * ── consensus ─────────────────────────────────────────────
 * 계산 재료가 서로 다른 계보(간지·자미·황도·항성황도) 여럿이 같은 축을
 * 가리키면 그건 값어치가 있다. 다만 보너스는 작게 준다 — 크게 주면
 * 흔한 축이 저절로 올라간다.
 */

import { AXES, round3, isEmpty } from './axes.js';
import { EVIDENCE_WEIGHT, deviationOf } from './rules.js';
import { independenceFactors, lineageOf, INDEPENDENT_LINEAGES } from './lineage.js';

/** 독립 계보가 여럿 겹칠 때 주는 보너스 상한 */
export const CONSENSUS_MAX = 0.20;

/**
 * 직접 증거가 남긴 여백을 간접·약한 증거가 채울 수 있는 몫.
 *
 * 직접 증거가 0 인 축이라도 간접이 전부 가리키면 0.40 까지, 약한 증거만
 * 있으면 0.18 까지 올라간다. **간접·약한 증거만으로 1위를 만들 수는
 * 있지만, 직접 증거가 선 축을 뒤집지는 못한다.**
 */
export const INDIRECT_SHARE = 0.40;
export const WEAK_SHARE = 0.18;

/**
 * 증거 등급이 합에 실리는 몫.
 *
 * 직접 증거를 내는 체계는 넷인데 간접·약한 증거를 내는 체계는 열하나다.
 * 같은 무게로 더하면 **수가 많은 쪽이 이긴다** — 실제로 개발자에게
 * '신체'가 1위로 나왔다. 그래서 등급마다 몫을 다르게 준다.
 */
export const ET_SCALE = { direct: 1, indirect: INDIRECT_SHARE, weak: WEAK_SHARE };

/**
 * 직접 증거가 얼마나 섰는지에 따라 간접·약한 증거의 몫을 줄인다.
 *
 * ── 왜 (실측) ─────────────────────────────────────────────
 * 열한 명 중 성적이 가장 나빴던 둘이 **둘 다 출생 시각을 모르는 사람**
 * 이었다(−0.33 · −0.52). 시각이 없으면 자미두수와 점성 하우스가 통째로
 * 빠져 직접 증거가 사주 하나만 남는데, 간접·약한 증거 열하나는 그대로
 * 남아서 **답을 그쪽이 가져간다.**
 *
 * 간접·약한 증거의 몫은 직접 증거를 **거들라고** 준 것이지 대신하라고
 * 준 것이 아니다. 그래서 직접 증거가 적으면 거드는 몫도 같이 줄인다.
 * 그러면 시각 미상인 사람의 답은 사주 쪽으로 모이고, 그게 정직하다.
 */
export const auxScale = (directCount, total = 4) =>
  Math.max(0.35, Math.min(1, directCount / total));

/**
 * 직업 축을 합친다.
 *
 * @param {Array} reads systems.interpretCareer 결과
 * @param {object|null} featureWeights calibration.weightsFrom 결과
 */
export function poolCareer(reads, featureWeights = null) {
  const spoke = reads.filter((r) => r.status === 'ok' && r.features);
  const silent = reads.filter((r) => r.status !== 'ok');
  if (!spoke.length) {
    return { features: null, spokeCount: 0, silent: silent.map(sil), contributors: [], consensus: {} };
  }

  const indep = independenceFactors(spoke.map((r) => r.system));
  const byType = { direct: [], indirect: [], weak: [] };
  const contributors = [];

  for (const r of spoke) {
    // 그 체계가 이번에 쓴 규칙들의 평균 전통강도·좁기
    const ev = r.evidence ?? [];
    const st = ev.length ? ev.reduce((a, e) => a + e.traditionalStrength, 0) / ev.length : 0.7;
    const sp = ev.length ? ev.reduce((a, e) => a + e.specificity, 0) / ev.length : 0.5;
    const et = EVIDENCE_WEIGHT[r.evidenceType ?? 'indirect'];

    // 축마다 다른 무게 — 이 체계가 잘 읽는 축은 조금 더, 못 읽는 축은 조금 덜.
    // `et`(증거 등급)는 여기서 빼고 아래 **묶음 단계**에서 건다.
    const perAxis = {};
    for (const ax of AXES.career) {
      const emp = featureWeights?.[r.system]?.[ax] ?? 1;
      perAxis[ax] = st * (0.55 + 0.45 * sp) * indep[r.system] * emp;
    }
    // **절대값이 아니라 그 표의 평균에서 벗어난 만큼**을 싣는다.
    // 그냥 더하면 표 전체의 평균에 수렴해 누가 와도 같은 답이 된다.
    const dev = deviationOf(r.system, r.features);
    byType[r.evidenceType ?? 'indirect'].push({
      features: Object.fromEntries(AXES.career.map((k) => [k, dev[k] * perAxis[k] * ET_SCALE[r.evidenceType ?? 'indirect']])),
      weight: 1,
    });
    contributors.push({
      system: r.system, name: r.systemName, lineage: r.lineage,
      evidenceType: r.evidenceType,
      traditionalStrength: round3({ v: st }).v, specificity: round3({ v: sp }).v,
      independence: round3({ v: indep[r.system] }).v,
      weightShare: round3({ v: et }).v,
    });
  }

  // ── 벗어난 만큼을 더한다 ──────────────────────────────────
  //
  // 등급마다 무게를 이미 곱해 두었으므로 여기서는 더하기만 한다.
  // 평균이 아니라 **합**이다 — 평균을 내면 침묵한 체계가 신호를 깎는데,
  // 침묵은 반대가 아니라 말하지 않은 것이다.
  const directCount = spoke.filter((r) => r.evidenceType === 'direct').length;
  const aux = auxScale(directCount);
  const raw = Object.fromEntries(AXES.career.map((ax) => [ax, 0]));
  for (const [group, scale] of [[byType.direct, 1], [byType.indirect, aux], [byType.weak, aux]]) {
    for (const c of group) {
      for (const ax of AXES.career) raw[ax] += (c.features[ax] ?? 0) * scale;
    }
  }

  // 0~1 로 편다. 가장 많이 벗어난 축이 1, 가장 적은 축이 0 이다.
  // 여기서 재는 것은 "이 사람 안에서 어느 축이 두드러지는가"이지
  // "절대적으로 얼마나 기술적인가"가 아니다 — 후자는 명반이 말할 수 없다.
  // 부호 있는 값은 **그대로 들고 간다** — 범주 비교와 채점이 이것을 쓴다.
  // 0~1 로 편 쪽은 화면과 문장용이다. 둘을 하나로 합치면 "평균보다 낮음"과
  // "말한 적 없음"이 같은 값이 된다.
  const scale = Math.max(1e-6, Math.max(...Object.values(raw).map(Math.abs)));
  const profile = Object.fromEntries(AXES.career.map((ax) => [ax, raw[ax] / scale]));

  const vals = Object.values(raw);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  let features = Object.fromEntries(AXES.career.map((ax) =>
    [ax, hi > lo ? (raw[ax] - lo) / (hi - lo) : 0]));

  // consensus — 서로 다른 계보가 겹치면 조금 올린다
  const consensus = {};
  for (const ax of AXES.career) {
    const lins = new Set();
    for (const r of spoke) if ((r.features[ax] ?? 0) >= 0.35) lins.add(lineageOf(r.system));
    const indepCount = [...lins].filter((L) => INDEPENDENT_LINEAGES.includes(L)).length;
    consensus[ax] = { lineages: lins.size, independent: indepCount };
    if (indepCount >= 2) {
      const bonus = Math.min(CONSENSUS_MAX, 0.07 * (indepCount - 1));
      features[ax] = Math.min(1, features[ax] + bonus * (1 - features[ax]));
    }
  }

  features = round3(features);
  return {
    features: isEmpty(features) ? null : features,
    // 보통 직업에서 벗어난 방향 (−1 ~ +1). 채점과 범주 비교가 이것을 쓴다
    profile: round3(profile),
    spokeCount: spoke.length,
    directCount,
    auxScale: round3({ v: aux }).v,
    silent: silent.map(sil),
    contributors,
    consensus,
    // 근거가 둘도 안 되면 합쳤다고 말하지 않는다
    weak: spoke.length < 2,
  };
}

const sil = (r) => ({ system: r.system, name: r.systemName, status: r.status, why: r.why });

/** 옛 이름 유지 */
export function ensemble(interpreted, featureWeights = null) {
  const reads = interpreted.byDomain?.career ?? interpreted;
  return { domains: { career: poolCareer(reads, featureWeights) } };
}

/**
 * 분야 하나를 합친다 — 직업과 같은 방식을 열두 분야로 쓴다.
 *
 * 직업은 `poolCareer` 가 속성별 보정까지 받지만, 나머지 분야는 아직
 * 실측 보정이 없으므로 전통 무게만으로 합친다. 구조는 같다 —
 * 표의 평균에서 벗어난 만큼을 등급별 몫으로 더한다.
 */
export function poolDomain(reads, domain) {
  if (domain === 'career') return poolCareer(reads, null);

  const spoke = reads.filter((r) => r.status === 'ok' && r.features);
  const silent = reads.filter((r) => r.status !== 'ok');
  const axes = AXES[domain] ?? [];
  if (!spoke.length || !axes.length) {
    return { features: null, profile: null, spokeCount: 0, silent: silent.map(sil), contributors: [] };
  }

  const indep = independenceFactors(spoke.map((r) => r.system));
  const directCount = spoke.filter((r) => r.evidenceType === 'direct').length;
  const aux = auxScale(directCount);

  const raw = Object.fromEntries(axes.map((ax) => [ax, 0]));
  const contributors = [];
  for (const r of spoke) {
    const ev = r.evidence ?? [];
    const st = ev.length ? ev.reduce((a, e) => a + e.traditionalStrength, 0) / ev.length : 0.7;
    const sp = ev.length ? ev.reduce((a, e) => a + e.specificity, 0) / ev.length : 0.5;
    const et = r.evidenceType ?? 'indirect';
    const scale = et === 'direct' ? 1 : ET_SCALE[et] * aux;

    // **그 체계가 한 말 안에서** 어느 축이 솟았는지로 센다.
    //
    // 처음엔 원시 표의 평균과 견줬는데, 체계 출력은 묶음 포화(1/√G)를
    // 거친 뒤라 표 값보다 훨씬 작다. 그래서 **모든 축이 평균 아래**로
    // 나와 profile 이 통째로 음수가 됐다. 잣대가 서로 달랐던 것이다.
    // 자기 출력의 평균으로 중심을 잡으면 눈금에 상관없이 성립한다.
    const vals = axes.map((ax) => r.features[ax] ?? 0);
    const selfMean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
    for (const ax of axes) {
      const dev = (r.features[ax] ?? 0) - selfMean;
      raw[ax] += dev * st * (0.55 + 0.45 * sp) * indep[r.system] * scale;
    }
    contributors.push({ system: r.system, name: r.systemName, lineage: r.lineage, evidenceType: et });
  }

  const s = Math.max(1e-6, Math.max(...Object.values(raw).map(Math.abs)));
  const profile = round3(Object.fromEntries(axes.map((ax) => [ax, raw[ax] / s])));
  const vals = Object.values(raw);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const features = round3(Object.fromEntries(axes.map((ax) =>
    [ax, hi > lo ? (raw[ax] - lo) / (hi - lo) : 0])));

  return {
    features: isEmpty(features) ? null : features, profile,
    spokeCount: spoke.length, directCount, auxScale: round3({ v: aux }).v,
    silent: silent.map(sil), contributors, weak: spoke.length < 2,
  };
}
