/**
 * location.js — 방향과 장소를 계산으로 다룬다
 *
 * "남쪽이 좋습니다"로 끝나지 않으려면 세 단계를 거쳐야 한다.
 *
 *   1) 방향 신호 계산   — 명반에서 나오는 것. 아래 세 가지가 그 자리다
 *   2) 거리·이동성 판단 — 실제 좌표로 방위각과 직선거리를 잰다
 *   3) 후보 지역 매핑   — 그 방향·거리에 실제로 있는 도시를 고른다
 *
 * **동네 이름은 명반에서 나오지 않는다.** 1단계만 계산이고, 3단계는 계산된
 * 방향을 실제 지도에 대본 것이다. 결과에 그 구분을 그대로 달아 둔다.
 *
 * 여기서 계산하는 것
 *   · 아스트로카토그래피 — 행성이 그 자리에서 각(角)이 되는 지구 위의 선
 *   · 로컬 스페이스     — 기준 지점에서 본 행성의 방위각
 *   · 릴로케이션 차트   — 후보 도시 좌표로 다시 세운 하우스
 *   · 지리 계산         — 두 좌표 사이의 방위각과 대권거리
 *
 * ── 계산 근거 ──────────────────────────────────────────────
 *   MC 라인 : 그 행성이 남중하는 경도. λ = 적경 − 그리니치항성시
 *   IC 라인 : λ = 적경 + 180° − 그리니치항성시
 *   ASC/DSC : 위도마다 다른 곡선이다. 뜨고 지는 시각의 시간각
 *             H₀ = arccos(−tanφ·tanδ) 를 써서 λ = 적경 ∓ H₀ − 항성시
 *   방위각  : 표준 지평좌표 변환
 *   거리    : 대권거리 (지구 반지름 6371km)
 *
 * 행성의 황위(黃緯)는 0으로 둔다. core/planets.js 가 황경만 계산하기 때문이고,
 * 이 사이트의 다른 모든 계산도 같은 가정 위에 서 있다. 명왕성처럼 황위가 큰
 * 천체는 라인이 실제보다 조금 어긋날 수 있다 — 그 한계를 결과에 적어 둔다.
 */

import {
  planetPositions, gmst, raFromLon, declFromLon, PLANET_ORDER, houses, houseOf,
} from '../core/planets.js';
import { obliquity, norm360, DEG } from '../core/astro.js';
import { CITIES, findCity } from '../core/place.js';
import { SIGNS, signOf, degInSign } from '../systems/astrology.js';

const sin = (d) => Math.sin(d * DEG);
const cos = (d) => Math.cos(d * DEG);
const tan = (d) => Math.tan(d * DEG);
const asin = (x) => Math.asin(Math.max(-1, Math.min(1, x))) / DEG;
const acos = (x) => Math.acos(Math.max(-1, Math.min(1, x))) / DEG;
const atan2 = (y, x) => Math.atan2(y, x) / DEG;

const EARTH_R = 6371;

/** −180 ~ +180 으로 접는다 (지구 경도 표기) */
const wrapLon = (x) => ((x + 540) % 360) - 180;

/** 아스트로카토그래피에서 보는 여섯 행성 */
export const ACG_PLANETS = ['태양', '금성', '목성', '토성', '화성', '천왕성'];

/** 각 라인이 무엇을 뜻하는지 — 해석이 아니라 자리 이름이다 */
export const LINE_MEANING = {
  ASC: '그곳에서 겉으로 드러나는 모습과 몸 쓰는 방식',
  DSC: '그곳에서 만나는 사람과 짝·동업',
  MC: '그곳에서의 직업과 평판',
  IC: '그곳에서의 집과 뿌리',
};

// ─────────────────────────────────────────────────────────────
// 1) 아스트로카토그래피
// ─────────────────────────────────────────────────────────────

/** 한 행성의 적경·적위 (황위 0 가정) */
function equatorial(lon, eps) {
  return { ra: raFromLon(lon, eps), dec: declFromLon(lon, eps) };
}

/**
 * 출생 순간을 기준으로 행성의 MC·IC 라인 경도와, 주어진 위도들에서의
 * ASC·DSC 라인 경도를 구한다.
 *
 * @param {number} jd   출생 율리우스일
 * @param {number[]} lats ASC/DSC 를 잴 위도 목록. 기본은 한반도 범위
 */
export function astrocartography(jd, lats = [33, 35, 36, 37, 38]) {
  const eps = obliquity(jd);
  const st = gmst(jd);
  const pos = planetPositions(jd);

  const out = [];
  for (const p of ACG_PLANETS) {
    const { ra, dec } = equatorial(pos[p].lon, eps);
    const mc = wrapLon(ra - st);
    const ic = wrapLon(ra + 180 - st);

    const asc = [], dsc = [];
    for (const phi of lats) {
      const c = -tan(phi) * tan(dec);
      if (Math.abs(c) > 1) continue;              // 그 위도에서는 뜨거나 지지 않는다
      const H0 = acos(c);
      asc.push({ lat: phi, lon: wrapLon(ra - H0 - st) });
      dsc.push({ lat: phi, lon: wrapLon(ra + H0 - st) });
    }
    out.push({ planet: p, mc, ic, asc, dsc, retro: pos[p].retrograde });
  }
  return { jd, lats, lines: out };
}

/** 그 위도에서의 라인 경도를 선형으로 집어낸다 */
function lineLonAt(points, lat) {
  if (!points.length) return null;
  let best = points[0];
  for (const p of points) if (Math.abs(p.lat - lat) < Math.abs(best.lat - lat)) best = p;
  return best.lon;
}

/**
 * 한 지점이 어느 라인에 얼마나 가까운가.
 * 거리는 그 위도에서의 실제 동서 거리(km)로 환산한다.
 *
 * 영향권 반경은 계산값이 아니라 관례다. 아스트로카토그래피에서 흔히
 * 100~300km 안쪽을 세게 본다. 여기서는 거리를 그대로 돌려주고
 * 세다·약하다는 판단을 바깥 레이어에 맡긴다.
 */
export function linesNear(acg, lat, lon, maxKm = 400) {
  const kmPerDeg = 111.32 * cos(lat);
  const out = [];
  for (const L of acg.lines) {
    const candidates = [
      ['MC', L.mc], ['IC', L.ic],
      ['ASC', lineLonAt(L.asc, lat)], ['DSC', lineLonAt(L.dsc, lat)],
    ];
    for (const [kind, ln] of candidates) {
      if (ln == null) continue;
      const dLon = Math.abs(wrapLon(ln - lon));
      const km = Math.round(dLon * kmPerDeg);
      if (km <= maxKm) {
        out.push({ planet: L.planet, kind, km, meaning: LINE_MEANING[kind] });
      }
    }
  }
  return out.sort((a, b) => a.km - b.km);
}

// ─────────────────────────────────────────────────────────────
// 2) 로컬 스페이스
// ─────────────────────────────────────────────────────────────

/**
 * 기준 지점에서 본 행성의 방위각 (북 0°, 동 90°).
 *
 * 태어난 순간의 하늘을 기준 지점의 지평에 대본 것이다. 거주지를 기준으로
 * 잡으면 "지금 사는 곳에서 어느 쪽이 어떤 결인가"가 된다.
 */
export function localSpace(jd, lat, lon, planets = ACG_PLANETS) {
  const eps = obliquity(jd);
  const lst = norm360(gmst(jd) + lon);
  const pos = planetPositions(jd);

  const DIR8 = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  return planets.map((p) => {
    const { ra, dec } = equatorial(pos[p].lon, eps);
    const H = norm360(lst - ra);
    const alt = asin(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H));
    const az = norm360(atan2(-cos(dec) * sin(H), sin(dec) * cos(lat) - cos(dec) * sin(lat) * cos(H)));
    return {
      planet: p,
      azimuth: Math.round(az * 10) / 10,
      dir8: DIR8[Math.round(az / 45) % 8],
      altitude: Math.round(alt * 10) / 10,
      aboveHorizon: alt > 0,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// 3) 릴로케이션 차트
// ─────────────────────────────────────────────────────────────

/** 하우스 뜻이 바뀌면 삶의 어느 자리가 달라지는지 */
const RELOC_FOCUS = { 10: '직업', 2: '돈', 7: '관계', 4: '주거' };

/**
 * 후보 도시 좌표로 출생 차트를 다시 세운다.
 * 행성의 황경은 그대로고 하우스만 바뀐다 — 그것이 릴로케이션의 전부다.
 */
export function relocation(input, cityName) {
  const city = typeof cityName === 'string' ? findCity(cityName) : cityName;
  if (!city) return null;
  if (!input.timeKnown) return { city: city.name, unavailable: '출생 시각을 알아야 하우스를 세울 수 있습니다' };

  const pos = planetPositions(input.jdUT);
  const h = houses(input.jdUT, city.lat, city.lon);
  const natal = houses(input.jdUT, input.place.lat, input.place.lon);

  const moved = [];
  for (const p of PLANET_ORDER.slice(0, 10)) {
    const a = houseOf(pos[p].lon, natal.cusps);
    const b = houseOf(pos[p].lon, h.cusps);
    if (a !== b) moved.push({ planet: p, from: a, to: b, focus: RELOC_FOCUS[b] ?? null });
  }

  const byFocus = {};
  for (const [hn, label] of Object.entries(RELOC_FOCUS)) {
    byFocus[label] = PLANET_ORDER.slice(0, 10)
      .filter((p) => houseOf(pos[p].lon, h.cusps) === Number(hn));
  }

  return {
    city: city.name, lat: city.lat, lon: city.lon,
    asc: `${SIGNS[signOf(h.asc)].name} ${degInSign(h.asc).toFixed(1)}°`,
    mc: `${SIGNS[signOf(h.mc)].name} ${degInSign(h.mc).toFixed(1)}°`,
    system: h.system,
    moved,
    byFocus,
    lines: linesNear(astrocartography(input.jdUT, [Math.round(city.lat)]), city.lat, city.lon),
  };
}

// ─────────────────────────────────────────────────────────────
// 4) 지리 계산
// ─────────────────────────────────────────────────────────────

/** 두 지점 사이의 초기 방위각 (북 0°, 동 90°) */
export function bearing(from, to) {
  const dLon = to.lon - from.lon;
  const y = sin(dLon) * cos(to.lat);
  const x = cos(from.lat) * sin(to.lat) - sin(from.lat) * cos(to.lat) * cos(dLon);
  return norm360(atan2(y, x));
}

/** 대권거리 (km) */
export function distanceKm(from, to) {
  const dLat = (to.lat - from.lat) * DEG;
  const dLon = (to.lon - from.lon) * DEG;
  const a = Math.sin(dLat / 2) ** 2 +
    cos(from.lat) * cos(to.lat) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a))));
}

export const DIR16 = ['북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동',
                      '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서'];
export const DIR8 = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
export const dir16 = (deg) => DIR16[Math.round(norm360(deg) / 22.5) % 16];
export const dir8 = (deg) => DIR8[Math.round(norm360(deg) / 45) % 8];

/**
 * 기준 지점에서 특정 방향·거리 안에 있는 실제 도시를 고른다.
 *
 * 이것이 3단계다. 명반이 도시를 알려준 것이 아니라, 계산된 방향을
 * 지도에 대본 것이다. 결과에 반드시 그렇게 표시한다.
 *
 * @param {string|object} origin 기준 도시
 * @param {number} dirDeg 방향 (도)
 * @param {object} opts { spread: 허용 각도 반폭, minKm, maxKm, limit }
 */
export function candidatesToward(origin, dirDeg, opts = {}) {
  const o = typeof origin === 'string' ? findCity(origin) : origin;
  if (!o) return [];
  const { spread = 33, minKm = 15, maxKm = 400, limit = 8, koreaOnly = true } = opts;

  return CITIES
    .filter((c) => (!koreaOnly || c.kr) && c.name !== o.name)
    .map((c) => ({
      name: c.name, lat: c.lat, lon: c.lon,
      km: distanceKm(o, c),
      deg: bearing(o, c),
    }))
    .map((c) => ({ ...c, off: Math.abs(((c.deg - dirDeg + 540) % 360) - 180), dir: dir16(c.deg) }))
    .filter((c) => c.off <= spread && c.km >= minKm && c.km <= maxKm)
    .sort((a, b) => a.off - b.off || a.km - b.km)
    .slice(0, limit);
}

/**
 * 오행 방향 — 사주에서 약한 기운을 채우는 쪽.
 * systems/saju.js 의 LUCK 표와 같은 대응을 쓴다 (목=동, 화=남, 토=중앙, 금=서, 수=북).
 */
export const ELEMENT_DIR_DEG = [90, 180, null, 270, 0];

/**
 * 여러 체계의 방향 신호를 한데 모은다.
 * 여기서는 각도만 모으고, 어느 도시인지는 candidatesToward 가 따로 한다.
 */
export function directionSignals({ weakElementIndex = null, localSpaceRows = [], moveBearing = null }) {
  const out = [];
  if (weakElementIndex != null && ELEMENT_DIR_DEG[weakElementIndex] != null) {
    out.push({ source: '사주 보완 오행', deg: ELEMENT_DIR_DEG[weakElementIndex],
      note: '약한 기운을 채우는 쪽 (전통 오행 방위)' });
  }
  for (const r of localSpaceRows) {
    if (['목성', '금성', '태양'].includes(r.planet)) {
      out.push({ source: `로컬 스페이스 ${r.planet}`, deg: r.azimuth, note: LINE_MEANING.MC });
    }
  }
  if (moveBearing != null) {
    out.push({ source: '출생지→거주지 실제 이동', deg: moveBearing, note: '이미 일어난 이동 방향' });
  }

  // 여러 신호가 같은 쪽을 가리키면 그만큼 무게가 있다.
  // 묶는 단위는 8방위다. 16방위로 묶으면 235°와 252°처럼 사실상 같은 쪽이
  // 남서·서남서로 갈려 '반복 없음'이 되어 버린다.
  const buckets = new Map();
  for (const s of out) {
    const key = dir8(s.deg);
    buckets.set(key, [...(buckets.get(key) ?? []), s.source]);
  }
  const repeated = [...buckets.entries()]
    .filter(([, v]) => v.length >= 2)
    .map(([dir, from]) => ({ dir, from }))
    .sort((a, b) => b.from.length - a.from.length);

  return { signals: out, repeated };
}
