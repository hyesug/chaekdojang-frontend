/**
 * timing/timeline.js — **predictTimeline**. 무엇이 언제 움직이는가
 *
 *   natal baseline × period activation × directional shift × event rules
 *   = event score
 *
 * ── 체계별 결과를 버리지 않는다 ────────────────────────────
 * 합친 것만 내보내면 나중에 "어느 체계가 직업 시기를 잘 잡는가"를
 * 물을 수 없다. `systemResults` 에 열다섯을 그대로 남긴다.
 *
 * ── 절대 점수가 아니라 순위다 ──────────────────────────────
 * "이 달 0.82" 는 그 자체로 아무 뜻이 없다. **그 사람의 그 기간 안에서**
 * 몇 번째인지가 읽을 수 있는 전부다. `percentile` 을 함께 낸다.
 */

import { readFortune } from '../../engine.js';
import * as ZW from '../../hires/ziwei.js';
import * as VEX from '../../hires/vedicExt.js';
import * as WS from '../../hires/western.js';
import { buildGrid } from '../../hires/grid.js';
import { makePeriod, monthsOfYear } from '../../forecast.js';
import { SYSTEMS } from '../../engine.js';

import { readPerson, natalFortune } from '../index.js';
import { AXES } from '../axes.js';
import { lineageOf, INDEPENDENT_LINEAGES } from '../lineage.js';
import { SYSTEM_IDS, SYSTEM_NAME } from '../extract.js';
import {
  DOMAINS, DOMAIN_LABEL, RESOLUTION, WINDOW_MONTHS,
  clamp01, monthNo, monthKey, windowSlice,
} from './schema.js';
import {
  sajuTiming, ziweiTiming, westernTiming, vedicTiming, otherTiming,
} from './adapters.js';
import { scoreEvents } from './events.js';

const safe = (fn) => { try { return fn(); } catch { return null; } };
const AUX_IDS = SYSTEM_IDS.filter((id) => !['saju', 'jamidusu', 'astrology', 'vedic'].includes(id));

/**
 * 시기별 해석.
 *
 * @param {object} o
 *   birth        출생 정보
 *   from,to      'YYYY-MM'
 *   currentState 선택 — 있으면 사건 후보를 거른다. 없으면 추측하지 않는다
 *   domains      선택 — 고르면 그 분야만
 */
export function predictTimeline(o) {
  const { birth, from, to, currentState = null } = o;
  const want = o.domains ?? DOMAINS.filter((d) => d !== 'personality' && d !== 'timing');

  // ── 정적 해석 (한 번만) ──
  const natal = readPerson(birth, { domains: want });
  const { fortune, stack } = natalFortune(birth);

  const y0 = Number(String(from).slice(0, 4));
  const y1 = Number(String(to).slice(0, 4));
  const lo = monthNo(from), hi = monthNo(to);

  // ── 네 체계의 시기 재료 — grid 가 절기월 축 위에 놓아 둔다 ──
  const months = [];
  for (let y = y0; y <= y1; y += 6) {
    const g = safe(() => buildGrid(fortune.input, fortune.chart, {
      fromYear: y, years: Math.min(6, y1 - y + 1), domain: '직업',
    }));
    for (const m of g?.months ?? []) {
      const key = `${m.from.y}-${String(m.from.m).padStart(2, '0')}`;
      const n = monthNo(key);
      if (n < lo || n > hi) continue;
      months.push({ key, n, m });
    }
  }
  months.sort((a, b) => a.n - b.n);

  const natalPack = safe(() => WS.natalPack(fortune.input));
  const vedicPacks = { d1: safe(() => VEX.chart(fortune.input, 'D1')) };

  // ── 나머지 열한 체계 — forecast() 를 달마다 돌리고 분포를 잡는다 ──
  const sysByType = Object.fromEntries(SYSTEMS.map((s) => [s.meta.id, s]));
  const auxRows = {};       // id → key → row
  for (const id of AUX_IDS) auxRows[id] = {};
  for (const { key, n } of months) {
    const [yy, mm] = key.split('-').map(Number);
    const p = safe(() => makePeriod('month', { y: yy, m: mm, d: 15 }));
    if (!p) continue;
    for (const id of AUX_IDS) {
      const sys = sysByType[id];
      if (!sys?.forecast) continue;
      if (sys.meta.requiresTime && !fortune.input.timeKnown) continue;
      auxRows[id][key] = safe(() => sys.forecast(fortune.input, fortune.chart, p));
    }
    void n;
  }
  // 그 사람의 그 기간 안에서의 분포 — 절대 점수가 아니라 상대 순위를 쓰려고
  const auxStats = {};
  for (const id of AUX_IDS) {
    const rows = Object.values(auxRows[id]).filter(Boolean);
    if (!rows.length) { auxStats[id] = null; continue; }
    // **달을 가로지르는 흔들림**을 잰다. 영역끼리의 차이가 아니다 —
    // 태을신수는 영역마다 값이 달라도 달마다는 늘 같아서, 영역을 섞어
    // 재면 "시기를 가른다"고 잘못 나온다.
    const areas = ['총운', '애정운', '금전운', '직장운', '학업운', '건강운'];
    const mean = {}; const sds = [];
    for (const a of areas) {
      const xs = rows.map((r) => r.areas?.[a]).filter((v) => v != null);
      if (!xs.length) { mean[a] = 50; continue; }
      const mu = xs.reduce((x, y) => x + y, 0) / xs.length;
      mean[a] = mu;
      sds.push(Math.sqrt(xs.reduce((t, v) => t + (v - mu) ** 2, 0) / xs.length));
    }
    const sd = sds.length ? sds.reduce((x, y) => x + y, 0) / sds.length : 0;

    // 달마다 값이 바뀌는가, 아니면 해마다만 바뀌는가.
    // 태을신수는 한 궁에 세 해를 머물러 달을 가르지 못한다 — 흔들림은
    // 있어도 눈금이 해 단위라, 달 단위로 쓰면 없는 해상도를 있다고 하는 것이다.
    const seq = Object.keys(auxRows[id]).sort().map((k) => auxRows[id][k]?.areas?.['총운']);
    let changed = 0, pairs = 0;
    for (let i = 1; i < seq.length; i++) {
      if (seq[i] == null || seq[i - 1] == null) continue;
      pairs++; if (seq[i] !== seq[i - 1]) changed++;
    }
    auxStats[id] = { mean, sd, changeRate: pairs ? changed / pairs : 0 };
  }

  // ── 달마다 열다섯을 돌린다 ──
  const perMonth = [];
  for (const { key, m } of months) {
    const signals = [
      sajuTiming(m, key),
      ziweiTiming(m, key, stack),
      westernTiming(m, key, natalPack),
      vedicTiming(m, key, vedicPacks),
      ...AUX_IDS.map((id) => otherTiming(id, key, auxRows[id][key], auxStats[id])),
    ];
    perMonth.push({ key, signals });
  }

  // ── 분야마다 합친다 ──
  const pooled = {};   // domain → key → { activation, shift, consensus, contributors }
  for (const d of want) {
    pooled[d] = {};
    for (const { key, signals } of perMonth) {
      pooled[d][key] = poolDomainMonth(signals, d, RESOLUTION[d]);
    }
  }

  // ── 해상도에 맞춰 창으로 뭉갠다 ──
  const timeline = {};
  for (const { key } of perMonth) {
    timeline[key] = { period: key, domains: {}, featureShift: {}, events: [] };
  }
  for (const d of want) {
    const months = WINDOW_MONTHS[RESOLUTION[d]] ?? 1;
    const keys = perMonth.map((x) => x.key);
    const smoothed = smooth(keys, pooled[d], months);
    // 그 사람의 그 기간 안에서의 순위 — **반올림하지 않은 값으로** 센다
    const vals = keys.map((k) => smoothed[k].activation).filter(Number.isFinite);
    for (const k of keys) {
      const a = smoothed[k];
      if (a.unavailable || !Number.isFinite(a.activation)) {
        timeline[k].domains[d] = {
          activation: null, rawActivation: null, percentile: null,
          resolution: RESOLUTION[d], window: months, unavailable: true,
          why: '이 분야의 시기를 말할 수 있는 체계가 없다',
        };
        continue;
      }
      timeline[k].domains[d] = {
        // 화면·로그용 (반올림)
        activation: round3(a.activation),
        // **검증용 원값** — 반올림하면 없던 동점이 생겨 순위가 망가진다
        rawActivation: a.activation,
        percentile: percentileOf(vals, a.activation),
        resolution: RESOLUTION[d], window: months,
        windowCount: a.windowCount, windowFull: a.windowFull,
        consensus: round3(a.consensus), spokeCount: a.spokeCount,
        magnitude: round3(a.magnitude),
      };
      // 방향과 세기를 따로 남긴다
      timeline[k].featureShift[d] = {
        raw: round3v(a.rawShift),
        direction: round3v(a.direction),
        magnitude: round3(a.magnitude),
      };

      const events = scoreEvents(d, a.activation, a.direction,
        natal.domains[d]?.profile ?? null, a.consensus, currentState, a.magnitude);
      for (const e of events) {
        if (e.score <= 0.02) continue;
        timeline[k].events.push({ domain: d, ...e });
      }
    }
  }

  for (const k of Object.keys(timeline)) {
    timeline[k].events.sort((a, b) => b.score - a.score);
    timeline[k].events = timeline[k].events.slice(0, 8);
  }

  // ── 여러 분야가 한꺼번에 켜지는 구간 ──
  const transitions = [];
  for (const k of Object.keys(timeline)) {
    const hot = want.filter((d) => (timeline[k].domains[d]?.percentile ?? 0) >= 85);
    if (hot.length >= 3) {
      transitions.push({ period: k, domains: hot.map((d) => DOMAIN_LABEL[d]),
        note: '여러 분야가 함께 켜지는 구간' });
    }
  }

  return {
    from, to,
    natal: Object.fromEntries(want.map((d) => [d, {
      leading: natal.domains[d]?.leading ?? [], profile: natal.domains[d]?.profile ?? null,
    }])),
    timeline,
    transitions,
    // 체계별 결과를 그대로 남긴다 — 나중에 어느 체계가 어느 분야의 시기를
    // 잘 잡는지 재려면 이것이 있어야 한다
    systemResults: Object.fromEntries(SYSTEM_IDS.map((id) => [id, {
      name: SYSTEM_NAME[id], lineage: lineageOf(id),
      months: Object.fromEntries(perMonth.map(({ key, signals }) => {
        const s = signals.find((x) => x.system === id);
        return [key, s ? {
          available: s.available, resolution: s.resolution, why: s.why,
          // 화면용 (반올림) 과 검증용 원값을 함께 남긴다
          activations: round3v(s.activations),
          rawActivations: s.activations,
          domainAvailability: s.domainAvailability ?? {},
          evidence: (s.evidence ?? []).slice(0, 3),
        } : null];
      })),
    }])),
    meta: {
      timeKnown: fortune.input.timeKnown,
      monthCount: perMonth.length,
      currentStateUsed: Boolean(currentState),
      note: 'activation 이 높다는 것은 그 분야가 시끄럽다는 뜻이지 좋은 일이 생긴다는 뜻이 아니다.',
      confidenceNote: '근거가 여러 독립 계보에서 겹치는 것(evidence confidence)과 실제로 맞는 것(prediction accuracy)은 다른 말이다.',
    },
  };
}

/**
 * 한 달 한 분야를 열다섯에서 합친다.
 *
 * ── 없는 정보를 0 으로 세지 않는다 ─────────────────────────
 * 그 체계가 그 분야를 말할 근거가 없으면(`activation === null`) **분모에서
 * 뺀다.** 0 으로 넣으면 "계산했는데 낮다"가 되어 앙상블을 끌어내린다.
 * 타로에게 이동 시기를 물어 0점을 받아 오는 셈이다.
 */
function poolDomainMonth(signals, domain, domainRes = 'month') {
  const usable = signals.filter((s) => s.available && s.resolution !== 'none'
    && Number.isFinite(s.activations?.[domain]));
  if (!usable.length) {
    return { activation: null, rawShift: {}, direction: {}, magnitude: 0,
      consensus: 0, spokeCount: 0, availableCount: 0, unavailable: true };
  }

  // 같은 계보는 한 표를 나눠 갖는다 — **말할 수 있는 체계끼리만** 센다
  const count = {};
  for (const s of usable) { const L = lineageOf(s.system); count[L] = (count[L] ?? 0) + 1; }

  let num = 0, den = 0;
  const shift = {};
  const shiftDen = {};
  const lineagesUp = new Set();
  const lineagesAvailable = new Set();

  for (const s of usable) {
    const L = lineageOf(s.system);
    lineagesAvailable.add(L);
    // 해 단위로만 바뀌는 체계는 달 눈금에서 제 몫을 다 주지 않는다
    const coarse = s.resolution === 'year' && ['month', 'quarter'].includes(domainRes) ? 0.5 : 1;
    const w = (1 / count[L]) * (CORE.includes(s.system) ? 1 : 0.45) * coarse;
    const a = s.activations[domain];
    num += a * w; den += w;
    if (a >= 0.5) lineagesUp.add(L);
    // 방향은 활성화된 체계만 싣는다. 조용한 체계의 방향은 뜻이 없다
    if (a >= 0.15) {
      for (const [ax, v] of Object.entries(s.featureShift?.[domain] ?? {})) {
        shift[ax] = (shift[ax] ?? 0) + v * w;
        shiftDen[ax] = (shiftDen[ax] ?? 0) + w;
      }
    }
  }

  const activation = den ? clamp01(num / den) : null;

  // ── 방향과 세기를 가른다 ──────────────────────────────────
  //
  // 전에는 가장 센 축을 무조건 ±1 로 폈다. 그러면 raw 0.03 짜리 흔들림도
  // "변화 +1" 로 보여서, 아주 약한 신호가 강한 사건 후보를 만든다.
  //
  //   rawShift   실제 가중 평균 (−1~1)
  //   direction  방향만 비교하려고 편 값
  //   magnitude  그 방향 신호가 얼마나 선명한가 (0~1)
  //
  // 사건 점수는 direction 과 magnitude 를 **따로** 쓴다.
  const rawShift = {};
  for (const ax of Object.keys(shift)) rawShift[ax] = shift[ax] / (shiftDen[ax] || 1);
  const peak = Math.max(...Object.values(rawShift).map(Math.abs), 0);
  const direction = {};
  for (const ax of Object.keys(rawShift)) {
    direction[ax] = peak > 1e-9 ? Math.max(-1, Math.min(1, rawShift[ax] / peak)) : 0;
  }
  // 0.5 쯤 되면 선명한 것으로 본다. 그 위는 더 올리지 않는다
  const magnitude = clamp01(peak / 0.5);

  // consensus 도 **말할 수 있는 계보**만 분모로 쓴다
  const indepAvailable = [...lineagesAvailable].filter((L) => INDEPENDENT_LINEAGES.includes(L)).length;
  const indepUp = [...lineagesUp].filter((L) => INDEPENDENT_LINEAGES.includes(L)).length;
  const consensus = indepAvailable ? clamp01(indepUp / indepAvailable) : 0;

  return {
    activation, rawShift, direction, magnitude, consensus,
    spokeCount: usable.length, availableCount: usable.length, unavailable: false,
  };
}

const CORE = ['saju', 'jamidusu', 'astrology', 'vedic'];

/**
 * 해상도에 맞춰 이웃 달을 섞는다 — **정확히 그 달 수만** 담는다.
 *
 * `floor(w/2)` 로 앞뒤를 자르면 6개월 창이 7개, 12개월 창이 13개가 됐다.
 * `windowSlice` 가 짝수 창을 왼쪽 적게 두는 규칙으로 정확한 개수를 준다.
 * 경계에서는 담긴 개수와 창이 다 찼는지를 함께 남긴다.
 */
function smooth(keys, byKey, months) {
  const out = {};
  keys.forEach((k, i) => {
    const w = windowSlice(keys, i, months);
    const slice = keys.slice(w.from, w.to + 1).map((x) => byKey[x]).filter((x) => x && !x.unavailable);
    if (!slice.length) {
      out[k] = { ...byKey[k], windowCount: 0, windowFull: false };
      return;
    }
    const rawShift = {};
    const denom = {};
    for (const s of slice) {
      for (const [ax, v] of Object.entries(s.rawShift ?? {})) {
        rawShift[ax] = (rawShift[ax] ?? 0) + v; denom[ax] = (denom[ax] ?? 0) + 1;
      }
    }
    for (const ax of Object.keys(rawShift)) rawShift[ax] /= denom[ax];
    const peak = Math.max(...Object.values(rawShift).map(Math.abs), 0);
    const direction = {};
    for (const ax of Object.keys(rawShift)) {
      direction[ax] = peak > 1e-9 ? Math.max(-1, Math.min(1, rawShift[ax] / peak)) : 0;
    }
    out[k] = {
      activation: slice.reduce((a, s) => a + s.activation, 0) / slice.length,
      rawShift, direction, magnitude: clamp01(peak / 0.5),
      consensus: Math.max(...slice.map((s) => s.consensus)),
      spokeCount: Math.max(...slice.map((s) => s.spokeCount)),
      unavailable: false,
      windowCount: w.count, windowFull: w.full,
    };
  });
  return out;
}

const percentileOf = (vals, v) => {
  const below = vals.filter((x) => x < v).length;
  const equal = vals.filter((x) => x === v).length;
  return Math.round(((below + equal / 2) / vals.length) * 100);
};
const round3 = (v) => Math.round(v * 1000) / 1000;
/** 화면용 반올림. **null 은 null 로 남긴다** — 0 으로 바꾸면 뜻이 달라진다 */
const round3v = (o) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) =>
  [k, typeof v === 'number' ? round3(v) : v]));

/**
 * 한 분야에서 **가장 두드러진 구간**을 뽑는다.
 * 절대 점수가 아니라 그 사람의 그 기간 안에서의 순위로 고른다.
 */
export function peakWindows(result, domain, topN = 2, floor = 80) {
  const rows = Object.values(result.timeline)
    .map((t) => ({ period: t.period, ...t.domains[domain] }))
    .filter((x) => x.percentile != null && !x.unavailable);
  const hot = rows.filter((x) => x.percentile >= floor).sort((a, b) => a.period.localeCompare(b.period));
  const runs = [];
  for (const r of hot) {
    const last = runs[runs.length - 1];
    if (last && monthNo(r.period) === monthNo(last.to) + 1) { last.to = r.period; last.peak = Math.max(last.peak, r.activation); }
    else runs.push({ from: r.period, to: r.period, peak: r.activation });
  }
  return runs.sort((a, b) => b.peak - a.peak).slice(0, topN);
}

export { DOMAINS, DOMAIN_LABEL, monthKey };
