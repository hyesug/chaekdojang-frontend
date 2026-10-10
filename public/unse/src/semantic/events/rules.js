/**
 * events/rules.js — **사건마다 원전이 정한 판단 규칙** (결혼·출산)
 *
 * 시기 엔진(timing/adapters.js)은 분야의 '활성도'를 낸다. 합과 충, 길과 흉을 한데
 * 모은 시끄러움이라 결혼한 해와 헤어진 해가 같은 점수를 받는다. 원전은 사건마다
 * 판단 규칙을 따로 둔다. 여기는 그 규칙만 옮긴다.
 *
 * ── 지키는 선 (docs/unse/rebuild-criteria.md) ──────────────────
 *   · 규칙은 원전·통설에서만 가져온다. **사례를 보고 고르지 않는다.**
 *   · 가중치를 만들지 않는다. 규칙 하나가 걸리면 1점, 해의 점수는 걸린 규칙 수다.
 *     "몇 갈래의 전통 신호가 그 해에 겹치나"를 그대로 센다.
 *   · 원전 규칙을 구현할 수 없는 체계는 **말하지 않는다**(null) — 이유를 남긴다.
 *
 * 해는 입춘 기준 사주 연도가 아니라 양력 연도로 센다(사례가 양력 날짜다).
 * 트랜싯·다샤는 그 해 매달 15일을 표본으로 본다.
 */
import {
  tenGod, TEN_GOD_GROUP, MAIN_HIDDEN, SIX_HARMONY, isClash, isStemCombine,
  computeDaeun, STEMS_KR,
} from '../../core/ganzhi.js';
import { toJD } from '../../core/astro.js';
import { planetPositions, houses, houseOf, toSidereal } from '../../core/planets.js';
import { buildBoard } from '../../hires/ziwei.js';
import { SIHWA } from '../../systems/jamidusu.js';
import { chart as vedicChart, charaKarakas, drishtiOf } from '../../hires/vedicExt.js';
import { dashaTree, dashaAt } from '../../hires/vedic.js';
import { HEXAGRAM_TABLE } from '../../systems/juyeok.js';
import { starOfYear, palaceChart, getsumeiOf } from '../../systems/gujeong.js';
import { modFrom1 } from '../../systems/_base.js';

const mod = (a, n) => ((a % n) + n) % n;
const KST = 9 / 24;
const jdOf = (y, m, d = 15) => toJD(y, m, d, 12) - KST;
const safe = (fn) => { try { return fn(); } catch { return null; } };
const sexStem = (y) => mod(y - 4, 10);
const sexBranch = (y) => mod(y - 4, 12);

export const EVENTS = ['marriage', 'birth'];

/** 체계가 이 사건을 원전 규칙으로 말할 수 없을 때 */
export const SILENT = {
  hongguk: '홍국기문의 연국(年局) 혼인 판단은 공개 원전을 확인하지 못했다',
  yukim: '육임은 질문 순간을 점시로 치는 점이라 평생 중 몇 년을 고르는 규칙이 없다',
  taeeul: '태을신수 개인 명법은 공개 자료가 적어 혼인 연도 규칙을 확인하지 못했다',
  sukyo: '숙요의 연운(구요성)은 해의 길흉만 말하고 혼인을 따로 짚지 않는다',
  tojeong: '토정비결은 144괘 풀이에서 혼인을 읽는데 원문 풀이표가 이 엔진에 없다',
  mahabote: '마하보테의 연간 자리 중 혼인을 지정한 원전 규칙을 확인하지 못했다',
};

// ═════════════════════════════════════════════════════════════
// 사주 — 자평 통설
// ═════════════════════════════════════════════════════════════

/** 홍란(紅鸞)·천희(天喜) — 년지 기준. 홍란은 卯에서 子년을 일으켜 역행, 천희는 그 대충 */
export const hongluanOf = (yearBranch) => mod(3 - yearBranch, 12);
export const tianxiOf = (yearBranch) => mod(3 - yearBranch + 6, 12);
/** 도화(함지) — 삼합의 목욕지: 申子辰→酉 寅午戌→卯 巳酉丑→午 亥卯未→子 */
export const peachOf = (b) => [9, 3, 6, 0][[[8, 0, 4], [2, 6, 10], [5, 9, 1], [11, 3, 7]].findIndex((g) => g.includes(b))];

/**
 * 사주 혼인·출산 규칙.
 *   혼인 (여명 관성 · 남명 재성)
 *     S1 세운 천간이 배우자성             S2 세운 지지(본기)가 배우자성
 *     S3 세운 지지가 일지(배우자궁)와 육합·삼합   S4 세운 천간이 일간과 천간합
 *     S5 세운 지지가 홍란·천희            S6 대운(간 또는 지 본기)이 배우자성
 *   출산 (여명 식상 · 남명 관성)
 *     B1 세운 천간이 자녀성   B2 세운 지지가 자녀성   B3 세운 지지가 시지(자녀궁)와 육합·삼합
 *     B4 세운 지지가 천희     B5 대운이 자녀성
 * 충은 넣지 않는다 — 일지 충은 원전에서 혼인과 이별을 함께 말해 방향이 없다.
 * 용신·희기신도 넣지 않는다 — 원전에서 용신은 그 혼인의 길흉(좋은 인연인가)을 가르지
 * 혼인이 일어나는 해를 고르는 규칙이 아니다.
 */
function sajuRules(input, chart, event) {
  const ds = chart.dayStem, db = chart.pillars.day.branch, yb = chart.pillars.year.branch;
  const hb = chart.pillars.hour?.branch ?? null;
  const female = input.gender === 'female';
  const star = event === 'marriage' ? (female ? '관성' : '재성') : (female ? '식상' : '관성');
  const grp = (s) => TEN_GOD_GROUP[tenGod(ds, s)];
  const daeun = computeDaeun(chart, input.gender === 'male', input.jdUT);
  const harmony = (a, b) => SIX_HARMONY[a] === b || (a !== b && mod(a, 4) === mod(b, 4));
  return (y) => {
    const s = sexStem(y), b = sexBranch(y);
    const age = (jdOf(y, 7, 1) - input.jdUT) / 365.2422;
    const du = daeun.list.find((d) => age >= d.fromExact && age < d.toExact);
    const hits = [];
    if (event === 'marriage') {
      if (grp(s) === star) hits.push(`세운 천간 ${STEMS_KR[s]} = ${star}`);
      if (grp(MAIN_HIDDEN[b]) === star) hits.push(`세운 지지 = ${star}`);
      if (harmony(b, db)) hits.push('세운 지지가 배우자궁(일지)과 합');
      if (isStemCombine(ds, s)) hits.push('세운 천간이 일간과 합');
      if (b === hongluanOf(yb) || b === tianxiOf(yb)) hits.push('홍란·천희의 해');
      if (du && (grp(du.stem) === star || grp(MAIN_HIDDEN[du.branch]) === star)) hits.push(`대운 ${star}`);
    } else {
      if (grp(s) === star) hits.push(`세운 천간 = ${star}(자녀성)`);
      if (grp(MAIN_HIDDEN[b]) === star) hits.push(`세운 지지 = ${star}(자녀성)`);
      if (hb != null && harmony(b, hb)) hits.push('세운 지지가 자녀궁(시지)과 합');
      if (b === tianxiOf(yb)) hits.push('천희의 해');
      if (du && (grp(du.stem) === star || grp(MAIN_HIDDEN[du.branch]) === star)) hits.push(`대운 ${star}`);
    }
    return hits;
  };
}

// ═════════════════════════════════════════════════════════════
// 자미두수 — 유년(流年) 판단
// ═════════════════════════════════════════════════════════════

/**
 * 원국 판에 혼인·자녀를 보는 잡성을 얹는다 (이 엔진의 판에 없던 별).
 *   홍란 卯에서 子년 역행 · 천희 그 대충 · 함지(도화) 년지 삼합의 목욕지 · 천요 丑에서 정월 순행
 */
function ziweiExtras(input, b) {
  const yb = mod((input.ziweiYear ?? input.sajuYear) - 4, 12);
  const lm = (input.ziweiLunar ?? input.lunar).month;
  return { 홍란: hongluanOf(yb), 천희: tianxiOf(yb), 함지: peachOf(yb), 천요: mod(1 + lm - 1, 12) };
}

/**
 * 자미 혼인·출산 규칙. 유년 명궁 = 그 해 태세 지지.
 *   혼인  Z1 유년 명궁이 원국 부처궁에 든다   Z2 유년 명궁이나 유년 부처궁에 홍란·천희
 *         Z3 유년 화록·화과가 원국 부처궁의 별에 붙는다   Z4 유년 부처궁에 함지·천요(도화)
 *   출산  Z1 유년 명궁이 원국 자녀궁에 든다   Z2 유년 명궁·유년 자녀궁에 천희
 *         Z3 유년 화록·화과가 원국 자녀궁의 별에 붙는다
 */
function ziweiRules(input, event) {
  if (!input.timeKnown) return null;
  const b = buildBoard(input);
  const ex = ziweiExtras(input, b);
  const seatIdx = event === 'marriage' ? 2 : 3;          // 부처궁 · 자녀궁
  const natalSeat = mod(b.myeong - seatIdx, 12);
  return (y) => {
    const tb = sexBranch(y);
    const yearSeat = mod(tb - seatIdx, 12);
    const [rok, , gwa] = SIHWA[STEMS_KR[sexStem(y)]] ?? [];
    const hits = [];
    if (tb === natalSeat) hits.push(`유년 명궁이 원국 ${event === 'marriage' ? '부처궁' : '자녀궁'}에`);
    const happy = event === 'marriage' ? [ex.홍란, ex.천희] : [ex.천희];
    if (happy.includes(tb) || happy.includes(yearSeat)) hits.push(event === 'marriage' ? '유년에 홍란·천희' : '유년에 천희');
    const seatStars = b.board[natalSeat] ?? [];
    if ([rok, gwa].some((s) => s && seatStars.includes(s))) hits.push('유년 화록·화과가 원국 그 궁에');
    if (event === 'marriage' && [ex.함지, ex.천요].includes(yearSeat)) hits.push('유년 부처궁에 도화(함지·천요)');
    return hits;
  };
}

// ═════════════════════════════════════════════════════════════
// 서양 점성 — 트랜싯·2차 진행
// ═════════════════════════════════════════════════════════════

const ASPECTS = [0, 60, 90, 120, 180];
const near = (a, b, orb) => { const d = Math.abs(mod(a - b + 180, 360) - 180); return ASPECTS.some((x) => Math.abs(d - x) <= orb); };
const hard = (a, b, orb) => { const d = Math.abs(mod(a - b + 180, 360) - 180); return [0, 180].some((x) => Math.abs(d - x) <= orb); };
const SIGN_RULER = ['화성', '금성', '수성', '달', '태양', '수성', '금성', '화성', '목성', '토성', '토성', '목성'];

/**
 * 혼인
 *   W1 목성 트랜싯이 하강점(DSC)과 합·대각, 또는 7하우스를 지남
 *   W2 목성 트랜싯이 출생 금성과 각 (주요 다섯 각)
 *   W3 목성 트랜싯이 배우자 표성(여 태양·화성 / 남 달·금성)과 각
 *   W4 토성 트랜싯이 하강점 또는 7하우스 주인과 합·대각 (관계의 고정)
 *   W5 진행 달이 출생 금성·하강점과 합      W6 진행 금성이 출생 태양·달·하강점과 합
 * 출산
 *   W1 목성이 5하우스를 지나거나 5하우스 주인과 각   W2 목성 트랜싯이 출생 달과 각
 *   W3 진행 달이 5하우스 커스프·출생 목성과 합
 * classical=true 면 전통 일곱 행성·프로펙션만 쓴다 (천왕성 이후 없음, 진행 없음)
 *   C  연간 프로펙션이 7하우스(출산 5하우스)에 닿는 해
 */
function westernRules(input, event, classical) {
  const natal = planetPositions(input.jdUT);
  const tk = input.timeKnown;
  const h = tk ? houses(input.jdUT, input.place.lat, input.place.lon) : null;
  const dsc = h ? mod(h.asc + 180, 360) : null;
  const female = input.gender === 'female';
  const targets = female ? ['태양', '화성'] : ['달', '금성'];
  const seat = event === 'marriage' ? 7 : 5;
  const cusp = h ? h.cusps[seat] : null;
  const rulerLon = h ? natal[SIGN_RULER[Math.floor(mod(cusp, 360) / 30)]].lon : null;
  const birthYear = input.year;
  return (y) => {
    const hits = new Set();
    for (let m = 1; m <= 12; m++) {
      const jd = jdOf(y, m);
      const t = planetPositions(jd);
      if (event === 'marriage') {
        if (h && (hard(t.목성.lon, dsc, 3) || houseOf(t.목성.lon, h.cusps) === 7)) hits.add('목성이 7하우스·하강점');
        if (near(t.목성.lon, natal.금성.lon, 3)) hits.add('목성–출생 금성');
        if (targets.some((p) => near(t.목성.lon, natal[p].lon, 3))) hits.add('목성–배우자 표성');
        if (h && (hard(t.토성.lon, dsc, 3) || hard(t.토성.lon, rulerLon, 3))) hits.add('토성–하강점·7하우스 주인');
      } else {
        if (h && (houseOf(t.목성.lon, h.cusps) === 5 || near(t.목성.lon, rulerLon, 3))) hits.add('목성–5하우스');
        if (near(t.목성.lon, natal.달.lon, 3)) hits.add('목성–출생 달');
      }
      if (!classical) {
        const age = (jd - input.jdUT) / 365.2422;
        const pr = planetPositions(input.jdUT + age);       // 하루 = 한 해
        if (event === 'marriage') {
          if (hard(pr.달.lon, natal.금성.lon, 1) || (dsc != null && hard(pr.달.lon, dsc, 1))) hits.add('진행 달–금성·하강점');
          if (['태양', '달'].some((p) => hard(pr.금성.lon, natal[p].lon, 1)) || (dsc != null && hard(pr.금성.lon, dsc, 1))) hits.add('진행 금성–태양·달·하강점');
        } else if ((cusp != null && hard(pr.달.lon, cusp, 1)) || hard(pr.달.lon, natal.목성.lon, 1)) {
          hits.add('진행 달–5하우스·목성');
        }
      }
    }
    if (classical && tk && mod(y - birthYear, 12) === seat - 1) hits.add(`프로펙션 ${seat}하우스의 해`);
    return [...hits];
  };
}

// ═════════════════════════════════════════════════════════════
// 베딕 — 다샤와 더블 트랜짓
// ═════════════════════════════════════════════════════════════

/**
 * 혼인
 *   V1 마하다샤 주인이 혼인 지표(금성·7궁주·다라카라카·7궁 거주·D9 7궁주)
 *   V2 안타르다샤 주인이 혼인 지표
 *   V3 더블 트랜짓 — 그 해 목성과 토성이 **둘 다** 라그나의 7궁 또는 7궁주의 자리를 보거나 그 자리에 든다
 * 출산 — 같은 틀로 5궁, 지표는 목성·5궁주·마트리카라카(7카라카에서 자녀 겸)·5궁 거주·D7 5궁주
 */
function vedicRules(input, event) {
  if (!input.timeKnown) return null;
  const d1 = vedicChart(input, 'D1');
  const dv = vedicChart(input, event === 'marriage' ? 'D9' : 'D7');
  if (!d1) return null;
  const seat = event === 'marriage' ? 7 : 5;
  const k = safe(() => charaKarakas(input));
  // 일곱 카라카 체계에는 푸트라카라카가 따로 없다 — 마트리카라카가 자녀를 겸한다(자이미니)
  const karaka = event === 'marriage' ? k?.darakaraka?.planet : k?.all?.['마트리카라카']?.planet;
  const sig = new Set([event === 'marriage' ? '금성' : '목성', d1.lordOf(seat)?.lord, karaka,
    ...(d1.inHouse(seat) ?? []), dv?.lordOf(seat)?.lord].filter(Boolean));
  const seatSign = d1.signOfHouse(seat);
  const lordSign = d1.planets[d1.lordOf(seat)?.lord]?.sign;
  const tree = dashaTree(input, 2);
  const sees = (planet, from, target) => [1, ...drishtiOf(planet)].some((d) => mod(from + d - 1, 12) === target);
  return (y) => {
    const hits = new Set();
    let jup = false, sat = false;
    for (let m = 1; m <= 12; m++) {
      const jd = jdOf(y, m);
      const da = dashaAt(input, tree, jd);
      if (sig.has(da.md?.lord)) hits.add(`마하다샤 ${da.md.lord}`);
      if (sig.has(da.ad?.lord)) hits.add(`안타르다샤 ${da.ad.lord}`);
      const t = planetPositions(jd);
      const js = Math.floor(toSidereal(t.목성.lon, jd) / 30), ss = Math.floor(toSidereal(t.토성.lon, jd) / 30);
      if ([seatSign, lordSign].some((s) => s != null && sees('목성', js, s))) jup = true;
      if ([seatSign, lordSign].some((s) => s != null && sees('토성', ss, s))) sat = true;
    }
    if (jup && sat) hits.add(`더블 트랜짓 (목성·토성 → ${seat}궁)`);
    return [...hits];
  };
}

// ═════════════════════════════════════════════════════════════
// 수·괘·구성 — 그 체계에 혼인·출산을 지정한 규칙이 있는 것만
// ═════════════════════════════════════════════════════════════

/** 주역(매화역수 연점) — 혼인 괘 咸31 恒32 家人37 漸53 歸妹54 / 출산 괘 屯3(생겨남) 家人37 */
function juyeokRules(input, event) {
  const lunar = input.lunar ?? { month: input.month, day: input.day };
  const set = event === 'marriage' ? new Set([31, 32, 37, 53, 54]) : new Set([3, 37]);
  return (y) => {
    const base = sexBranch(y) + 1 + lunar.month + lunar.day;
    const up = modFrom1(base, 8) - 1;
    const lo = modFrom1(base + (input.timeKnown ? input.hourBranch + 1 : 1), 8) - 1;
    const n = HEXAGRAM_TABLE[up][lo];
    return set.has(n) ? [`그 해의 괘 ${n}번`] : [];
  };
}

/** 구성학 — 본명성·월명성이 손궁(4, 연애·혼담)·태궁(7, 기쁨·결실)에 회좌. 출산은 곤궁(2, 모성)·태궁 */
function gujeongRules(input, chart, event) {
  const hon = starOfYear(chart.sajuYear);
  const get = getsumeiOf(hon, chart.sector?.index ?? 0);
  const BASIC = { 북: 1, 북동: 8, 동: 3, 남동: 4, 남: 9, 남서: 2, 서: 7, 북서: 6 };
  const want = event === 'marriage' ? [4, 7] : [2, 7];
  const seatOf = (board, star) => { for (const [d, n] of Object.entries(BASIC)) if (board[d] === star) return n; return 5; };
  return (y) => {
    const board = palaceChart(starOfYear(y));
    const hits = [];
    if (want.includes(seatOf(board, hon))) hits.push('본명성 회좌');
    if (want.includes(seatOf(board, get))) hits.push('월명성 회좌');
    return hits;
  };
}

/** 수비학 개인년 — 2(동반자)·6(결혼·가정) / 출산 6(가정)·3(창조·탄생) */
function kabbalahRules(input, event) {
  const root = (n) => { while (n > 9) n = String(n).split('').reduce((a, c) => a + Number(c), 0); return n; };
  const want = event === 'marriage' ? [2, 6] : [3, 6];
  return (y) => { const py = root(input.month + input.day + root(y)); return want.includes(py) ? [`개인년 ${py}`] : []; };
}

/** 타로 연간 카드 — 생월+생일+그 해를 22 이하로. 혼인 6 연인·3 여황제 / 출산 3 여황제 */
function tarotRules(input, event) {
  const want = event === 'marriage' ? [6, 3] : [3];
  return (y) => {
    let s = input.month + input.day + y;
    while (s > 22) s = String(s).split('').reduce((a, c) => a + Number(c), 0);
    return want.includes(s) ? [`연간 카드 ${s}`] : [];
  };
}

/**
 * 태국 마하탁사 — 태어난 요일의 행성부터 정해진 순서로 돈다(합 108년).
 * 순서와 햇수: 태양6 달15 화성8 수성17 토성10 목성19 라후12 금성21.
 * 각 대주기 안에서 같은 순서로 소주기를 햇수 비례로 나눈다. 금성 대·소주기를 혼인,
 * 목성 대·소주기를 출산(자식 복)의 때로 본다.
 */
const TAKSA = [['태양', 6], ['달', 15], ['화성', 8], ['수성', 17], ['토성', 10], ['목성', 19], ['라후', 12], ['금성', 21]];
const WEEKDAY_PLANET = ['태양', '달', '화성', '수성', '목성', '금성', '토성'];
function thaiRules(input, event) {
  const wd = mod(Math.floor(toJD(input.year, input.month, input.day, 12) + 1.5), 7);
  const startPlanet = wd === 3 && input.timeKnown && input.hour >= 18 ? '라후' : WEEKDAY_PLANET[wd];
  const i0 = TAKSA.findIndex(([p]) => p === startPlanet);
  const want = event === 'marriage' ? '금성' : '목성';
  const periodsAt = (age) => {
    let a = age;
    for (let k = 0; k < 16; k++) {
      const [p, yrs] = TAKSA[(i0 + k) % 8];
      if (a < yrs) {
        let b = a;
        for (let s = 0; s < 8; s++) {
          const [sp, sy] = TAKSA[(i0 + k + s) % 8];
          const len = (yrs * sy) / 108;
          if (b < len) return [p, sp];
          b -= len;
        }
        return [p, null];
      }
      a -= yrs;
    }
    return [null, null];
  };
  return (y) => {
    const hits = new Set();
    for (const m of [3, 9]) {
      const [major, minor] = periodsAt((jdOf(y, m) - input.jdUT) / 365.2422);
      if (major === want) hits.add(`대주기 ${want}`);
      if (minor === want) hits.add(`소주기 ${want}`);
    }
    return [...hits];
  };
}

// ═════════════════════════════════════════════════════════════

/**
 * 체계마다 해별 원전 신호.
 *
 * @param {object} fortune `readFortune(...)` 결과 ({input, chart})
 * @param {'marriage'|'birth'} event
 * @param {number} from 시작 해 (양력)
 * @param {number} to   끝 해 (양력, 포함)
 * @returns {Record<string, {available:boolean, why?:string, years?:Record<number,{score:number,hits:string[]}>}>}
 */
export function eventYears(fortune, event, from, to) {
  const { input, chart } = fortune;
  const makers = {
    saju: () => sajuRules(input, chart, event),
    jamidusu: () => ziweiRules(input, event),
    astrology_modern: () => (input.timeKnown || event === 'marriage' ? westernRules(input, event, false) : null),
    astrology_classical: () => (input.timeKnown ? westernRules(input, event, true) : null),
    vedic: () => vedicRules(input, event),
    juyeok: () => juyeokRules(input, event),
    gujeong: () => gujeongRules(input, chart, event),
    kabbalah: () => kabbalahRules(input, event),
    tarot: () => tarotRules(input, event),
    thai: () => thaiRules(input, event),
  };
  const out = {};
  for (const [id, why] of Object.entries(SILENT)) out[id] = { available: false, why };
  for (const [id, make] of Object.entries(makers)) {
    const fn = safe(make);
    if (!fn) { out[id] = { available: false, why: '출생 시각이 없어 이 체계의 판을 세우지 못한다' }; continue; }
    const years = {};
    for (let y = from; y <= to; y++) {
      const hits = safe(() => fn(y)) ?? [];
      years[y] = { score: hits.length, hits };
    }
    out[id] = { available: true, years };
  }
  return out;
}
