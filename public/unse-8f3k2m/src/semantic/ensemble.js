/**
 * ensemble.js — LEVEL 5. 열다섯을 **어디서** 합치는가
 *
 * ── 이 파일의 유일한 설계 판단 ──────────────────────────────
 * 이 저장소는 융합을 세 번 만들어 세 번 다 실패했다. 실패한 셋은
 * **전부 범주(label) 에서 합쳤다.**
 *
 *   profile.js 융합      다섯 명 전원에게 "교육·법률·금융"
 *   가중투표 융합        열한 명 중 여덟에게 "전문가"
 *   교집합 융합          어떤 기준으로도 영점을 못 넘음
 *
 * 범주에서 합치면 **흔한 범주로 표가 쏠린다.** 자미가 '미용', 사주가
 * '기술'을 말하면 둘 다 1표라 아무것도 남지 않고, 여러 체계가 조금씩
 * 걸치는 '교육·법률·금융' 같은 넓은 칸이 이긴다.
 *
 * 그래서 여기서는 **축에서 합친다.** 자미가 미적감각을, 사주가 기술을
 * 가리키면 두 축이 **둘 다 선 벡터**가 된다. 범주는 그 합쳐진 벡터를
 * 보고 한 번만 고른다. 근거가 상쇄되지 않고 쌓인다.
 *
 * **이것이 옳다는 보장은 없다.** 다만 이전 실패의 원인(범주 쏠림)을
 * 구조적으로 비껴간다. 실제로 나은지는 `scripts/validate-semantic.mjs`
 * 의 LOO 가 말한다 — 합친 것이 최고 단독 체계보다 나쁘면 그대로 적는다.
 *
 * ── 같은 표를 쓰는 체계는 한 표로 묶는다 ────────────────────
 * 주역·태을신수·토정비결은 셋 다 팔괘로 말한다. 답이 겹쳐도 그것은
 * 교차검증이 아니라 **같은 표를 세 번 읽은 것**이다. 묶어서 무게를 나눈다.
 */

import { AXES, zero, add, clamp01, round3, isEmpty } from './axes.js';
import { SHARED_TABLE_GROUPS } from './rules.js';
import { categorize } from './categories.js';
import { buildWeights, isAxisSuppressed, isOutputSuppressed, SUPPRESSED } from './reliability.js';

/** 같은 표를 쓰는 묶음이면 무게를 1/n 로 나눈다 */
function groupDivisor(systemId) {
  const g = SHARED_TABLE_GROUPS.find((grp) => grp.includes(systemId));
  return g ? g.length : 1;
}

/**
 * 한 분야를 합친다.
 *
 * @param {object[]} reads systems.js 가 낸 체계별 해석
 * @param {string} domain
 * @param {object} weights buildWeights 결과
 */
export function poolDomain(reads, domain, weights) {
  const spoke = reads.filter((r) => r.status === 'ok' && r.features);
  const silent = reads.filter((r) => r.status !== 'ok');

  let vec = zero(domain);
  let total = 0;
  const contributors = [];

  for (const r of spoke) {
    const w = (weights[r.system]?.[domain]?.finalWeight ?? 1) / groupDivisor(r.system);
    vec = add(vec, r.features, w);
    total += w;
    contributors.push({ system: r.system, name: r.systemName, weight: Math.round(w * 1000) / 1000 });
  }
  if (total > 0) {
    vec = Object.fromEntries(Object.entries(vec).map(([k, v]) => [k, v / total]));
  }

  // 막아 둔 축은 **합친 뒤에 지운다.** 합치기 전에 지우면 그 축을 쓰던
  // 체계가 통째로 조용해져서, 침묵이 근거 부족처럼 보인다.
  const blocked = [];
  for (const axis of AXES[domain]) {
    if (!isAxisSuppressed(domain, axis)) continue;
    blocked.push(axis);
    vec[axis] = 0;
  }

  // **최댓값으로 다시 키우지 않는다.** 합친 값이 낮다는 것은 "여럿이
  // 말했지만 같은 쪽은 아니었다"는 뜻이고, 그 정보를 지우면 안 된다.
  const features = isEmpty(vec) ? null : round3(clamp01(vec));
  const categories = features ? categorize(domain, features) : {};

  // 막아 둔 출력은 계산은 하되 내보내지 않는다
  const suppressedOutputs = [];
  for (const name of Object.keys(categories)) {
    if (!isOutputSuppressed(domain, name)) continue;
    suppressedOutputs.push({ name, why: SUPPRESSED.outputs[`${domain}.${name}`] });
    delete categories[name];
  }

  return {
    domain,
    features,
    categories,
    // 몇이 말했고 몇이 침묵했나. 결론의 무게를 읽는 데 이 숫자가 먼저다
    spokeCount: spoke.length,
    silent: silent.map((r) => ({ system: r.system, name: r.systemName, status: r.status, why: r.why })),
    contributors,
    blockedAxes: blocked.map((a) => ({ axis: a, why: SUPPRESSED.axes[`${domain}.${a}`] })),
    suppressedOutputs,
    // 근거가 둘도 안 되면 합쳤다고 말하지 않는다
    weak: spoke.length < 2,
  };
}

/**
 * 체계마다 따로 낸 범주 분포. **합친 것과 나란히 낸다.**
 * 합친 쪽이 언제나 낫다는 보장이 없으므로 둘 다 보여 주고 채점한다.
 */
export function perSystemCategories(reads, domain) {
  return reads
    .filter((r) => r.status === 'ok' && r.features)
    .map((r) => ({
      system: r.system, name: r.systemName,
      features: r.features,
      categories: categorize(domain, r.features),
      evidence: r.evidence,
    }));
}

/**
 * 일곱 분야를 한 번에.
 *
 * @param {object} interpreted systems.js 의 interpretSystems 결과
 * @param {object|null} calibration reliability.buildWeights 에 넘길 실측값
 */
export function ensemble(interpreted, calibration = null) {
  const weights = buildWeights(calibration);
  const out = {};
  for (const [domain, reads] of Object.entries(interpreted.byDomain)) {
    out[domain] = {
      ...poolDomain(reads, domain, weights),
      bySystem: perSystemCategories(reads, domain),
    };
  }
  return { domains: out, weights };
}
