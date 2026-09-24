/**
 * scenario/phase.js — **한 달의 봉우리를 사건으로 만들지 않는다**
 *
 * 순위는 그 사람 안에서의 상대값이라, 가장 높은 한 달을 집어 "그때다"로
 * 읽으면 37달 창에 이직 봉우리가 열 개 생긴다(실측). 일이란 것은 대개
 * 준비 → 고비 → 정리의 흐름으로 오므로, 이어지는 달을 **국면**으로 묶는다.
 *
 *   buildup     올라오는 구간
 *   peak        가장 높은 구간
 *   resolution  내려가는 구간
 *
 * ── 기간을 늘이지 않는다 ───────────────────────────────────
 * 문턱을 넘은 **이어지는 달**만 쓴다. 넉넉해 보이라고 앞뒤를 덧붙이지
 * 않는다. 분야마다 정해 둔 해상도(month/quarter/halfyear)를 그대로 따른다.
 */

import { RESOLUTION, WINDOW_MONTHS, monthNo } from '../timing/schema.js';

const round3 = (v) => Math.round(v * 1000) / 1000;

/**
 * 한 분야의 국면을 뽑는다.
 *
 * @param {object} result predictTimeline 결과
 * @param {string} domain
 * @param {object} o
 *   peakFloor  이 백분위 위를 봉우리로 본다 (기본 85)
 *   baseFloor  국면에 넣을 최소 백분위 (기본 60)
 *   max        몇 개까지
 */
export function timingPhases(result, domain, o = {}) {
  const peakFloor = o.peakFloor ?? 85;
  const baseFloor = o.baseFloor ?? 60;
  const max = o.max ?? 4;

  const keys = Object.keys(result.timeline).sort();
  const rows = keys.map((k) => {
    const d = result.timeline[k]?.domains?.[domain];
    return {
      key: k, n: monthNo(k),
      activation: d?.rawActivation ?? null,
      percentile: d?.percentile ?? null,
      unavailable: !d || d.unavailable === true,
      windowFull: d?.windowFull !== false,
    };
  });
  const usable = rows.filter((r) => !r.unavailable && Number.isFinite(r.activation));
  if (!usable.length) {
    return { domain, resolution: RESOLUTION[domain] ?? 'month', phases: [],
      note: '이 분야의 시기를 말할 수 있는 체계가 없다' };
  }
  // 값이 전부 같으면 국면이랄 것이 없다 — 없다고 적는다
  if (new Set(usable.map((r) => r.activation)).size <= 1) {
    return { domain, resolution: RESOLUTION[domain] ?? 'month', phases: [],
      note: '이 기간 값이 달마다 같다 — 국면을 가르지 못한다' };
  }

  // ── 문턱을 넘은 이어지는 달을 덩어리로 ──
  const minLen = WINDOW_MONTHS[RESOLUTION[domain]] ?? 1;
  const runs = [];
  let cur = null;
  for (const r of rows) {
    const ok = !r.unavailable && Number.isFinite(r.percentile) && r.percentile >= baseFloor;
    if (ok) {
      if (cur && r.n === cur[cur.length - 1].n + 1) cur.push(r);
      else { if (cur) runs.push(cur); cur = [r]; }
    } else if (cur) { runs.push(cur); cur = null; }
  }
  if (cur) runs.push(cur);

  const phases = [];
  for (const run of runs) {
    const top = Math.max(...run.map((r) => r.percentile));
    if (top < peakFloor) continue;                       // 봉우리라 부를 것이 없다
    if (run.length < minLen) continue;                   // 분야 해상도보다 짧으면 국면이 아니다

    const peakIdx = run.reduce((best, r, i) => (r.activation > run[best].activation ? i : best), 0);
    // 봉우리 구간 = 봉우리 백분위에 붙어 있는 이어지는 달
    let ps = peakIdx, pe = peakIdx;
    while (ps > 0 && run[ps - 1].percentile >= peakFloor) ps--;
    while (pe < run.length - 1 && run[pe + 1].percentile >= peakFloor) pe++;

    const span = (a, b) => (a > b ? null : {
      from: run[a].key, to: run[b].key, months: b - a + 1,
      meanActivation: round3(run.slice(a, b + 1).reduce((s, r) => s + r.activation, 0) / (b - a + 1)),
    });

    phases.push({
      domain,
      resolution: RESOLUTION[domain] ?? 'month',
      start: run[0].key,
      peak: run[peakIdx].key,
      end: run[run.length - 1].key,
      peakPercentile: run[peakIdx].percentile,
      peakActivation: round3(run[peakIdx].activation),
      /** 문턱을 넘어 이어진 달 수 ÷ 그 분야의 창 — 1 보다 크면 창보다 오래 간다 */
      persistence: Math.round((run.length / minLen) * 100) / 100,
      months: run.length,
      /** 창이 덜 찬 달이 섞였는가 (시계열 가장자리) */
      edge: run.some((r) => !r.windowFull),
      buildup: span(0, ps - 1),
      peakPhase: span(ps, pe),
      resolution_: span(pe + 1, run.length - 1),
      keys: run.map((r) => r.key),
    });
  }

  phases.sort((a, b) => b.peakPercentile - a.peakPercentile || a.start.localeCompare(b.start));
  return {
    domain, resolution: RESOLUTION[domain] ?? 'month',
    phases: phases.slice(0, max),
    ...(phases.length ? {} : { note: `백분위 ${peakFloor} 을 넘는 이어진 구간이 없다` }),
  };
}

/**
 * 출력 모양을 요청대로 `{buildup, peak, resolution}` 으로 낸다.
 * (`resolution` 이라는 이름이 해상도와 겹쳐서 내부에서는 `resolution_` 로 둔다)
 */
export const asPhaseShape = (p) => ({
  buildup: p.buildup, peak: p.peakPhase, resolution: p.resolution_,
  start: p.start, peakMonth: p.peak, end: p.end,
  peakPercentile: p.peakPercentile, persistence: p.persistence,
  grain: p.resolution,
});
