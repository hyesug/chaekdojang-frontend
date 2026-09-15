/**
 * ganzhi.js — 간지 · 오행 · 십신 · 사주
 *
 * 사주는 물론이고 육임 · 홍국기문 · 토정비결 · 태을신수까지
 * 전부 이 60갑자 체계 위에서 돌아간다. 공용 어휘집이라고 보면 된다.
 */

import {
  toJDN, fromJD, sunLongitude, prevSolarTermJD, solarTermSector,
} from './astro.js';

// ── 기본 어휘 ────────────────────────────────────────────────
export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const STEMS_KR = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const BRANCHES_KR = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
export const ZODIAC = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];

export const ELEMENTS = ['목', '화', '토', '금', '수'];
export const ELEMENT_COLORS = ['#4ade80', '#f87171', '#fbbf24', '#e5e7eb', '#60a5fa'];
export const ELEMENT_HANJA = ['木', '火', '土', '金', '水'];

/** 천간의 오행 (甲乙=목, 丙丁=화 …) */
export const STEM_ELEMENT = STEMS.map((_, i) => Math.floor(i / 2));
/** 천간의 음양 (0=양, 1=음) */
export const STEM_YIN = STEMS.map((_, i) => i % 2);

/** 지지의 오행 */
export const BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
/** 지지의 음양 */
export const BRANCH_YIN = BRANCHES.map((_, i) => i % 2);

/** 지장간 — 지지 속에 숨은 천간. 마지막이 본기(그 지지를 대표하는 기운) */
export const HIDDEN_STEMS = [
  [8, 9],        // 子
  [9, 7, 5],     // 丑
  [4, 2, 0],     // 寅
  [0, 1],        // 卯
  [1, 9, 4],     // 辰
  [4, 6, 2],     // 巳
  [2, 5, 3],     // 午
  [3, 1, 5],     // 未
  [4, 8, 6],     // 申
  [6, 7],        // 酉
  [7, 3, 4],     // 戌
  [4, 0, 8],     // 亥
];
/** 지지의 본기 천간 */
export const MAIN_HIDDEN = HIDDEN_STEMS.map((a) => a[a.length - 1]);

// ── 지지 관계 ────────────────────────────────────────────────
/** 육합: 서로 끌어당기는 짝 */
export const SIX_HARMONY = { 0: 1, 1: 0, 2: 11, 11: 2, 3: 10, 10: 3, 4: 9, 9: 4, 5: 8, 8: 5, 6: 7, 7: 6 };
/** 삼합: 세 지지가 모여 한 오행을 이룬다 */
export const TRIPLE_HARMONY = [
  { members: [8, 0, 4], element: 4 },  // 申子辰 → 수
  { members: [11, 3, 7], element: 0 }, // 亥卯未 → 목
  { members: [2, 6, 10], element: 1 }, // 寅午戌 → 화
  { members: [5, 9, 1], element: 3 },  // 巳酉丑 → 금
];
/** 충: 정반대에서 부딪친다 */
export function isClash(a, b) {
  return (a + 6) % 12 === b % 12;
}

/** 해(害): 겉으로는 멀쩡한데 속으로 갉아먹는 관계 */
const HARM = { 0: 7, 7: 0, 1: 6, 6: 1, 2: 5, 5: 2, 3: 4, 4: 3, 8: 11, 11: 8, 9: 10, 10: 9 };
export const isHarm = (a, b) => HARM[a] === b;

/** 파(破): 이뤄진 것을 깨뜨리는 관계 */
const BREAK = { 0: 9, 9: 0, 1: 4, 4: 1, 2: 11, 11: 2, 3: 6, 6: 3, 5: 8, 8: 5, 7: 10, 10: 7 };
export const isBreak = (a, b) => BREAK[a] === b;

/** 형(刑): 서로 벼르고 다스리는 관계 */
const TRIPLE_PUNISH = [[2, 5, 8], [1, 10, 7]];        // 寅巳申 · 丑戌未
const MUTUAL_PUNISH = [[0, 3]];                        // 子卯
const SELF_PUNISH = [4, 6, 9, 11];                     // 辰午酉亥
export function punishment(a, b) {
  for (const set of TRIPLE_PUNISH) {
    if (set.includes(a) && set.includes(b) && a !== b) return '삼형';
  }
  for (const [x, y] of MUTUAL_PUNISH) {
    if ((a === x && b === y) || (a === y && b === x)) return '상형';
  }
  if (a === b && SELF_PUNISH.includes(a)) return '자형';
  return null;
}

/** 천간합: 다섯 칸 떨어진 짝끼리 손을 잡는다 */
export const STEM_COMBINE = { 0: 5, 5: 0, 1: 6, 6: 1, 2: 7, 7: 2, 3: 8, 8: 3, 4: 9, 9: 4 };
export const isStemCombine = (a, b) => STEM_COMBINE[a] === b;
/** 천간충: 여섯 칸 떨어져 마주 선다 */
export const isStemClash = (a, b) => Math.abs(a - b) === 6;

/**
 * 원진(元嗔) — 까닭 없이 서로 껄끄러운 짝. 귀문(鬼門)이라고도 한다.
 *
 * 충·형·해·파처럼 뚜렷한 부딪침은 아니고 보조로 보는 관계지만, 궁합에서는
 * 흔히 쓴다. 이것이 없으면 巳戌 같은 짝이 '무관'으로 나온다.
 */
const WONJIN = { 0: 7, 7: 0, 1: 6, 6: 1, 2: 9, 9: 2, 3: 8, 8: 3, 4: 11, 11: 4, 5: 10, 10: 5 };
export const isWonjin = (a, b) => WONJIN[a] === b;

/** 두 지지 사이의 모든 관계를 한 번에 훑는다 */
export function branchRelations(a, b) {
  const out = [];
  if (SIX_HARMONY[a] === b) out.push({ kind: '육합', good: true, text: '서로 끌어당겨 붙는 짝입니다' });
  for (const t of TRIPLE_HARMONY) {
    if (t.members.includes(a) && t.members.includes(b) && a !== b) {
      out.push({ kind: '반합', good: true, text: `${ELEMENTS[t.element]} 기운으로 힘을 합치는 조합입니다` });
    }
  }
  if (isClash(a, b)) out.push({ kind: '충', good: false, text: '정면으로 부딪칩니다. 변동과 이동이 잦아집니다' });
  const pun = punishment(a, b);
  if (pun) out.push({ kind: pun, good: false, text: '서로 벼르는 자리입니다. 사소한 일로 오래 끕니다' });
  if (isHarm(a, b)) out.push({ kind: '해', good: false, text: '겉은 멀쩡한데 속으로 갉아먹는 관계입니다' });
  if (isBreak(a, b)) out.push({ kind: '파', good: false, text: '이뤄놓은 것이 깨지기 쉬운 조합입니다' });
  // 원진은 보조 관계라 맨 뒤에 붙인다. 앞의 [0] 을 보는 곳들이 영향을 받지
  // 않도록 순서를 지킨다.
  if (isWonjin(a, b)) out.push({ kind: '원진', good: false, minor: true, text: '까닭 없이 서로 껄끄러워지는 짝입니다. 크게 부딪치지는 않아도 편치 않은 결이 오래 갑니다' });
  return out;
}

// ── 십신 ─────────────────────────────────────────────────────
const TEN_GODS = {
  비견: '比肩', 겁재: '劫財', 식신: '食神', 상관: '傷官',
  편재: '偏財', 정재: '正財', 편관: '偏官', 정관: '正官',
  편인: '偏印', 정인: '正印',
};
export const TEN_GOD_LIST = Object.keys(TEN_GODS);

/** 십신을 다섯 무리로 묶는다. 해석은 대부분 이 무리 단위로 한다. */
export const TEN_GOD_GROUP = {
  비견: '비겁', 겁재: '비겁',
  식신: '식상', 상관: '식상',
  편재: '재성', 정재: '재성',
  편관: '관성', 정관: '관성',
  편인: '인성', 정인: '인성',
};

/**
 * 일간(나)을 기준으로 상대 천간이 무엇인지 판정한다.
 * 나와 같으면 비겁, 내가 낳으면 식상, 내가 이기면 재성,
 * 나를 이기면 관성, 나를 낳으면 인성.
 */
export function tenGod(dayStem, targetStem) {
  const me = STEM_ELEMENT[dayStem];
  const it = STEM_ELEMENT[targetStem];
  const same = STEM_YIN[dayStem] === STEM_YIN[targetStem];
  if (it === me) return same ? '비견' : '겁재';
  if (it === (me + 1) % 5) return same ? '식신' : '상관';
  if (it === (me + 2) % 5) return same ? '편재' : '정재';
  if (it === (me + 3) % 5) return same ? '편관' : '정관';
  return same ? '편인' : '정인';
}

// ── 60갑자 ───────────────────────────────────────────────────
export function ganzhiName(stem, branch) {
  return {
    hanja: STEMS[stem] + BRANCHES[branch],
    kr: STEMS_KR[stem] + BRANCHES_KR[branch],
    stem, branch,
    element: STEM_ELEMENT[stem],
    branchElement: BRANCH_ELEMENT[branch],
  };
}

/** 60갑자 순번 (0~59) */
export function sexagenaryIndex(stem, branch) {
  for (let i = 0; i < 60; i++) {
    if (i % 10 === stem && i % 12 === branch) return i;
  }
  return -1;
}

// ── 사주 ─────────────────────────────────────────────────────

/**
 * 네 기둥을 세운다.
 *
 * 연·월주는 태양 황경(절기)으로, 일·시주는 진태양시로 정한다.
 * 양력 날짜가 아니라 절기가 기준이라 1월생도 전년도 간지를 쓰는 일이 흔하다.
 *
 * @param {number} jdUT  세계시 율리우스일
 * @param {number} jdTST 진태양시 율리우스일
 * @param {object} opts
 * @param {boolean} [opts.timeKnown=true] 출생 시간을 아는가
 * @param {boolean} [opts.lateZiNextDay=true] 야자시(23시 이후)를 다음 날로 볼 것인가
 */
export function computeFourPillars(jdUT, jdTST, opts = {}) {
  const { timeKnown = true, lateZiNextDay = true } = opts;

  // 연주 — 직전 입춘이 속한 해가 그 사람의 사주 연도다
  const ipchunJD = prevSolarTermJD(315, jdUT);
  const sajuYear = fromJD(ipchunJD + 9 / 24).y;
  const yearStem = ((sajuYear - 4) % 10 + 10) % 10;
  const yearBranch = ((sajuYear - 4) % 12 + 12) % 12;

  // 월주 — 절기 구간이 곧 월지. 월간은 연간에서 파생된다(년상기월법)
  const sector = solarTermSector(jdUT);
  const monthBranch = (sector.index + 2) % 12;
  const monthStemBase = ((yearStem % 5) * 2 + 2) % 10;
  const monthStem = (monthStemBase + sector.index) % 10;

  // 일주 — 율리우스일을 60으로 돌린다
  const t = fromJD(jdTST);
  let dayJDN = toJDN(t.y, t.m, t.d);
  if (lateZiNextDay && t.h >= 23) dayJDN += 1;
  const dayStem = (dayJDN + 9) % 10;
  const dayBranch = (dayJDN + 1) % 12;

  // 시주 — 두 시간이 한 지지. 시간(時干)은 일간에서 파생된다(일상기시법)
  let hourStem = null, hourBranch = null;
  if (timeKnown) {
    hourBranch = Math.floor(((t.h + 1) % 24) / 2);
    const hourStemBase = ((dayStem % 5) * 2) % 10;
    hourStem = (hourStemBase + hourBranch) % 10;
  }

  const pillars = {
    year: ganzhiName(yearStem, yearBranch),
    month: ganzhiName(monthStem, monthBranch),
    day: ganzhiName(dayStem, dayBranch),
    hour: timeKnown ? ganzhiName(hourStem, hourBranch) : null,
  };

  return {
    sajuYear,
    pillars,
    dayStem,           // 일간 = 사주의 주인공
    sector,            // 절기 구간 (대운 계산에 쓴다)
    zodiac: ZODIAC[yearBranch],
    timeKnown,
  };
}

/**
 * 오행 분포를 센다.
 * 천간 넷은 그대로, 지지 넷은 지장간을 가중해서 센다.
 * (본기 1.0, 중기 0.4, 여기 0.2 — 널리 쓰이는 배분)
 */
export function elementDistribution(pillars) {
  const count = [0, 0, 0, 0, 0];
  const list = [pillars.year, pillars.month, pillars.day, pillars.hour].filter(Boolean);

  for (const p of list) {
    count[STEM_ELEMENT[p.stem]] += 1;
    const hidden = HIDDEN_STEMS[p.branch];
    const weights = hidden.length === 2 ? [0.3, 1.0] : [0.2, 0.4, 1.0];
    hidden.forEach((s, i) => {
      count[STEM_ELEMENT[s]] += weights[i];
    });
  }

  const total = count.reduce((a, b) => a + b, 0);
  const pct = count.map((c) => (total ? (c / total) * 100 : 0));
  const max = Math.max(...count);
  const min = Math.min(...count);

  return {
    count: count.map((c) => Math.round(c * 10) / 10),
    pct: pct.map((p) => Math.round(p * 10) / 10),
    strongest: count.indexOf(max),
    weakest: count.indexOf(min),
    missing: count.map((c, i) => (c < 0.5 ? i : -1)).filter((i) => i >= 0),
  };
}

/** 십신 분포 — 이 사람이 무엇에 끌리는지를 보여준다 */
export function tenGodDistribution(pillars, dayStem) {
  const groups = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  const detail = [];
  const list = [
    ['년', pillars.year], ['월', pillars.month],
    ['일', pillars.day], ['시', pillars.hour],
  ].filter(([, p]) => p);

  for (const [pos, p] of list) {
    if (!(pos === '일')) {
      const g = tenGod(dayStem, p.stem);
      groups[TEN_GOD_GROUP[g]] += 1;
      detail.push({ pos: pos + '간', god: g });
    }
    const hb = tenGod(dayStem, MAIN_HIDDEN[p.branch]);
    groups[TEN_GOD_GROUP[hb]] += 1;
    detail.push({ pos: pos + '지', god: hb });
  }

  const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  return { groups, detail, dominant: entries[0][0], weakest: entries[entries.length - 1][0] };
}

/**
 * 대운 — 10년 단위로 바뀌는 인생의 큰 흐름.
 *
 * 연간이 양인 남자와 음인 여자는 절기를 향해 순행하고,
 * 그 반대는 역행한다. 태어난 날부터 절기까지의 일수를 3으로 나눈 값이
 * 대운이 시작되는 나이다. (3일 = 1년)
 */
export function computeDaeun(chart, isMale, jdUT, count = 9) {
  const yearStemYang = STEM_YIN[chart.pillars.year.stem] === 0;
  const forward = yearStemYang === isMale;

  const days = forward
    ? chart.sector.endJD - jdUT
    : jdUT - chart.sector.startJD;

  const startAgeExact = days / 3;
  const startAge = Math.max(1, Math.round(startAgeExact));

  const list = [];
  const { stem, branch } = chart.pillars.month;
  for (let i = 1; i <= count; i++) {
    const step = forward ? i : -i;
    const s = ((stem + step) % 10 + 10) % 10;
    const b = ((branch + step) % 12 + 12) % 12;
    list.push({
      ...ganzhiName(s, b),
      fromAge: startAge + (i - 1) * 10,
      toAge: startAge + i * 10 - 1,
      god: tenGod(chart.dayStem, s),
    });
  }

  return { forward, startAge, startAgeExact: Math.round(startAgeExact * 10) / 10, list };
}

/** 지금 나이에 해당하는 대운을 고른다 */
export function currentDaeun(daeun, age) {
  return daeun.list.find((d) => age >= d.fromAge && age <= d.toAge) ?? null;
}

/** 특정 연도의 세운(그 해의 간지) */
export function yearPillar(year) {
  const s = ((year - 4) % 10 + 10) % 10;
  const b = ((year - 4) % 12 + 12) % 12;
  return ganzhiName(s, b);
}
