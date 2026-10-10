/**
 * grid.js — 시간 격자. 계산값만 모은다
 *
 * 이 파일은 **아무것도 해석하지 않는다.** 네 체계가 각자 구한 값을
 * 같은 시간 축(절기월) 위에 나란히 놓기만 한다. 사건을 추측하는 일은
 * events.js 가 따로 한다. 둘을 한 파일에 섞으면 나중에 무엇이 계산이고
 * 무엇이 추론인지 가릴 수 없게 된다.
 *
 * 시간 축은 절기월로 잡는다. 사주가 절기로 달을 세고, 이 사이트의 기존
 * 열두 달 타임라인도 절기 기준이기 때문이다. 자미두수의 유월은 음력 달이라
 * 축이 다르므로, 절기월의 시작일을 음력으로 옮겨 짝지어 둔다. 억지로
 * 한쪽에 맞추지 않고 각자의 기준을 유지한 채 대응만 시킨다.
 */

import { solarToLunar } from '../core/lunar.js';
import { fromJD } from '../core/astro.js';
import { monthsOfYear } from '../forecast.js';
import { monthlyTrack, annualTrack, daeunAt } from './bazi.js';
import * as ZW from './ziwei.js';
import * as WS from './western.js';
import * as WE from './westernExt.js';
import * as VD from './vedic.js';

/**
 * 격자를 만든다.
 *
 * @param {object} input  prepareInput 결과
 * @param {object} chart  computeFourPillars 결과
 * @param {object} opts
 *   fromYear  시작 사주 연도 (기본: 올해)
 *   years     몇 해를 볼지 (기본 3)
 *   domain    질문 분야. 서양 하우스·자미 궁 선택에 쓴다
 *   forecast  readForecast 결과가 있으면 그 해 열두 달 점수를 붙인다
 */
export function buildGrid(input, chart, opts = {}) {
  const fromYear = opts.fromYear ?? input.currentYear;
  const years = Math.max(1, Math.min(6, opts.years ?? 3));
  const domain = opts.domain ?? '직업';

  const N = WS.natalPack(input);
  const board = ZW.buildBoard(input);
  const limits = ZW.decadeLimits(input, board);
  const tree = VD.dashaTree(input, 3);

  const out = { years: [], months: [], domain, fromYear, toYear: fromYear + years - 1 };

  // 해 단위 — 굵은 흐름
  const baziYears = annualTrack(input, chart, fromYear, fromYear + years - 1);
  for (const [k, by] of baziYears.entries()) {
    const y = by.year;
    const annual = ZW.annualLayer(board, y);
    const decade = ZW.decadeAt(limits, y);
    const sr = input.timeKnown ? safe(() => WS.solarReturn(input, N, y, input.home)) : null;
    const zwLayers = [
      { label: '원국', myeongBranch: board.myeong, sihwa: ZW.sihwaOn(board.board, board.yearStem) },
      ...(decade ? [{ label: '대한', myeongBranch: decade.branch, sihwa: ZW.sihwaOn(board.board, decade.stem) }] : []),
      { label: '유년', myeongBranch: annual.branch, sihwa: annual.sihwa },
    ];

    out.years.push({
      year: y,
      bazi: by,
      ziwei: {
        decade: decade && {
          n: decade.n, branch: decade.branch, fromYear: decade.fromYear, toYear: decade.toYear,
          palaceOfNatal: decade.palaceOfNatal, stars: decade.stars,
          sihwa: ZW.sihwaOn(board.board, decade.stem),
        },
        annual,
        overlap: ZW.overlapFor(board, domain, zwLayers),
        layers: zwLayers,
      },
      western: {
        solarReturn: sr,
      },
      vedic: {
        changes: VD.dashaChanges(tree, y, y),
      },
    });
    void k;
  }

  // 자미 유월은 음력 달이 기준이라 해마다 따로 세워 두고 꺼내 쓴다.
  // 절기월의 한가운데가 앞해 섣달에 걸리는 일이 있어 앞뒤 한 해씩 더 만든다.
  const mlCache = new Map();
  const monthLayersOf = (yy) => {
    if (!mlCache.has(yy)) mlCache.set(yy, safe(() => ZW.monthLayers(input, board, yy)));
    return mlCache.get(yy);
  };

  // 달 단위 — 이 파일의 알맹이
  for (let i = 0; i < years; i++) {
    const y = fromYear + i;
    const baziMonths = monthlyTrack(input, chart, y);
    const periods = monthsOfYear(y);
    const annual = ZW.annualLayer(board, y);
    const decade = ZW.decadeAt(limits, y);

    // 그 해의 시간주(time lord) — 고전 점성술이 그 해를 다스린다고 보는 행성.
    //
    // 프로펙션은 한 해에 한 칸이라 **그 자체로는 달을 가르지 못한다**(12달이
    // 통째로 같은 값이다). 그래서 점수에 직접 더하지 않고, **그 해에 어느
    // 트랜싯을 무겁게 볼지**를 정하는 데만 쓴다. 고전 독법이 원래 그렇다 —
    // 프로펙션이 그 해의 주인을 정하고, 그 주인에 걸리는 트랜싯이 달을 짚는다.
    //
    // 이렇게 하면 이미 달마다 변하는 값(트랜싯)의 무게만 조절하므로
    // **동률을 만들지 않으면서** 고전이 기여한다.
    const prof = N
      ? safe(() => WE.profection(input, N, Math.max(0, y - input.year)))
      : null;

    for (const [k, bm] of baziMonths.entries()) {
      const p = periods[k];
      // 절기월과 음력 달은 경계가 보름쯤 어긋난다. 시작일로 짝지으면
      // 입춘 직후 절기월이 앞해 섣달로 잡혀 유월이 한 칸씩 밀린다.
      // 절기월 한가운데 날짜로 짝지어야 실제로 겹치는 달을 고른다.
      const mid = fromJD(p.jd + 15 + 9 / 24);
      const lun = safe(() => solarToLunar(mid.y, mid.m, mid.d));
      const ml = lun ? monthLayersOf(lun.year) : null;
      const zwMonth = (lun && ml) ? ml.months[lun.month - 1] ?? null : null;

      const layers = [
        { label: '원국', myeongBranch: board.myeong, sihwa: ZW.sihwaOn(board.board, board.yearStem) },
        ...(decade ? [{ label: '대한', myeongBranch: decade.branch, sihwa: ZW.sihwaOn(board.board, decade.stem) }] : []),
        { label: '유년', myeongBranch: annual.branch, sihwa: annual.sihwa },
        ...(zwMonth ? [{ label: '유월', myeongBranch: zwMonth.branch, sihwa: zwMonth.sihwa }] : []),
      ];

      const tr = safe(() => WS.transitsAt(N, p.jd, {
        timeKnown: input.timeKnown, domain, speed: 'month',
      }));
      const prog = safe(() => WS.progressedAt(input, N, p.jd));
      const dasha = VD.dashaAt(input, tree, p.jd);
      const gochara = safe(() => VD.gocharaAt(input, p.jd));

      out.months.push({
        key: `${y}-${k}`,
        year: y, index: k,
        // 라벨에 달력 연도가 들어 있다 (축월은 이듬해 1월에 시작한다)
        label: bm.label,
        from: bm.from,
        branchName: bm.branchName,
        jd: p.jd,
        // 기존 열두 달 점수 — 올해만 있다. 새로 계산하지 않고 그대로 붙인다
        areas: (opts.forecast && y === opts.forecast.day.period.sajuYear)
          ? opts.forecast.timeline[k]?.areas ?? null
          : null,
        bazi: bm,
        ziwei: {
          month: zwMonth, layers,
          overlap: ZW.overlapFor(board, domain, layers),
          lunarMonth: lun?.month ?? null,
        },
        western: { transits: tr, progressed: prog, profection: prof },
        vedic: { dasha, gochara },
      });
    }
  }

  return {
    ...out,
    natal: N,
    board,
    limits,
    dashaTree: tree,
    daeun: daeunAt(input, chart, input.nowJD),
  };
}

/** 한 군데가 터져도 격자 전체가 무너지지 않게 한다 */
function safe(fn) {
  try { return fn(); } catch { return null; }
}
