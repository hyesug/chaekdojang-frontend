/**
 * astro.js — 천문 계산 엔진
 *
 * 모든 운세 체계가 공통으로 쓰는 재료를 만든다.
 *   · 율리우스일(JD) 변환
 *   · 태양 황경 → 24절기, 12별자리, 균시차
 *   · 달 황경  → 27수(nakshatra), 월상
 *   · 삭(new moon) 시각 → 음력 달의 시작
 *
 * 알고리즘 출처: Jean Meeus, "Astronomical Algorithms" 2nd ed.
 *   태양 ch.25 (정밀도 약 0.01°)
 *   달   ch.47 (주요항 절삭, 정밀도 약 0.003°)
 *   삭망 ch.49 (정밀도 약 1분)
 * 운세 계산에는 과할 만큼 충분한 정밀도다.
 */

export const DEG = Math.PI / 180;
const sin = (d) => Math.sin(d * DEG);
const cos = (d) => Math.cos(d * DEG);

/** 0~360 범위로 정규화 */
export function norm360(x) {
  return ((x % 360) + 360) % 360;
}

/** 두 각도의 최단 차이 (-180 ~ +180). a가 b보다 앞서면 음수 */
export function angleDiff(a, b) {
  return ((a - b + 540) % 360) - 180;
}

// ─────────────────────────────────────────────────────────────
// 율리우스일
// ─────────────────────────────────────────────────────────────

/** 그레고리력 날짜 → 그 날 정오(UT)의 율리우스일 정수 */
export function toJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045
  );
}

/** UT 기준 연월일시분 → 율리우스일(소수) */
export function toJD(y, m, d, h = 0, mi = 0, s = 0) {
  return toJDN(y, m, d) - 0.5 + (h + mi / 60 + s / 3600) / 24;
}

/** 율리우스일 → {y, m, d, h, mi, s} (UT) */
export function fromJD(jd) {
  const z = Math.floor(jd + 0.5);
  let frac = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const dd = Math.floor(365.25 * c);
  const e = Math.floor((b - dd) / 30.6001);
  const day = b - dd - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;

  let totalSec = Math.round(frac * 86400);
  const h = Math.floor(totalSec / 3600);
  const mi = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { y: year, m: month, d: day, h, mi, s };
}

/** 율리우스 세기 (J2000.0 기준) */
function centuries(jd) {
  return (jd - 2451545.0) / 36525;
}

// ─────────────────────────────────────────────────────────────
// ΔT (TD − UT) — 역법 계산에서 초 단위 오차를 줄인다
// Espenak & Meeus 다항식 근사. 반환값 단위: 초
// ─────────────────────────────────────────────────────────────
export function deltaT(year) {
  let t, dt;
  if (year < 1900) {
    t = (year - 1860) / 1;
    dt = 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * t ** 3
       - 0.0004473624 * t ** 4 + t ** 5 / 233174;
  } else if (year < 1920) {
    t = year - 1900;
    dt = -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  } else if (year < 1941) {
    t = year - 1920;
    dt = 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t ** 3;
  } else if (year < 1961) {
    t = year - 1950;
    dt = 29.07 + 0.407 * t - (t * t) / 233 + (t ** 3) / 2547;
  } else if (year < 1986) {
    t = year - 1975;
    dt = 45.45 + 1.067 * t - (t * t) / 260 - (t ** 3) / 718;
  } else if (year < 2005) {
    t = year - 2000;
    dt = 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3
       + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  } else if (year < 2050) {
    t = year - 2000;
    dt = 62.92 + 0.32217 * t + 0.005589 * t * t;
  } else {
    const u = (year - 1820) / 100;
    dt = -20 + 32 * u * u - 0.5628 * (2150 - year);
  }
  return dt;
}

/** ΔT를 일 단위로 (JD 보정용) */
function deltaTdays(jd) {
  const { y } = fromJD(jd);
  return deltaT(y) / 86400;
}

// ─────────────────────────────────────────────────────────────
// 태양
// ─────────────────────────────────────────────────────────────

// ── VSOP87D 지구 황경 급수 (절삭) ──────────────────────────────
// [진폭, 위상, 각속도] · 단위 1e-8 라디안, 인수는 천년(τ) 단위
// 간이 공식(오차 약 0.01° ≈ 4분)으로는 절기 경계가 흔들려서
// 여기만 정밀 급수를 쓴다. 절삭 후 오차 약 0.0005° ≈ 40초.
const EARTH_L0 = [
  [175347046, 0, 0], [3341656, 4.6692568, 6283.07585],
  [34894, 4.6261, 12566.1517], [3497, 2.7441, 5753.3849],
  [3418, 2.8289, 3.5231], [3136, 3.6277, 77713.7715],
  [2676, 4.4181, 7860.4194], [2343, 6.1352, 3930.2097],
  [1324, 0.7425, 11506.7698], [1273, 2.0371, 529.691],
  [1199, 1.1096, 1577.3435], [990, 5.233, 5884.927],
  [902, 2.045, 26.298], [857, 3.508, 398.149],
  [780, 1.179, 5223.694], [753, 2.533, 5507.553],
  [505, 4.583, 18849.228], [492, 4.205, 775.523],
  [357, 2.920, 0.067], [317, 5.849, 11790.629],
  [284, 1.899, 796.298], [271, 0.315, 10977.079],
  [243, 0.345, 5486.778], [206, 4.806, 2544.314],
  [205, 1.869, 5573.143], [202, 2.458, 6069.777],
  [156, 0.833, 213.299], [132, 3.411, 2942.463],
  [126, 1.083, 20.775], [115, 0.645, 0.980],
  [103, 0.636, 4694.003], [102, 0.976, 15720.839],
  [102, 4.267, 7.114], [99, 6.21, 2146.17],
  [98, 0.68, 155.42], [86, 5.98, 161000.69],
  [85, 1.30, 6275.96], [85, 3.67, 71430.70],
  [80, 1.81, 17260.15], [79, 3.04, 12036.46],
  [75, 1.76, 5088.63], [74, 3.50, 3154.69],
  [74, 4.68, 801.82], [70, 0.83, 9437.76],
  [62, 3.98, 8827.39], [61, 1.82, 7084.90],
  [57, 2.78, 6286.60], [56, 4.39, 14143.50],
  [56, 3.47, 6279.55], [52, 0.19, 12139.55],
  [52, 1.33, 1748.02], [51, 0.28, 5856.48],
  [49, 0.49, 1194.45], [41, 5.37, 8429.24],
  [41, 2.40, 19651.05], [39, 6.17, 10447.39],
  [37, 6.04, 10213.29], [37, 2.57, 1059.38],
  [36, 1.71, 2352.87], [36, 1.78, 6812.77],
  [33, 0.59, 17789.85], [30, 0.44, 83996.85],
  [30, 2.74, 1349.87], [25, 3.16, 4690.48],
];
const EARTH_L1 = [
  [628331966747, 0, 0], [206059, 2.678235, 6283.07585],
  [4303, 2.6351, 12566.1517], [425, 1.590, 3.523],
  [119, 5.796, 26.298], [109, 2.966, 1577.344],
  [93, 2.59, 18849.23], [72, 1.14, 529.69],
  [68, 1.87, 398.15], [67, 4.41, 5507.55],
  [59, 2.89, 5223.69], [56, 2.17, 155.42],
  [45, 0.40, 796.30], [36, 0.47, 775.52],
  [29, 2.65, 7.11], [21, 5.34, 0.98],
  [19, 1.85, 5486.78], [19, 4.97, 213.30],
  [17, 2.99, 6275.96], [16, 0.03, 2544.31],
];
const EARTH_L2 = [
  [52919, 0, 0], [8720, 1.0721, 6283.0758],
  [309, 0.867, 12566.152], [27, 0.05, 3.52],
  [16, 5.19, 26.30], [16, 3.68, 155.42],
  [10, 0.76, 18849.23], [9, 2.06, 77713.77],
  [7, 0.83, 775.52], [5, 4.66, 1577.34],
];
const EARTH_L3 = [[289, 5.844, 6283.076], [35, 0, 0], [17, 5.49, 12566.15]];
const EARTH_L4 = [[114, 3.142, 0], [8, 4.13, 6283.08]];
const EARTH_L5 = [[1, 3.14, 0]];

function vsopSum(terms, tau) {
  let s = 0;
  for (const [a, b, c] of terms) s += a * Math.cos(b + c * tau);
  return s;
}

/** 지구의 일심 황경 (도, 그 시점의 평균 춘분점 기준) */
function earthHeliocentricLongitude(jdTT) {
  const tau = (jdTT - 2451545.0) / 365250;
  const L =
    vsopSum(EARTH_L0, tau) +
    vsopSum(EARTH_L1, tau) * tau +
    vsopSum(EARTH_L2, tau) * tau ** 2 +
    vsopSum(EARTH_L3, tau) * tau ** 3 +
    vsopSum(EARTH_L4, tau) * tau ** 4 +
    vsopSum(EARTH_L5, tau) * tau ** 5;
  return norm360((L / 1e8) / DEG);
}

/** 황경 장동 Δψ (도). 주요 4항 */
function nutationInLongitude(T) {
  const omega = 125.04452 - 1934.136261 * T;
  const Ls = 280.4665 + 36000.7698 * T;
  const Lm = 218.3165 + 481267.8813 * T;
  const arcsec =
    -17.20 * sin(omega) -
    1.32 * sin(2 * Ls) -
    0.23 * sin(2 * Lm) +
    0.21 * sin(2 * omega);
  return arcsec / 3600;
}

/**
 * 태양의 겉보기 황경 (도).
 * 절기·별자리·사주 월주가 전부 이 값 하나에서 나온다.
 * @param {number} jd 율리우스일 (UT)
 */
export function sunLongitude(jd) {
  const jdTT = jd + deltaTdays(jd);
  const T = centuries(jdTT);

  // 지구에서 본 태양 = 태양에서 본 지구 + 180°
  let theta = earthHeliocentricLongitude(jdTT) + 180;
  theta -= 0.09033 / 3600;                    // VSOP87 → FK5 보정
  theta += nutationInLongitude(T);            // 장동
  theta -= 20.4898 / 3600;                    // 광행차 (R≈1)
  return norm360(theta);
}

/**
 * 균시차 (Equation of Time). 단위: 분
 * 진태양시 = 평균태양시 + 균시차
 */
export function equationOfTime(jd) {
  const T = centuries(jd + deltaTdays(jd));
  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const eps0 =
    23 + 26 / 60 +
    21.448 / 3600 -
    (46.8150 * T + 0.00059 * T * T - 0.001813 * T ** 3) / 3600;
  const y = Math.tan(eps0 / 2 * DEG) ** 2;

  const E =
    y * Math.sin(2 * L0 * DEG) -
    2 * e * sin(M) +
    4 * e * y * sin(M) * Math.cos(2 * L0 * DEG) -
    0.5 * y * y * Math.sin(4 * L0 * DEG) -
    1.25 * e * e * Math.sin(2 * M * DEG);

  return (E / DEG) * 4; // 라디안 → 도 → 분
}

/**
 * 목표 황경에 도달하는 정확한 시각을 이분법으로 조인다.
 * 추정 시점 ±5일 안에 반드시 한 번만 교차하므로 그 구간에서만 탐색한다.
 */
function refineCrossing(targetLon, guessJD) {
  let lo = guessJD - 5;
  let hi = guessJD + 5;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (angleDiff(sunLongitude(mid), targetLon) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 태양의 평균 일일 이동량 (도/일) */
const SUN_DEG_PER_DAY = 360 / 365.2422;

/**
 * startJD 이후 태양 황경이 targetLon에 처음 도달하는 시각.
 * 절입 시각(입춘·동지 등)을 구할 때 쓴다.
 */
export function solarTermJD(targetLon, startJD) {
  const ahead = norm360(targetLon - sunLongitude(startJD));
  return refineCrossing(targetLon, startJD + ahead / SUN_DEG_PER_DAY);
}

/** startJD 이전에 태양 황경이 targetLon이었던 가장 가까운 시각 */
export function prevSolarTermJD(targetLon, startJD) {
  const behind = norm360(sunLongitude(startJD) - targetLon);
  return refineCrossing(targetLon, startJD - behind / SUN_DEG_PER_DAY);
}

/**
 * 그 시점이 속한 절기 구간을 돌려준다. (사주 월주 · 대운 계산의 뼈대)
 * 절기는 입춘(황경 315°)에서 시작해 30°마다 바뀐다.
 * @returns {{index:number, startJD:number, endJD:number, lon:number}}
 *   index 0 = 인월(입춘~), 1 = 묘월(경칩~), … 11 = 축월(소한~)
 */
export function solarTermSector(jd) {
  const lon = sunLongitude(jd);
  const index = Math.floor(norm360(lon - 315) / 30);
  const startLon = norm360(315 + index * 30);
  const endLon = norm360(startLon + 30);
  return {
    index,
    lon,
    startJD: prevSolarTermJD(startLon, jd),
    endJD: solarTermJD(endLon, jd),
  };
}

// ─────────────────────────────────────────────────────────────
// 달
// ─────────────────────────────────────────────────────────────

// Meeus ch.47 표 47.A 주요항 [D, M, M', F, 계수(1e-6 도)]
const MOON_LON_TERMS = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314],
  [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332],
  [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322],
  [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528],
  [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034],
  [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888], [2, 1, 0, 0, -6766],
  [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665],
  [0, 1, -2, 0, -2689], [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390],
  [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236], [0, 1, 2, 0, -2120],
  [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048], [2, 0, 1, -2, -1773],
  [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110],
  [3, 0, -1, 0, -892], [2, 1, 1, 0, -810], [4, -1, -2, 0, 759],
  [0, 2, -1, 0, -713], [2, 2, -1, 0, -700], [2, 1, -2, 0, 691],
  [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537],
  [4, -1, 0, 0, 520], [1, 0, -2, 0, -487],
];

/**
 * 달의 겉보기 황경 (도).
 * 숙요의 27수, 베딕의 nakshatra, 자미두수의 음력이 여기서 나온다.
 */
export function moonLongitude(jd) {
  const T = centuries(jd + deltaTdays(jd));

  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T
           + T ** 3 / 538841 - T ** 4 / 65194000;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T
          + T ** 3 / 545868 - T ** 4 / 113065000;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T ** 3 / 24490000;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T
           + T ** 3 / 69699 - T ** 4 / 14712000;
  const F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T
          - T ** 3 / 3526000 + T ** 4 / 863310000;

  const E = 1 - 0.002516 * T - 0.0000074 * T * T;

  let sigmaL = 0;
  for (const [d, m, mp, f, coef] of MOON_LON_TERMS) {
    const arg = d * D + m * M + mp * Mp + f * F;
    const ecc = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    sigmaL += coef * ecc * sin(arg);
  }

  // 금성·목성의 섭동과 지구 편평률 보정
  const A1 = 119.75 + 131.849 * T;
  const A2 = 53.09 + 479264.290 * T;
  sigmaL += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);

  return norm360(Lp + sigmaL / 1e6);
}

/** 달 - 태양 황경차 (0~360). 0=삭, 180=망 */
export function moonPhaseAngle(jd) {
  return norm360(moonLongitude(jd) - sunLongitude(jd));
}

/**
 * k번째 삭(new moon)의 율리우스일 (UT).
 * k=0 은 2000년 1월 6일의 삭. 음력 계산의 기준점이다.
 * Meeus ch.49
 */
export function newMoonJD(k) {
  const T = k / 1236.85;
  let jde =
    2451550.09766 +
    29.530588861 * k +
    0.00015437 * T * T -
    0.000000150 * T ** 3 +
    0.00000000073 * T ** 4;

  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const M = 2.5534 + 29.10535670 * k - 0.0000014 * T * T - 0.00000011 * T ** 3;
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T * T
           + 0.00001238 * T ** 3 - 0.000000058 * T ** 4;
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T * T
          - 0.00000227 * T ** 3 + 0.000000011 * T ** 4;
  const O = 124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3;

  jde +=
    -0.40720 * sin(Mp) +
    0.17241 * E * sin(M) +
    0.01608 * sin(2 * Mp) +
    0.01039 * sin(2 * F) +
    0.00739 * E * sin(Mp - M) -
    0.00514 * E * sin(Mp + M) +
    0.00208 * E * E * sin(2 * M) -
    0.00111 * sin(Mp - 2 * F) -
    0.00057 * sin(Mp + 2 * F) +
    0.00056 * E * sin(2 * Mp + M) -
    0.00042 * sin(3 * Mp) +
    0.00042 * E * sin(M + 2 * F) +
    0.00038 * E * sin(M - 2 * F) -
    0.00024 * E * sin(2 * Mp - M) -
    0.00017 * sin(O) -
    0.00007 * sin(Mp + 2 * M) +
    0.00004 * sin(2 * Mp - 2 * F) +
    0.00004 * sin(3 * M) +
    0.00003 * sin(Mp + M - 2 * F) +
    0.00003 * sin(2 * Mp + 2 * F) -
    0.00003 * sin(Mp + M + 2 * F) +
    0.00003 * sin(Mp - M + 2 * F) -
    0.00002 * sin(Mp - M - 2 * F) -
    0.00002 * sin(3 * Mp + M) +
    0.00002 * sin(4 * Mp);

  // 행성 섭동 보정 (Meeus 표 49.A 주요항)
  const A1 = 299.77 + 0.107408 * k - 0.009173 * T * T;
  const A2 = 251.88 + 0.016321 * k;
  const A3 = 251.83 + 26.651886 * k;
  const A4 = 349.42 + 36.412478 * k;
  const A5 = 84.66 + 18.206239 * k;
  const A6 = 141.74 + 53.303771 * k;
  const A7 = 207.14 + 2.453732 * k;
  const A8 = 154.84 + 7.306860 * k;
  const A9 = 34.52 + 27.261239 * k;
  const A10 = 207.19 + 0.121824 * k;
  const A11 = 291.34 + 1.844379 * k;
  const A12 = 161.72 + 24.198154 * k;
  const A13 = 239.56 + 25.513099 * k;
  const A14 = 331.55 + 3.592518 * k;

  jde +=
    0.000325 * sin(A1) + 0.000165 * sin(A2) + 0.000164 * sin(A3) +
    0.000126 * sin(A4) + 0.000110 * sin(A5) + 0.000062 * sin(A6) +
    0.000060 * sin(A7) + 0.000056 * sin(A8) + 0.000047 * sin(A9) +
    0.000042 * sin(A10) + 0.000040 * sin(A11) + 0.000037 * sin(A12) +
    0.000035 * sin(A13) + 0.000023 * sin(A14);

  return jde - deltaTdays(jde); // TD → UT
}

/** 주어진 JD 이전(또는 같은) 가장 가까운 삭의 k 값을 추정 */
export function newMoonIndexBefore(jd) {
  let k = Math.floor((jd - 2451550.09766) / 29.530588861);
  // 추정이 한 칸 어긋날 수 있으니 보정
  while (newMoonJD(k) > jd) k--;
  while (newMoonJD(k + 1) <= jd) k++;
  return k;
}

// ─────────────────────────────────────────────────────────────
// 세차 · 아야남샤
// ─────────────────────────────────────────────────────────────

/**
 * 춘분점 세차량 (도). 황도 좌표를 J2000에서 그 시점의 분점으로 옮길 때 쓴다.
 * 행성 위치를 J2000 기준으로 구한 뒤 여기에 더하면 회귀(트로피컬) 황경이 된다.
 */
export function precession(jd) {
  const T = centuries(jd + deltaTdays(jd));
  return (5028.796195 * T + 1.1054348 * T * T) / 3600;
}

/**
 * 라히리 아야남샤 (도).
 * 항성(시데리얼) 좌표를 쓰는 체계 — 숙요의 27수, 베딕의 12궁과 나크샤트라 —
 * 는 회귀 황경에서 이 값을 빼야 한다. 지금은 약 24도 차이가 난다.
 */
export function lahiriAyanamsa(jd) {
  const T = centuries(jd + deltaTdays(jd));
  return 23.85340 + 1.3970833 * T + 0.0003085 * T * T;
}

/** 황도 경사각 (도) */
export function obliquity(jd) {
  const T = centuries(jd + deltaTdays(jd));
  return 23 + 26 / 60 + (21.448 - 46.8150 * T - 0.00059 * T * T + 0.001813 * T ** 3) / 3600;
}
