/**
 * westernExt.js — 서양 점성술로 '연도'를 좁히는 기법들
 *
 * hires/western.js 의 트랜싯·프로그레션·솔라리턴은 '이 달이 어떤가'를 본다.
 * 여기 있는 것들은 결이 다르다. **어느 해에 큰 사건이 걸리는가**를 좁힌다.
 *
 *   솔라 아크  — 태양이 간 만큼 차트 전체를 밀어 본다. 한 해에 약 1도라
 *                평생 한두 번 걸리는 각이 나온다. 큰 사건의 연도를 고른다
 *   프로펙션   — 해마다 상승점이 한 칸씩 옮겨 간다. 그 해 어느 자리가
 *                무대인지, 그 해의 주인 행성이 누구인지 정한다
 *   루나 리턴  — 달이 출생 위치로 돌아오는 순간. 한 달을 아주 좁게 볼 때만
 *   합성 차트  — 두 사람을 한 차트로 합친 것. 관계 자체의 시계를 본다
 *
 * ── 유파 고지 ──────────────────────────────────────────────
 *   솔라 아크  : 진행 태양 − 출생 태양 (일도일년법의 태양 이동량).
 *                나이보드(고정 0.9856°/년) 방식을 쓰지 않는다
 *   프로펙션   : 헬레니즘 표준. 만 나이 n 살이면 상승점에서 n칸 (1하우스가
 *                0살). 그 별자리의 주인이 그 해의 주인(Time Lord)이다
 *   합성 차트  : 중점(midpoint) 방식. 두 황경의 가까운 쪽 중점을 쓴다
 *   데이비슨   : 시각과 장소를 각각 중간으로 잡아 실제로 차트를 세운다.
 *                중점 방식과 결과가 다르다 — 둘을 섞어 읽지 않는다
 */

import { planetPositions, houses, houseOf, PLANET_ORDER } from '../core/planets.js';
import { toJD, fromJD, norm360, angleDiff } from '../core/astro.js';
import { SIGNS, signOf, degInSign, findAspect, HOUSES } from '../systems/astrology.js';

const YEAR_DAYS = 365.2425;

/** 솔라 아크와 프로펙션에서 볼 지점 */
const ARC_POINTS = ['태양', '달', '금성', '목성', '토성', '화성'];

// ─────────────────────────────────────────────────────────────
// 솔라 아크 디렉션
// ─────────────────────────────────────────────────────────────

/**
 * 솔라 아크 — 차트 전체를 태양이 간 만큼 밀어 놓고 출생 차트에 대본다.
 *
 * 한 해에 약 1도씩 가므로 한 각이 맺히는 구간이 한두 해로 좁혀진다.
 * 트랜싯이 "이 달"이라면 이쪽은 "이 해"다. 큰 사건의 연도를 고르는 데 쓴다.
 *
 * @param {object} N natalPack 결과
 * @param {number} jd 볼 시점
 */
export function solarArcAt(input, N, jd) {
  const elapsed = (jd - input.jdUT) / YEAR_DAYS;
  const progSun = planetPositions(input.jdUT + elapsed).태양.lon;
  const arc = norm360(progSun - N.pos.태양.lon);

  // 밀어 놓을 지점 — 행성과 각(角)
  const moved = {};
  for (const p of ARC_POINTS) moved[p] = norm360(N.pos[p].lon + arc);
  if (input.timeKnown) {
    moved.ASC = norm360(N.asc + arc);
    moved.MC = norm360(N.mc + arc);
    moved.DSC = norm360(N.asc + 180 + arc);
    moved.IC = norm360(N.mc + 180 + arc);
  }

  // 출생 차트의 무엇에 걸리는가
  const targets = [
    ['출생 태양', N.pos.태양.lon], ['출생 달', N.pos.달.lon],
    ['출생 금성', N.pos.금성.lon], ['출생 목성', N.pos.목성.lon],
    ['출생 토성', N.pos.토성.lon], ['출생 화성', N.pos.화성.lon],
  ];
  if (input.timeKnown) {
    targets.push(['상승점', N.asc], ['중천', N.mc],
                 ['하강점', norm360(N.asc + 180)], ['천저', norm360(N.mc + 180)]);
  }

  // 솔라 아크는 한 해에 1도라 오브를 1도 안쪽으로 좁힌다.
  // 트랜싯과 같은 오브(7~8도)를 쓰면 여덟 해가 한꺼번에 걸려 뜻이 없다.
  const ORB = 1.0;
  const ANGLES = [[0, '합'], [60, '육각'], [90, '사각'], [120, '삼각'], [180, '대각']];
  const hits = [];
  for (const [name, lon] of Object.entries(moved)) {
    for (const [tn, tl] of targets) {
      if (`출생 ${name}` === tn) continue;            // 자기 자신과의 합은 뜻이 없다
      const sep = Math.abs(((lon - tl + 540) % 360) - 180);
      for (const [deg, label] of ANGLES) {
        const off = Math.abs(sep - deg);
        if (off <= ORB) {
          hits.push({ from: name, to: tn, aspect: label, orb: Math.round(off * 100) / 100,
            // 한 해에 약 1도이므로 오브가 곧 남은 햇수다
            yearsAway: Math.round(off * 100) / 100 });
        }
      }
    }
  }
  hits.sort((a, b) => a.orb - b.orb);
  return { arc: Math.round(arc * 100) / 100, elapsed: Math.round(elapsed * 10) / 10, moved, hits };
}

/**
 * 어느 해에 솔라 아크가 맺히는가 — 연도 후보를 직접 돌려준다.
 * 사건의 해를 좁히는 것이 목적이므로 구간이 아니라 해를 센다.
 */
export function solarArcYears(input, N, fromYear, toYear) {
  const out = [];
  for (let y = fromYear; y <= toYear; y++) {
    const s = solarArcAt(input, N, toJD(y, 7, 1, 12));
    for (const h of s.hits) {
      out.push({ year: y, ...h, label: `${h.from}→${h.to} ${h.aspect}` });
    }
  }
  // 같은 각이 두 해에 걸치면 더 가까운 해만 남긴다
  const best = new Map();
  for (const h of out) {
    const k = `${h.from}|${h.to}|${h.aspect}`;
    if (!best.has(k) || best.get(k).orb > h.orb) best.set(k, h);
  }
  return [...best.values()].sort((a, b) => a.year - b.year || a.orb - b.orb);
}

// ─────────────────────────────────────────────────────────────
// 연간 프로펙션
// ─────────────────────────────────────────────────────────────

/** 각 별자리의 주인 — 전통 지배성(현대 지배성을 쓰지 않는다) */
const TRADITIONAL_RULER = ['화성', '금성', '수성', '달', '태양', '수성',
                           '금성', '화성', '목성', '토성', '토성', '목성'];

/** 그 하우스가 무엇을 보는 자리인가 */
export const HOUSE_TOPIC = {
  1: '몸과 자기 자신', 2: '돈과 소유', 3: '가까운 이동과 소통', 4: '집과 뿌리',
  5: '연애와 자식, 창작', 6: '일상 노동과 건강', 7: '짝과 동업', 8: '남의 돈과 위기',
  9: '먼 길과 배움', 10: '직업과 평판', 11: '동료와 바라는 것', 12: '이면과 놓아주는 일',
};

/**
 * 연간 프로펙션 — 그 해의 무대와 주인.
 *
 * 만 나이 n 살이면 상승점에서 n 칸 옮긴 자리가 그 해의 1하우스가 된다.
 * 그 별자리의 전통 지배성이 그 해의 주인(Time Lord)이고, 그 행성에 걸린
 * 트랜싯이 그 해의 사건을 만든다고 본다.
 *
 * @param {number} age 만 나이
 */
export function profection(input, N, age) {
  if (!input.timeKnown) return null;
  const ascSign = signOf(N.asc);
  const house = (age % 12) + 1;
  const sign = (ascSign + (age % 12)) % 12;
  const lord = TRADITIONAL_RULER[sign];

  return {
    age, house, topic: HOUSE_TOPIC[house],
    sign: SIGNS[sign].name,
    timeLord: lord,
    // 그 해의 주인이 출생 차트 어디에 앉아 있는가 — 사건이 어느 자리에서 터지는가
    lordNatalHouse: houseOf(N.pos[lord].lon, N.cusps),
    lordNatalSign: SIGNS[signOf(N.pos[lord].lon)].name,
    lordRetro: N.pos[lord].retrograde,
  };
}

/** 여러 해치를 한 번에 — 어느 해에 어느 자리가 켜지는지 본다 */
export function profectionYears(input, N, birthYear, fromYear, toYear) {
  const out = [];
  for (let y = fromYear; y <= toYear; y++) {
    const age = y - birthYear;
    const p = profection(input, N, Math.max(0, age));
    if (p) out.push({ year: y, ...p });
  }
  return out;
}

/** 질문 분야가 프로펙션 하우스와 맞물리는가 */
export const DOMAIN_HOUSES = {
  직업: [10, 6, 2, 11], 이직: [10, 6, 1, 11],
  재물: [2, 8, 11, 5], 결혼: [7, 5, 4], 관계: [7, 5, 11],
  주거: [4, 2, 8], 이사: [4, 3, 9, 12], 자녀: [5, 4, 9], 건강: [6, 1, 12], 학업: [9, 3, 5],
};

// ─────────────────────────────────────────────────────────────
// 루나 리턴
// ─────────────────────────────────────────────────────────────

/**
 * 루나 리턴 — 달이 출생 위치로 돌아오는 순간. 한 달을 아주 좁게 볼 때만 쓴다.
 * 기본 분석에 넣지 않는다. 달마다 한 번씩 오므로 남용하면 잡음이 된다.
 */
export function lunarReturn(input, N, afterJD, place = null) {
  const where = place ?? input.home ?? input.place;
  const target = N.pos.달.lon;
  // 달은 하루 13도씩 간다. 이분법으로 정확한 순간을 조인다
  let lo = afterJD, hi = afterJD + 28;
  const diff = (t) => angleDiff(planetPositions(t).달.lon, target);
  if (diff(lo) > 0) { // 이미 지났으면 다음 회귀로
    while (diff(lo) > 0 && lo < afterJD + 30) lo += 1;
  }
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (diff(mid) < 0) lo = mid; else hi = mid;
  }
  const jd = (lo + hi) / 2;
  const h = input.timeKnown ? houses(jd, where.lat, where.lon) : null;
  const pos = planetPositions(jd);
  return {
    jd, at: fromJD(jd + 9 / 24),
    asc: h ? SIGNS[signOf(h.asc)].name : null,
    mc: h ? SIGNS[signOf(h.mc)].name : null,
    moonHouse: h ? houseOf(pos.달.lon, h.cusps) : null,
    sunHouse: h ? houseOf(pos.태양.lon, h.cusps) : null,
  };
}

// ─────────────────────────────────────────────────────────────
// 두 사람 — 합성 차트와 데이비슨
// ─────────────────────────────────────────────────────────────

/** 두 황경의 가까운 쪽 중점 */
const midLon = (a, b) => {
  const d = ((b - a + 540) % 360) - 180;
  return norm360(a + d / 2);
};

/**
 * 합성 차트(Composite) — 두 사람의 같은 천체끼리 중점을 잡는다.
 * 관계 자체가 하나의 차트를 가진다고 보는 방식이다.
 */
export function compositeChart(inputA, inputB) {
  const A = planetPositions(inputA.jdUT);
  const B = planetPositions(inputB.jdUT);
  const planets = {};
  for (const p of PLANET_ORDER) planets[p] = midLon(A[p].lon, B[p].lon);

  let asc = null, mc = null;
  if (inputA.timeKnown && inputB.timeKnown) {
    const ha = houses(inputA.jdUT, inputA.place.lat, inputA.place.lon);
    const hb = houses(inputB.jdUT, inputB.place.lat, inputB.place.lon);
    asc = midLon(ha.asc, hb.asc);
    mc = midLon(ha.mc, hb.mc);
  }

  return {
    kind: '합성(중점)',
    planets: Object.fromEntries(Object.entries(planets).map(([k, v]) =>
      [k, `${SIGNS[signOf(v)].name} ${degInSign(v).toFixed(1)}°`])),
    lon: planets,
    asc: asc == null ? null : `${SIGNS[signOf(asc)].name} ${degInSign(asc).toFixed(1)}°`,
    mc: mc == null ? null : `${SIGNS[signOf(mc)].name} ${degInSign(mc).toFixed(1)}°`,
    ascLon: asc, mcLon: mc,
  };
}

/**
 * 데이비슨 차트 — 두 사람의 시각과 장소를 각각 중간으로 잡아
 * **실제로 하늘을 다시 계산한** 차트. 중점 방식과 결과가 다르다.
 */
export function davisonChart(inputA, inputB) {
  const jd = (inputA.jdUT + inputB.jdUT) / 2;
  const lat = (inputA.place.lat + inputB.place.lat) / 2;
  const lon = (inputA.place.lon + inputB.place.lon) / 2;
  const pos = planetPositions(jd);
  const h = (inputA.timeKnown && inputB.timeKnown) ? houses(jd, lat, lon) : null;
  return {
    kind: '데이비슨(시공 중간)',
    at: fromJD(jd + 9 / 24), lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100,
    planets: Object.fromEntries(PLANET_ORDER.slice(0, 10).map((p) =>
      [p, `${SIGNS[signOf(pos[p].lon)].name} ${degInSign(pos[p].lon).toFixed(1)}°`])),
    lon7: Object.fromEntries(PLANET_ORDER.slice(0, 10).map((p) => [p, pos[p].lon])),
    asc: h ? `${SIGNS[signOf(h.asc)].name} ${degInSign(h.asc).toFixed(1)}°` : null,
    mc: h ? `${SIGNS[signOf(h.mc)].name} ${degInSign(h.mc).toFixed(1)}°` : null,
    ascLon: h?.asc ?? null, mcLon: h?.mc ?? null,
  };
}

/**
 * 합성 차트에 지금 하늘이 어떻게 걸리는가.
 * 관계의 시계를 보는 자리라, 결혼 시기를 물을 때 쓴다.
 */
export function compositeTransits(comp, jd) {
  const now = planetPositions(jd);
  const targets = [
    ['합성 태양', comp.lon.태양], ['합성 달', comp.lon.달],
    ['합성 금성', comp.lon.금성], ['합성 화성', comp.lon.화성],
  ];
  if (comp.ascLon != null) targets.push(['합성 상승점', comp.ascLon], ['합성 중천', comp.mcLon]);

  const hits = [];
  for (const p of ['목성', '토성', '천왕성', '명왕성']) {
    for (const [tn, tl] of targets) {
      if (tl == null) continue;
      const a = findAspect(now[p].lon, tl);
      if (a) hits.push({ planet: p, target: tn, aspect: a.name, orb: Math.round(a.orbUsed * 10) / 10 });
    }
  }
  return hits.sort((a, b) => a.orb - b.orb);
}

export { HOUSES };
