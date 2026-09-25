/**
 * scenario/supporting.js — **딸려 오는 분야를 실제로 읽는다**
 *
 * `CROSS_DOMAIN` 은 "이직이면 수입·이동·주거도 봐야 한다"까지만 말한다.
 * 그런데 봐야 한다고만 적고 실제로 보지 않으면, 정작 "장거리인가 생활권
 * 안인가", "수입은 오르는 쪽인가"는 답할 수 없다. 여기서 그 분야를
 * **같은 구간에 대해** 실제로 읽는다.
 *
 * ── 곁가지는 곁가지다 ──────────────────────────────────────
 *   · 주 시나리오를 바꾸지 않는다. 대표 사건도 순위도 그대로다
 *   · 묻지 않은 분야를 새 주제로 꺼내지 않는다 — 주 사건이 켠 것만 본다
 *   · **한 단계 얕게** 본다. 주 시나리오가 방향까지면 곁가지는 방향까지이고,
 *     곁가지가 주 시나리오보다 구체적일 수는 없다
 *   · 사건은 "그 분야에서 잡히는 후보"까지다. 일어난다는 뜻이 아니다
 */

import { predictTimeline } from '../timing/timeline.js';
import { DOMAIN_LABEL } from '../domains.js';
import { timingPhases, asPhaseShape } from './phase.js';
import { resolveConflict } from './conflict.js';
import { detailFor, DETAIL_SLOT } from './detail.js';
import { timingAt } from './composer.js';
import { readPerson } from '../index.js';

/** 그 구간에서 얼마나 두드러지는가 — 확률이 아니라 그 사람 안에서의 자리다 */
const bandOf = (pct) => (pct >= 85 ? 'pronounced' : pct >= 60 ? 'moderate' : 'quiet');
const BAND_LABEL = { pronounced: '두드러집니다', moderate: '어느 정도 움직입니다', quiet: '조용합니다' };
/** 뒤에 말이 이어질 때 쓰는 꼴 */
const BAND_JOIN = { pronounced: '두드러지고', moderate: '어느 정도 움직이고', quiet: '조용하고' };

/**
 * 주 시나리오가 켠 분야들을 같은 구간에서 읽는다.
 *
 * @param {object} o
 *   birth     출생 정보
 *   scenario  composePrepared() 결과 (바꾸지 않는다)
 *   from, to  주 시나리오와 같은 계산 구간
 *   max       몇 분야까지 (기본 3)
 */
export function supportingReads(o = {}) {
  const { birth, scenario, from, to, max = 3 } = o;
  const p = scenario?.primary ?? null;
  if (!p || !birth) return { reads: [], note: '주 시나리오가 없어 곁가지를 읽지 않았다' };

  // 주 사건이 켠 분야만. 묻지 않은 주제를 새로 꺼내지 않는다
  const wanted = [];
  const seen = new Set([scenario.meta?.domain]);
  for (const c of scenario.chains?.chains ?? []) {
    for (const x of c.crossDomain ?? []) {
      if (seen.has(x.domain)) continue;
      seen.add(x.domain);
      wanted.push(x);
      if (wanted.length >= max) break;
    }
    if (wanted.length >= max) break;
  }
  if (!wanted.length) return { reads: [], note: '주 사건이 다른 분야를 켜지 않았다' };

  const domains = wanted.map((x) => x.domain);
  let result = null; let natal = null;
  try {
    result = predictTimeline({ birth, from, to, currentState: null, domains });
    natal = readPerson(birth, { domains });
  } catch {
    return { reads: [], note: '곁가지 분야를 계산하지 못했다' };
  }

  // 주 시나리오가 내려간 단계보다 깊이 가지 않는다
  const cap = Math.max(0, (scenario.meta?.allowedLevel ?? 0) - 1);
  const grain = p.timing?.grain ?? 'year';
  const win = { from: p.timing?.from, to: p.timing?.to };

  const reads = wanted.map((x) => {
    const d = x.domain;
    const conflict = resolveConflict(result, d, win);
    // 그 구간 안에서 이 분야가 몇 번째인가
    const rows = Object.keys(result.timeline).sort()
      .filter((k) => k >= win.from && k <= win.to)
      .map((k) => result.timeline[k]?.domains?.[d])
      .filter((v) => v && !v.unavailable && Number.isFinite(v.percentile));
    const pct = rows.length
      ? Math.round(rows.reduce((a, v) => a + v.percentile, 0) / rows.length) : null;

    // 그 분야의 국면이 이 구간과 겹치는가
    const ph = timingPhases(result, d).phases
      .find((q) => q.start <= win.to && q.end >= win.from) ?? null;

    const profile = natal.domains[d]?.profile ?? null;
    const { detail, why } = detailFor({ domain: d, profile, level: cap });
    const slot = DETAIL_SLOT[d];

    // 그 분야에서 잡히는 후보 하나 — **일어난다는 뜻이 아니다**
    const best = new Map();
    for (const k of Object.keys(result.timeline).sort()) {
      if (k < win.from || k > win.to) continue;
      for (const e of result.timeline[k]?.events ?? []) {
        if (e.domain !== d) continue;
        const cur = best.get(e.type);
        if (!cur || e.score > cur.score) best.set(e.type, e);
      }
    }
    const top = [...best.values()].sort((a, b) => b.score - a.score)[0] ?? null;

    return {
      domain: d,
      label: DOMAIN_LABEL[d],
      role: 'supporting',
      triggeredBy: x.from ?? null,
      why: x.why ?? null,
      reason: x.reason ?? null,
      window: ph ? timingAt(asPhaseShape(ph), grain) : timingAt({ start: win.from, end: win.to }, grain),
      activation: pct == null
        ? { percentile: null, band: null, note: '이 분야의 시기를 말할 체계가 없다' }
        : { percentile: pct, band: bandOf(pct),
          label: BAND_LABEL[bandOf(pct)], join: BAND_JOIN[bandOf(pct)] },
      agreement: {
        activation: conflict.activationAgreement,
        direction: conflict.directionalAgreement,
      },
      /** 그 분야의 결 — 주 시나리오보다 한 단계 얕게만 */
      detail: slot ? detail[slot] ?? null : null,
      detailWhy: slot ? why?.[slot] ?? null : null,
      candidate: top && cap >= 2
        ? { type: top.type, label: top.label, note: '그 분야에서 잡히는 후보이지 일어난다는 뜻이 아니다' }
        : null,
      allowedLevel: cap,
      sourceType: 'fortune',
      note: '주 사건에 딸려 오는 분야다. 따로 물어본 것이 아니고 주 시나리오를 바꾸지도 않는다',
    };
  });

  return {
    reads,
    capUsed: cap,
    note: '곁가지는 주 시나리오보다 구체적일 수 없다',
  };
}
