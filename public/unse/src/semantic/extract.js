/**
 * extract.js — LEVEL 1 → LEVEL 2. **기호를 집는 자리**
 *
 * 계산은 하지 않는다. `readFortune` 과 `hires/` 가 이미 구한 값에서
 * 그 전통이 직업을 보라고 지정한 자리의 기호를 꺼낼 뿐이다.
 *
 * ── 감사에서 드러난 것 ─────────────────────────────────────
 * 열다섯을 **대표 기호 하나씩**으로 읽고 있었다. 그런데 계산은 이미 훨씬
 * 많이 되어 있었다 — 자미는 열두 궁을 다 세워 두고 관록궁 하나만 읽었고,
 * 점성은 열 행성을 다 구해 두고 MC 사인 하나만 읽었고, 사주는 **격국의
 * 정통 자리인 월지 본기**를 안 보고 천간만 세고 있었다.
 *
 * 그 상태에서 "자미가 잘 맞는다 / 주역이 못 맞는다"를 견주면, 체계가
 * 틀린 것인지 **우리가 얕게 읽은 것인지** 가릴 수 없다. 그래서 먼저
 * 깊이를 맞췄다.
 *
 * ── 근거를 묶음(group)으로 낸다 ────────────────────────────
 * MC 사인 · MC 주인 · MC 주인의 하우스는 **같은 MC 에서 파생**된다.
 * 독립 증거 셋으로 세면 MC 를 세 번 세는 것이다. 그래서 묶음 이름을
 * 함께 내고, `systems.js` 가 묶음 안에서는 더하지 않고 가장 센 것만 쓴다.
 *
 * ── 없으면 없다고 한다 ────────────────────────────────────
 *   unavailable  시각 미상처럼 재료가 없다
 *   empty        자리는 섰는데 비었다 (공궁 등)
 */

import * as ZE from '../hires/ziweiExt.js';
import * as VEX from '../hires/vedicExt.js';
import * as WS from '../hires/western.js';
import * as IN from '../hires/interpret.js';
import { DOMICILE } from '../hires/classical.js';
import { houseOf } from '../core/planets.js';
import {
  tenGod, elementDistribution, STEM_ELEMENT, MAIN_HIDDEN, BRANCHES,
} from '../core/ganzhi.js';
import { QUALITY_NAME } from './tables/western.js';
import { CAREER as ZI_CAREER } from './tables/ziwei.js';

export const SYSTEM_IDS = [
  'saju', 'jamidusu', 'astrology', 'vedic',
  'juyeok', 'yukim', 'hongguk', 'taeeul',
  'gujeong', 'sukyo', 'tojeong',
  'kabbalah', 'mahabote', 'thai', 'tarot',
];

export const SYSTEM_NAME = {
  saju: '사주', jamidusu: '자미두수', astrology: '점성술', vedic: '베딕',
  juyeok: '주역', yukim: '육임', hongguk: '홍국기문', taeeul: '태을신수',
  gujeong: '구성학', sukyo: '숙요', tojeong: '토정비결',
  kabbalah: '카발라', mahabote: '마하보테', thai: '태국 점성술', tarot: '타로',
};

const safe = (fn) => { try { return fn(); } catch { return null; } };
const signOf = (lon) => Math.floor((((lon % 360) + 360) % 360) / 30);

/**
 * 근거 하나.
 * @param condition rules.js 의 condition 키
 * @param basis 사람이 읽을 근거 문구
 * @param group 같은 재료에서 나온 것끼리의 묶음 이름
 * @param weight 그 묶음 안에서의 세기
 */
const hit = (condition, basis, group, weight = 1) => ({ condition, basis, group, weight });

// ─────────────────────────────────────────────────────────────
// 사주
// ─────────────────────────────────────────────────────────────

/**
 * ── 보강한 것 ──
 *   전: 천간 세 개의 십성 + 일간 오행
 *   후: + **월지 본기 십성**(격국을 세우는 정통 자리) + 나머지 지지 본기
 *       + 오행 최강·최약
 *
 * 월지를 안 보고 격을 말하던 것이 가장 큰 구멍이었다. 자평 명리에서
 * 격은 **월지 지장간 본기**로 세운다 — 천간만 세는 것은 격국이 아니다.
 */
export function sajuCareer(chart) {
  if (!chart?.pillars?.month) return { status: 'unavailable', why: '월주를 세우지 못했다' };
  const out = [];
  const count = {};

  // 천간 — 일간은 나 자신이라 십성이 아니다
  for (const k of ['year', 'month', 'hour']) {
    const p = chart.pillars[k];
    if (!p) continue;
    const g = tenGod(chart.dayStem, p.stem);
    if (g) count[g] = (count[g] ?? 0) + 1;
  }
  for (const [god, n] of Object.entries(count)) {
    out.push(hit(`god:${god}`, `천간 ${god} ${n}개`, 'stem', Math.min(1, 0.4 + n * 0.3)));
  }

  // 월지 본기 — **격의 자리**
  const mb = chart.pillars.month.branch;
  const monthMain = MAIN_HIDDEN?.[mb];
  const monthGod = monthMain != null ? tenGod(chart.dayStem, monthMain) : null;
  if (monthGod) {
    out.push(hit(`god:${monthGod}`, `월지 ${BRANCHES[mb]} 본기 ${monthGod} — 격의 자리`, 'monthBranch', 1));
  }

  // 나머지 지지 본기 — 격보다 약하게
  for (const k of ['year', 'day', 'hour']) {
    const p = chart.pillars[k];
    if (!p) continue;
    const main = MAIN_HIDDEN?.[p.branch];
    const g = main != null ? tenGod(chart.dayStem, main) : null;
    if (g) out.push(hit(`god:${g}`, `${BRANCHES[p.branch]} 본기 ${g}`, 'branch', 0.6));
  }

  // 일간 오행
  const el = STEM_ELEMENT?.[chart.pillars.day.stem];
  if (el != null) out.push(hit(`dayElement:${el}`, `일간 ${chart.pillars.day.stem}`, 'dayElement', 0.8));

  // 오행 분포 — 가장 두터운 기운
  const dist = elementDistribution(chart.pillars);
  if (dist) {
    const top = dist.pct.indexOf(Math.max(...dist.pct));
    out.push(hit(`elementTop:${top}`, `오행 최강 ${['목', '화', '토', '금', '수'][top]}`, 'elementBalance', 0.7));
  }

  return {
    status: out.length ? 'ok' : 'empty', hits: out,
    facts: { count, monthGod, dayElement: el,
      elementSpread: dist ? Math.max(...dist.pct) - Math.min(...dist.pct) : null },
  };
}

// ─────────────────────────────────────────────────────────────
// 자미두수
// ─────────────────────────────────────────────────────────────

const MAIN_STARS = new Set(Object.keys(ZI_CAREER));

function palaceRow(rows, name, board) {
  const row = rows.find((x) => x.palace === name)?.rows?.find((r) => /원국/.test(r.layer ?? '')) ?? null;
  if (!row) return null;
  let main = (row.main ?? []).filter((s) => MAIN_STARS.has(s));
  let borrowed = false;
  if (!main.length && row.branch != null && board) {
    const opp = ZE.trineSquare(row.branch).opposite;
    if (board[opp]) { main = board[opp].filter((s) => MAIN_STARS.has(s)); borrowed = main.length > 0; }
  }
  return { ...row, main, borrowed };
}

/**
 * ── 보강한 것 ──
 *   전: 관록궁 주성 + 그 궁의 보조성·사화
 *   후: + **명궁**(타고난 결) + **재백궁**(돈 버는 방식) + **천이궁**(밖에서의 활동)
 *       + 오행국
 *
 * 두수는 한 궁만 보지 않는다. 관록궁의 삼방이 곧 명궁과 재백궁이라,
 * 관록궁만 읽는 것은 삼방사정을 버리는 것이다.
 */
export function ziweiCareer(input, stack) {
  if (!stack) return { status: 'unavailable', why: '출생 시각을 알아야 판을 세운다' };
  const rows = safe(() => ZE.domainPalaces(input, '직업', stack.layers)) ?? [];
  const board = stack.board?.board ?? null;
  if (!rows.length) return { status: 'unavailable', why: '판을 세우지 못했다' };

  const out = [];
  const gwan = palaceRow(rows, '관록궁', board);
  const myeong = palaceRow(rows, '명궁', board);
  const money = palaceRow(rows, '재백궁', board);
  const travel = palaceRow(rows, '천이궁', board);

  for (const s of gwan?.main ?? []) {
    out.push(hit(`career:${s}`, gwan.borrowed ? `관록궁 공궁 → 대궁 ${s}` : `원국 관록궁 ${s}`, 'gwanrok', 1));
  }
  for (const s of myeong?.main ?? []) {
    out.push(hit(`myeong:${s}`, `원국 명궁 ${s}`, 'myeong', 0.9));
  }
  for (const s of money?.main ?? []) {
    out.push(hit(`money:${s}`, `원국 재백궁 ${s}`, 'jaebaek', 0.75));
  }
  for (const s of travel?.main ?? []) {
    out.push(hit(`travel:${s}`, `원국 천이궁 ${s}`, 'cheoni', 0.65));
  }
  // 관록궁의 보조성·사화 — 세기를 조절한다
  for (const s of gwan?.lucky ?? []) out.push(hit(`aux:${s}`, `관록궁 ${s}`, 'aux', 0.6));
  for (const s of gwan?.evil ?? []) out.push(hit(`aux:${s}`, `관록궁 ${s}`, 'aux', 0.6));
  for (const s of gwan?.sihwa ?? []) {
    const kind = ['화록', '화권', '화과', '화기'].find((k) => String(s).endsWith(k));
    if (kind) out.push(hit(`sihwa:${kind}`, `관록궁 ${s}`, 'sihwa', 0.7));
  }
  // 오행국 — 판의 바탕
  const guk = (input.__guk ?? null) || gukOf(stack);
  if (guk) out.push(hit(`guk:${guk}`, `오행국 ${guk}`, 'guk', 0.5));

  if (!out.length) return { status: 'empty', why: '관록궁·명궁 모두 비었다' };
  return { status: 'ok', hits: out,
    facts: { gwanrok: gwan?.main, myeong: myeong?.main, jaebaek: money?.main, cheoni: travel?.main, guk } };
}

const GUK_NAMES = { 2: '수이국', 3: '목삼국', 4: '금사국', 5: '토오국', 6: '화육국' };
const gukOf = (stack) => GUK_NAMES[stack?.board?.guk?.n] ?? null;

// ─────────────────────────────────────────────────────────────
// 서양 점성술
// ─────────────────────────────────────────────────────────────

/**
 * ── 보강한 것 ──
 *   전: MC 사인 · MC 양태 · 10H 거주 · 6H 거주 · MC 주인 · MC 주인 하우스
 *   후: + **상승점 사인**(몸과 기질) + **태양 사인·하우스**(무대) + **2H 거주**(벌이)
 *       + MC 주인의 **사인** + 원소 우세
 *
 * MC 계열(사인·주인·주인의 자리·양태)은 **같은 MC 에서 파생**되므로
 * 한 묶음으로 낸다. 셋으로 세면 MC 를 세 번 세는 것이다.
 */
export function westernCareer(input) {
  if (!input?.timeKnown) return { status: 'unavailable', why: '출생 시각을 알아야 하우스를 세운다' };
  const N = safe(() => WS.natalPack(input));
  if (!N?.cusps) return { status: 'unavailable', why: '하우스를 세우지 못했다' };

  const out = [];
  const mc = signOf(N.cusps[10]);
  const inHouse = (n) => Object.entries(N.pos)
    .filter(([, v]) => houseOf(v.lon, N.cusps) === n).map(([k]) => k);

  // ── MC 묶음 (전부 같은 MC 에서 나온다) ──
  out.push(hit(`mcSign:${mc}`, `10하우스 ${IN.SIGN_NAME[mc]}`, 'mc', 1));
  out.push(hit(`mcQuality:${QUALITY_NAME[mc % 3]}`, `10하우스 ${QUALITY_NAME[mc % 3]}궁`, 'mc', 0.6));
  const lord = DOMICILE[mc];
  if (lord && N.pos?.[lord]) {
    out.push(hit(`mcLord:${lord}`, `MC 주인 ${lord}`, 'mc', 0.95));
    const h = houseOf(N.pos[lord].lon, N.cusps);
    if (h) out.push(hit(`mcLordHouse:${h}`, `MC 주인 ${lord}가 ${h}하우스`, 'mc', 0.8));
    const ls = signOf(N.pos[lord].lon);
    out.push(hit(`mcSign:${ls}`, `MC 주인 ${lord}가 ${IN.SIGN_NAME[ls]}`, 'mcLordSign', 0.7));
  }

  // ── 하우스 거주 ──
  for (const p of inHouse(10)) out.push(hit(`tenth:${p}`, `10하우스에 ${p}`, 'tenth', 1));
  for (const p of inHouse(6)) out.push(hit(`sixth:${p}`, `6하우스에 ${p}`, 'sixth', 0.7));
  for (const p of inHouse(2)) out.push(hit(`second:${p}`, `2하우스에 ${p}`, 'second', 0.6));

  // ── 상승점 — 몸과 기질. 직업의 '방식'을 본다 ──
  const asc = signOf(N.cusps[1]);
  out.push(hit(`ascSign:${asc}`, `상승점 ${IN.SIGN_NAME[asc]}`, 'asc', 0.75));

  // ── 태양 — 무대와 지향 ──
  if (N.pos?.태양) {
    const ss = signOf(N.pos.태양.lon);
    out.push(hit(`sunSign:${ss}`, `태양 ${IN.SIGN_NAME[ss]}`, 'sun', 0.7));
    const sh = houseOf(N.pos.태양.lon, N.cusps);
    if (sh) out.push(hit(`sunHouse:${sh}`, `태양 ${sh}하우스`, 'sun', 0.6));
  }

  return { status: 'ok', hits: out,
    facts: { mcSign: mc, mcLord: lord, asc, tenth: inHouse(10), sixth: inHouse(6), second: inHouse(2) } };
}

// ─────────────────────────────────────────────────────────────
// 베딕
// ─────────────────────────────────────────────────────────────

const DIGNITY = { 고양: 1, 정위: 1, 무랄라트리코나: 1, 우호: 0.9, 중립: 0.85, 적대: 0.7, 쇠약: 0.6 };
const dig = (d) => DIGNITY[d] ?? 0.85;

/**
 * ── 보강한 것 ──
 *   전: D10 라그나주 · D10 10궁주 · D10 10궁 거주 · D1 10궁주 · AK · D10 라그나
 *   후: + **아마탸카라카**(BPHS 가 경력·생계에 지정한 카라카) + **D1 10궁 거주**
 *       + D10 6궁(고용)·7궁(거래처)
 *
 * 역산에서 확인된 것: 일곱 지표 중 최고가 4/8 이고 전부 동원해도 6/8 인데
 * 그마저 사람마다 다른 지표를 골라야 나왔다. 그래서 **고르지 않고 전부**
 * 싣는다 — 사후에 고르는 것은 규칙이 아니다.
 */
export function vedicCareer(input) {
  const wp = safe(() => VEX.wealthPack(input));
  const k = safe(() => VEX.charaKarakas(input));
  if (!wp) return { status: 'unavailable', why: '차트를 세우지 못했다' };

  const out = [];
  if (wp.d10_1?.lord) out.push(hit(`d10Lagnesh:${wp.d10_1.lord}`, `D10 라그나주 ${wp.d10_1.lord}`, 'd10lagna', dig(wp.d10_1.lordDignity)));
  if (Number.isInteger(wp.d10_1?.signIndex)) {
    out.push(hit(`d10Lagna:${wp.d10_1.signIndex}`, `D10 라그나 ${wp.d10Lagna ?? ''}`, 'd10lagna', 0.7));
  }
  if (wp.d10_10?.lord) out.push(hit(`d10TenthLord:${wp.d10_10.lord}`, `D10 10궁주 ${wp.d10_10.lord}`, 'd10tenth', dig(wp.d10_10.lordDignity)));
  for (const p of wp.d10_10?.occupants ?? []) out.push(hit(`d10TenthIn:${p}`, `D10 10궁에 ${p}`, 'd10tenth', 0.8));

  if (wp.d1_10?.lord) out.push(hit(`d1TenthLord:${wp.d1_10.lord}`, `D1 10궁주 ${wp.d1_10.lord}`, 'd1tenth', dig(wp.d1_10.lordDignity)));
  for (const p of wp.d1_10?.occupants ?? []) out.push(hit(`d1TenthIn:${p}`, `D1 10궁에 ${p}`, 'd1tenth', 0.85));

  // 카라카 — 아트마(영혼)와 **아마탸(경력·생계)**
  if (k?.atmakaraka?.planet) out.push(hit(`atmakaraka:${k.atmakaraka.planet}`, `아트마카라카 ${k.atmakaraka.planet}`, 'karaka', 0.75));
  const amk = k?.all?.['아마탸카라카']?.planet ?? null;
  if (amk) out.push(hit(`amatyakaraka:${amk}`, `아마탸카라카 ${amk} — 경력의 카라카`, 'karaka', 0.9));

  // D10 6궁(고용)·7궁(거래처)
  if (wp.d10_6?.lord) out.push(hit(`d10Sixth:${wp.d10_6.lord}`, `D10 6궁주 ${wp.d10_6.lord} — 고용의 자리`, 'd10work', 0.6));
  if (wp.d10_7?.lord) out.push(hit(`d10Seventh:${wp.d10_7.lord}`, `D10 7궁주 ${wp.d10_7.lord} — 거래처의 자리`, 'd10work', 0.6));

  if (!out.length) return { status: 'empty', why: 'D10 을 세우지 못했다' };
  return { status: 'ok', hits: out,
    facts: { d10Lagnesh: wp.d10_1?.lord, d10TenthLord: wp.d10_10?.lord, ak: k?.atmakaraka?.planet, amk } };
}

// ─────────────────────────────────────────────────────────────
// 나머지 열한 체계
// ─────────────────────────────────────────────────────────────

const factOf = (a, label) => (a?.facts ?? []).find((f) => f.label === label)?.value ?? null;
const headOf = (a) => String(a?.headline ?? '');

const GUA = /[乾兌離震巽坎艮坤]/;
const NINE_STAR = /(일백|이흑|삼벽|사록|오황|육백|칠적|팔백|구자)/;
const NINE_STAR_HANJA = { 一白: '일백', 二黑: '이흑', 三碧: '삼벽', 四綠: '사록', 五黃: '오황', 六白: '육백', 七赤: '칠적', 八白: '팔백', 九紫: '구자' };

/**
 * ── 보강한 것 ──
 *   주역   상괘 → + **하괘**(바탕) + **지괘 상괘**(향하는 방향)
 *   육임   초전 천장 → + **중전·말전 천장**(과정·결말)
 *   홍국   팔문 → + **구성 아홉**(기질) + **내 궁 팔괘**
 *   태을   태을궁 → + **주산/객산**(산법의 알맹이) + **문**
 *   구성학  본명성 → + **월명성**(드러나는 성격)
 *   숙요   칠요 → + **28수 낱낱**(칠요는 28을 일곱으로 뭉갠 것이다)
 *   카발라  라이프 패스 → + **생일수**(타고난 재능의 결)
 *   마하보테 자리 → + **요일 행성**
 *
 *   토정·태국·타로는 보강할 재료가 없다 (아래 주석 참조).
 */
export function otherCareer(results) {
  const by = Object.fromEntries((results ?? []).map((r) => [r.id ?? r.name, r]));
  const out = {};
  const put = (id, hits, facts) => {
    out[id] = hits.length ? { status: 'ok', hits, facts } : { status: 'empty', why: '기호를 집어내지 못했다' };
  };

  // ── 주역 — 외괘·내괘·지괘 ──
  const jy = by.juyeok;
  if (jy) {
    const hits = [];
    const up = String(factOf(jy, '상괘') ?? '').match(GUA)?.[0];
    const low = String(factOf(jy, '하괘') ?? '').match(GUA)?.[0];
    if (up) hits.push(hit(`symbol:${up}`, `본괘 상괘 ${up} — 드러나는 일`, 'outer', 1));
    if (low) hits.push(hit(`symbol:${low}`, `본괘 하괘 ${low} — 바탕`, 'inner', 0.85));
    put('juyeok', hits, { up, low });
  }

  // ── 육임 — 삼전의 천장 셋 ──
  const ym = by.yukim;
  if (ym) {
    const TJ = /(귀인|등사|주작|육합|구진|청룡|천공|백호|태상|현무|태음|천후)/;
    const hits = [];
    for (const [label, group, w, what] of [['초전', 'first', 1, '일의 시작'], ['중전', 'mid', 0.75, '과정'], ['말전', 'last', 0.8, '결말']]) {
      const t = String(factOf(ym, label) ?? '').match(TJ)?.[1];
      if (t) hits.push(hit(`symbol:${t}`, `${label} ${t} — ${what}`, group, w));
    }
    put('yukim', hits, {});
  }

  // ── 홍국기문 — 팔문 · 구성 · 궁 ──
  const hg = by.hongguk;
  if (hg) {
    const hits = [];
    const cell = String(factOf(hg, '내 궁') ?? '') + ' ' + headOf(hg);
    const gate = cell.match(/(휴문|생문|상문|두문|경문|사문|개문)/)?.[1];
    const star = cell.match(/(천봉|천예|천충|천보|천금|천심|천주|천임|천영)/)?.[1];
    const gua = cell.match(GUA)?.[0];
    if (gate) hits.push(hit(`gate:${gate}`, `내 궁 ${gate}`, 'gate', 1));
    if (star) hits.push(hit(`star:${star}`, `내 궁 ${star}`, 'star', 0.85));
    if (gua) hits.push(hit(`symbol:${gua}`, `내 궁 ${gua}`, 'palace', 0.7));
    put('hongguk', hits, { gate, star, gua });
  }

  // ── 태을신수 — 궁 · 주객산 · 문 ──
  const te = by.taeeul;
  if (te) {
    const hits = [];
    const g = String(factOf(te, '태을궁') ?? '').match(/[離坎坤震巽乾兌艮中]/)?.[0];
    const gua = g === '中' ? '坤' : g;
    if (gua) hits.push(hit(`symbol:${gua}`, `태을궁 ${gua}`, 'palace', 1));
    const host = Number(factOf(te, '주산')), guest = Number(factOf(te, '객산'));
    if (Number.isFinite(host) && Number.isFinite(guest)) {
      const key = host > guest ? '주산우세' : guest > host ? '객산우세' : '대등';
      hits.push(hit(`host:${key}`, `주산 ${host} · 객산 ${guest} — ${key}`, 'host', 0.9));
    }
    const gate = String(factOf(te, '문') ?? '').match(/(휴문|생문|상문|두문|경문|사문|개문)/)?.[1];
    if (gate) hits.push(hit(`gate:${gate}`, `태을 ${gate}`, 'gate', 0.7));
    put('taeeul', hits, { gua, host, guest, gate });
  }

  // ── 구성학 — 본명성 · 월명성 ──
  const gj = by.gujeong;
  if (gj) {
    const hits = [];
    const pick = (label) => {
      const v = String(factOf(gj, label) ?? '');
      return v.match(NINE_STAR)?.[1] ?? NINE_STAR_HANJA[v.slice(0, 2)] ?? null;
    };
    const main = pick('본명성') ?? headOf(gj).match(NINE_STAR)?.[1];
    const month = pick('월명성');
    if (main) hits.push(hit(`symbol:${main}`, `본명성 ${main}`, 'main', 1));
    if (month) hits.push(hit(`symbol:${month}`, `월명성 ${month} — 드러나는 성격`, 'month', 0.85));
    put('gujeong', hits, { main, month });
  }

  // ── 숙요 — 28수 낱낱 + 칠요 ──
  const sk = by.sukyo;
  if (sk) {
    const hits = [];
    const m = headOf(sk).match(/([角亢氐房心尾箕斗牛女虛危室壁奎婁胃昴畢觜參井鬼柳星張翼軫])宿/);
    if (m) hits.push(hit(`mansion:${m[1]}`, `본명숙 ${m[1]}宿`, 'mansion', 1));
    const yo = IN.SUKYO_YO?.[m?.[1]];
    // 칠요는 28수를 일곱으로 뭉갠 것이라 **같은 묶음**에 넣는다
    if (yo) hits.push(hit(`symbol:${yo}`, `본명숙 칠요 ${yo}요`, 'mansion', 0.6));
    put('sukyo', hits, { mansion: m?.[1], yo });
  }

  // ── 카발라 — 라이프 패스 · 생일수 ──
  const kb = by.kabbalah;
  if (kb) {
    const hits = [];
    const lp = Number(headOf(kb).match(/라이프 패스\s*(\d+)/)?.[1]);
    const bd = Number(factOf(kb, '생일수'));
    if (Number.isFinite(lp)) hits.push(hit(`symbol:${lp}`, `라이프 패스 ${lp}`, 'lifepath', 1));
    if (Number.isFinite(bd)) hits.push(hit(`birthday:${bd}`, `생일수 ${bd} — 타고난 재능의 결`, 'birthday', 0.9));
    put('kabbalah', hits, { lp, bd });
  }

  // ── 마하보테 — 자리 · 요일 행성 ──
  const mb = by.mahabote;
  if (mb) {
    const hits = [];
    const seat = headOf(mb).match(/(빈가|아하|야자|아디|마라나|푸티|타트)/)?.[1]
      ?? String(factOf(mb, '내 자리') ?? '').match(/(빈가|아하|야자|아디|마라나|푸티|타트)/)?.[1];
    const planet = String(factOf(mb, '내 행성') ?? '').match(/(태양|달|화성|수성|목성|금성|토성)/)?.[1];
    if (seat) hits.push(hit(`symbol:${seat}`, `내 자리 ${seat}`, 'seat', 1));
    if (planet) hits.push(hit(`planet:${planet}`, `요일 행성 ${planet}`, 'planet', 0.8));
    put('mahabote', hits, { seat, planet });
  }

  // ── 토정비결 — 상괘 하나뿐 ──
  // 중괘(1~6)·하괘(1~3)는 팔괘가 아니라 옮길 물상표가 없다.
  // 억지로 만들면 그건 전통이 아니라 우리가 지어낸 표가 된다.
  const tj = by.tojeong;
  if (tj) {
    const TOJEONG_TRIGRAM = { 1: '乾', 2: '兌', 3: '離', 4: '震', 5: '巽', 6: '坎', 7: '艮', 8: '坤' };
    const gua = TOJEONG_TRIGRAM[Number(factOf(tj, '상괘'))];
    put('tojeong', gua ? [hit(`symbol:${gua}`, `상괘 ${gua}`, 'outer', 1)] : [], { gua });
  }

  // ── 태국 점성술 — 요일 하나뿐 ──
  // 색·방위·불상은 전부 요일에서 파생된 같은 정보다. 따로 세면 한 재료를
  // 네 번 세는 것이라 늘리지 않았다.
  const th = by.thai;
  if (th) {
    const day = String(factOf(th, '태어난 요일') ?? headOf(th)).match(/[일월화수목금토]요일/)?.[0];
    put('thai', day ? [hit(`symbol:${day}`, `출생 요일 ${day}`, 'weekday', 1)] : [], { day });
  }

  // ── 타로 — 생일 카드 하나뿐 ──
  // 상황·과제·조언 카드는 **해마다 바뀌므로** 원국에 쓸 수 없다.
  const tr = by.tarot;
  if (tr) {
    const card = String(factOf(tr, '생일 카드') ?? '').replace(/^\d+\.\s*/, '').trim();
    put('tarot', card ? [hit(`symbol:${card}`, `생일 카드 ${card}`, 'birthcard', 1)] : [], { card });
  }

  return out;
}

// ─────────────────────────────────────────────────────────────

/**
 * 한 사람의 직업 기호를 체계마다 꺼낸다.
 *
 * @param {object} fortune `readFortune` 결과
 * @param {object|null} stack `ZW.stackAt` 결과
 */
export function extractCareer(fortune, stack) {
  const { input, chart, results } = fortune;
  const out = {
    saju: safe(() => sajuCareer(chart)) ?? { status: 'unavailable', why: '계산 중 오류' },
    jamidusu: safe(() => ziweiCareer(input, stack)) ?? { status: 'unavailable', why: '계산 중 오류' },
    astrology: safe(() => westernCareer(input)) ?? { status: 'unavailable', why: '계산 중 오류' },
    vedic: safe(() => vedicCareer(input)) ?? { status: 'unavailable', why: '계산 중 오류' },
    ...(safe(() => otherCareer(results)) ?? {}),
  };
  for (const id of SYSTEM_IDS) {
    if (!out[id]) out[id] = { status: 'unavailable', why: '이번 계산에서 값이 나오지 않았다' };
  }
  return out;
}
