/**
 * reliability.js — 체계 × 분야의 **무게**와 **침묵**
 *
 * ── 무게를 셋으로 가른다 ───────────────────────────────────
 *   traditionalWeight  그 전통에 이 분야를 보는 전용 장치가 있는가
 *                      (이미 `systems/_base.js` 의 DOMAIN_WEIGHT 가 적어 둔 것.
 *                       **지우지 않고 그대로 가져온다.**)
 *   empiricalWeight    실제 사례가 말해 주는 것. **지금은 전부 1.0 이다.**
 *   finalWeight        둘의 곱
 *
 * 셋을 한 숫자로 합쳐 두면, 나중에 성적이 바뀌었을 때 전통 근거까지
 * 같이 지워진다. 갈라 두면 실측만 갈아 끼울 수 있다.
 *
 * ── 작은 표본에서 무게를 크게 움직이지 않는다 ────────────────
 * 열한 명에서 3명 중 3명을 맞혔다고 그 체계를 2배로 올리면, 그 무게는
 * 그 열한 명에게만 맞는다. 그래서 실측 무게는 **1.0 쪽으로 강하게
 * 끌어당긴다**(shrinkage). 표본이 커질수록만 1.0 에서 멀어진다.
 *
 *   empirical = 1 + lift × n / (n + K),   K = 20
 *
 * n=10 이면 실측이 완벽해도 무게는 1.33 을 넘지 못한다. 이것이 의도다.
 *
 * ── 침묵 ──────────────────────────────────────────────────
 * 실측이 **영점보다 나빴던 축**은 답하지 않는다. 그 판단은 이미
 * `hires/interpret.js` 의 `AXIS_OWNER` 에 있으므로 **거기서 읽어 온다.**
 * 두 군데에 적으면 한쪽만 고쳐져 조용히 갈라진다.
 */

import { axisPolicy } from '../hires/interpret.js';
import { domainWeight } from '../systems/_base.js';
import { SYSTEM_IDS } from './extract.js';

/** 새 분야 이름 → `_base.js` DOMAIN_WEIGHT 의 열 이름 */
const AREA_OF = {
  career: '직장운',
  relationship: '애정운',
  wealth: '금전운',
  education: '학업운',
  health: '건강운',
  // 자녀·주거는 그 표에 열이 없다. 없는 값을 지어내지 않고 총운을 쓴다
  children: '총운',
  residence: '총운',
};

/** 전통 무게 — 지우지 않고 그대로 가져온다 */
export const traditionalWeight = (systemId, domain) =>
  domainWeight(systemId, AREA_OF[domain] ?? '총운');

/** 실측 무게의 기본값. **데이터가 모이기 전에는 전부 1.0 이다** */
export const DEFAULT_EMPIRICAL = 1;

/** 작은 n 이 큰 차이를 만들지 못하게 하는 사전 강도 */
export const SHRINK_K = 20;

/** 실측 무게의 상한·하한. 한 체계를 죽이거나 독주시키지 않는다 */
export const EMPIRICAL_BOUNDS = [0.5, 2];

/**
 * 순위백분위 평균(0~1)을 무게로 바꾼다.
 *
 * @param {number|null} meanRankPercentile 0.5 가 '우연과 같음'
 * @param {number} n 그 값을 만든 사람 수
 */
export function shrinkToOne(meanRankPercentile, n) {
  if (meanRankPercentile == null || !n) return DEFAULT_EMPIRICAL;
  const lift = 2 * (meanRankPercentile - 0.5);       // −1 ~ +1
  const w = 1 + lift * (n / (n + SHRINK_K));
  return Math.min(EMPIRICAL_BOUNDS[1], Math.max(EMPIRICAL_BOUNDS[0], w));
}

/**
 * 답하지 않는 자리.
 *
 * 값은 `AXIS_OWNER` 의 '비움' 판정에서 끌어온다. 저쪽이 다시 채워지면
 * 여기도 같이 열린다 — 한 군데에서만 정한다.
 */
const SUPPRESSION_MAP = {
  '거주형태': [{ domain: 'residence', axes: ['ownership'], outputs: [] }],
  '혼인안정': [{ domain: 'relationship', axes: ['stability', 'volatility'], outputs: [] }],
  '직업전환': [{ domain: 'career', axes: [], outputs: ['tempo'] }],
};

export const SUPPRESSED = (() => {
  const pol = axisPolicy();
  const axes = {};      // `${domain}.${axis}` → 이유
  const outputs = {};   // `${domain}.${output}` → 이유
  for (const [axisKey, targets] of Object.entries(SUPPRESSION_MAP)) {
    if (pol[axisKey]?.grade !== '비움') continue;   // 저쪽이 열리면 여기도 열린다
    for (const t of targets) {
      const why = `${axisKey}: ${pol[axisKey].note}`;
      for (const a of t.axes) axes[`${t.domain}.${a}`] = why;
      for (const o of t.outputs) outputs[`${t.domain}.${o}`] = why;
    }
  }
  return { axes, outputs };
})();

/** 시기 — 두 자료에서 다 졌다. 사건 날짜는 어느 등급에서도 말하지 않는다 */
export const TIMING_EVIDENCE = {
  month: { p: 0.868, note: '달 단위 시기 예측은 섞은 것보다 나빴다 (두 자료)' },
  year: { p: 0.196, note: '해 단위 사주의 p=0.004 는 독립 자료에서 재현되지 않았다' },
  profile: { note: '성향은 시기와 다른 능력이다. 프로파일 성적이 시기로 넘어가지 않는다' },
};

/**
 * 한 벌의 무게표를 만든다.
 *
 * @param {object|null} calibration
 *   `{ [systemId]: { [domain]: { meanRankPercentile, n } } }`
 *   없으면 실측 무게는 전부 1.0 이다.
 */
export function buildWeights(calibration = null) {
  const out = {};
  for (const id of SYSTEM_IDS) {
    out[id] = {};
    for (const domain of Object.keys(AREA_OF)) {
      const t = traditionalWeight(id, domain);
      const c = calibration?.[id]?.[domain] ?? null;
      const e = c ? shrinkToOne(c.meanRankPercentile, c.n) : DEFAULT_EMPIRICAL;
      out[id][domain] = {
        traditionalWeight: Math.round(t * 1000) / 1000,
        empiricalWeight: Math.round(e * 1000) / 1000,
        finalWeight: Math.round(t * e * 1000) / 1000,
        calibratedOn: c?.n ?? 0,
      };
    }
  }
  return out;
}

export const isAxisSuppressed = (domain, axis) => `${domain}.${axis}` in SUPPRESSED.axes;
export const isOutputSuppressed = (domain, output) => `${domain}.${output}` in SUPPRESSED.outputs;
