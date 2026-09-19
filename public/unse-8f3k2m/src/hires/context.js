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
import * as VD from './vedic.js';
import * as ZW from './ziwei.js';

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
      d
    )
  );

  const chain = chainOf(inferences);
  const location = plan.needsPlace ? buildLocation(r, plan) : null;

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
    timingWindows: inferences.flatMap((i) =>
      i.windows.map((w) => ({ domain: i.domain, label: w.label, band: w.band,
        peak: w.peak.label, systems: w.systems, phases: w.phases }))),
    candidateEvents: inferences.map((i) => ({
      domain: i.domain,
      candidates: i.candidates.slice(0, 5),
      attributes: i.attributes,
      scenarios: i.scenarios,
    })),
    chain,
  };

  return { json, grid, inferences, chain, location, text: formatHiRes(json, plan) };
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
  return {
    dasha: {
      nakshatra: grid.dashaTree.nakName, lord: grid.dashaTree.nakLord,
      now: first ? VD.formatDasha(first.dasha) : null,
      changes: [...ad, ...pd]
        .sort((a, b) => (a.from.y - b.from.y) || (a.from.m - b.from.m))
        .map((c) => `${c.level} ${c.lord} ${c.from.y}.${p2(c.from.m)}`),
    },
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
  for (const t of j.vedic.transits) {
    out.push(`  고차라 ${t.label} ${t.rows.join(' ')}${t.sadeSati ? ' ※사데사티' : ''}`);
  }
  out.push('');

  // ── B~E. 사건 추론 ──
  out.push('### [B~E] 사건 추론 — 위 계산값을 현실 사건으로 옮긴 것 (계산이 아니라 해석)');
  out.push('구간 등급은 이 사람의 이 기간 안에서의 상대 순위다. 확률이 아니며 숫자로 옮기지 말 것.');
  for (const w of j.timingWindows) {
    out.push(`[${w.domain}] ${w.band} 구간 ${w.label} · 정점 ${w.peak} · 지지 체계 ${w.systems.join('·') || '없음'}`);
    const ph = w.phases.filter((p) => p.phase).map((p) => `${p.label}${p.phase}`);
    if (ph.length) out.push(`  국면: ${ph.join(' → ')}`);
  }
  if (!j.timingWindows.length) {
    out.push('두드러진 구간 없음 — 이 기간에는 월 단위로 좁힐 근거가 부족하다.');
  }
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
    out.push(`※ ${j.location.caveat}`);
    out.push('');
  }

  out.push('### 이 구획을 쓰는 법');
  out.push('- [A] 로 표시된 값은 이미 계산된 것이다. 다시 계산하지 말고 그대로 쓸 것.');
  out.push('- [B~E] 는 해석이다. "~로 나타나기 쉽습니다" 처럼 읽었다는 것이 드러나게 쓸 것.');
  out.push('- 여기 적히지 않은 달·구간·도시를 만들어내지 말 것. 없으면 없다고 적는 것이 답의 일부다.');
  out.push('- 구간 등급(최강·강함·보조·약함)은 이 사람의 이 기간 안에서의 상대 순위다. 확률·퍼센트로 옮기지 말 것.');
  out.push('- 좁히지 못한 속성은 억지로 채우지 말고 근거가 얇다고 적을 것.');
  out.push('- 회사 규모·직원 수·동네 이름을 말해야 하면 반드시 [E] 초구체화 추정이라고 표시할 것.');
  void plan;
  return out.join('\n');
}
