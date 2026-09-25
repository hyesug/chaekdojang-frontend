/**
 * scoring.js — **확률을 채점한다**
 *
 * ── 폐기한 채점법 ──────────────────────────────────────────
 * "열다섯 중 하나가 맞았으면 성공"은 쓰지 않는다. 남의 명반을 줘도
 * 90% 가 걸렸다(`scripts/validate-attribution.mjs`). 넓게 말하는 쪽이
 * 자동으로 이기는 자라서, 그 자로는 아무것도 잴 수 없다.
 *
 * ── 대신 쓰는 것 ───────────────────────────────────────────
 * 확률형 채점 규칙(proper scoring rule)은 **넓게 말하면 손해를 보게**
 * 되어 있다. 아래 둘이 그렇다.
 *
 *   로그 손실  −ln p(정답)          낮을수록 좋음
 *   브라이어   Σ (p − y)²           낮을수록 좋음
 *
 *   체계 A: IT 0.65 (정답 IT)  →  로그 0.43 · 브라이어 0.17
 *   체계 B: 열여섯에 고루 0.06  →  로그 2.77 · 브라이어 0.94
 *
 * B 의 목록에 IT 가 들어 있다고 맞힌 것으로 세지 않는다. **이것이 이
 * 파일의 존재 이유다.**
 *
 * ── 한 눈금만 보고 결론 내지 않는다 ─────────────────────────
 * 표본이 작을 때는 지표마다 다른 말을 한다. 그래서 여섯을 함께 낸다.
 */

/** 분포를 안전하게 읽는다. 없는 칸은 0 이 아니라 아주 작은 값으로 본다 */
const EPS = 1e-9;
const p = (dist, key) => Math.max(EPS, dist?.[key] ?? 0);

export function logLoss(dist, trueKey) {
  return -Math.log(p(dist, trueKey));
}

export function brier(dist, trueKey) {
  const keys = Object.keys(dist ?? {});
  if (!keys.length) return null;
  return keys.reduce((t, k) => t + ((dist[k] ?? 0) - (k === trueKey ? 1 : 0)) ** 2, 0);
}

/**
 * 동점을 평균 순위로 처리한다.
 * 동점을 1등으로 세면 평평한 분포가 공짜로 top-1 을 가져간다.
 */
export function rankOf(dist, trueKey) {
  const keys = Object.keys(dist ?? {});
  if (!keys.length || !(trueKey in (dist ?? {}))) return null;
  const v = dist[trueKey];
  const higher = keys.filter((k) => dist[k] > v).length;
  const equal = keys.filter((k) => dist[k] === v).length;
  return { rank: higher + (equal + 1) / 2, n: keys.length };
}

export function scoreOne(dist, trueKey) {
  if (!dist || trueKey == null || !(trueKey in dist)) return null;
  const r = rankOf(dist, trueKey);
  return {
    p: Math.round(p(dist, trueKey) * 1000) / 1000,
    logLoss: logLoss(dist, trueKey),
    brier: brier(dist, trueKey),
    rank: r.rank, n: r.n,
    top1: r.rank <= 1,
    top3: r.rank <= 3,
    mrr: 1 / r.rank,
    // 0 = 꼴찌, 1 = 1등. 우연은 0.5
    rankPercentile: r.n > 1 ? (r.n - r.rank) / (r.n - 1) : 0.5,
  };
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);

export function summarize(scores) {
  const v = scores.filter(Boolean);
  if (!v.length) return { n: 0 };
  return {
    n: v.length,
    logLoss: r3(mean(v.map((x) => x.logLoss))),
    brier: r3(mean(v.map((x) => x.brier))),
    top1: r3(mean(v.map((x) => (x.top1 ? 1 : 0)))),
    top3: r3(mean(v.map((x) => (x.top3 ? 1 : 0)))),
    mrr: r3(mean(v.map((x) => x.mrr))),
    rankPercentile: r3(mean(v.map((x) => x.rankPercentile))),
  };
}

// ─────────────────────────────────────────────────────────────
// 여러 라벨이 동시에 참인 속성 (multi-label)
// ─────────────────────────────────────────────────────────────

/**
 * 속성 채점 — 직업 하나에 기술성·분석성·조직성이 동시에 있다.
 *
 * @param {object} scores  축 → 0~1
 * @param {string[]} truth 실제로 해당하는 축
 * @param {number} threshold 이 위면 '그렇다'로 본다
 */
export function multiLabel(scores, truth, threshold = 0.4) {
  const keys = Object.keys(scores ?? {});
  if (!keys.length) return null;
  const T = new Set(truth ?? []);
  const said = keys.filter((k) => (scores[k] ?? 0) >= threshold);
  const hit = said.filter((k) => T.has(k)).length;
  const precision = said.length ? hit / said.length : null;
  const recall = T.size ? said.filter((k) => T.has(k)).length / T.size : null;
  const f1 = precision != null && recall != null && precision + recall > 0
    ? (2 * precision * recall) / (precision + recall) : 0;
  // 문턱을 안 넘는 값도 채점에 들어가도록 축마다 브라이어를 낸다
  const brierPerAxis = mean(keys.map((k) => ((scores[k] ?? 0) - (T.has(k) ? 1 : 0)) ** 2));
  return { precision: r3(precision), recall: r3(recall), f1: r3(f1), brier: r3(brierPerAxis), said };
}

// ─────────────────────────────────────────────────────────────
// 기준선 — 무엇과 견주는가
// ─────────────────────────────────────────────────────────────

/** 고르게 찍기 */
export const uniformDist = (keys) =>
  Object.fromEntries(keys.map((k) => [k, 1 / keys.length]));

/**
 * 한계분포(marginal) — **훈련 쪽 사람들의 답 빈도만**으로 만든다.
 *
 * 이게 가장 중요한 기준선이다. 명반을 하나도 안 보고 "우리 표본에 흔한
 * 답"만 찍는 것이고, 지금까지 이 저장소에서 융합이 실제로 수렴한 자리다.
 * **이것을 못 넘으면 명반이 기여한 것이 없다.**
 */
export function marginalDist(keys, trainLabels, alpha = 1) {
  const count = Object.fromEntries(keys.map((k) => [k, alpha]));
  for (const l of trainLabels) if (l in count) count[l] += 1;
  const total = Object.values(count).reduce((a, b) => a + b, 0);
  return Object.fromEntries(keys.map((k) => [k, count[k] / total]));
}

/** 오른쪽 꼬리 순열검정 — 실제 값이 섞은 분포의 어디쯤인가 */
export function permutationP(realScore, shuffledScores, lowerIsBetter = true) {
  const n = shuffledScores.length;
  if (!n) return null;
  const ge = shuffledScores.filter((s) => (lowerIsBetter ? s <= realScore : s >= realScore)).length;
  return Math.round(((ge + 1) / (n + 1)) * 1000) / 1000;
}

// ─────────────────────────────────────────────────────────────
// 오른쪽 절단 (right censoring) — 아직 안 일어난 일
// ─────────────────────────────────────────────────────────────

/**
 * "34세 현재 미혼"을 "결혼 안 하는 사람"으로 채점하지 않는다.
 *
 * 관측된 것은 **그 나이까지 사건이 없었다**는 사실뿐이다. 그러므로
 * 그 나이까지의 누적확률이 낮았을수록 좋은 예측이다.
 *
 * @param {Array<{ageRange, score}>} bands
 * @param {number} observedUntilAge
 */
export function censoredScore(bands, observedUntilAge) {
  if (!bands?.length || observedUntilAge == null) return null;
  let before = 0;
  for (const b of bands) {
    const [a] = String(b.ageRange).split('-').map(Number);
    if (a + 1 <= observedUntilAge) before += b.score ?? 0;
  }
  const survive = Math.max(EPS, 1 - before);
  return { cumulativeBefore: r3(before), logLoss: -Math.log(survive), observedUntilAge };
}
