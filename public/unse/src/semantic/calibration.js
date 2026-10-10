/**
 * calibration.js — **어느 체계가 어느 속성을 잘 읽는가**
 *
 * ── 이 파일이 찾는 것 ──────────────────────────────────────
 * "P01 은 카발라가 맞혔다" 가 아니다. 그건 그 사람에게만 붙는 이름표라
 * 다음 사람에게 넘어가지 않는다(실측: LOO 0/11).
 *
 * 찾는 것은 이것이다.
 *
 *   자미두수는 **어떤 종류의 현실 속성**을 반복해서 잘 포착하는가
 *   사주는 어떤 속성을 잘 읽는가
 *   서양은 어떤 속성을 잘 읽는가
 *
 * 사람별 담당이 아니라 **속성별 강한 체계**를 찾는다. 그래야 새 사람에게
 * 넘어간다 — 그 사람이 누구인지 몰라도 "기술성은 A가 잘 읽더라"는 쓸 수 있다.
 *
 * ── 어떻게 재는가 ──────────────────────────────────────────
 * 축 하나를 두고 사람 열하나를 늘어놓는다.
 *
 *   실제 technical:  0.9  0.5  0.2  0.2  ...
 *   자미 technical:  0.7  0.4  0.3  0.1  ...
 *
 * 둘이 같이 오르내리는가(상관)와 값이 얼마나 가까운가(MAE)를 함께 본다.
 * 상관만 보면 "늘 0.5 를 내는 체계"가 0점이 되고, MAE만 보면 "늘 평균값을
 * 내는 체계"가 높은 점수를 받는다. 둘 다 필요하다.
 *
 * ── 작은 표본에서 무게를 크게 움직이지 않는다 ────────────────
 * 표본 수에 따라 움직일 수 있는 폭 자체를 묶는다.
 *
 *   n 1~3   ±0.03      n 4~6   ±0.05
 *   n 7~12  ±0.10      n 13+   ±0.15 (천천히 열린다)
 *
 * 무시하지도 않고 과적합하지도 않는 자리다.
 */

import { AXES } from './axes.js';

const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** 최댓값 1 로 맞춘다. 체계마다 값의 전체 크기가 달라 그대로는 못 견준다 */
export function unitize(v) {
  const max = Math.max(0, ...Object.values(v ?? {}));
  if (!max) return v ?? {};
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x / max]));
}

export function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  if (dx <= 0 || dy <= 0) return null;   // 변화가 없으면 상관을 말할 수 없다
  return num / Math.sqrt(dx * dy);
}

export function cosineOf(a, b, keys) {
  let dot = 0, na = 0, nb = 0;
  for (const k of keys) {
    const x = a[k] ?? 0, y = b[k] ?? 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0;
}

/** 표본 수에 따라 무게가 움직일 수 있는 폭 */
export function driftCap(n) {
  if (!n) return 0;
  if (n <= 3) return 0.03;
  if (n <= 6) return 0.05;
  if (n <= 12) return 0.10;
  return Math.min(0.30, 0.10 + (n - 12) * 0.005);
}

/**
 * 체계 × 속성 성능을 잰다.
 *
 * @param {Array} rows [{ id, truth: {axis: v}, systems: [{system, features}] }]
 * @param {string} domain
 */
export function measure(rows, domain = 'career') {
  const axes = AXES[domain];
  const systems = [...new Set(rows.flatMap((r) => r.systems.map((s) => s.system)))];
  const bySystem = {};

  for (const id of systems) {
    const pairs = rows
      .map((r) => ({ truth: unitize(r.truth), pred: r.systems.find((s) => s.system === id)?.features }))
      .filter((p) => p.pred)
      .map((p) => ({ truth: p.truth, pred: unitize(p.pred) }));
    if (!pairs.length) { bySystem[id] = { n: 0 }; continue; }

    // 사람마다의 전체 유사도
    const sims = pairs.map((p) => cosineOf(p.truth, p.pred, axes));

    // 축마다
    const byFeature = {};
    for (const ax of axes) {
      const t = pairs.map((p) => p.truth[ax] ?? 0);
      const q = pairs.map((p) => p.pred[ax] ?? 0);
      const corr = pearson(t, q);
      const mae = mean(t.map((v, i) => Math.abs(v - q[i])));
      // 읽기 점수 — 같이 움직이는가(상관)와 값이 가까운가(MAE)를 절반씩
      const corrPart = corr == null ? 0.5 : (corr + 1) / 2;
      const maePart = 1 - Math.min(1, mae);
      byFeature[ax] = {
        n: pairs.length,
        corr: r3(corr), mae: r3(mae),
        readScore: r3(0.5 * corrPart + 0.5 * maePart),
        // 그 체계가 이 축을 **말하기는 하는가**. 말하지 않으면 점수가 높아도 뜻이 없다
        spoke: r3(mean(q.map((v) => (v > 0.15 ? 1 : 0)))),
      };
    }
    bySystem[id] = {
      n: pairs.length,
      similarity: r3(mean(sims)),
      similarityMin: r3(Math.min(...sims)),
      similarityMax: r3(Math.max(...sims)),
      byFeature,
    };
  }

  // 축마다 어느 체계가 잘 읽는지 줄을 세운다
  const byFeature = {};
  for (const ax of axes) {
    byFeature[ax] = systems
      .filter((id) => bySystem[id].n)
      .map((id) => ({ system: id, ...bySystem[id].byFeature[ax] }))
      // 말하지도 않는 체계가 1위가 되면 안 된다
      .sort((a, b) => (b.readScore * (0.3 + 0.7 * b.spoke)) - (a.readScore * (0.3 + 0.7 * a.spoke)));
  }
  return { bySystem, byFeature, systems };
}

/**
 * 성능표를 **속성별 무게**로 바꾼다.
 *
 * 기준은 그 축을 읽은 체계들의 평균이다. 평균보다 잘 읽으면 1 위로,
 * 못 읽으면 1 아래로 — 다만 `driftCap` 안에서만 움직인다.
 */
export function weightsFrom(measurement, domain = 'career') {
  const axes = AXES[domain];
  const out = {};
  for (const ax of axes) {
    const rows = (measurement.byFeature[ax] ?? []).filter((r) => r.n);
    if (!rows.length) continue;
    const avg = mean(rows.map((r) => r.readScore));
    const spread = Math.max(1e-6, Math.max(...rows.map((r) => r.readScore)) - Math.min(...rows.map((r) => r.readScore)));
    for (const r of rows) {
      const lift = (r.readScore - avg) / spread;            // −1 ~ +1 쯤
      const cap = driftCap(r.n);
      const w = 1 + Math.max(-1, Math.min(1, lift)) * cap;
      (out[r.system] ??= {})[ax] = r3(w);
    }
  }
  return out;
}

/** 규칙 단위 실측 뒷받침 — rules.applyEmpirical 이 받는 모양 */
export function ruleSupportFrom(rows, domain = 'career') {
  const acc = {};
  for (const r of rows) {
    const truth = unitize(r.truth);
    for (const s of r.systems) {
      for (const e of s.evidence ?? []) {
        const sim = cosineOf(truth, unitize(e.contribution), AXES[domain]);
        (acc[e.rule] ??= []).push(sim);
      }
    }
  }
  return Object.fromEntries(Object.entries(acc)
    .map(([id, xs]) => [id, { value: mean(xs), n: xs.length }]));
}

/**
 * 한 사람에 대해 **무엇을 맞히고 무엇을 틀렸나**.
 * 오류 분석이 이 작업의 핵심이라 따로 낸다.
 */
export function compareOne(truth, pred, domain = 'career', near = 0.2) {
  const t = unitize(truth), p = unitize(pred);
  const hit = [], missed = [], over = [];
  for (const ax of AXES[domain]) {
    const a = t[ax] ?? 0, b = p[ax] ?? 0;
    if (a >= 0.5 && b >= 0.5 - near) hit.push(ax);           // 실제로 높은데 읽어 냈다
    else if (a >= 0.5 && b < 0.5 - near) missed.push(ax);    // 실제로 높은데 못 읽었다
    else if (a < 0.3 && b >= 0.6) over.push(ax);             // 실제로 낮은데 세게 읽었다
  }
  return { similarity: r3(cosineOf(t, p, AXES[domain])), hit, missed, over };
}
