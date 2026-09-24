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
 *
 * **이것은 사건 하나짜리 기준선이다.** 여러 사건의 구간을 평균해서 합산값의
 * 기준선으로 쓰면 안 된다 — 합산값은 `aggregateNull()` 로 잰다.
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

/**
 * **그 사람의 그 체계 눈금**으로 잰다.
 *
 * 눈금은 체계의 성질만으로 정해지지 않는다. 태을신수는 한 궁에 세 해를
 * 머무는데, 궁이 바뀌는 자리가 사람마다 달라서 어떤 사람의 구간에서는 달이
 * 갈리고 어떤 사람의 구간에서는 갈리지 않는다. **첫 사람 눈금을 체계 전체에
 * 씌우면 나머지 사람을 남의 자로 재게 된다.** 그래서 행마다 받는다.
 *
 * @param {Array} series 그 체계·그 분야의 달별 원값
 * @param {{resolution:'month'|'year'|'none', precision:'month'|'year', year:number, key:string}} row
 * @returns {{skipped, scale, score}} skipped 가 있으면 채점하지 않은 것이다
 */
export function scoreAtResolution(series, { resolution, precision, year, key }) {
  if (resolution === 'none') return { skipped: 'no_resolution', scale: null, score: null };
  if (!series?.some((e) => Number.isFinite(e.v))) {
    return { skipped: 'unavailable', scale: null, score: null };
  }
  // 체계가 해 단위거나, 사건 날짜 자체가 해까지만 알려진 경우 해로 접는다
  const scale = resolution === 'year' || precision === 'year' ? 'year' : 'month';
  const score = scale === 'year' ? scoreEventYearly(series, year) : scoreEvent(series, key);
  if (score.unscorable === 'no_variation') return { skipped: 'no_variation', scale, score };
  if (score.unscorable) return { skipped: 'unavailable', scale, score };
  return { skipped: null, scale, score };
}

// ═════════════════════════════════════════════════════════════
// 합산 통계의 null 분포
//
// **사건 하나하나의 null 구간을 평균하면 안 된다.** 사건 하나를 무작위로
// 뽑았을 때의 95% 구간은 2~98% 처럼 넓지만, 열 건의 **평균**이 그만큼 흔들리지는
// 않는다. 평균은 √n 만큼 좁아진다. 개별 구간을 평균해서 합산값 옆에 놓으면,
// 넓은 자를 좁은 값에 대는 셈이라 무엇을 재도 "구간 안"이 된다.
//
// 그러므로 **합산 통계 자체의 null 분포**를 만든다. 한 회차마다 모든 사건을
// 각자 자기 시계열 안에서 무작위 달로 옮기고, **그 회차의 합산값**을 적는다.
// 그것을 10,000회 모은 것이 비교 대상이다.
// ═════════════════════════════════════════════════════════════

/** 순열이 쓰는 지표들 — 참/거짓 지표는 0·100 으로 적어 관측 %와 같은 자로 잰다 */
export const NULL_METRICS = [
  'eventPercentile',
  'top3Within1', 'top3Within3', 'top3Within6',
  'bestPercentileWithin1', 'bestPercentileWithin3', 'bestPercentileWithin6',
];

const TOLERANCES = [1, 3, 6];

/**
 * 한 시계열에서 **뽑을 수 있는 모든 달의 채점표**를 미리 만든다.
 *
 * 라운드마다 `scoreEvent` 를 다시 부르면 10,000회 × 사건 수만큼 정렬이 돈다.
 * 시계열이 고정이면 "그 달이 사건이었다면 받았을 점수"도 고정이므로 한 번만 센다.
 */
export function prepareNullDraws(series) {
  const xs = series.filter((e) => Number.isFinite(e.v));
  if (xs.length < 3) return null;
  if (new Set(xs.map((e) => e.v)).size <= 1) return { unscorable: 'no_variation' };

  const values = xs.map((e) => e.v);
  const nos = xs.map((e) => monthNo(e.k));
  const pctOfValue = new Map();
  for (const v of new Set(values)) pctOfValue.set(v, midRank(values, v).percentile);
  const top3 = topK(xs, 3).keys.map(monthNo);

  const draws = xs.map((e, i) => {
    const n = nos[i];
    const d = { key: e.k, eventPercentile: pctOfValue.get(e.v) };
    for (const tol of TOLERANCES) {
      d[`top3Within${tol}`] = top3.some((t) => Math.abs(t - n) <= tol) ? 100 : 0;
      let best = -Infinity;
      for (let j = 0; j < xs.length; j++) {
        if (Math.abs(nos[j] - n) <= tol && values[j] > best) best = values[j];
      }
      d[`bestPercentileWithin${tol}`] = best === -Infinity ? null : pctOfValue.get(best);
    }
    return d;
  });
  return { draws, n: xs.length };
}

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

function summarize(samples) {
  const s = samples.slice().sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return {
    mean: Math.round(mean * 10) / 10,
    lo: Math.round(quantile(s, 0.025) * 10) / 10,
    hi: Math.round(quantile(s, 0.975) * 10) / 10,
    samples: s,
  };
}

/**
 * 합산 통계의 순열 null 분포.
 *
 * @param {Array<{person:string, series:Array}>} rows 채점된 월 단위 사건들
 * @returns {{rounds, seed, events, people, metrics}} metrics[지표] = {event, person}
 *          event  = 사건 가중 평균의 null 분포
 *          person = 사람별로 먼저 평균한 뒤 사람끼리 평균한 값의 null 분포
 */
export function aggregateNull(rows, { rounds = 10000, seed = 20260924 } = {}) {
  const prepared = [];
  for (const r of rows) {
    const p = prepareNullDraws(r.series);
    if (!p || p.unscorable) continue;
    prepared.push({ person: r.person, draws: p.draws });
  }
  if (!prepared.length) return null;

  const people = [...new Set(prepared.map((p) => p.person))];
  const rnd = seededRandom(seed);
  const acc = {};
  for (const m of NULL_METRICS) acc[m] = { event: [], person: [] };

  const pick = new Array(prepared.length);
  for (let i = 0; i < rounds; i++) {
    // 한 회차 — 사건마다 **자기 시계열 안에서** 무작위 달을 하나씩 뽑는다
    for (let j = 0; j < prepared.length; j++) {
      const d = prepared[j].draws;
      pick[j] = d[Math.floor(rnd() * d.length)];
    }
    for (const m of NULL_METRICS) {
      let sum = 0, n = 0;
      const byPerson = new Map();
      for (let j = 0; j < prepared.length; j++) {
        const v = pick[j][m];
        if (v == null) continue;
        sum += v; n++;
        const cur = byPerson.get(prepared[j].person) ?? { s: 0, c: 0 };
        cur.s += v; cur.c++; byPerson.set(prepared[j].person, cur);
      }
      if (!n) continue;
      acc[m].event.push(sum / n);
      const pm = [...byPerson.values()].map((c) => c.s / c.c);
      acc[m].person.push(pm.reduce((a, b) => a + b, 0) / pm.length);
    }
  }

  const metrics = {};
  for (const m of NULL_METRICS) {
    if (!acc[m].event.length) continue;
    metrics[m] = { event: summarize(acc[m].event), person: summarize(acc[m].person) };
  }
  return { rounds, seed, events: prepared.length, people: people.length, metrics };
}

/**
 * 관측값이 null 분포의 몇 번째인가 (0~100).
 *
 * p 값이라고 부르지 않는다. 사건이 열 건 남짓일 때 소수점 셋째 자리의 p 는
 * 정밀해 보이지만 그만큼의 근거가 없다. **경험적 위치**까지만 말한다.
 */
export function nullPosition(observed, summary) {
  if (observed == null || !summary?.samples?.length) return null;
  const s = summary.samples;
  let below = 0, equal = 0;
  for (const v of s) { if (v < observed) below++; else if (v === observed) equal++; }
  return Math.round(((below + equal / 2) / s.length) * 1000) / 10;
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
