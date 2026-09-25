/**
 * bazi.js — 사주를 원국·대운·세운·월운(·일진)으로 겹쳐 본다
 *
 * 기존 forecast.js 는 "그 시기의 대표 간지 하나"를 일간에 대보는 방식이다.
 * 그것만으로는 "2027년 어느 달에 실제로 움직이는가"를 가를 수 없다.
 * 대운이 세운을 받쳐주는지, 세운이 월운과 합을 짓는지, 원국의 어느 기둥과
 * 부딪치는지가 전부 다른 이야기이기 때문이다.
 *
 * 그래서 여기서는 층을 전부 세워 놓고 서로 맞댄다.
 *
 *   원국 네 기둥 · 대운 · 세운 · 월운 (· 필요하면 일진)
 *
 * **새 계산식을 만들지 않는다.** 간지·절기·대운은 core/ganzhi.js 와
 * core/astro.js 가 이미 구한 것을 그대로 가져온다. 여기서 하는 일은
 * 이미 있는 값끼리 관계(합·충·형·해·파)를 따지고 세는 것뿐이다.
 *
 * **층 무게에 대하여**: 아래 LAYER_WEIGHT 는 과학적 확률이 아니라
 * 내부 비교용 상대값이다. 대운이 세운보다, 세운이 월운보다 오래 간다는
 * 전통적인 순서를 숫자로 옮긴 것이고, 바깥으로 점수를 내보내지 않는다.
 */

import { toJD } from '../core/astro.js';
import {
  yearPillar, computeDaeun, tenGod, MAIN_HIDDEN,
  TEN_GOD_GROUP, STEMS, BRANCHES, ELEMENTS,
} from '../core/ganzhi.js';
import { monthsOfYear, makePeriod } from '../forecast.js';
import {
  crossLayers, layeredElements, exposedHiddenStems, activatedHidden,
} from './relations.js';

const KST = 9 / 24;

/** 층마다의 상대 무게. 오래 가는 층일수록 무겁다 */
export const LAYER_WEIGHT = {
  년주: 0.7, 월주: 0.9, 일주: 1.0, 시주: 0.7,
  대운: 0.9, 세운: 0.8, 월운: 0.6, 일진: 0.35,
};

/** 태어난 순간부터 그 시점까지, 해 단위 소수 */
const elapsedAt = (jdBirth, jd) => (jd - jdBirth) / 365.2425;

/** 원국 네 기둥을 층으로 편다 */
function natalLayers(chart) {
  const out = [];
  const add = (key, p) => {
    if (!p) return;
    out.push({ key, label: key, stem: p.stem, branch: p.branch, weight: LAYER_WEIGHT[key] });
  };
  add('년주', chart.pillars.year);
  add('월주', chart.pillars.month);
  add('일주', chart.pillars.day);
  add('시주', chart.pillars.hour);
  return out;
}

/** 그 시점에 걸린 대운 */
export function daeunAt(input, chart, jd) {
  const daeun = computeDaeun(chart, input.isMale, input.jdUT);
  const el = elapsedAt(input.jdUT, jd);
  const now = daeun.list.find((d) => el >= d.fromExact && el < d.toExact) ?? null;
  const i = now ? daeun.list.indexOf(now) : -1;
  return {
    daeun,
    current: now,
    next: i >= 0 ? daeun.list[i + 1] ?? null : daeun.list[0],
    elapsed: Math.round(el * 100) / 100,
    // 전환까지 남은 햇수 — 대운이 바뀌는 해는 그 자체로 큰 변화 신호다
    toTurn: now ? Math.round((now.toExact - el) * 100) / 100 : null,
  };
}

/**
 * 한 시점의 층을 전부 세운다.
 *
 * @param {object} input prepareInput 결과
 * @param {object} chart computeFourPillars 결과
 * @param {object} at    { jd, sajuYear, monthGZ?, dayGZ? } — forecast.makePeriod 가 준 값
 * @param {object} opts  { withDay: 일진까지 포함할지 }
 */
export function stackAt(input, chart, at, opts = {}) {
  const layers = natalLayers(chart);
  const d = daeunAt(input, chart, at.jd);

  if (d.current) {
    layers.push({ key: '대운', label: '대운', stem: d.current.stem, branch: d.current.branch,
      weight: LAYER_WEIGHT.대운 });
  }
  const yGZ = yearPillar(at.sajuYear);
  layers.push({ key: '세운', label: '세운', stem: yGZ.stem, branch: yGZ.branch,
    weight: LAYER_WEIGHT.세운 });

  if (at.monthGZ) {
    layers.push({ key: '월운', label: '월운', stem: at.monthGZ.stem, branch: at.monthGZ.branch,
      weight: LAYER_WEIGHT.월운 });
  }
  if (opts.withDay && at.dayGZ) {
    layers.push({ key: '일진', label: '일진', stem: at.dayGZ.stem, branch: at.dayGZ.branch,
      weight: LAYER_WEIGHT.일진 });
  }

  const natalBranches = natalLayers(chart).map((l) => l.branch);
  const natalStems = natalLayers(chart).map((l) => l.stem);
  const cross = crossLayers(layers, chart.dayStem, natalBranches);
  const flowing = layers.filter((l) => ['대운', '세운', '월운', '일진'].includes(l.key));

  // 들어온 지지가 원국의 어느 지장간을 깨우는가
  const activated = [];
  for (const f of flowing) {
    for (const a of activatedHidden(natalBranches, f.branch)) {
      activated.push({ ...a, from: f.label });
    }
  }

  return {
    layers,
    daeun: d,
    cross,
    elements: layeredElements(layers),
    natalElements: layeredElements(natalLayers(chart)),
    // 투간 — 들어온 천간까지 합쳐서 다시 본다
    exposed: exposedHiddenStems(
      [...natalStems, ...flowing.map((f) => f.stem)],
      natalBranches
    ),
    activated,
  };
}

/**
 * 해마다의 층 — 여러 해를 견주려고 쓴다.
 * 월까지는 내려가지 않는다. 연 단위로 굵게 훑는 자리다.
 */
export function annualTrack(input, chart, fromYear, toYear) {
  const out = [];
  for (let y = fromYear; y <= toYear; y++) {
    // 그 해의 입춘 직후를 대표 시각으로 삼는다 (명리에서 한 해의 시작)
    const jd = toJD(y, 3, 1, 12) - KST;
    const s = stackAt(input, chart, { jd, sajuYear: y });
    const gz = yearPillar(y);
    // 육십갑자가 한 바퀴 돌아 세운 간지가 원국 년주와 같아지는 해 = 환갑.
    // 명리의 기본 눈금인데 연층이 표시하지 않고 있었다. 한국에서는 이 해에
    // 기념 여행·잔치가 실제로 몰리므로, 사건을 읽을 때 **계산 사실로** 알고
    // 있어야 한다. 지지만 같은 해(열두 해마다)는 본명년(띠해)이다.
    //
    // 점수에는 넣지 않는다. 이것은 [A] 계산 사실이고, 그래서 무슨 일이
    // 벌어지는가는 해석의 몫이다. 점수에 넣으면 계산과 해석이 섞인다.
    const natalYear = chart.pillars?.year;
    out.push({
      year: y,
      age: y - input.year,
      gz,
      // 태어난 해 자체는 '돌아온' 것이 아니라 출발점이므로 세지 않는다
      sexagenaryReturn: !!natalYear && y > input.year && gz.hanja === natalYear.hanja,
      zodiacReturn: !!natalYear && y > input.year && gz.branch === natalYear.branch,
      god: tenGod(chart.dayStem, gz.stem),
      godGroup: TEN_GOD_GROUP[tenGod(chart.dayStem, gz.stem)],
      branchGod: tenGod(chart.dayStem, MAIN_HIDDEN[gz.branch]),
      daeun: s.daeun.current
        ? { hanja: s.daeun.current.hanja, kr: s.daeun.current.kr, god: s.daeun.current.god }
        : null,
      daeunTurn: s.daeun.toTurn != null && s.daeun.toTurn < 1,
      harmony: s.cross.harmony,
      friction: s.cross.friction,
      net: s.cross.net,
      // 원국 어느 기둥과 부딪치는가 — 이동·전환 신호의 핵심
      hits: s.cross.branchHits
        .filter((h) => h.to === '세운' || h.from === '세운')
        .map((h) => `${h.from === '세운' ? h.to : h.from}와 ${h.kind}`),
      combos: s.cross.combos.map((c) => `${c.kind}(${ELEMENTS[c.element]})`),
    });
  }
  return out;
}

/**
 * 한 해 열두 절기월의 층 — 이 파일의 알맹이.
 *
 * 절기월은 forecast.monthsOfYear 가 이미 정확한 절입 시각으로 만든다.
 * 여기서는 그 위에 대운·세운을 얹어 네 층을 한꺼번에 맞댄다.
 */
export function monthlyTrack(input, chart, sajuYear) {
  const months = monthsOfYear(sajuYear);
  return months.map((p, i) => {
    const s = stackAt(input, chart, {
      jd: p.jd, sajuYear: p.sajuYear, monthGZ: p.gz.month,
    });
    const mg = p.gz.month;
    const monthHits = [...s.cross.branchHits, ...s.cross.stemHits]
      .filter((h) => h.from === '월운' || h.to === '월운');

    return {
      i,
      // 축월은 이듬해 1월에 시작한다. 사주 연도만 적으면 '2026년 1월'처럼
      // 읽혀 한 해가 어긋나므로 달력 연도를 라벨에 함께 넣는다.
      label: `${p.termStart.y}.${p.termStart.m}/${p.termStart.d}~`,
      from: p.termStart,
      branchName: p.branchName,
      gz: mg,
      god: tenGod(chart.dayStem, mg.stem),
      godGroup: TEN_GOD_GROUP[tenGod(chart.dayStem, mg.stem)],
      branchGod: tenGod(chart.dayStem, MAIN_HIDDEN[mg.branch]),
      // 원국·대운·세운과 이 달이 맺는 관계. 무게 순으로 위만 남긴다 —
      // 전부 실으면 한 달에 여덟 줄씩 붙어 어느 달이 특별한지 가릴 수 없다.
      hits: monthHits
        .map((h) => ({
          with: h.from === '월운' ? h.to : h.from,
          kind: h.kind, good: h.good, weight: Math.round(h.weight * 100) / 100,
        }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 4),
      // 그 달이 실제로 만들어낸 합만 남긴다. 대운·세운이 이미 짜 놓은 합은
      // 해 단위 사실이라 열두 달에 똑같이 붙어 어느 달이 특별한지 가린다.
      combos: s.cross.combos.filter((c) => c.members.includes(mg.branch)),
      harmony: s.cross.harmony,
      friction: s.cross.friction,
      net: s.cross.net,
      elements: s.elements,
      // 원국 대비 이 달에 무엇이 늘고 줄었는가
      elementShift: s.elements.pct.map((v, k) =>
        Math.round((v - s.natalElements.pct[k]) * 10) / 10),
      activated: s.activated
        .filter((a) => a.from === '월운')
        .map((a) => `${BRANCHES[a.branch]}→${STEMS[a.stem]}`),
      daeun: s.daeun.current?.hanja ?? null,
    };
  });
}

/**
 * 일진 층 — 실제 날짜를 물었을 때만 쓴다.
 * 기본 답변에 남용하지 않도록 따로 떼어 두었다.
 */
export function dayLayer(input, chart, on) {
  const p = makePeriod('day', on);
  const s = stackAt(input, chart, {
    jd: p.jd, sajuYear: p.sajuYear, monthGZ: p.gz.month, dayGZ: p.gz.day,
  }, { withDay: true });
  return {
    on, weekday: p.weekday, gz: p.gz.day,
    god: tenGod(chart.dayStem, p.gz.day.stem),
    hits: [...s.cross.branchHits, ...s.cross.stemHits]
      .filter((h) => h.from === '일진' || h.to === '일진')
      .map((h) => `${h.from === '일진' ? h.to : h.from} ${h.kind}`),
    net: s.cross.net,
    stack: s,
  };
}

/**
 * 원국·대운·세운·월운을 한 표로 편다 (프롬프트용).
 * 네 층의 간지와 십신을 한눈에 놓아야 모델이 층을 섞지 않는다.
 */
export function formatStack(chart, s) {
  const row = (g) =>
    `${g.label} ${g.gz}(${g.kr}) 간:${g.stemGod} 지:${g.branchGod}`;
  return s.cross.gods.map(row).join(' | ');
}
