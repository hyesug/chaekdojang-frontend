/**
 * validation/timingMetrics.js — 시기 채점의 **자**
 *
 * 앞선 검증기에서 실제로 걸린 잘못 넷을 여기서 막는다.
 *
 *   1. 동점을 배열 순서로 깨서 앞 달이 이겼다
 *   2. 반올림한 값을 채점에 써서 없던 동점이 생겼다
 *   3. "Top-3 중 하나가 ±3달 안" 을 "±3달 적중률" 이라고 불렀다
 *   4. 값이 전부 같은(구분 못 하는) 시계열에 50% 를 줘서 예측력처럼 보였다
 *
 * ── 이름과 계산을 일치시킨다 ───────────────────────────────
 *   EventPercentile        사건월이 전체에서 몇 번째인가 (동점 중간순위)
 *   ExactMonth             사건월이 1위인가
 *   Top1/Top3/Top5         상위 K 안에 사건월이 들었나 (동점은 모두 포함)
 *   Top3Within±N           상위 3 안의 달 중 하나가 사건 ±N달 안인가
 *   BestPercentileWithin±N 사건 ±N달 창에서 가장 높은 달의 백분위
 *   PeakErrorMonths        전체 최고점이 사건에서 몇 달 떨어졌나
 *
 * 값이 전부 같으면 **`unscorable: 'no_variation'`** 이다. 그 체계가 그
 * 기간의 시기를 구분하지 못한 것이지, 틀린 것도 맞은 것도 아니다.
 */

import { midRank, topK, monthNo, seededRandom } from '../semantic/timing/schema.js';

/**
 * 한 사건을 채점한다.
 *
 * @param {Array<{k:string, v:number|null}>} series 달별 **원값** (반올림 금지)
 * @param {string} eventKey 사건이 일어난 달 'YYYY-MM'
 */
export function scoreEvent(series, eventKey) {
  const xs = series.filter((e) => Number.isFinite(e.v));
  if (!xs.length) return { unscorable: 'no_data' };
  const target = xs.find((e) => e.k === eventKey);
  if (!target) return { unscorable: 'event_outside_range' };

  const mr = midRank(xs.map((e) => e.v), target.v);
  if (mr.allEqual) {
    return { unscorable: 'no_variation', n: mr.n,
      note: '그 기간 값이 전부 같다 — 이 체계는 이 시기를 구분하지 못한다' };
  }

  const away = (k) => Math.abs(monthNo(k) - monthNo(eventKey));
  const tk = (k) => topK(xs, k);
  const inTop = (k) => tk(k).keys.includes(eventKey);
  const top3 = tk(3);
  const within = (tol) => top3.keys.some((k) => away(k) <= tol);

  // 사건 ±N달 창에서 가장 높은 달이 전체에서 몇 번째인가
  const bestWithin = (tol) => {
    const near = xs.filter((e) => away(e.k) <= tol);
    if (!near.length) return null;
    const best = Math.max(...near.map((e) => e.v));
    return midRank(xs.map((e) => e.v), best).percentile;
  };

  const best = Math.max(...xs.map((e) => e.v));
  const peaks = xs.filter((e) => e.v === best).map((e) => e.k);

  return {
    unscorable: null,
    n: mr.n, rank: mr.rank, tied: mr.tied,
    eventPercentile: mr.percentile,
    exactMonth: peaks.length === 1 && peaks[0] === eventKey,
    top1: inTop(1), top3: inTop(3), top5: inTop(5),
    top1Count: tk(1).candidateCount, top3Count: top3.candidateCount, top5Count: tk(5).candidateCount,
    top3Within1: within(1), top3Within3: within(3), top3Within6: within(6),
    bestPercentileWithin1: bestWithin(1),
    bestPercentileWithin3: bestWithin(3),
    bestPercentileWithin6: bestWithin(6),
    peakErrorMonths: Math.min(...peaks.map(away)),
  };
}

/**
 * 달 시계열을 해 시계열로 접는다.
 *
 * 해 단위로만 바뀌는 체계를 달 눈금으로 재면, 같은 값 열두 개를 열두 개의
 * 순위로 부풀리게 된다. 그런 체계는 해로 접어서 잰다.
 */
export function toYearly(series) {
  const by = new Map();
  for (const e of series) {
    if (!Number.isFinite(e.v)) continue;
    const y = String(e.k).slice(0, 4);
    const cur = by.get(y) ?? { sum: 0, n: 0 };
    cur.sum += e.v; cur.n++; by.set(y, cur);
  }
  return [...by.entries()].map(([y, c]) => ({ k: y, v: c.sum / c.n }));
}

/** 해 단위 채점 — 사건이 일어난 **해**가 몇 번째인가 */
export function scoreEventYearly(series, eventYear) {
  const ys = toYearly(series);
  const target = ys.find((e) => e.k === String(eventYear));
  if (!target) return { unscorable: 'event_outside_range' };
  const mr = midRank(ys.map((e) => e.v), target.v);
  if (mr.allEqual) {
    return { unscorable: 'no_variation', n: mr.n,
      note: '그 기간 해마다 값이 같다 — 이 체계는 이 시기를 구분하지 못한다' };
  }
  const tk = topK(ys, 1);
  return {
    unscorable: null, n: mr.n, rank: mr.rank, tied: mr.tied,
    eventPercentile: mr.percentile,
    top1: tk.keys.includes(String(eventYear)), top1Count: tk.candidateCount,
  };
}

/**
 * 순열 기준선 — **같은 사람의 같은 시계열 안에서** 사건월을 무작위로 뽑는다.
 *
 * 남의 사건과 섞는 방식은 보조 진단으로만 쓴다. 그 방식은 "명반이 남의
 * 것이면 나쁜가"를 재는데, 우리가 알고 싶은 것은 **"이 사람 안에서 하필
 * 그 달이었나"** 이기 때문이다.
 *
 * 씨앗을 고정해 돌릴 때마다 같은 값이 나오게 한다.
 */
export function permutationBaseline(series, rounds = 10000, seed = 20260924) {
  const xs = series.filter((e) => Number.isFinite(e.v));
  if (xs.length < 3) return null;
  if (new Set(xs.map((e) => e.v)).size <= 1) return { unscorable: 'no_variation' };
  const rnd = seededRandom(seed);
  const out = [];
  for (let i = 0; i < rounds; i++) {
    const pick = xs[Math.floor(rnd() * xs.length)];
    const p = midRank(xs.map((e) => e.v), pick.v).percentile;
    if (p != null) out.push(p);
  }
  out.sort((a, b) => a - b);
  const mean = out.reduce((a, b) => a + b, 0) / out.length;
  return {
    mean: Math.round(mean * 10) / 10,
    lo: out[Math.floor(out.length * 0.025)],
    hi: out[Math.floor(out.length * 0.975)],
    rounds: out.length, seed,
  };
}

/** 관측값이 순열 분포의 어디쯤인가 (한쪽 꼬리) */
export function permutationP(observed, nulls) {
  if (!nulls?.length) return null;
  const ge = nulls.filter((v) => v >= observed).length;
  return Math.round(((ge + 1) / (nulls.length + 1)) * 1000) / 1000;
}

/**
 * 사람별로 먼저 평균하고 사람끼리 다시 평균한다.
 *
 * 한 사람이 사건을 여럿 냈다고 전체를 지배하면 안 된다. 열한 건은
 * **열한 명이 아니라 다섯 명**이다.
 */
export function personWeighted(rows, pick) {
  const byPerson = new Map();
  for (const r of rows) {
    const v = pick(r);
    if (v == null) continue;
    const cur = byPerson.get(r.person) ?? [];
    cur.push(v); byPerson.set(r.person, cur);
  }
  const perPerson = [...byPerson.entries()]
    .map(([person, xs]) => ({ person, mean: xs.reduce((a, b) => a + b, 0) / xs.length, n: xs.length }));
  if (!perPerson.length) return null;
  const mean = perPerson.reduce((a, p) => a + p.mean, 0) / perPerson.length;
  return { mean: Math.round(mean * 10) / 10, people: perPerson.length, perPerson };
}

/** 사람 단위 부트스트랩 — 표본이 적으면 탐색용으로만 읽는다 */
export function personBootstrap(rows, pick, rounds = 5000, seed = 20260924) {
  const pw = personWeighted(rows, pick);
  if (!pw || pw.people < 2) return null;
  const means = pw.perPerson.map((p) => p.mean);
  const rnd = seededRandom(seed);
  const out = [];
  for (let i = 0; i < rounds; i++) {
    let s = 0;
    for (let j = 0; j < means.length; j++) s += means[Math.floor(rnd() * means.length)];
    out.push(s / means.length);
  }
  out.sort((a, b) => a - b);
  return {
    mean: pw.mean,
    lo: Math.round(out[Math.floor(out.length * 0.025)] * 10) / 10,
    hi: Math.round(out[Math.floor(out.length * 0.975)] * 10) / 10,
    people: pw.people,
    note: pw.people < 10 ? '사람이 적어 구간은 탐색용으로만 읽는다' : null,
  };
}
