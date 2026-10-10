/**
 * engine.js — 진입점
 *
 * 사용자가 넣은 값 하나로 모든 체계를 돌린다.
 *
 *   입력 정리 → 공용 계산(시각·음력·사주) → 체계별 모듈 → 종합
 *
 * 체계를 추가하려면 SYSTEMS 배열에 한 줄 넣으면 된다.
 * 기존 코드는 건드릴 일이 없다.
 */

import { toJD, toJDN, prevSolarTermJD, fromJD } from './core/astro.js';
import { normalizeBirth } from './core/time.js';
import { findCity, bearing8, suggestCity } from './core/place.js';
import { solarToLunar } from './core/lunar.js';
import { computeFourPillars } from './core/ganzhi.js';
import { synthesize } from './synth.js';
import { interpretProfile } from './interpretation/profile.js';

import saju from './systems/saju.js';
import jamidusu from './systems/jamidusu.js';
import astrology from './systems/astrology.js';
import tarot from './systems/tarot.js';
import sukyo from './systems/sukyo.js';
import mahabote from './systems/mahabote.js';
import vedic from './systems/vedic.js';
import yukim from './systems/yukim.js';
import hongguk from './systems/hongguk.js';
import kabbalah from './systems/kabbalah.js';
import juyeok from './systems/juyeok.js';
import thai from './systems/thai.js';
import tojeong from './systems/tojeong.js';
import gujeong from './systems/gujeong.js';
import taeeul from './systems/taeeul.js';

/** 등록된 체계 열다섯. 순서가 화면에 나오는 순서다. */
export const SYSTEMS = [
  saju, jamidusu, astrology, vedic,          // 명반을 세우는 것들
  juyeok, yukim, hongguk, taeeul,            // 괘와 판을 뽑는 것들
  gujeong, sukyo, tojeong,                   // 주기와 자리를 보는 것들
  kabbalah, mahabote, thai, tarot,           // 수와 상징으로 보는 것들
];

/** 전부 붙였다. 더 넣을 체계가 생기면 여기에 이름만 추가한다. */
export const PLANNED = [];

/**
 * 지금이라는 값.
 *
 * 체계마다 한 해가 바뀌는 자리가 다르다. 명리와 구성학은 입춘에 바뀌고,
 * 수비학과 타로는 양력 1월 1일에 바뀐다. 하나를 돌려쓰면 1월과 2월 초에
 * 어느 한쪽이 한 해씩 어긋난다. 그래서 갈라서 넘긴다.
 *
 * 나이도 마찬가지다. 대운과 다샤의 경계는 30.2세처럼 소수로 떨어지는데
 * 정수 만 나이로 고르면 최대 한 해까지 늦게 바뀐다. 태어난 순간부터
 * 지금까지를 그대로 잰 값을 따로 둔다.
 */
export function nowJD(now = new Date()) {
  return toJD(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(),
              now.getUTCHours(), now.getUTCMinutes());
}

/** 오늘이 속한 사주 연도 (입춘 기준). 세운·구성학 연반이 이 값을 쓴다 */
function currentSajuYear(now = new Date()) {
  return fromJD(prevSolarTermJD(315, nowJD(now)) + 9 / 24).y;
}

/** 오늘이 속한 양력 연도 (한국 시각). 수비학 개인년과 타로 씨앗이 쓴다 */
function currentCivilYear(now = new Date()) {
  const k = new Date(now.getTime() + 9 * 3600000);
  return k.getUTCFullYear();
}

/** 만 나이 — 정수. 화면에 '만 34세'로 적을 때 쓴다 */
function exactAge(y, m, d, now = new Date()) {
  let age = now.getFullYear() - y;
  const passed = now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d);
  if (!passed) age -= 1;
  return Math.max(0, age);
}

/** 태어난 순간부터 지금까지, 해 단위 소수. 대운·다샤 경계가 이걸 쓴다 */
function elapsedYears(jdBirth, now = new Date()) {
  return (nowJD(now) - jdBirth) / 365.2425;
}

/**
 * @param {object} form
 * @param {string} form.name
 * @param {'male'|'female'} form.gender
 * @param {number} form.year  양력
 * @param {number} form.month
 * @param {number} form.day
 * @param {number|null} form.hour   모르면 null
 * @param {number} form.minute
 * @param {string} form.birthPlace  도시 이름
 * @param {string} form.homePlace   도시 이름
 * @param {boolean} [form.dst]      해외 출생 시 서머타임 여부
 */
/**
 * 시주 기준 차이 — 이 사이트는 **진태양시**(실제 경도 + 균시차)로 시주를 세운다. 많은 만세력 앱은
 * 표준시에서 30분만 빼는 방식(동경 127.5° 고정, = 세계시 + 8시간 30분)을 쓴다. 대부분은 같은 시가
 * 나오지만, 태어난 시각이 시 경계에 가까우면 둘이 갈린다(예: 대구 9월 13:26 → 진태양시 未, 일반 午).
 * 갈릴 때만 두 결과를 함께 돌려준다 — 한쪽만 정답처럼 보이지 않게.
 */
function pillarBasisOf(tstBirth, used) {
  const T = computeFourPillars(tstBirth.jdUT, tstBirth.jdTST, { timeKnown: true }).pillars;
  const C = computeFourPillars(tstBirth.jdUT, tstBirth.jdUT + STD_OFFSET, { timeKnown: true }).pillars;
  if (T.hour.hanja === C.hour.hanja && T.day.hanja === C.day.hanja) return null;
  return {
    used,                                  // 'tst' | 'std' — 이 결과가 쓴 기준
    tst: { hour: T.hour, day: T.day },
    common: { hour: C.hour, day: C.day },
    dayDiffers: T.day.hanja !== C.day.hanja,
    tstClock: tstBirth.tst,
  };
}

/** 일반 만세력 방식의 시각 — 세계시 + 8시간 30분(동경 127.5° 고정, 표준시에서 30분 보정) */
const STD_OFFSET = 8.5 / 24;
/**
 * 시주를 세우는 시간 기준. 입력 화면에서 고른다.
 *   tst(기본) — 진태양시: 태어난 곳의 실제 경도 + 균시차
 *   std       — 일반 만세력 방식: 표준시에서 30분 보정
 * std 를 고르면 사주만이 아니라 시각을 쓰는 모든 체계가 같은 시각으로 계산한다(기준이 섞이지 않게).
 */
function applyTimeBasis(birth, basis) {
  if (basis !== 'std') return birth;
  const jdTST = birth.jdUT + STD_OFFSET;
  return { ...birth, jdTST, tst: fromJD(jdTST) };
}

export function prepareInput(form, opts = {}) {
  const integers = ['year', 'month', 'day'];
  if (integers.some((key) => !Number.isInteger(form[key]))) {
    throw new Error('생년월일은 숫자로 정확히 입력해주세요.');
  }
  if (form.year < 1900 || form.year > 2100) {
    throw new Error('1900년에서 2100년 사이만 계산할 수 있습니다.');
  }
  const date = new Date(Date.UTC(form.year, form.month - 1, form.day));
  if (form.month < 1 || form.month > 12 || form.day < 1 ||
      date.getUTCFullYear() !== form.year || date.getUTCMonth() + 1 !== form.month ||
      date.getUTCDate() !== form.day) {
    throw new Error('존재하지 않는 날짜입니다. 생년월일을 다시 확인해주세요.');
  }
  if (form.hour != null && (!Number.isInteger(form.hour) || form.hour < 0 || form.hour > 23)) {
    throw new Error('태어난 시는 0에서 23 사이로 입력해주세요.');
  }
  if (!Number.isInteger(form.minute ?? 0) || (form.minute ?? 0) < 0 || (form.minute ?? 0) > 59) {
    throw new Error('분은 0에서 59 사이로 입력해주세요.');
  }

  const place = findCity(form.birthPlace);
  if (!place) {
    // 목록에 없다고 막아만 두면 사용자가 할 수 있는 게 없다.
    // 비슷한 이름을 알려주고, 정확히 맞출 필요가 없다는 것도 함께 알린다.
    const near = suggestCity(form.birthPlace);
    throw new Error(
      `'${form.birthPlace}'은(는) 목록에 없습니다.` +
      (near.length ? ` 혹시 ${near.join(', ')} 중 하나인가요?` : '') +
      ' 없으면 가장 가까운 시·군을 고르세요 — 경도가 가까우면 결과가 사실상 같습니다.'
    );
  }
  const home = findCity(form.homePlace) ?? place;

  const timeKnown = form.hour != null;

  // 1) 시각 정규화 — 서머타임·표준자오선·균시차를 벗겨낸다
  const tstBirth = normalizeBirth({
    year: form.year, month: form.month, day: form.day,
    hour: form.hour, minute: form.minute ?? 0,
    place, dst: form.dst,
  });
  const timeBasis = form.timeBasis === 'std' ? 'std' : 'tst';
  const birth = applyTimeBasis(tstBirth, timeBasis);

  // 2) 모든 체계가 공유하는 계산
  const lunar = solarToLunar(form.year, form.month, form.day);
  const chart = computeFourPillars(birth.jdUT, birth.jdTST, { timeKnown });
  const ziweiLunar = ziweiLunarOf(birth, timeKnown, lunar);
  const pillarBasis = timeKnown ? pillarBasisOf(tstBirth, timeBasis) : null;

  const at = opts.now instanceof Date ? opts.now : new Date();
  const currentYear = currentSajuYear(at);
  const civilYear = currentCivilYear(at);
  const age = exactAge(form.year, form.month, form.day, at);
  const elapsed = elapsedYears(birth.jdUT, at);

  // 3) 체계 모듈에 넘길 입력 한 벌
  const input = {
    ...form,
    timeKnown,
    place, home,
    moveDirection: bearing8(place, home),
    jdUT: birth.jdUT,
    jdTST: birth.jdTST,
    tst: birth.tst,
    // 시주를 세운 시간 기준 — 'tst'(진태양시, 기본) | 'std'(일반 만세력 방식)
    timeBasis,
    // 시 경계 근처라 두 기준의 시주·일주가 갈리면 그 차이 (아니면 null)
    pillarBasis,
    lunar,
    // 자미두수가 쓰는 음력 — 사주 일주와 같은 날, 설날 기준 연도, 윤달 보정 (ziweiLunarOf)
    ziweiLunar,
    ziweiYear: ziweiLunar.year,
    sajuYear: chart.sajuYear,
    sectorIndex: chart.sector.index,
    // 간지 여덟 글자 — 육임·홍국기문·자미두수가 낱낱이 쓴다
    yearStem: chart.pillars.year.stem,
    yearBranch: chart.pillars.year.branch,
    monthStem: chart.pillars.month.stem,
    monthBranch: chart.pillars.month.branch,
    dayStem: chart.pillars.day.stem,
    dayBranch: chart.pillars.day.branch,
    hourStem: timeKnown ? chart.pillars.hour.stem : null,
    hourBranch: timeKnown ? chart.pillars.hour.branch : null,
    isMale: form.gender === 'male',
    // 'married' | 'single' | null. 기혼이면 리포트가 결혼 시기를 내지 않는다
    marital: form.marital === 'married' || form.marital === 'single' ? form.marital : null,
    age,
    // 입춘에 바뀌는 해. 세운·구성학 연반·태을이 쓴다
    currentYear,
    // 양력 1월 1일에 바뀌는 해. 수비학 개인년·타로 씨앗이 쓴다
    civilYear,
    // 소수로 떨어지는 나이. 대운·다샤 경계 판정이 쓴다
    elapsedYears: elapsed,
    nowJD: nowJD(at),
  };

  return { input, birth, lunar, chart };
}

/**
 * 자미두수의 음력 생일.
 *
 *  · 날짜 — 사주 일주와 같은 날을 쓴다. 진태양시로 날짜를 잡고 23시 이후는 다음 날
 *    (computeFourPillars 의 lateZiNextDay 와 같은 규칙). 전에는 벽시계 날짜를 그대로 써서
 *    23시대 출생자가 사주는 다음 날, 자미두수는 그날로 갈렸다.
 *  · 연도 — **설날 기준**. 자미두수의 연간·연지(오호둔, 사화, 보조성)는 음력 해를 따른다.
 *    전에는 입춘 기준 사주 연도를 써서 입춘과 설날 사이 출생자(해마다 7일 안팎)의
 *    오행국·자미성·사화가 통째로 달라졌다.
 *  · 윤달 — 1~15일은 그 달, 16일부터는 다음 달로 본다(자미두수에서 흔히 쓰는 처리).
 * 시간을 모르면 벽시계 날짜의 음력을 그대로 쓴다.
 */
function ziweiLunarOf(birth, timeKnown, clockLunar) {
  let l = clockLunar;
  if (timeKnown) {
    const t = birth.tst;
    const dayJDN = toJDN(t.y, t.m, t.d) + (t.h >= 23 ? 1 : 0);
    const d = fromJD(dayJDN);           // JDN 은 그 날 정오
    l = solarToLunar(d.y, d.m, d.d);
  }
  const shift = Boolean(l.isLeap) && l.day > 15;
  const month = shift ? (l.month % 12) + 1 : l.month;
  const year = shift && l.month === 12 ? l.year + 1 : l.year;
  return { year, month, day: l.day, isLeap: Boolean(l.isLeap), leapShifted: shift, sourceMonth: l.month };
}

/**
 * 한 사람의 운세를 본다.
 * @param {object} form prepareInput과 같은 형식
 */
export function readFortune(form, opts = {}) {
  const { input, birth, lunar, chart } = prepareInput(form, opts);
  const timeKnown = input.timeKnown;

  // 4) 체계별로 돌린다.
  //    출생 시각이 없으면 아예 판을 못 세우는 체계가 있다. 그건 고장이 아니라
  //    재료가 없는 것이므로 오류와 구분해서 따로 모은다.
  const results = [];
  const skipped = [];
  const errors = [];
  for (const sys of SYSTEMS) {
    if (sys.meta.requiresTime && !timeKnown) {
      skipped.push({ system: sys.meta.name, reason: '태어난 시각을 알아야 계산할 수 있습니다' });
      continue;
    }
    try {
      results.push(sys.analyze(input));
    } catch (e) {
      errors.push({ system: sys.meta.name, message: e.message });
    }
  }

  // 5) 종합
  const synthesis = synthesize(results);

  return { input, birth, lunar, chart, results, synthesis, skipped, errors, planned: PLANNED };
}

/** 15체계의 원국 신호만으로 만드는 구조화 프로필 해석. */
export function readProfileInterpretation(form, opts = {}) {
  const fortune = readFortune(form, opts);
  return { ...interpretProfile(fortune.results), errors: fortune.errors, skipped: fortune.skipped };
}
