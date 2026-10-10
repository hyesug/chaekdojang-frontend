/**
 * planets.js — 행성 위치와 하우스 분할
 *
 * 점성술과 베딕이 쓰는 재료다. 사주 쪽 체계는 여기를 건드리지 않는다.
 *
 * 행성 위치는 JPL이 공개한 근사 궤도요소(Standish)로 구한다.
 *
 * ── 실제로 얼마나 정확한가 (독립 구현과 대조해 잰 값) ────────
 * 1900~2050년을 60일 간격으로 훑어 독립 구현과 벌어지는 폭을 쟀다.
 *
 *   태양 0.8′ · 달 1.0′ · 금성 1.5′ · 해왕성 1.4′ · 천왕성 2.2′ · 화성 2.9′
 *   목성 10.8′ · 토성 14.3′
 *   수성 84′  — 내합(태양과 붙는 때) 근처에서 지심 경도가 급변해 벌어진다.
 *               기하학적 확대라 어느 구현을 써도 생긴다
 *   명왕성 85′ — JPL 근사 궤도요소가 가장 약한 천체다
 *
 * 해와 달이 1분각 안쪽인 것이 중요하다. 절기·음력·사주 월주가 전부 태양
 * 황경에 매달려 있어서, 여기가 흔들리면 팔자가 통째로 밀린다.
 *
 * **이 값을 어디에 쓰면 안 되는가.** 도수 순서로 무언가를 정하는 계산은
 * 위 폭 안쪽에서 순서가 뒤집힐 수 있다. 실제로 베딕 차라 카라카가 그런
 * 자리라, hires/vedicExt.js 가 흔들릴 수 있는 쌍을 따로 신고한다.
 *
 * 재는 방법과 상한은 tests/unse/ephemeris-accuracy.test.mjs 에 있다.
 * 기준값은 tests/unse/fixtures/ephemeris-reference.json 에 떠 두었다.
 *
 * 좌표는 J2000 황도 기준으로 구한 뒤 세차를 더해 그 시점의 분점으로 옮긴다.
 * 그래야 회귀(트로피컬) 황경이 된다. 베딕은 여기서 아야남샤를 뺀다.
 */

import {
  DEG, norm360, toJD, fromJD, sunLongitude, moonLongitude,
  precession, obliquity, lahiriAyanamsa,
} from './astro.js';

const sin = (d) => Math.sin(d * DEG);
const cos = (d) => Math.cos(d * DEG);
const tan = (d) => Math.tan(d * DEG);
const asin = (x) => Math.asin(Math.max(-1, Math.min(1, x))) / DEG;
const atan2 = (y, x) => Math.atan2(y, x) / DEG;

// ── JPL 근사 궤도요소 (J2000 기준값과 100년당 변화율) ──────────
// [a, e, I, L, ϖ(근일점 황경), Ω(승교점 황경)] 과 각각의 변화율
const ELEMENTS = {
  수성: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
         [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  금성: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
         [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
  지구: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
         [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
  화성: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
         [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  목성: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
         [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  토성: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
         [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  천왕성: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
           [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
  해왕성: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
           [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
  명왕성: [[39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684],
           [-0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482]],
};

/** 케플러 방정식 M = E − e·sinE 를 뉴턴법으로 푼다 (E는 도 단위) */
function eccentricAnomaly(M, e) {
  const eDeg = e / DEG;
  let E = M + eDeg * sin(M);
  for (let i = 0; i < 12; i++) {
    const dM = M - (E - eDeg * sin(E));
    const dE = dM / (1 - e * cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

/** 행성의 일심 직교좌표 (J2000 황도면, AU) */
function heliocentricXYZ(name, T) {
  const [base, rate] = ELEMENTS[name];
  const [a, e, I, L, peri, node] = base.map((v, i) => v + rate[i] * T);

  const omega = peri - node;              // 근일점 인수
  const M = norm360(L - peri);
  const E = eccentricAnomaly(M > 180 ? M - 360 : M, e);

  // 궤도면 안에서의 위치
  const xv = a * (cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * sin(E);

  // 황도면으로 회전
  const co = cos(omega), so = sin(omega);
  const cn = cos(node), sn = sin(node);
  const ci = cos(I), si = sin(I);

  return {
    x: (co * cn - so * sn * ci) * xv + (-so * cn - co * sn * ci) * yv,
    y: (co * sn + so * cn * ci) * xv + (-so * sn + co * cn * ci) * yv,
    z: (so * si) * xv + (co * si) * yv,
  };
}

/** 한 행성의 지심 황경 (도, 그 시점의 분점 기준) */
function geocentricLongitude(name, jd) {
  const T = (jd - 2451545.0) / 36525;
  const p = heliocentricXYZ(name, T);
  const earth = heliocentricXYZ('지구', T);
  const x = p.x - earth.x;
  const y = p.y - earth.y;
  return norm360(atan2(y, x) + precession(jd));
}

/** 달 승교점(라후)의 평균 황경 */
export function meanNode(jd) {
  const T = (jd - 2451545.0) / 36525;
  return norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T);
}

export const PLANET_ORDER = [
  '태양', '달', '수성', '금성', '화성', '목성', '토성',
  '천왕성', '해왕성', '명왕성', '라후', '케투',
];

/**
 * 열두 천체의 회귀 황경을 한 번에 구한다.
 * 역행 여부는 하루 뒤 위치와 비교해서 판정한다.
 */
export function planetPositions(jd) {
  const out = {};
  const at = (t) => ({
    태양: sunLongitude(t),
    달: moonLongitude(t),
    수성: geocentricLongitude('수성', t),
    금성: geocentricLongitude('금성', t),
    화성: geocentricLongitude('화성', t),
    목성: geocentricLongitude('목성', t),
    토성: geocentricLongitude('토성', t),
    천왕성: geocentricLongitude('천왕성', t),
    해왕성: geocentricLongitude('해왕성', t),
    명왕성: geocentricLongitude('명왕성', t),
    라후: meanNode(t),
    케투: norm360(meanNode(t) + 180),
  });

  const now = at(jd);
  const next = at(jd + 1);
  for (const name of PLANET_ORDER) {
    const lon = now[name];
    const delta = ((next[name] - lon + 540) % 360) - 180;
    out[name] = { lon, retrograde: delta < 0, speed: delta };
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// 하우스
// ─────────────────────────────────────────────────────────────

/** 그리니치 항성시 (도) */
export function gmst(jd) {
  const T = (jd - 2451545.0) / 36525;
  return norm360(
    280.46061837 + 360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T - (T * T * T) / 38710000
  );
}

/** 황경 → 적경 (황위 0인 황도상의 점) */
export const raFromLon = (lon, eps) => norm360(atan2(sin(lon) * cos(eps), cos(lon)));
/** 적경 → 황경 */
const lonFromRA = (ra, eps) => norm360(atan2(sin(ra), cos(ra) * cos(eps)));
/** 황도상의 점의 적위 */
export const declFromLon = (lon, eps) => asin(sin(lon) * sin(eps));

/**
 * 플라시두스 하우스.
 *
 * 각 커스프는 "자기 반호(半弧)를 몇 분의 몇 지났는가"로 정의된다.
 * 적위가 커스프 위치에 의존하고 커스프가 다시 적위에 의존하므로 반복해서 푼다.
 *
 * 위도가 높으면 tanφ·tanδ 가 1을 넘어 해가 없다. 극권 근처에서
 * 플라시두스가 무너지는 이유이고, 그때는 등분 하우스로 물러선다.
 */
function placidusCusp(ramc, phi, eps, fraction, nocturnal) {
  let ad = 0;
  let lon = 0;
  for (let i = 0; i < 40; i++) {
    const arc = nocturnal ? 90 - ad : 90 + ad;
    const ra = nocturnal
      ? ramc + 180 - fraction * arc
      : ramc + fraction * arc;
    lon = lonFromRA(ra, eps);
    const decl = declFromLon(lon, eps);
    const t = tan(phi) * tan(decl);
    if (Math.abs(t) > 1) return null;        // 이 위도에서는 성립하지 않는다
    const next = asin(t);
    if (Math.abs(next - ad) < 1e-9) { ad = next; break; }
    ad = next;
  }
  return norm360(lon);
}

/**
 * 출생 차트의 각(角)과 하우스 커스프.
 * @param {number} jd  세계시 율리우스일
 * @param {number} lat 위도 (북이 +)
 * @param {number} lon 경도 (동이 +)
 */
export function houses(jd, lat, lon) {
  const eps = obliquity(jd);
  const ramc = norm360(gmst(jd) + lon);

  // 중천 — 자오선과 황도가 만나는 점
  const mc = norm360(atan2(sin(ramc), cos(ramc) * cos(eps)));

  // 상승점 — 동쪽 지평선과 황도가 만나는 점
  let asc = norm360(atan2(cos(ramc), -(sin(ramc) * cos(eps) + tan(lat) * sin(eps))));
  // 상승점은 늘 중천에서 동쪽으로 90도 남짓 떨어져 있다
  if (norm360(asc - mc) > 180) asc = norm360(asc + 180);

  const cusps = new Array(13).fill(0);
  cusps[1] = asc;
  cusps[10] = mc;

  const c11 = placidusCusp(ramc, lat, eps, 1 / 3, false);
  const c12 = placidusCusp(ramc, lat, eps, 2 / 3, false);
  const c2 = placidusCusp(ramc, lat, eps, 2 / 3, true);
  const c3 = placidusCusp(ramc, lat, eps, 1 / 3, true);

  if (c11 == null || c12 == null || c2 == null || c3 == null) {
    // 고위도에서는 상승점 기준 등분으로 물러선다.
    // 이때 중천은 10하우스 커스프와 어긋나므로 따로 들고 간다.
    for (let i = 1; i <= 12; i++) cusps[i] = norm360(asc + (i - 1) * 30);
    return { asc, mc, cusps, system: '등분 (고위도라 플라시두스 불가)', ramc, eps };
  }

  // 직접 구하는 건 여섯 개(1·2·3·10·11·12)뿐이고 나머지는 그 대궁이다.
  // 대궁을 채울 때 방금 구한 값을 덮어쓰지 않도록 원본만 보고 만든다.
  cusps[11] = c11; cusps[12] = c12; cusps[2] = c2; cusps[3] = c3;
  cusps[4] = norm360(cusps[10] + 180);
  cusps[5] = norm360(cusps[11] + 180);
  cusps[6] = norm360(cusps[12] + 180);
  cusps[7] = norm360(cusps[1] + 180);
  cusps[8] = norm360(cusps[2] + 180);
  cusps[9] = norm360(cusps[3] + 180);

  return { asc, mc, cusps, system: '플라시두스', ramc, eps };
}

/** 황경이 몇 번 하우스에 드는지 */
export function houseOf(lon, cusps) {
  for (let i = 1; i <= 12; i++) {
    const a = cusps[i];
    const b = cusps[i === 12 ? 1 : i + 1];
    const span = norm360(b - a);
    if (norm360(lon - a) < span) return i;
  }
  return 1;
}

/** 회귀 황경 → 항성 황경 (베딕용) */
export function toSidereal(lon, jd) {
  return norm360(lon - lahiriAyanamsa(jd));
}
