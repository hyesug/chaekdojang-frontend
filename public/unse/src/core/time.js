/**
 * time.js — 출생 시각 정규화
 *
 * 사람이 기억하는 "태어난 시간"은 그 나라 벽시계 시각이다.
 * 동양 명리는 그 지점의 진태양시(태양이 정남에 올 때가 정오)를 쓰므로
 * 아래 세 가지를 차례로 벗겨내야 한다.
 *
 *   1) 서머타임        — 한국도 1948~60, 1987~88에 시행했다
 *   2) 표준자오선 차이 — 한국 표준시는 동경 135°. 서울은 127°라 32분 빠르다
 *   3) 균시차          — 지구 공전궤도가 타원이라 하루 길이가 매일 다르다 (±16분)
 *
 * 이걸 안 하면 시주(時柱)가 통째로 한 칸씩 틀어진다. 실제로 서울 출생자의
 * 약 4분의 1이 이 보정으로 시주가 바뀐다.
 */

import { toJD, toJDN, fromJD, equationOfTime } from './astro.js';

// ── 한국 표준시 변천사 ────────────────────────────────────────
// 1908-04-01 ~ 1911-12-31  동경 127.5° (UTC+8:30)
// 1912-01-01 ~ 1954-03-20  동경 135°   (UTC+9)
// 1954-03-21 ~ 1961-08-09  동경 127.5° (UTC+8:30)
// 1961-08-10 ~            동경 135°   (UTC+9)
const KR_TZ_PERIODS = [
  { from: [1908, 4, 1], tz: 8.5 },
  { from: [1912, 1, 1], tz: 9 },
  { from: [1954, 3, 21], tz: 8.5 },
  { from: [1961, 8, 10], tz: 9 },
];

// 한국 서머타임 시행 구간 (시작일 ~ 종료일, 양끝 포함).
// 1960년 이전 구간은 관보 기준 날짜라 하루 정도 이설이 있을 수 있다.
const KR_DST_PERIODS = [
  [[1948, 6, 1], [1948, 9, 12]],
  [[1949, 4, 3], [1949, 9, 10]],
  [[1950, 4, 1], [1950, 9, 10]],
  [[1951, 5, 6], [1951, 9, 8]],
  [[1955, 5, 5], [1955, 9, 8]],
  [[1956, 5, 20], [1956, 9, 29]],
  [[1957, 5, 5], [1957, 9, 21]],
  [[1958, 5, 4], [1958, 9, 20]],
  [[1959, 5, 3], [1959, 9, 19]],
  [[1960, 5, 1], [1960, 9, 17]],
  [[1987, 5, 10], [1987, 10, 11]],
  [[1988, 5, 8], [1988, 10, 9]],
];

const dayNum = ([y, m, d]) => toJDN(y, m, d);

/** 그 날짜에 한국에서 쓰던 표준시 오프셋 (시간) */
export function koreaStandardOffset(y, m, d) {
  const n = toJDN(y, m, d);
  let tz = 8.5; // 1908년 이전은 사실상 지방시. 편의상 127.5° 기준으로 둔다.
  for (const p of KR_TZ_PERIODS) {
    if (n >= dayNum(p.from)) tz = p.tz;
  }
  return tz;
}

/** 그 날짜가 한국 서머타임 기간인가 */
export function koreaDST(y, m, d) {
  const n = toJDN(y, m, d);
  return KR_DST_PERIODS.some(([a, b]) => n >= dayNum(a) && n <= dayNum(b));
}

/**
 * 출생 정보를 계산 가능한 시각으로 바꾼다.
 *
 * @param {object} input
 * @param {number} input.year   양력 연
 * @param {number} input.month  양력 월
 * @param {number} input.day    양력 일
 * @param {number} input.hour   벽시계 시 (0~23). 모르면 null
 * @param {number} input.minute 벽시계 분. 모르면 0
 * @param {object} input.place  place.js의 도시 객체 {lat, lon, tz, kr}
 * @param {boolean} [input.dst] 해외 출생 시 서머타임 여부 수동 지정
 *
 * @returns {{
 *   jdUT: number,          천문 계산용 세계시 율리우스일
 *   jdTST: number,         진태양시 율리우스일 (시주·시진 판정용)
 *   tst: object,           진태양시 연월일시분
 *   timeKnown: boolean,
 *   corrections: string[]  사용자에게 보여줄 보정 내역
 * }}
 */
export function normalizeBirth(input) {
  const { year, month, day, place } = input;
  const timeKnown = input.hour != null;
  const hour = timeKnown ? input.hour : 12; // 시간 미상이면 정오로 가정
  const minute = input.minute ?? 0;

  const corrections = [];

  // 1) 그 시점에 유효했던 표준시 오프셋
  let tz;
  if (place.kr) {
    tz = koreaStandardOffset(year, month, day);
    if (tz === 8.5) {
      corrections.push(`당시 한국 표준시는 동경 127.5°(UTC+8:30) 기준이었습니다`);
    }
  } else {
    tz = place.tz;
  }

  // 2) 서머타임
  const dstActive = place.kr ? koreaDST(year, month, day) : !!input.dst;
  if (dstActive) {
    corrections.push('서머타임 시행 기간 → 1시간 차감');
  }
  const tzEffective = tz + (dstActive ? 1 : 0);

  // 벽시계 시각 → 세계시 율리우스일
  const jdUT = toJD(year, month, day, hour, minute) - tzEffective / 24;

  // 3) 경도차 보정: 표준자오선에서 1° 벗어날 때마다 4분
  const standardMeridian = tz * 15;
  const lonMinutes = (place.lon - standardMeridian) * 4;

  // 4) 균시차
  const eotMinutes = equationOfTime(jdUT);

  // 진태양시 = 세계시 + 그 지점의 경도시 + 균시차
  const jdTST = jdUT + place.lon / 15 / 24 + eotMinutes / 1440;

  if (timeKnown) {
    const sign = (v) => (v >= 0 ? '+' : '−');
    corrections.push(
      `경도 보정 ${sign(lonMinutes)}${Math.abs(lonMinutes).toFixed(1)}분 (동경 ${place.lon.toFixed(2)}° vs 표준 ${standardMeridian}°)`
    );
    corrections.push(
      `균시차 ${sign(eotMinutes)}${Math.abs(eotMinutes).toFixed(1)}분`
    );
  }

  return {
    jdUT,
    jdTST,
    tst: fromJD(jdTST),
    tzUsed: tz,
    dstActive,
    timeKnown,
    totalShiftMinutes: lonMinutes + eotMinutes,
    corrections,
  };
}
