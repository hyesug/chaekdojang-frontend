/**
 * western.js — 서양 점성술로 시기를 좁힌다
 *
 * 기존 systems/astrology.js 의 forecast 는 트랜싯을 보긴 하지만
 * 출생 차트의 태양·달·상승점 세 점만 본다. 직업을 물으면 정작 봐야 할
 * 중천(MC)과 10·6·2하우스가 빠진다. 그래서 여기서 넓힌다.
 *
 *   1) 트랜싯 — 지금 하늘이 출생 차트의 어느 점을 건드리는가
 *   2) 2차 프로그레션 — 하루를 한 해로 세어 옮긴 내면의 시계
 *   3) 솔라 리턴 — 해마다 태양이 출생 위치로 돌아오는 순간의 차트
 *
 * 천체 위치·하우스·각은 core/planets.js 와 systems/astrology.js 가 이미
 * 계산하는 것을 그대로 쓴다. 여기서 새 천문 공식을 쓰지 않는다.
 *
 * ── 유파 고지 ──────────────────────────────────────────────
 *   하우스      : 플라시두스 (고위도에서만 등분). 기존과 같다
 *   황도        : 회귀(트로피컬). 기존과 같다
 *   각(오브)    : systems/astrology.js 의 ASPECTS 표를 그대로 쓴다.
 *                 트랜싯용으로 따로 좁히지 않는다 — 두 화면이 다른 각을
 *                 말하면 근거가 어긋나기 때문이다
 *   프로그레션  : 일도일년법(a day for a year). 진행 시각 = 출생 율리우스일
 *                 + 경과 햇수(일). 진행 ASC·MC 는 그 진행 시각의 항성시를
 *                 출생지 좌표에 대어 구한다 (나이보드·솔라아크 변형을 쓰지 않음)
 *   솔라 리턴   : 회귀 황경 기준. 태양이 출생 황경과 같아지는 순간을 찾고,
 *                 그 순간의 차트를 거주지 좌표로 세운다 (전통적으로 그해를
 *                 보내는 장소를 쓴다)
 */

import { planetPositions, houses, houseOf, PLANET_ORDER, gmst } from '../core/planets.js';
import { toJD, fromJD, solarTermJD, norm360 } from '../core/astro.js';
import { SIGNS, signOf, degInSign, findAspect, HOUSES } from '../systems/astrology.js';

/** 직업·돈·관계 질문에서 실제로 보는 자리 */
export const KEY_HOUSES = [2, 4, 6, 7, 8, 10, 11];

/** 질문 분야별로 앞세울 자리 */
export const DOMAIN_POINTS = {
  직업: { houses: [10, 6, 2, 11], planets: ['토성', '목성', '천왕성', '태양', '화성'] },
  이직: { houses: [10, 6, 2, 11], planets: ['토성', '목성', '천왕성', '태양', '화성'] },
  재물: { houses: [2, 8, 11, 10], planets: ['목성', '금성', '토성', '명왕성'] },
  결혼: { houses: [7, 5, 4, 8], planets: ['금성', '목성', '토성', '천왕성'] },
  관계: { houses: [7, 5, 11], planets: ['금성', '화성', '목성'] },
  이사: { houses: [4, 3, 9, 10], planets: ['천왕성', '목성', '토성'] },
  주거: { houses: [4, 2, 8], planets: ['토성', '목성', '천왕성'] },
  건강: { houses: [6, 1, 12], planets: ['토성', '화성', '해왕성'] },
  학업: { houses: [9, 3, 5], planets: ['수성', '목성'] },
};

/** 느리게 가는 순서대로. 느린 별이 걸린 각이 사건을 만든다 */
const SLOW = ['명왕성', '해왕성', '천왕성', '토성', '목성', '라후'];
const MID = ['화성'];
const FAST = ['태양', '금성', '수성'];

/** 출생 차트 한 벌 — 여러 번 쓰므로 한 번만 만든다 */
export function natalPack(input) {
  const pos = planetPositions(input.jdUT);
  const h = houses(input.jdUT, input.place.lat, input.place.lon);
  const ascSign = signOf(h.asc);
  const ruler = SIGNS[ascSign].ruler;
  return {
    pos, houses: h,
    asc: h.asc, mc: h.mc, cusps: h.cusps,
    ascSign, ruler,
    rulerLon: pos[ruler]?.lon ?? null,
  };
}

/** 트랜싯이 건드릴 출생 차트의 점들 */
function natalTargets(N, timeKnown, domain = null) {
  const t = [
    { name: '출생 태양', lon: N.pos.태양.lon, kind: 'planet' },
    { name: '출생 달', lon: N.pos.달.lon, kind: 'planet' },
  ];
  if (!timeKnown) return t;

  t.push({ name: '상승점', lon: N.asc, kind: 'angle' });
  t.push({ name: '중천', lon: N.mc, kind: 'angle' });
  // 차트 주인이 태양이나 달이면 위에 이미 있다. 또 넣으면 같은 각이 두 번 잡힌다.
  const near = (a, b) => Math.abs(((a - b + 540) % 360) - 180) < 0.5;
  if (N.rulerLon != null && !near(N.rulerLon, N.pos.태양.lon) && !near(N.rulerLon, N.pos.달.lon)) {
    t.push({ name: `차트 주인 ${N.ruler}`, lon: N.rulerLon, kind: 'ruler' });
  }
  const want = domain && DOMAIN_POINTS[domain] ? DOMAIN_POINTS[domain].houses : KEY_HOUSES;
  for (const hn of want) {
    t.push({ name: `${hn}하우스 시작점`, lon: N.cusps[hn], kind: 'cusp', house: hn,
      relevant: domain ? (DOMAIN_POINTS[domain]?.houses ?? []).includes(hn) : false });
  }
  return t;
}

/** 이 질문에서 그 점이 얼마나 중요한가 — 같은 각이 겹칠 때 무엇을 남길지 고른다 */
const targetRank = (tg) =>
  tg.kind === 'angle' ? 3
  : tg.kind === 'planet' ? 2.4
  : tg.kind === 'cusp' ? (tg.relevant ? 2.2 : 1.4)
  : 1.2;

/**
 * 한 시점의 트랜싯.
 *
 * @param {object} N      natalPack 결과
 * @param {number} jd     볼 시점
 * @param {object} opts   { timeKnown, domain, speed: 'slow'|'month'|'day' }
 */
export function transitsAt(N, jd, opts = {}) {
  const { timeKnown = true, domain = null, speed = 'month' } = opts;
  const now = planetPositions(jd);
  const targets = natalTargets(N, timeKnown, domain);

  const movers = speed === 'slow' ? SLOW
    : speed === 'day' ? ['달', ...FAST, ...MID]
    : [...SLOW, ...MID, ...FAST];

  // 사흘 뒤 위치는 각이 다가오는지 멀어지는지 가리는 데만 쓴다.
  // 각마다 다시 구하면 같은 계산을 수십 번 되풀이하게 되므로 한 번만 구한다.
  const later = planetPositions(jd + 3);

  const hits = [];
  for (const p of movers) {
    if (!now[p]) continue;
    for (const tg of targets) {
      const a = findAspect(now[p].lon, tg.lon);
      if (!a) continue;
      // 다가오는 각인가 멀어지는 각인가 — 사건의 시점을 가르는 자리다
      const sep = Math.abs(((now[p].lon - tg.lon + 540) % 360) - 180);
      const sepNext = Math.abs(((later[p].lon - tg.lon + 540) % 360) - 180);
      const applying = Math.abs(sepNext - a.angle) < Math.abs(sep - a.angle);
      hits.push({
        planet: p, target: tg.name, targetKind: tg.kind, house: tg.house ?? null,
        aspect: a.name, orb: Math.round(a.orbUsed * 10) / 10,
        exact: a.exact, applying,
        retro: now[p].retrograde,
        tight: Math.round((1 - a.orbUsed / (a.orb + 1)) * 100) / 100,
        rank: targetRank(tg),
      });
    }
  }

  // 마주 보는 두 커스프(3–9, 4–10)는 한쪽에 합이면 다른 쪽에 대각이다.
  // 같은 각을 두 줄로 적으면 근거가 두 배로 부풀어 보이므로 하나만 남긴다.
  hits.sort((x, y) => y.rank - x.rank || y.tight - x.tight);
  const seen = new Set();
  const deduped = [];
  for (const h of hits) {
    const key = `${h.planet}|${Math.round(h.orb * 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(h);
  }
  deduped.sort((x, y) => y.tight - x.tight);
  hits.length = 0;
  hits.push(...deduped);

  // 트랜싯 행성이 출생 차트의 어느 하우스를 지나는가
  const inHouse = {};
  if (timeKnown) {
    for (const p of [...SLOW, ...MID]) {
      if (!now[p]) continue;
      inHouse[p] = houseOf(now[p].lon, N.cusps);
    }
  }

  return { jd, hits, inHouse, positions: now };
}

/**
 * 2차 프로그레션 — 하루를 한 해로 센다.
 *
 * 태어난 뒤 n 일째 하늘이 n 살의 내면이라고 본다. 특히 진행 달은 한 별자리에
 * 두 해 반씩 머물러, 사건의 시기를 좁힐 때 가장 많이 쓰인다.
 */
/**
 * 진행 차트의 각(角).
 *
 * 진행 행성은 출생 율리우스일 + 경과 햇수(일) 에서 그냥 읽으면 된다.
 * 그런데 **각은 그렇게 읽으면 안 된다.** 경과 햇수가 34.5 처럼 소수라
 * 그 시점의 시각이 출생 시각과 반나절 어긋나고, 상승점이 별자리를 한 바퀴
 * 돌아 버린다. 실제로 그렇게 짜 보니 한 해 안에서 상승점이 사자→전갈→물병
 * 으로 튀었다.
 *
 * 일도일년법에서 각은 "진행 날짜의 **출생과 같은 시각**"에서 읽는다.
 * 같은 시각이면 항성시가 하루에 약 0.9856°씩 앞서므로 중천이 한 해에
 * 1° 남짓 나아간다 — 이것이 진행 각이 움직이는 속도로 알려진 값이다.
 *
 * 여기서는 목표 항성시를 먼저 정하고, 그 항성시가 되는 순간을 찾아
 * 기존 houses() 에 넘긴다. 각 계산식을 따로 베껴 쓰지 않으려는 것이다.
 */
const SIDEREAL_GAIN = 0.9856473;           // 하루에 항성시가 앞서는 양 (도)
const SIDEREAL_RATE = 360.98564736629;     // 항성시가 하루에 도는 양 (도)

function progressedAngles(input, elapsed) {
  const lon = input.place.lon;
  const target = norm360(gmst(input.jdUT) + lon + SIDEREAL_GAIN * elapsed);
  let jd = input.jdUT + elapsed;
  for (let i = 0; i < 5; i++) {
    const cur = norm360(gmst(jd) + lon);
    const d = ((target - cur + 540) % 360) - 180;
    if (Math.abs(d) < 1e-7) break;
    jd += d / SIDEREAL_RATE;
  }
  return houses(jd, input.place.lat, lon);
}

export function progressedAt(input, N, jd) {
  const elapsed = (jd - input.jdUT) / 365.2425;
  const jdProg = input.jdUT + elapsed;          // 하루 = 한 해
  const pos = planetPositions(jdProg);
  const h = input.timeKnown
    ? progressedAngles(input, elapsed)
    : { asc: 0, mc: 0 };

  const pick = ['태양', '달', '수성', '금성', '화성'];
  const planets = {};
  for (const p of pick) {
    planets[p] = {
      lon: pos[p].lon,
      sign: SIGNS[signOf(pos[p].lon)].name,
      deg: Math.round(degInSign(pos[p].lon) * 10) / 10,
      retro: pos[p].retrograde,
      natalHouse: input.timeKnown ? houseOf(pos[p].lon, N.cusps) : null,
    };
  }

  // 진행 달이 출생 차트의 무엇을 건드리는가
  const moonHits = [];
  const targets = natalTargets(N, input.timeKnown);
  for (const tg of targets) {
    const a = findAspect(pos.달.lon, tg.lon);
    if (a) moonHits.push({ target: tg.name, aspect: a.name, orb: Math.round(a.orbUsed * 10) / 10 });
  }

  return {
    elapsed: Math.round(elapsed * 100) / 100,
    jdProg,
    date: fromJD(jdProg),
    planets,
    asc: input.timeKnown ? { lon: h.asc, sign: SIGNS[signOf(h.asc)].name, deg: Math.round(degInSign(h.asc) * 10) / 10 } : null,
    mc: input.timeKnown ? { lon: h.mc, sign: SIGNS[signOf(h.mc)].name, deg: Math.round(degInSign(h.mc) * 10) / 10 } : null,
    moonHits,
  };
}

/**
 * 진행 달이 별자리 또는 하우스를 갈아타는 시점.
 * 사건의 문턱으로 자주 쓰이는 신호라 실제 달을 찾아 돌려준다.
 */
export function progressedMoonIngress(input, N, fromYear, toYear) {
  const out = [];
  let prevSign = null, prevHouse = null;
  for (let y = fromYear; y <= toYear; y++) {
    for (let m = 1; m <= 12; m++) {
      const jd = toJD(y, m, 1, 12) - 9 / 24;
      if (jd < input.jdUT) continue;
      const p = progressedAt(input, N, jd);
      const s = SIGNS[signOf(p.planets.달.lon)].name;
      const hse = input.timeKnown ? houseOf(p.planets.달.lon, N.cusps) : null;
      if (prevSign && s !== prevSign) out.push({ y, m, kind: '별자리', to: s });
      if (prevHouse && hse !== prevHouse) out.push({ y, m, kind: '하우스', to: `${hse}하우스` });
      prevSign = s; prevHouse = hse;
    }
  }
  return out;
}

/**
 * 솔라 리턴 — 태양이 출생 황경으로 돌아오는 순간의 차트.
 *
 * 그 한 해의 주제를 보는 차트다. 상승점과 중천이 출생 차트의 어느 하우스에
 * 떨어지는지가 그 해 무대가 어디인지를 알려준다.
 *
 * @param {object} place 차트를 세울 곳. 전통적으로 그 해를 보내는 곳(거주지)
 */
export function solarReturn(input, N, year, place = null) {
  const where = place ?? input.home ?? input.place;
  const natalSun = N.pos.태양.lon;
  // 그 해 1월 1일 이후 태양이 출생 황경에 처음 도달하는 시각
  const jd = solarTermJD(natalSun, toJD(year, 1, 1, 0));
  const pos = planetPositions(jd);
  const h = houses(jd, where.lat, where.lon);

  const planetHouses = {};
  for (const p of PLANET_ORDER.slice(0, 10)) {
    planetHouses[p] = {
      sign: SIGNS[signOf(pos[p].lon)].name,
      house: houseOf(pos[p].lon, h.cusps),
      retro: pos[p].retrograde,
    };
  }

  return {
    year, jd, at: fromJD(jd + 9 / 24), place: where.name ?? null,
    asc: { lon: h.asc, sign: SIGNS[signOf(h.asc)].name, deg: Math.round(degInSign(h.asc) * 10) / 10 },
    mc: { lon: h.mc, sign: SIGNS[signOf(h.mc)].name, deg: Math.round(degInSign(h.mc) * 10) / 10 },
    sunHouse: houseOf(pos.태양.lon, h.cusps),
    moonHouse: houseOf(pos.달.lon, h.cusps),
    planetHouses,
    // 솔라 리턴의 각이 출생 차트의 어느 하우스에 떨어지는가
    ascInNatalHouse: input.timeKnown ? houseOf(h.asc, N.cusps) : null,
    mcInNatalHouse: input.timeKnown ? houseOf(h.mc, N.cusps) : null,
  };
}

/** 하우스가 무엇을 보는 자리인지 — 프롬프트에 뜻을 함께 싣는다 */
export const houseMeaning = (n) => HOUSES[n]?.[1] ?? '';

/** 프롬프트용 — 트랜싯 몇 개를 한 줄로 */
export function formatTransits(t, n = 6) {
  if (!t.hits.length) return '뚜렷한 각 없음';
  return t.hits.slice(0, n).map((h) =>
    `${h.planet}${h.retro ? '℞' : ''}–${h.target} ${h.aspect}(${h.orb}°${h.applying ? '↗' : '↘'})`
  ).join(', ');
}
