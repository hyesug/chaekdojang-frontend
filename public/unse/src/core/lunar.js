/**
 * lunar.js — 음양력 변환
 *
 * 자미두수 · 토정비결 · 숙요 · 육임은 음력 생일을 쓴다.
 *
 * 흔히 쓰는 방식은 100년치 음력 데이터를 표로 박아 넣는 것인데,
 * 여기서는 역법 규칙 그대로 천문 계산으로 만든다. 표가 없으니
 * 범위 제한도 없고 오타가 섞일 여지도 없다.
 *
 * 한국 음력의 규칙 (시헌력):
 *   1. 삭(달과 해의 황경이 같아지는 순간)이 든 날이 그 달의 초하루
 *   2. 동지가 든 달이 11월
 *   3. 동지달에서 다음 동지달까지 열세 달이면 윤달이 하나 낀다
 *   4. 그중 중기(中氣)가 없는 첫 달이 윤달이 된다 — 무중치윤법
 *
 * 날짜 경계는 모두 한국 표준시(KST) 자정 기준이다.
 */

import {
  toJD, toJDN, fromJD, sunLongitude,
  solarTermJD, prevSolarTermJD, newMoonJD,
} from './astro.js';

/** 율리우스일 → 그 순간이 속한 KST 날짜의 일련번호 */
export function kstDay(jd) {
  return Math.floor(jd + 9 / 24 + 0.5);
}

/** KST 날짜 일련번호 → {y, m, d} */
export function fromKstDay(n) {
  const t = fromJD(n - 0.5 + 0.001);
  return { y: t.y, m: t.m, d: t.d };
}

/** 주어진 KST 날짜 이하에서 가장 늦은 삭의 k 값 */
function newMoonIndexOnOrBefore(dayNumber) {
  let k = Math.round((dayNumber - 2451550.1) / 29.530588861);
  let guard = 0;
  while (kstDay(newMoonJD(k)) > dayNumber && guard++ < 40) k--;
  while (kstDay(newMoonJD(k + 1)) <= dayNumber && guard++ < 40) k++;
  return k;
}

/** 그 삭망월 안에 중기(황경 30의 배수)가 들어 있는가 */
function containsMajorTerm(startJD, endJD) {
  const lon = sunLongitude(startJD);
  // 다음 중기의 황경
  let target = Math.ceil(lon / 30 - 1e-9) * 30;
  target = ((target % 360) + 360) % 360;
  const termJD = solarTermJD(target, startJD);
  return kstDay(termJD) < kstDay(endJD);
}

/**
 * 동지에서 동지까지 한 주기의 음력 달 목록을 만든다.
 * @param {number} jd 이 시점이 속한 주기를 만든다
 */
function buildLunarCycle(jd) {
  // 이 시점 직전의 동지
  let ws = prevSolarTermJD(270, jd);
  let k11 = newMoonIndexOnOrBefore(kstDay(ws));

  // 동지달의 초하루가 우리 날짜보다 뒤라면 한 주기 앞에서 시작해야 한다
  if (kstDay(newMoonJD(k11)) > kstDay(jd)) {
    ws = prevSolarTermJD(270, ws - 10);
    k11 = newMoonIndexOnOrBefore(kstDay(ws));
  }

  let ws2 = solarTermJD(270, ws + 10);
  let k11next = newMoonIndexOnOrBefore(kstDay(ws2));

  // 반대 경우도 있다. 동지는 아직 안 왔는데 다음 동지달의 초하루는 이미 지난
  // 며칠 — 12월 중순이 여기에 걸린다. 이때 그 날짜는 다음 주기의 11월에 속한다.
  if (kstDay(jd) >= kstDay(newMoonJD(k11next))) {
    ws = ws2;
    k11 = k11next;
    ws2 = solarTermJD(270, ws + 10);
    k11next = newMoonIndexOnOrBefore(kstDay(ws2));
  }

  const monthCount = k11next - k11;

  // 윤달 찾기 — 중기가 없는 첫 달
  let leapIndex = -1;
  if (monthCount === 13) {
    for (let i = 1; i < 13; i++) {
      if (!containsMajorTerm(newMoonJD(k11 + i), newMoonJD(k11 + i + 1))) {
        leapIndex = i;
        break;
      }
    }
  }

  // 11월부터 번호를 매겨 나간다
  const months = [];
  let num = 11;
  let lunarYear = fromJD(ws + 9 / 24).y;
  let first = true;

  for (let i = 0; i < monthCount; i++) {
    const isLeap = i === leapIndex;
    if (!isLeap) {
      if (!first) {
        num = num === 12 ? 1 : num + 1;
        if (num === 1) lunarYear += 1;
      }
      first = false;
    }
    const start = kstDay(newMoonJD(k11 + i));
    const end = kstDay(newMoonJD(k11 + i + 1));
    months.push({ num, isLeap, year: lunarYear, start, end, size: end - start });
  }

  return months;
}

/**
 * 양력 → 음력
 * @returns {{year, month, day, isLeap, isBigMonth, ganzhiDay}}
 */
export function solarToLunar(y, m, d) {
  const dayNumber = toJDN(y, m, d);
  const jd = toJD(y, m, d, 12) - 9 / 24; // 그 날 KST 정오
  const months = buildLunarCycle(jd);

  const month = months.find((mm) => dayNumber >= mm.start && dayNumber < mm.end);
  if (!month) throw new Error(`음력 변환 실패: ${y}-${m}-${d}`);

  return {
    year: month.year,
    month: month.num,
    day: dayNumber - month.start + 1,
    isLeap: month.isLeap,
    isBigMonth: month.size === 30,
  };
}

/**
 * 음력 → 양력
 * @param {boolean} isLeap 윤달 여부
 */
export function lunarToSolar(lunarYear, lunarMonth, lunarDay, isLeap = false) {
  // 해당 음력 연도를 포함할 만한 시점에서 두 주기를 만들어 뒤진다
  const seed = toJD(lunarYear, lunarMonth <= 10 ? 7 : 12, 15, 12) - 9 / 24;
  const candidates = [
    ...buildLunarCycle(seed),
    ...buildLunarCycle(seed - 200),
    ...buildLunarCycle(seed + 200),
  ];
  const month = candidates.find(
    (mm) => mm.year === lunarYear && mm.num === lunarMonth && mm.isLeap === isLeap
  );
  if (!month) throw new Error(`양력 변환 실패: ${lunarYear}-${lunarMonth}-${lunarDay}${isLeap ? ' 윤' : ''}`);
  if (lunarDay > month.size) throw new Error(`그 달은 ${month.size}일까지입니다`);
  return fromKstDay(month.start + lunarDay - 1);
}

/** 그 음력 연도에 윤달이 있으면 몇 월인지 */
export function leapMonthOf(lunarYear) {
  const seed = toJD(lunarYear, 7, 15, 12) - 9 / 24;
  const months = [...buildLunarCycle(seed - 200), ...buildLunarCycle(seed)];
  const leap = months.find((mm) => mm.year === lunarYear && mm.isLeap);
  return leap ? leap.num : null;
}
