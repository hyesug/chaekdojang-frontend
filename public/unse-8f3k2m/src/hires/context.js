/**
 * context.js — 고해상도 계산을 구조화해 모델에게 넘긴다
 *
 * 두 가지를 만든다.
 *   json — 구조화된 계산 결과 한 덩이. 화면·테스트·디버깅이 이걸 본다
 *   text — 위를 프롬프트에 실을 수 있게 접은 글
 *
 * **계산과 추론을 글에서도 갈라 놓는다.** '계산 사실' 구획에 들어간 값은
 * 천문·역법 계산에서 그대로 나온 것이고, '사건 추론' 구획은 그 값을 현실
 * 사건으로 옮긴 해석이다. 모델이 둘을 섞지 않도록 구획 제목에 못박는다.
 */

import { elementDistribution, ELEMENTS, STEMS, BRANCHES } from '../core/ganzhi.js';
import { buildGrid } from './grid.js';
import { inferEvents, chainOf } from './events.js';
import * as LOC from './location.js';
import * as WS from './western.js';
import * as WE from './westernExt.js';
import * as VD from './vedic.js';
import * as VE from './vedicExt.js';
import * as ZW from './ziwei.js';
import * as ZE from './ziweiExt.js';
import * as CL from './classical.js';
import * as W from './wealth.js';
import { profileFor, formatProfile, tierOf, describeTier } from './profile.js';

/** 신뢰도 표기 — 답변에서 이 등급을 그대로 쓰게 한다 */
export const CONFIDENCE_LEGEND =
  'A=계산 사실(천문·역법 계산에서 그대로 나온 값) · ' +
  'B=강한 교차 신호(핵심 체계 3개 이상이 같은 주제) · ' +
  'C=중간 교차 신호(핵심 2개) · ' +
  'D=약한 해석(한 체계만 지지하거나 상충) · ' +
  'E=초구체화 추정(지역·조직 규모처럼 상징을 현실로 옮긴 것)';

const p2 = (n) => String(n).padStart(2, '0');

/**
 * 고해상도 묶음 하나를 만든다.
 *
 * @param {object} r    readFortune 결과
 * @param {object} f    readForecast 결과 (없어도 된다)
 * @param {object} plan router.routeQuestion 또는 defaultPlan 결과
 */
export function buildHiRes(r, f = null, plan) {
  const { input, chart } = r;
  const domains = plan.domains ?? ['직업'];

  const grid = buildGrid(input, chart, {
    fromYear: plan.fromYear, years: plan.years,
    domain: domains[0], forecast: f,
  });

  const inferences = domains.map((d) =>
    inferEvents(
      // 분야마다 자미 궁·서양 하우스 선택이 달라야 한다. 첫 분야 외에는
      // 격자를 다시 만들지 않고 같은 격자에서 그 분야 기준으로 다시 센다.
      d === domains[0] ? grid : buildGrid(input, chart, {
        fromYear: plan.fromYear, years: plan.years, domain: d, forecast: f,
      }),
      d,
      // 질문이 사건을 집어냈고 그 사건이 이 분야의 것이면 그것에 맞춘다.
      // 맞추지 않으면 정반대 사건을 골라 답이 뒤집힌다 (실측: 7위 vs 177위)
      (plan.event && plan.eventDomain === d) ? { event: plan.event } : {}
    )
  );

  const chain = chainOf(inferences);
  const location = plan.needsPlace ? buildLocation(r, plan) : null;
  const natal = safe(() => WS.natalPack(input));

  // ── 분야별 프로파일 — "누구와·어떤 모양으로" ──
  // 층(원국·대한·유년·유월)을 한 번만 세워 여러 프로파일이 나눠 쓴다
  const stack = safe(() => input.timeKnown
    ? ZW.stackAt(input, grid.fromYear, null) : null);
  const profiles = domains
    .map((d) => safe(() => profileFor(input, d, stack)))
    .filter(Boolean);

  // ── 연 단위 타이밍 기법 — 솔라 아크와 프로펙션 ──
  const solarArc = natal ? safe(() => WE.solarArcYears(input, natal, grid.fromYear, grid.toYear)) ?? [] : [];
  const profections = natal ? safe(() => WE.profectionYears(input, natal, input.year, grid.fromYear, grid.toYear)) ?? [] : [];

  // ── 재물 — 돈이 어디서 들어오는가 ──
  // 재물 질문일 때만 돌린다. 고전 로트와 릴로케이션까지 도는 무거운 계산이다.
  const classical = plan.needsWealth ? safe(() => CL.classicalChart(input)) : null;
  const wealth = plan.needsWealth ? safe(() => W.wealthPaths(input, chart, stack)) : null;
  const windfall = (plan.needsWealth && plan.needsWindfall)
    ? safe(() => W.windfall(input, chart, stack, {
        fromYear: grid.fromYear, years: Math.max(12, plan.years), natal }))
    : null;
  const lifetime = (plan.needsWealth && (plan.needsLifetime || plan.needsWindfall))
    ? safe(() => W.lifetimeWealth(input, chart, { dashaTree: grid.dashaTree }))
    : null;

  // ── 단언 등급 ──
  // 여기서 중요한 것은 "여러 기법이 있다"가 아니라 **같은 시기를 함께 짚는가**다.
  // 기법이 있기만 하면 세 해쯤 보는 동안 거의 언제나 뭔가 하나는 걸리므로,
  // 그렇게 세면 모든 질문이 Tier S 가 된다. 실제로 그렇게 나왔다.
  // 그래서 가장 강한 구간 **그 해**를 함께 짚는 기법만 센다.
  const tiers = inferences.map((inf) => {
    // 시간 순서로 첫 구간을 집으면 앞쪽 달이 구조적으로 유리해진다.
    // 점수가 가장 높은 달이 든 구간을 쓴다.
    const top = inf.bestWindow ?? null;
    if (!top) {
      return { domain: inf.domain, ...tierOf([], []), techs: [], window: null };
    }
    const y = top.peak.year;
    const techs = [];

    // 베딕 — 그 해에 안타르·프라탼타르다샤가 바뀌는가
    const changes = safe(() => VD.dashaChanges(grid.dashaTree, y, y)) ?? [];
    if (changes.length) techs.push('다샤전환');

    // 솔라 아크 — 그 해에 맺히는 각이 있는가
    if (solarArc.some((h) => h.year === y)) techs.push('솔라아크');

    // 프로펙션 — 그 해의 무대가 이 분야의 자리인가
    const prof = profections.find((p) => p.year === y);
    if (prof && (WE.DOMAIN_HOUSES[inf.domain] ?? []).includes(prof.house)) techs.push('프로펙션');

    // 자미 — 그 해 유년에서 분야 궁이 되풀이 켜지는가
    const zw = safe(() => {
      const st2 = input.timeKnown ? ZW.stackAt(input, y) : null;
      if (!st2) return false;
      const rows = ZE.domainPalaces(input, inf.domain, st2.layers);
      return rows.some((p) => p.repeated.length > 0 || p.rows.some((x) => x.sihwa.length >= 2));
    });
    if (zw) techs.push('유년사화');

    // 구간 전체가 아니라 **정점 달**에서 실제로 말한 체계만 센다
    const core = top.peak.systems ?? top.systems;
    const t = tierOf(core, techs);
    // 핵심 체계가 정면으로 갈리면 단언까지 올리지 않는다
    if (inf.conflicts.length && t.tier === 'S') {
      return { domain: inf.domain, ...tierOf(core, techs.slice(0, 1)), techs,
        window: top.label, cappedBy: '상충 신호가 있어 한 단계 내렸다' };
    }
    return { domain: inf.domain, ...t, techs, window: top.label };
  });

  const json = {
    questionType: plan.primary ?? 'general',
    matchedQuestion: plan.matched,
    period: `${grid.fromYear}-${grid.toYear}`,
    bazi: baziJson(grid, chart),
    ziwei: ziweiJson(grid, input),
    western: westernJson(grid, input),
    vedic: vedicJson(grid, input, plan),
    location,
    crossValidation: {
      legend: CONFIDENCE_LEGEND,
      byDomain: inferences.map((i) => ({
        domain: i.domain, confidence: i.confidence, systems: i.activeSystems,
        conflicts: i.conflicts,
      })),
    },
    tiers,
    profiles,
    yearTiming: { solarArc, profections },
    classical: classical && !classical.unavailable ? {
      sect: classical.sect,
      dignities: Object.fromEntries(Object.entries(classical.dignities)
        .map(([k, v]) => [k, CL.stateLine(v)])),
      lots: Object.fromEntries(Object.entries(classical.lots).map(([k, v]) => [k, CL.lotLine(v)])),
      moneyHouses: Object.fromEntries(Object.entries(classical.moneyHouses)
        .map(([k, v]) => [k, CL.houseLine(v)])),
      substanceNote: classical.substanceNote,
    } : (classical?.unavailable ? { unavailable: classical.unavailable } : null),
    wealth, windfall, lifetime,
    // 자미 — 질문 분야의 궁을 층마다 삼방사정·길성·살성까지 펴 본다
    ziweiPalaces: stack ? domains.map((d) => ({
      domain: d,
      palaces: safe(() => ZE.domainPalaces(input, d, stack.layers)) ?? [],
    })).filter((x) => x.palaces.length) : [],
    askedEvent: plan.event ?? null,
    timingWindows: inferences.flatMap((i) =>
      i.windows.map((w) => ({ domain: i.domain, label: w.label, band: w.band,
        peak: w.peak.label, systems: w.systems, phases: w.phases,
        rankedBy: i.rankedBy }))),
    // 사건마다 따로 세운 달. 구간만 보면 정반대 사건이 섞인다
    perEvent: inferences.map((i) => ({ domain: i.domain, focusEvent: i.focusEvent,
      rankedBy: i.rankedBy, events: i.perEvent })),
    candidateEvents: inferences.map((i) => ({
      domain: i.domain,
      candidates: i.candidates.slice(0, 5),
      attributes: i.attributes,
      scenarios: i.scenarios,
    })),
    chain,
  };

  return { json, grid, inferences, chain, location, profiles, tiers, stack,
           classical, wealth, windfall, lifetime,
           text: formatHiRes(json, plan) };
}

/** 한 군데가 터져도 나머지는 나가야 한다 */
function safe(fn) {
  try { return fn(); } catch { return null; }
}

// ─────────────────────────────────────────────────────────────
// 구조화 — LEVEL 1 계산값
// ─────────────────────────────────────────────────────────────

function baziJson(grid, chart) {
  const d = grid.daeun;
  return {
    natal: {
      pillars: ['year', 'month', 'day', 'hour']
        .map((k) => chart.pillars[k]?.hanja).filter(Boolean).join(' '),
      dayStem: STEMS[chart.dayStem],
      elements: elementDistribution(chart.pillars).pct,
    },
    decadeLuck: d.current ? {
      gz: d.current.hanja, god: d.current.god,
      fromAge: d.current.fromAge, toAge: d.current.toAge,
      yearsToTurn: d.toTurn,
      next: d.next ? d.next.hanja : null,
    } : null,
    annual: grid.years.map((y) => ({
      year: y.year, gz: y.bazi.gz.hanja, god: y.bazi.god,
      hits: y.bazi.hits, combos: y.bazi.combos,
      daeunTurn: y.bazi.daeunTurn,
    })),
    monthly: grid.months.map((m) => ({
      year: m.year, label: m.label, from: m.from, gz: m.bazi.gz.hanja, god: m.bazi.god,
      hits: m.bazi.hits.map((h) => `${h.with}${h.kind}`),
      combos: m.bazi.combos.map((c) => c.kind),
      elementShift: m.bazi.elementShift,
      activated: m.bazi.activated,
    })),
  };
}

function ziweiJson(grid, input) {
  if (!input.timeKnown) return { unavailable: '출생 시각을 몰라 판을 세우지 못함' };
  const b = grid.board;
  return {
    natal: {
      myeong: BRANCHES[b.myeong], stars: b.mainStars, guk: b.guk.name,
      sihwa: ZW.sihwaOn(b.board, b.yearStem).map((s) => `${s.star}${s.kind}@${s.branchName ?? '없음'}`),
      helpers: Object.fromEntries(Object.entries(b.helpers).map(([k, v]) => [k, BRANCHES[v]])),
    },
    decade: grid.years.map((y) => y.ziwei.decade && {
      year: y.year, n: y.ziwei.decade.n,
      myeong: BRANCHES[y.ziwei.decade.branch],
      natalPalace: y.ziwei.decade.palaceOfNatal,
      span: `${y.ziwei.decade.fromYear}~${y.ziwei.decade.toYear}`,
      stars: y.ziwei.decade.stars,
      sihwa: y.ziwei.decade.sihwa.map((s) => `${s.star}${s.kind}@${s.branchName ?? '없음'}`),
    }).filter(Boolean)[0] ?? null,
    annual: grid.years.map((y) => ({
      year: y.year, myeong: BRANCHES[y.ziwei.annual.branch],
      natalPalace: y.ziwei.annual.palaceOfNatal,
      sihwa: y.ziwei.annual.sihwa.map((s) => `${s.star}${s.kind}@${s.branchName ?? '없음'}`),
      overlap: y.ziwei.overlap.rows.map((x) => ({
        palace: x.palace, repeated: x.repeated, sihwa: x.hits.flatMap((h) => h.sihwa),
      })),
    })),
    monthly: grid.months.map((m) => m.ziwei.month && {
      year: m.year, label: m.label, lunarMonth: m.ziwei.lunarMonth,
      myeong: BRANCHES[m.ziwei.month.branch],
      natalPalace: m.ziwei.month.palaceOfNatal,
      stars: m.ziwei.month.stars,
      sihwa: m.ziwei.month.sihwa.map((s) => `${s.star}${s.kind}@${s.branchName ?? '없음'}`),
    }).filter(Boolean),
  };
}

function westernJson(grid, input) {
  return {
    natal: {
      asc: input.timeKnown ? Math.round(grid.natal.asc * 10) / 10 : null,
      mc: input.timeKnown ? Math.round(grid.natal.mc * 10) / 10 : null,
      ruler: grid.natal.ruler,
      houseSystem: grid.natal.houses.system,
    },
    transits: grid.months.map((m) => ({
      year: m.year, label: m.label,
      hits: (m.western.transits?.hits ?? []).slice(0, 4).map((h) =>
        `${h.planet}${h.retro ? '℞' : ''}-${h.target} ${h.aspect} ${h.orb}°${h.applying ? '↗' : '↘'}`),
      inHouse: m.western.transits?.inHouse ?? {},
    })),
    // 진행 달이 자리를 옮기는 때 — 사건의 문턱으로 가장 많이 쓰인다
    progressedMoonIngress: input.timeKnown
      ? WS.progressedMoonIngress(input, grid.natal, grid.fromYear, grid.toYear)
        .map((x) => `${x.y}.${p2(x.m)} ${x.kind}→${x.to}`)
      : [],
    progressions: grid.months.filter((_, i) => i % 3 === 0).map((m) => ({
      year: m.year, label: m.label,
      moon: m.western.progressed
        ? `${m.western.progressed.planets.달.sign}${m.western.progressed.planets.달.natalHouse ? ` ${m.western.progressed.planets.달.natalHouse}하우스` : ''}`
        : null,
      sun: m.western.progressed?.planets.태양.sign ?? null,
      asc: m.western.progressed?.asc?.sign ?? null,
      mc: m.western.progressed?.mc?.sign ?? null,
    })),
    solarReturn: grid.years.map((y) => y.western.solarReturn && {
      year: y.year,
      at: `${y.western.solarReturn.at.y}.${y.western.solarReturn.at.m}.${y.western.solarReturn.at.d}`,
      asc: y.western.solarReturn.asc.sign, mc: y.western.solarReturn.mc.sign,
      sunHouse: y.western.solarReturn.sunHouse, moonHouse: y.western.solarReturn.moonHouse,
      ascInNatalHouse: y.western.solarReturn.ascInNatalHouse,
      mcInNatalHouse: y.western.solarReturn.mcInNatalHouse,
    }).filter(Boolean),
  };
}

/** 베딕 분야 묶음을 한 줄씩 편다 */
function formatPack(kind, d) {
  const h = (x, label) => x ? `${label} ${x.sign}(${x.quality}) 주 ${x.lord}→${x.lordIn}H` +
    `${x.lordDignity && x.lordDignity !== '보통' ? `·${x.lordDignity}` : ''}` +
    `${x.lordCombust ? '·조합' : ''}${x.occupants?.length ? ` 내 ${x.occupants.join('·')}` : ''}` +
    `${x.aspects?.length ? ` 조견 ${x.aspects.join('·')}` : ''}` : null;
  const L = [];
  if (kind === '결혼') {
    L.push(h(d.d1_7, 'D1 7궁'), h(d.d9_7, 'D9 7궁'));
    L.push(`D9 라그나 ${d.d9Lagna ?? '—'} · 금성 ${d.venus?.signName}${d.venus?.dignity && d.venus.dignity !== '보통' ? `(${d.venus.dignity})` : ''}${d.venus?.combust ? '·조합' : ''} ${d.venus?.house}H · 목성 ${d.jupiter?.signName} ${d.jupiter?.house}H`);
    if (d.darakaraka) L.push(`다라카라카 ${d.darakaraka.planet} — D1 ${d.darakaraka.d1.sign} ${d.darakaraka.d1.house}H / D9 ${d.darakaraka.d9?.sign ?? '—'} ${d.darakaraka.d9?.house ?? '—'}H`);
    if (d.upapada) L.push(`우파파다(UL) ${d.upapada.signName} — 라그나에서 ${d.upapada.fromLagna}번째${d.upapada.occupants.length ? ` (${d.upapada.occupants.join('·')})` : ''} / UL2 ${d.upapada2?.signName ?? '—'}${d.upapada2?.occupants?.length ? ` (${d.upapada2.occupants.join('·')})` : ' 비어 있음'}`);
    L.push(`결혼을 여는 행성(다샤에서 이것이 오면 무대에 오른다): ${d.activators.join('·')}`);
  }
  if (kind === '자녀') {
    L.push(h(d.d1_5, 'D1 5궁'), h(d.d7_5, 'D7 5궁'));
    L.push(`D7 라그나 ${d.d7Lagna ?? '—'} · 목성 ${d.jupiter?.signName}${d.jupiter?.dignity && d.jupiter.dignity !== '보통' ? `(${d.jupiter.dignity})` : ''} ${d.jupiter?.house}H / D7 목성 ${d.jupiterInD7?.signName ?? '—'} ${d.jupiterInD7?.house ?? '—'}H`);
    if (d.maleficsOn5.length) L.push(`5하우스 흉성 ${d.maleficsOn5.join('·')}`);
    L.push(`자녀 자리를 여는 행성: ${d.activators.join('·')}`);
  }
  if (kind === '재물') {
    L.push(h(d.d1_2, 'D1 2궁'), h(d.d1_11, 'D1 11궁'), h(d.d1_10, 'D1 10궁'), h(d.d1_6, 'D1 6궁'));
    L.push(`D10 라그나 ${d.d10Lagna ?? '—'}`, h(d.d10_10, 'D10 10궁'), h(d.d10_7, 'D10 7궁(거래처)'), h(d.d10_6, 'D10 6궁(고용)'));
    if (d.hora) L.push(`D2 호라 — 태양 쪽 ${d.hora.sunHora}개 / 달 쪽 ${d.hora.moonHora}개 (태양 쪽=스스로 버는 결, 달 쪽=받아 버는 결)`);
    if (d.arudha) L.push(`아루다 AL ${d.arudha.AL?.signName ?? '—'} · A2(보이는 재물) ${d.arudha.A2?.signName ?? '—'} · A10(보이는 직업) ${d.arudha.A10?.signName ?? '—'}`);
    if (d.dhanaYogas.length) L.push(`다나 요가 ${d.dhanaYogas.length}개 — ${d.dhanaYogas.map((y) => y.note).join(' / ')}`);
    if (d.rajaYogas.length) L.push(`라자 요가 ${d.rajaYogas.length}개 — ${d.rajaYogas.map((y) => y.note).join(' / ')}`);
    L.push(`재물 자리를 여는 행성: ${d.activators.join('·')}`);
  }
  if (kind === '주거') {
    L.push(h(d.d1_4, 'D1 4궁'), h(d.d4_4, 'D4 4궁'));
    L.push(`D4 라그나 ${d.d4Lagna ?? '—'} · 화성 ${d.mars?.signName} ${d.mars?.house}H · 달 ${d.moon?.signName} ${d.moon?.house}H`);
    L.push(h(d.d1_3, 'D1 3궁'), h(d.d1_9, 'D1 9궁'), h(d.d1_12, 'D1 12궁'));
    L.push(`주거 자리를 여는 행성: ${d.activators.join('·')}`);
  }
  return L.filter(Boolean);
}

function vedicJson(grid, input, plan) {
  const codes = [...new Set((plan.pipeline?.vedic ?? []).filter((x) => /^D\d+$/.test(x)))];
  const vargas = {};
  for (const c of ['D1', ...codes]) {
    const v = VD.vargaChart(input, c);
    if (v) {
      vargas[c] = {
        lagna: v.lagnaSign,
        placements: Object.fromEntries(Object.entries(v.placements)
          .map(([k, x]) => [k, `${x.sign}${x.house ? ` ${x.house}H` : ''}${x.retro ? '℞' : ''}`])),
      };
    }
  }
  const first = grid.months[0]?.vedic;
  // 프라탼타르다샤는 한 해에 스물 몇 개씩 바뀐다. 전부 실으면 정작 큰 전환인
  // 안타르다샤가 묻히므로, 안타르다샤는 다 싣고 그 아래는 여덟 개까지만 싣는다.
  const all = VD.dashaChanges(grid.dashaTree, grid.fromYear, grid.toYear);
  const ad = all.filter((c) => c.level === 'AD');
  const pd = all.filter((c) => c.level === 'PD').slice(0, 8);
  // 분야 전용 묶음 — 7궁·5궁·2/11궁·4궁을 궁주까지 펴서 본다
  const packs = {};
  for (const d of plan.domains ?? []) {
    const p = VE.packFor(input, d);
    if (p?.data) packs[p.kind] = p.data;
  }
  const karakas = (() => { try { return VE.charaKarakas(input); } catch { return null; } })();

  return {
    dasha: {
      nakshatra: grid.dashaTree.nakName, lord: grid.dashaTree.nakLord,
      now: first ? VD.formatDasha(first.dasha) : null,
      changes: [...ad, ...pd]
        .sort((a, b) => (a.from.y - b.from.y) || (a.from.m - b.from.m))
        .map((c) => `${c.level} ${c.lord} ${c.from.y}.${p2(c.from.m)}`),
    },
    karakas: karakas && {
      atmakaraka: karakas.atmakaraka?.planet ?? null,
      darakaraka: karakas.darakaraka?.planet ?? null,
      order: karakas.list.map((x) => `${x.role ?? '-'}:${x.planet}`).join(' '),
    },
    packs,
    transits: grid.months.filter((_, i) => i % 3 === 0).map((m) => ({
      year: m.year, label: m.label,
      rows: (m.vedic.gochara?.rows ?? []).map((x) => `${x.planet} ${x.sign}(달에서 ${x.fromMoon})`),
      sadeSati: m.vedic.gochara?.sadeSati ?? false,
    })),
    vargas,
  };
}

/** 지역 — 계산 세 가지 + 지도 매핑 */
export function buildLocation(r, plan) {
  const { input, chart } = r;
  const dist = elementDistribution(chart.pillars);
  const ls = LOC.localSpace(input.jdUT, input.home.lat, input.home.lon);
  const acg = LOC.astrocartography(input.jdUT);
  const near = LOC.linesNear(acg, input.home.lat, input.home.lon, 500);

  const signals = LOC.directionSignals({
    weakElementIndex: dist.weakest,
    localSpaceRows: ls,
    moveBearing: input.place.name === input.home.name
      ? null : LOC.bearing(input.place, input.home),
  });

  // 반복되는 방향이 있으면 그쪽으로 후보를 찾는다. 없으면 만들지 않는다
  const repeated = signals.repeated[0] ?? null;
  const pickDeg = repeated
    ? signals.signals.find((s) => LOC.dir8(s.deg) === repeated.dir)?.deg ?? null
    : null;

  const candidates = pickDeg == null ? [] : LOC.candidatesToward(input.home, pickDeg, { maxKm: 300 });

  const cities = (plan.cities ?? []).map((c) => LOC.relocation(input, c)).filter(Boolean);
  // 후보 도시를 대지 않았으면 국내 주요 생활권을 전부 돌려 견준다.
  // 방향만 말하고 끝나면 답이 지도까지 내려가지 못한다.
  const zones = cities.length ? null : safe(() => LOC.compareZones(input));

  return {
    origin: input.home.name,
    weakElement: ELEMENTS[dist.weakest],
    localSpace: ls.map((x) => `${x.planet} ${x.dir8}(${x.azimuth}°)${x.aboveHorizon ? '' : '·지평아래'}`),
    astrocartographyNear: near.map((x) => `${x.planet} ${x.kind}선 ${x.km}km — ${x.meaning}`),
    directionSignals: signals.signals.map((s) => `${s.source}: ${LOC.dir16(s.deg)}(${Math.round(s.deg)}°)`),
    repeatedDirection: repeated,
    candidates: candidates.map((c) => `${c.name} ${c.dir} ${c.km}km`),
    relocation: cities.map((c) => c.unavailable ? `${c.city}: ${c.unavailable}` : {
      city: c.city, asc: c.asc, mc: c.mc,
      byFocus: c.byFocus, lines: c.lines.map((x) => `${x.planet} ${x.kind} ${x.km}km`),
    }),
    zones,
    caveat: '방향은 계산값이고, 도시 이름은 그 방향을 실제 지도에 대본 초구체화 추정이다. 명반이 도시를 직접 가리킨 것이 아니다.',
  };
}

// ─────────────────────────────────────────────────────────────
// 프롬프트용 글
// ─────────────────────────────────────────────────────────────

const cap = (arr, n) => arr.slice(0, n);

export function formatHiRes(j, plan) {
  const out = [];
  out.push('## 고해상도 계산 (기간 ' + j.period + ')');
  out.push(`신뢰도 표기 — ${CONFIDENCE_LEGEND}`);
  if (j.matchedQuestion === false) {
    out.push('※ 질문에서 분야를 가려내지 못해 기본 분야(직업·재물·관계)로 계산했다. 분야가 다르면 그렇다고 밝힐 것.');
  }
  out.push('');

  // ── A. 계산 사실 ──
  out.push('### [A] 계산 사실 — 사주 다층 (원국×대운×세운×월운)');
  out.push(`원국 ${j.bazi.natal.pillars} · 일간 ${j.bazi.natal.dayStem} · 오행 ${ELEMENTS.map((e, i) => e + j.bazi.natal.elements[i]).join(' ')}`);
  if (j.bazi.decadeLuck) {
    out.push(`대운 ${j.bazi.decadeLuck.gz}(${j.bazi.decadeLuck.god}) ${j.bazi.decadeLuck.fromAge}~${j.bazi.decadeLuck.toAge}세 · 전환까지 약 ${j.bazi.decadeLuck.yearsToTurn}년 · 다음 ${j.bazi.decadeLuck.next ?? '없음'}`);
  }
  for (const y of j.bazi.annual) {
    out.push(`${y.year} ${y.gz} ${y.god}` +
      (y.hits.length ? ` [${y.hits.join('·')}]` : '') +
      (y.combos.length ? ` [${y.combos.join('·')}]` : '') +
      (y.daeunTurn ? ' ※대운전환해' : ''));
  }
  out.push('월운 (절기 기준, 시작일~):');
  for (const m of j.bazi.monthly) {
    const bits = [m.gz, m.god];
    if (m.hits.length) bits.push(m.hits.join('·'));
    if (m.combos.length) bits.push(m.combos.join('·'));
    if (m.activated.length) bits.push('장간 ' + m.activated.slice(0, 3).join(','));
    out.push(`  ${m.label} ${bits.join(' ')}`);
  }
  out.push('');

  // ── 자미 ──
  out.push('### [A] 계산 사실 — 자미두수 층 (원국·대한·유년·유월)');
  if (j.ziwei.unavailable) {
    out.push(j.ziwei.unavailable);
  } else {
    out.push(`원국 명궁 ${j.ziwei.natal.myeong} ${j.ziwei.natal.stars.join('·') || '공궁'} · ${j.ziwei.natal.guk}`);
    out.push(`생년사화 ${j.ziwei.natal.sihwa.join(' ')}`);
    if (j.ziwei.decade) {
      out.push(`대한 ${j.ziwei.decade.span} 명궁 ${j.ziwei.decade.myeong}(원국 ${j.ziwei.decade.natalPalace}) ${j.ziwei.decade.stars.join('·') || '공궁'}`);
      out.push(`대한사화 ${j.ziwei.decade.sihwa.join(' ')}`);
    }
    for (const y of j.ziwei.annual) {
      out.push(`유년 ${y.year} 명궁 ${y.myeong}(원국 ${y.natalPalace}) · 유년사화 ${y.sihwa.join(' ')}`);
      const rep = y.overlap.filter((x) => x.repeated.length);
      if (rep.length) {
        out.push('  궁 겹침: ' + rep.map((x) =>
          `${x.palace}×${x.repeated.map((r2) => r2.layers).join('/')}(${x.repeated.map((r2) => r2.branchName).join(',')})`).join(' '));
      }
    }
    // 질문 분야의 궁 — 자미두수는 한 궁만 보지 않고 삼방사정을 함께 본다
    for (const g of j.ziweiPalaces ?? []) {
      out.push(`[${g.domain}] 관련 궁 — 층마다 삼방사정·길성·살성까지`);
      for (const p of g.palaces) {
        out.push(`  ${p.palace} (층 합계 ${p.toneSum}` +
          (p.repeated.length ? ` · 겹침 ${p.repeated.map((x) => `${x.branchName}×${x.layers}`).join(',')}` : '') + ')');
        for (const row of p.rows) out.push(`    ${ZE.formatPalace(row)}`);
      }
    }
    out.push('유월 (음력 달 기준. 앞의 날짜는 짝지은 절기월의 시작일이다):');
    for (const m of cap(j.ziwei.monthly, 72)) {
      out.push(`  ${m.label} 음${m.lunarMonth}월 명궁 ${m.myeong}(원국 ${m.natalPalace})` +
        (m.stars.length ? ` ${m.stars.join('·')}` : ' 공궁') +
        (m.sihwa.length ? ` · ${m.sihwa.join(' ')}` : ''));
    }
  }
  out.push('');

  // ── 서양 ──
  out.push('### [A] 계산 사실 — 서양 점성술 (트랜싯·프로그레션·솔라리턴)');
  out.push(`네이탈 상승 ${j.western.natal.asc ?? '—'}° 중천 ${j.western.natal.mc ?? '—'}° · 차트 주인 ${j.western.natal.ruler} · 하우스 ${j.western.natal.houseSystem}`);
  for (const s of j.western.solarReturn) {
    out.push(`솔라리턴 ${s.year} (${s.at}) ASC ${s.asc} MC ${s.mc} · 태양 ${s.sunHouse}H 달 ${s.moonHouse}H · SR ASC는 출생 ${s.ascInNatalHouse ?? '—'}H, SR MC는 출생 ${s.mcInNatalHouse ?? '—'}H`);
  }
  out.push('트랜싯 (달별, 위 네 개까지):');
  for (const t of j.western.transits) {
    if (!t.hits.length) continue;
    out.push(`  ${t.label} ${t.hits.join(', ')}`);
  }
  out.push('진행(2차 프로그레션) 석 달 간격:');
  for (const p of j.western.progressions) {
    out.push(`  ${p.label} 달 ${p.moon ?? '—'} · 태양 ${p.sun ?? '—'} · ASC ${p.asc ?? '—'} · MC ${p.mc ?? '—'}`);
  }
  if (j.western.progressedMoonIngress.length) {
    out.push(`진행 달이 자리를 옮기는 때: ${j.western.progressedMoonIngress.join(' / ')}`);
  }
  out.push('');

  // ── 베딕 ──
  out.push('### [A] 계산 사실 — 베딕 (다샤·고차라·바르가)');
  out.push(`나크샤트라 ${j.vedic.dasha.nakshatra}(지배 ${j.vedic.dasha.lord}) · 현재 ${j.vedic.dasha.now ?? '—'}`);
  if (j.vedic.dasha.changes.length) {
    out.push(`이 기간 다샤 전환: ${j.vedic.dasha.changes.join(' / ')}`);
  }
  for (const [code, v] of Object.entries(j.vedic.vargas)) {
    out.push(`${code} 라그나 ${v.lagna ?? '—'} · ` +
      Object.entries(v.placements).slice(0, 7).map(([k, x]) => `${k} ${x}`).join(' '));
  }
  if (j.vedic.karakas) {
    out.push(`차라 카라카(일곱 방식) ${j.vedic.karakas.order}`);
    out.push(`  아트마카라카 ${j.vedic.karakas.atmakaraka ?? '—'} · 다라카라카(배우자) ${j.vedic.karakas.darakaraka ?? '—'}`);
  }
  for (const [kind, d] of Object.entries(j.vedic.packs ?? {})) {
    out.push(`[${kind}] 전용 배치`);
    for (const line of formatPack(kind, d)) out.push(`  ${line}`);
  }
  for (const t of j.vedic.transits) {
    out.push(`  고차라 ${t.label} ${t.rows.join(' ')}${t.sadeSati ? ' ※사데사티' : ''}`);
  }
  out.push('');

  // ── 연 단위 타이밍 기법 ──
  const yt = j.yearTiming ?? { solarArc: [], profections: [] };
  if (yt.solarArc.length || yt.profections.length) {
    out.push('### [A] 계산 사실 — 연도를 좁히는 기법 (솔라 아크 · 프로펙션)');
    if (yt.solarArc.length) {
      out.push('솔라 아크 — 한 해에 약 1도라 한 각이 한두 해로 좁혀진다. 큰 사건의 연도를 고르는 자리다.');
      for (const h of yt.solarArc) out.push(`  ${h.year} ${h.from}→${h.to} ${h.aspect} (오차 ${h.orb}°)`);
    }
    if (yt.profections.length) {
      out.push('프로펙션 — 그 해의 무대와 주인. 주인 행성에 걸린 트랜싯이 그 해 사건을 만든다고 본다.');
      for (const p of yt.profections) {
        out.push(`  ${p.year} ${p.age}세 → ${p.house}하우스(${p.topic}) ${p.sign} · 그 해 주인 ${p.timeLord} → 출생 ${p.lordNatalHouse}하우스 ${p.lordNatalSign}${p.lordRetro ? ' 역행' : ''}`);
      }
    }
    out.push('');
  }

  // ── B~E. 사건 추론 ──
  out.push('### [B~E] 사건 추론 — 위 계산값을 현실 사건으로 옮긴 것 (계산이 아니라 해석)');
  out.push('구간 등급은 이 사람의 이 기간 안에서의 상대 순위다. 확률이 아니며 숫자로 옮기지 말 것.');
  if (j.askedEvent) {
    out.push(`질문이 집어낸 사건: **${j.askedEvent}** — 아래 구간은 이 사건에 맞춰 고른 것이다.`);
  } else {
    out.push('질문에서 사건을 집어내지 못했다. 아래 구간은 "그 영역이 언제 시끄러운가"일 뿐이고, ' +
      '**어떤 사건인지는 가리지 않는다.** 사건별로는 그 아래 "사건마다 따로 세운 달"을 볼 것.');
  }
  for (const w of j.timingWindows) {
    out.push(`[${w.domain}] ${w.band} 구간 ${w.label} · 정점 ${w.peak} · 기준 ${w.rankedBy} · 지지 체계 ${w.systems.join('·') || '없음'}`);
    const ph = w.phases.filter((p) => p.phase).map((p) => `${p.label}${p.phase}`);
    if (ph.length) out.push(`  국면: ${ph.join(' → ')}`);
  }
  if (!j.timingWindows.length) {
    out.push('두드러진 구간 없음 — 이 기간에는 월 단위로 좁힐 근거가 부족하다.');
  }
  out.push('');

  // ── 사건마다 따로 세운 달 ──
  // 영역 활성도로만 줄을 세우면 정반대 사건이 같은 달에 겹친다. 실제로
  // '새 만남'과 '관계 정리'가 둘 다 같은 달을 가리켰고, 활성도 1위 달이
  // '정리 쪽'이었다. 사건마다 갈라 세워야 "무엇이 언제"가 맞물린다.
  out.push('### [B~E] 사건마다 따로 세운 달');
  out.push('같은 영역이라도 정반대 사건이 있다(새 만남 / 관계 정리, 자발적 이직 / 현 직장 유지). ' +
    '활성도로만 고르면 둘이 섞인다. 아래는 사건마다 "다른 후보보다 얼마나 앞서는가"로 따로 세운 것이다.');
  for (const g of j.perEvent) {
    out.push(`[${g.domain}]`);
    for (const [name, months] of Object.entries(g.events)) {
      if (!months.length) continue;
      const top = months.filter((m) => m.fit > 0).slice(0, 3);
      if (!top.length) { out.push(`  ${name}: 앞서는 달 없음 — 이 사건으로는 좁힐 근거가 부족하다`); continue; }
      out.push(`  ${name}: ${top.map((m) => `${m.label}(여유 +${m.fit})`).join(' / ')}`);
    }
  }
  out.push('※ 여유가 0 이하인 사건은 그 달이 그 사건처럼 보이지 않는다는 뜻이다. 억지로 고르지 말 것.');
  out.push('');

  for (const c of j.candidateEvents) {
    out.push(`[${c.domain}] 사건 후보 (앞설수록 근거가 두텁다): ` +
      c.candidates.map((x) => x.name).join(' > '));
    const at = c.attributes.filter((a) => a.lean);
    if (at.length) {
      out.push(`  속성: ${at.map((a) => `${a.key}=${a.lean}(${a.strength})`).join(' · ')}`);
    }
    const un = c.attributes.filter((a) => !a.lean);
    if (un.length) out.push(`  좁히지 못한 속성: ${un.map((a) => a.key).join('·')} — 근거 부족이라고 적을 것`);
    if (c.scenarios.main) out.push(`  주 시나리오: ${c.scenarios.main.name} (${c.scenarios.main.weight})`);
    if (c.scenarios.alternative) out.push(`  대안: ${c.scenarios.alternative.name}`);
    if (c.scenarios.contrary) out.push(`  반대 근거: ${c.scenarios.contrary.name} 쪽을 막는 신호가 있다`);
  }
  out.push('');

  // ── 고전 점성술 — 섹트·디그니티·로트·재물 하우스 ──
  if (j.classical && !j.classical.unavailable) {
    out.push('### [A] 계산 사실 — 고전 점성술 (섹트·디그니티·로트)');
    out.push(`${j.classical.sect.label} (태양이 ${j.classical.sect.sunHouse}하우스) · ` +
      `이 차트의 섹트 길성 ${j.classical.sect.benefic}, 섹트 흉성 ${j.classical.sect.malefic}, ` +
      `섹트에 어긋난 흉성 ${j.classical.sect.outOfSectMalefic}`);
    out.push('행성의 힘 (에센셜 점수 / 액시덴털 상태):');
    for (const line of Object.values(j.classical.dignities)) out.push(`  ${line}`);
    out.push('로트 (주인의 상태까지 봐야 한다 — 로트만 보고 결론 내리지 말 것):');
    for (const line of Object.values(j.classical.lots)) out.push(`  ${line}`);
    out.push(`  ※ substance 는 ${j.classical.substanceNote}`);
    out.push('재물 하우스 — 고전은 돈을 다섯 자리로 나눠 본다:');
    for (const line of Object.values(j.classical.moneyHouses)) out.push(`  ${line}`);
    out.push('');
  } else if (j.classical?.unavailable) {
    out.push(`### 고전 점성술 — ${j.classical.unavailable}`);
    out.push('');
  }

  // ── 재물 경로 ──
  if (j.wealth) {
    out.push(W.formatWealth(j.wealth, j.windfall, j.lifetime));
    out.push('');
  }

  // ── 분야별 프로파일 — 누구와·어떤 모양으로 ──
  if (j.profiles?.length) {
    out.push('### [B~E] 프로파일 — "무엇이 일어나는가"를 "어떤 것인가"까지 내린 것');
    out.push('항목마다 근거를 달았다. 근거를 대지 못하는 항목은 아예 만들지 않았으니, 여기 없는 차원은 답에서도 만들지 말 것.');
    for (const p of j.profiles) {
      const t = formatProfile(p);
      if (t) out.push(t);
    }
    out.push('');
    out.push('※ 계산 불확실성: 행성 위치는 근사식으로 구한다. 도수 순서로 정해지는 것(베딕 카라카)은 ' +
      '순서가 뒤집힐 수 있어, 흔들리는 경우 위 프로파일에 그렇게 적어 두었다. ' +
      '그 표시가 붙은 항목은 단언하지 말 것.');
    out.push('');
  }

  // ── 단언 등급 ──
  if (j.tiers?.length) {
    out.push('### 단언 등급 — 얼마나 세게 말해도 되는가');
    out.push('근거가 모인 만큼만 세게 말한다. 단언은 근거의 강도를 드러내는 표현 방식이지, 빈자리를 채우는 허가증이 아니다.');
    out.push('등급은 "가장 강한 구간 그 해"를 함께 짚는 기법만 세어 매겼다. 기법이 있기만 한 것은 세지 않았다.');
    for (const t of j.tiers) {
      out.push(`  [${t.domain}] ${describeTier(t)}` +
        (t.window ? ` · 대상 구간 ${t.window}` : '') +
        (t.techs.length ? ` · 같은 시기를 짚은 기법 ${t.techs.join('·')}` : ' · 같은 시기를 짚은 기법 없음') +
        (t.cappedBy ? ` ※${t.cappedBy}` : ''));
    }
    out.push('');
  }

  const conf = j.crossValidation.byDomain;
  out.push('신뢰도 등급:');
  for (const c of conf) {
    out.push(`  ${c.domain} — ${c.confidence.grade}: ${c.confidence.text}` +
      (c.conflicts.length ? ` ※상충 ${c.conflicts.join(' / ')}` : ''));
  }
  if (j.chain.order) {
    out.push(`사건 선후: ${j.chain.order}`);
    if (j.chain.notes.length) out.push(`  ${j.chain.notes.join(' · ')}`);
  }
  out.push('');

  // ── 지역 ──
  if (j.location) {
    out.push('### [A/E] 지역 — 방향은 계산, 도시는 추정');
    out.push(`기준 ${j.location.origin} · 보완 오행 ${j.location.weakElement}`);
    out.push(`방향 신호(A): ${j.location.directionSignals.join(' / ')}`);
    if (j.location.repeatedDirection) {
      out.push(`반복되는 방향(A): ${j.location.repeatedDirection.dir} — ${j.location.repeatedDirection.from.join(', ')}`);
    } else {
      out.push('반복되는 방향 없음 — 방향을 하나로 좁히지 말 것');
    }
    if (j.location.astrocartographyNear.length) {
      out.push(`가까운 아스트로카토그래피 라인(A): ${j.location.astrocartographyNear.join(' / ')}`);
    }
    if (j.location.candidates.length) {
      out.push(`후보 생활권(E, 지도 매핑): ${j.location.candidates.join(' / ')}`);
    }
    for (const rl of j.location.relocation) {
      if (typeof rl === 'string') { out.push(`  ${rl}`); continue; }
      out.push(`릴로케이션 ${rl.city}: ASC ${rl.asc} MC ${rl.mc} · ` +
        Object.entries(rl.byFocus).map(([k, v]) => `${k}[${v.join('·') || '비어 있음'}]`).join(' ') +
        (rl.lines.length ? ` · 라인 ${rl.lines.join(', ')}` : ''));
    }
    const z = j.location.zones;
    if (z && !z.unavailable) {
      out.push(`국내 주요 생활권 ${z.checked}곳을 같은 명반으로 다시 세워 기준 ${z.origin} 과 견준 결과:`);
      if (z.noDifference) {
        out.push(`  실제로 달라지는 곳이 없다. ${z.caveat}`);
      } else {
        out.push(`  달라지는 곳: ${z.different.join(' / ')}`);
        for (const [focus, list] of Object.entries(z.byFocus)) {
          // 이 함수의 매개변수 이름이 j 라 core/josa.js 의 j() 를 쓸 수 없다.
          // 조사가 필요 없게 적는다.
          if (list.length) out.push(`  '${focus}' 쪽이 달라지는 곳: ${list.join(' / ')}`);
        }
        out.push(`  ※ ${z.caveat}`);
      }
    } else if (z?.unavailable) {
      out.push(`  도시 비교 불가 — ${z.unavailable}`);
    }
    out.push(`※ ${j.location.caveat}`);
    out.push('');
  }

  out.push('### 이 구획을 쓰는 법');
  out.push('- [A] 로 표시된 값은 이미 계산된 것이다. 다시 계산하지 말고 그대로 쓸 것.');
  out.push('- [B~E] 는 해석이다. 다만 위의 **단언 등급**이 허락하는 만큼은 세게 말할 것. Tier S 에서까지 "~일 수도 있습니다"로 흐리면 계산한 보람이 없다.');
  out.push('- 여기 적히지 않은 달·구간·도시·사람을 만들어내지 말 것. 없으면 없다고 적는 것이 답의 일부다.');
  out.push('- 구간 등급(최강·강함·보조·약함)은 이 사람의 이 기간 안에서의 상대 순위다. 확률·퍼센트로 옮기지 말 것.');
  out.push('- 프로파일의 각 항목은 근거를 달고 나왔다. 그 근거 밖의 차원(이름·얼굴·회사명·정확한 나이)은 만들지 말 것.');
  out.push('- 숫자는 범위로만 쓰고, 명반에서 직접 나온 값이 아니라는 것을 한 번 밝힐 것.');
  out.push('- 가능성을 셋 이상 늘어놓지 말 것. 주 시나리오 하나와 대안 하나로 끝낼 것.');
  void plan;
  return out.join('\n');
}
