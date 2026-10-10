/**
 * domains.js — **열두 분야**를 열다섯 체계로 읽는다
 *
 * 직업 하나를 깊게 판 뒤, 같은 방법을 나머지 열한 분야로 넓힌 층이다.
 *
 *   personality  기질        career     직업        relationship 관계
 *   marriage     결혼        children   자녀        education    학업
 *   wealth       재물        residence  주거        movement     이동
 *   health       건강        majorChange 큰 전환    timing       시기
 *
 * ── 두 가지 근거를 쓴다 ────────────────────────────────────
 *   SEAT      그 전통에 그 분야를 보는 **전용 자리**가 있는 경우.
 *             자미 부처궁, 사주 식상, 점성 7하우스, 베딕 D7 같은 것.
 *             `direct` 로 센다.
 *   NATURE    전용 자리가 없는 경우. 기호의 **물상**을 그 분야로 옮긴다.
 *             坎(물)은 관계에서 '감추는 인연', 이동에서 '자주 옮김'이다.
 *             `indirect` 또는 `weak` 로 센다.
 *
 * 전용 자리가 있으면 그쪽이 이긴다. 물상은 **빈칸을 메우는 자리**다.
 *
 * ── 건강 ──────────────────────────────────────────────────
 * 질환명·수술 여부를 만들지 않는다. 전통이 말하는 '몸에 실리는 부담'까지다.
 *
 * ── 시기 ──────────────────────────────────────────────────
 * 여기서 **연도를 말하지 않는다.** 그 전통이 시기를 보는 장치를 가졌는지,
 * 기운이 앞쪽에 실리는지 뒤쪽에 실리는지까지다. 실제 연도 계산은 LEVEL 7.
 */

import { AXES, zero, round3, isEmpty } from './axes.js';
import { makeRule, specificityOf, EVIDENCE_WEIGHT } from './rules.js';
import { SYSTEM_IDS, SYSTEM_NAME } from './extract.js';
import { lineageOf } from './lineage.js';
import * as NA from './tables/nature.js';
import * as ZI from './tables/ziwei.js';
import * as SA from './tables/saju.js';
import * as WE from './tables/western.js';
import * as VE from './tables/vedic.js';

import * as ZE from '../hires/ziweiExt.js';
import * as VEX from '../hires/vedicExt.js';
import * as WS from '../hires/western.js';
import * as IN from '../hires/interpret.js';
import { DOMICILE } from '../hires/classical.js';
import { houseOf } from '../core/planets.js';
import { tenGod, elementDistribution, STEM_ELEMENT, MAIN_HIDDEN, BRANCHES } from '../core/ganzhi.js';

export const DOMAINS = [
  'personality', 'career', 'relationship', 'marriage', 'children',
  'education', 'wealth', 'residence', 'movement', 'health',
  'majorChange', 'timing',
];

export const DOMAIN_LABEL = {
  personality: '기질', career: '직업', relationship: '관계', marriage: '결혼',
  children: '자녀', education: '학업', wealth: '재물', residence: '주거',
  movement: '이동', health: '건강', majorChange: '큰 전환', timing: '시기',
};

const safe = (fn) => { try { return fn(); } catch { return null; } };
const signOf = (lon) => Math.floor((((lon % 360) + 360) % 360) / 30);
const hit = (condition, basis, group, weight = 1) => ({ condition, basis, group, weight });

// ═════════════════════════════════════════════════════════════
// 1. 규칙 등록소 — 분야별
// ═════════════════════════════════════════════════════════════

const rules = [];

/**
 * 규칙을 등록한다. **축이 하나도 안 남으면 등록하지 않는다.**
 *
 * 주거와 이동을 다른 분야로 가른 뒤, 옛 전택궁 표의 `mobile` 항목들이
 * 주거 축에 없어 빈 껍데기가 됐다 (전택궁 천기·파군·칠살). 그것은
 * "전택궁에 천기가 들면 주거에 대해 말하지 않고 **이동**에 대해 말한다"는
 * 뜻이므로, 빈 규칙을 만들지 않고 이동 표가 맡게 둔다.
 */
const push = (o) => {
  const r = makeRule(o);
  if (Object.keys(r.features).length) rules.push(r);
};

/** 명시적인 분야별 표 — 전용 자리가 있는 곳 */
const EXPLICIT = {
  jamidusu: {
    personality: { table: ZI.PERSONALITY, prefix: 'star', where: '원국 명궁', ts: 0.85 },
    marriage: { table: ZI.MARRIAGE, prefix: 'star', where: '원국 부처궁', ts: 0.9 },
    majorChange: { table: ZI.MAJOR_CHANGE, prefix: 'star', where: '원국 명궁·천이궁 (살파랑)', ts: 0.7 },
    movement: { table: ZI.MOVEMENT, prefix: 'star', where: '원국 천이궁', ts: 0.8 },
    relationship: { table: ZI.RELATIONSHIP, prefix: 'spouse', where: '원국 부처궁', ts: 0.9 },
    children: { table: ZI.CHILDREN, prefix: 'child', where: '원국 자녀궁', ts: 0.85 },
    residence: { table: ZI.RESIDENCE, prefix: 'home', where: '원국 전택궁', ts: 0.8 },
    wealth: { table: ZI.WEALTH, prefix: 'money', where: '원국 재백궁', ts: 0.9 },
    education: { table: ZI.EDUCATION, prefix: 'study', where: '원국 관록궁·자녀궁', ts: 0.7 },
    health: { table: ZI.HEALTH, prefix: 'ill', where: '원국 질액궁', ts: 0.8 },
  },
  saju: {
    personality: { table: SA.PERSONALITY, prefix: 'god', where: '일간과 십성', ts: 0.85 },
    marriage: { table: SA.MARRIAGE, prefix: 'god', where: '배우자 십성과 일지', ts: 0.85 },
    majorChange: { table: SA.MAJOR_CHANGE, prefix: 'god', where: '비겁·식상 vs 관성·인성', ts: 0.7 },
    movement: { table: SA.MOVEMENT, prefix: 'god', where: '역마와 십성', ts: 0.75 },
    relationship: { table: SA.RELATIONSHIP, prefix: 'god', where: '배우자 십성', ts: 0.85 },
    children: { table: SA.CHILDREN, prefix: 'god', where: '식상 (자식의 자리)', ts: 0.85 },
    education: { table: SA.EDUCATION, prefix: 'god', where: '인성 (문서·학문의 자리)', ts: 0.85 },
    wealth: { table: SA.WEALTH, prefix: 'god', where: '재성 (재물의 자리)', ts: 0.85 },
    residence: { table: SA.RESIDENCE, prefix: 'god', where: '인성·역마', ts: 0.7 },
    health: { table: SA.HEALTH, prefix: 'god', where: '십성과 오행 편중', ts: 0.7 },
  },
  astrology: {
    relationship: { signTable: WE.SIGN_RELATIONSHIP, planetTable: WE.PLANET_RELATIONSHIP,
      signPrefix: 'seventhSign', planetPrefix: 'seventhIn', where: '7하우스', ts: 0.9 },
    children: { planetTable: WE.PLANET_CHILDREN, planetPrefix: 'fifthIn', where: '5하우스', ts: 0.8 },
    wealth: { planetTable: WE.PLANET_WEALTH, planetPrefix: 'secondIn', where: '2하우스', ts: 0.85 },
    residence: { signTable: WE.SIGN_RESIDENCE, signPrefix: 'fourthSign', where: '4하우스', ts: 0.8 },
    health: { planetTable: WE.PLANET_HEALTH, planetPrefix: 'sixthIn', where: '6하우스', ts: 0.75 },
  },
  vedic: {
    relationship: { planetTable: VE.PLANET_RELATIONSHIP, planetPrefix: 'seventh', where: 'D1 7궁·D9', ts: 0.85 },
    children: { planetTable: VE.PLANET_CHILDREN, planetPrefix: 'fifth', where: 'D1 5궁·D7', ts: 0.8 },
    education: { planetTable: VE.PLANET_EDUCATION, planetPrefix: 'study', where: 'D1 4·5·9궁', ts: 0.8 },
    wealth: { planetTable: VE.PLANET_WEALTH, planetPrefix: 'wealth', where: 'D1 2·11궁·D2', ts: 0.85 },
    residence: { planetTable: VE.PLANET_RESIDENCE, planetPrefix: 'home', where: 'D1 4궁·D4', ts: 0.8 },
    health: { planetTable: VE.PLANET_HEALTH, planetPrefix: 'ill', where: 'D1 6궁', ts: 0.75 },
  },
};

for (const [system, byDomain] of Object.entries(EXPLICIT)) {
  for (const [domain, def] of Object.entries(byDomain)) {
    for (const [sym, f] of Object.entries(def.table ?? {})) {
      push({ system, domain, condition: `${def.prefix}:${sym}`, symbol: sym, features: f,
        where: def.where, evidenceType: 'direct', traditionalStrength: def.ts });
    }
    (def.signTable ?? []).forEach((f, i) => {
      push({ system, domain, condition: `${def.signPrefix}:${i}`, symbol: i, features: f,
        where: def.where, evidenceType: 'direct', traditionalStrength: def.ts });
    });
    for (const [p, f] of Object.entries(def.planetTable ?? {})) {
      push({ system, domain, condition: `${def.planetPrefix}:${p}`, symbol: p, features: f,
        where: def.where, evidenceType: 'direct', traditionalStrength: def.ts });
    }
  }
}

/** 물상으로 채우는 자리 — 체계 × 물상표 × 증거 등급 */
const NATURE_SOURCE = {
  saju: { table: NA.TEN_GOD_NATURE, prefix: 'god', where: '십성의 물상', et: 'indirect', ts: 0.7 },
  jamidusu: { table: NA.ZIWEI_STAR_NATURE, prefix: 'star', where: '주성의 물상', et: 'indirect', ts: 0.7 },
  astrology: { table: NA.SIGN_NATURE, prefix: 'sign', where: '사인의 물상', et: 'indirect', ts: 0.65 },
  vedic: { table: NA.PLANET_NATURE, prefix: 'planet', where: '행성 카라카의 물상', et: 'indirect', ts: 0.65 },
  juyeok: { table: NA.TRIGRAM_NATURE, prefix: 'symbol', where: '괘의 물상', et: 'indirect', ts: 0.5 },
  taeeul: { table: NA.TRIGRAM_NATURE, prefix: 'symbol', where: '태을궁 물상', et: 'indirect', ts: 0.45 },
  tojeong: { table: NA.TRIGRAM_NATURE, prefix: 'symbol', where: '상괘 물상', et: 'indirect', ts: 0.45 },
  gujeong: { table: NA.NINE_STAR_NATURE, prefix: 'symbol', where: '구성의 물상', et: 'indirect', ts: 0.55 },
  yukim: { table: NA.GENERAL_NATURE, prefix: 'symbol', where: '천장의 물상', et: 'indirect', ts: 0.55 },
  hongguk: { table: NA.GATE_NATURE, prefix: 'gate', where: '팔문의 물상', et: 'indirect', ts: 0.6 },
  kabbalah: { table: NA.NUMBER_NATURE, prefix: 'symbol', where: '수의 물상', et: 'weak', ts: 0.4 },
  sukyo: { table: NA.WEEKDAY_NATURE, prefix: 'symbol', where: '칠요의 물상', et: 'weak', ts: 0.4 },
  thai: { table: NA.WEEKDAY_NATURE, prefix: 'symbol', where: '요일 행성의 물상', et: 'weak', ts: 0.35 },
  mahabote: { table: NA.MAHABOTE_NATURE, prefix: 'symbol', where: '자리의 물상', et: 'weak', ts: 0.35 },
  tarot: { table: NA.TAROT_NATURE, prefix: 'symbol', where: '생일 카드의 물상', et: 'weak', ts: 0.35 },
};

/**
 * 물상으로 채우되 **전용 자리가 있는** 칸.
 *
 * 점성의 7하우스는 결혼을 보는 전용 자리이고 상승점은 기질을 보는
 * 전용 자리다. 표를 물상으로 만들었다고 해서 간접 증거인 것은 아니다 —
 * **자리가 전용이면 직접 증거**다. 자리와 표를 헷갈리지 않는다.
 */
const DIRECT_SEATS = new Set([
  // 점성 — 상승점(기질) · 7하우스(결혼) · 3·9·12하우스(이동) · 8하우스(전환)
  //        3·9하우스(학업) · 프로펙션과 트랜싯(시기)
  'astrology.personality', 'astrology.marriage', 'astrology.movement',
  'astrology.majorChange', 'astrology.education', 'astrology.timing',
  // 베딕 — 라그나 · D9 · 3·9·12궁 · 8궁 · 빔쇼타리 다샤
  'vedic.personality', 'vedic.marriage', 'vedic.movement',
  'vedic.majorChange', 'vedic.timing',
  // 시기를 보는 전용 장치 — 사주 대운 · 자미 대한
  'saju.timing', 'jamidusu.timing',
]);

/** 어느 체계 × 분야가 물상으로 채워졌는지 — coverage 표가 쓴다 */
export const NATURE_FILLED = new Set();

for (const [system, src] of Object.entries(NATURE_SOURCE)) {
  const entries = Array.isArray(src.table)
    ? src.table.map((traits, i) => [i, traits])
    : Object.entries(src.table);
  for (const domain of DOMAINS) {
    if (domain === 'career') continue;                      // 직업은 명시 표가 따로 있다
    if (EXPLICIT[system]?.[domain]) continue;               // 전용 자리가 있으면 그쪽
    if (!NA.PROJECTION[domain]) continue;
    let made = 0;
    for (const [sym, traits] of entries) {
      const f = NA.projectNature(traits, domain);
      if (!f) continue;
      const seated = DIRECT_SEATS.has(`${system}.${domain}`);
      push({ system, domain, condition: `${src.prefix}:${sym}`, symbol: sym, features: f,
        where: seated ? `${src.where} (전용 자리)` : src.where,
        evidenceType: seated ? 'direct' : src.et,
        traditionalStrength: seated ? Math.min(0.85, src.ts + 0.2) : src.ts,
        note: `물상 ${traits.join('·')}`, source: 'nature' });
      made++;
    }
    if (made) NATURE_FILLED.add(`${system}.${domain}`);
  }
}

export const DOMAIN_RULES = rules;
const INDEX = new Map(rules.map((r) => [r.id, r]));
export const domainRuleFor = (system, domain, condition) =>
  INDEX.get(`${system}|${domain}|${condition}`) ?? null;

/** 체계 × 분야의 표 평균 — 편차 중심화가 쓴다 */
export const DOMAIN_TABLE_MEAN = (() => {
  const acc = {};
  for (const r of rules) {
    ((acc[r.system] ??= {})[r.domain] ??= []).push(r.features);
  }
  const out = {};
  for (const [sys, byDom] of Object.entries(acc)) {
    out[sys] = {};
    for (const [dom, list] of Object.entries(byDom)) {
      const m = {};
      for (const ax of AXES[dom] ?? []) {
        m[ax] = list.reduce((a, f) => a + (f[ax] ?? 0), 0) / list.length;
      }
      out[sys][dom] = m;
    }
  }
  return out;
})();

// ═════════════════════════════════════════════════════════════
// 2. 재료 모으기 — 한 번만 계산한다
// ═════════════════════════════════════════════════════════════

const MAIN_STARS = new Set(Object.keys(ZI.CAREER));

function ziweiPalaces(input, stack) {
  if (!stack) return null;
  const board = stack.board?.board ?? null;
  const want = {
    관록궁: '직업', 명궁: '직업', 재백궁: '재물', 천이궁: '이사',
    부처궁: '결혼', 자녀궁: '자녀', 전택궁: '주거', 질액궁: '건강', 복덕궁: '관계',
  };
  const out = {};
  for (const [palace, domain] of Object.entries(want)) {
    const rows = safe(() => ZE.domainPalaces(input, domain, stack.layers)) ?? [];
    const row = rows.find((x) => x.palace === palace)?.rows?.find((r) => /원국/.test(r.layer ?? ''));
    if (!row) continue;
    let main = (row.main ?? []).filter((s) => MAIN_STARS.has(s));
    let borrowed = false;
    if (!main.length && row.branch != null && board) {
      const opp = ZE.trineSquare(row.branch).opposite;
      if (board[opp]) { main = board[opp].filter((s) => MAIN_STARS.has(s)); borrowed = main.length > 0; }
    }
    out[palace] = { ...row, main, borrowed };
  }
  return out;
}

const GUK_NAMES = { 2: '수이국', 3: '목삼국', 4: '금사국', 5: '토오국', 6: '화육국' };

function sajuFacts(chart) {
  if (!chart?.pillars?.month) return null;
  const stemGods = {};
  for (const k of ['year', 'month', 'hour']) {
    const p = chart.pillars[k];
    if (!p) continue;
    const g = tenGod(chart.dayStem, p.stem);
    if (g) stemGods[g] = (stemGods[g] ?? 0) + 1;
  }
  const branchGods = {};
  for (const k of ['year', 'month', 'day', 'hour']) {
    const p = chart.pillars[k];
    if (!p) continue;
    const main = MAIN_HIDDEN?.[p.branch];
    const g = main != null ? tenGod(chart.dayStem, main) : null;
    if (g) branchGods[g] = (branchGods[g] ?? 0) + 1;
  }
  const monthMain = MAIN_HIDDEN?.[chart.pillars.month.branch];
  const dist = elementDistribution(chart.pillars);
  const YEOKMA = [2, 5, 8, 11];
  const yeokma = ['year', 'month', 'day', 'hour']
    .filter((k) => chart.pillars[k] && YEOKMA.includes(chart.pillars[k].branch)).length;
  return {
    stemGods, branchGods,
    monthGod: monthMain != null ? tenGod(chart.dayStem, monthMain) : null,
    dayElement: STEM_ELEMENT?.[chart.pillars.day.stem] ?? null,
    dayBranchGod: (() => {
      const m = MAIN_HIDDEN?.[chart.pillars.day.branch];
      return m != null ? tenGod(chart.dayStem, m) : null;
    })(),
    elementSpread: dist ? Math.max(...dist.pct) - Math.min(...dist.pct) : null,
    yeokma,
    // 모든 십성을 개수와 함께 — 분야별로 필요한 것만 꺼내 쓴다
    all: (() => {
      const a = { ...stemGods };
      for (const [g, n] of Object.entries(branchGods)) a[g] = (a[g] ?? 0) + n * 0.6;
      return a;
    })(),
  };
}

function westernFacts(input) {
  if (!input?.timeKnown) return null;
  const N = safe(() => WS.natalPack(input));
  if (!N?.cusps) return null;
  const inHouse = (n) => Object.entries(N.pos)
    .filter(([, v]) => houseOf(v.lon, N.cusps) === n).map(([k]) => k);
  const sign = (n) => signOf(N.cusps[n]);
  return {
    N, inHouse, sign,
    asc: sign(1), mc: sign(10),
    lordOf: (n) => DOMICILE[sign(n)] ?? null,
    houseOfPlanet: (p) => (N.pos?.[p] ? houseOf(N.pos[p].lon, N.cusps) : null),
    signOfPlanet: (p) => (N.pos?.[p] ? signOf(N.pos[p].lon) : null),
  };
}

function vedicFacts(input) {
  const d1 = safe(() => VEX.chart(input, 'D1'));
  if (!d1) return null;
  return {
    d1,
    karakas: safe(() => VEX.charaKarakas(input)),
    marriage: safe(() => VEX.marriagePack(input)),
    children: safe(() => VEX.childrenPack(input)),
    wealth: safe(() => VEX.wealthPack(input)),
    home: safe(() => VEX.homePack(input)),
  };
}

/** 나머지 열한 체계의 대표 기호 — extract.js 와 같은 자리를 읽는다 */
function otherSymbols(results) {
  const by = Object.fromEntries((results ?? []).map((r) => [r.id ?? r.name, r]));
  const factOf = (a, label) => (a?.facts ?? []).find((f) => f.label === label)?.value ?? null;
  const head = (a) => String(a?.headline ?? '');
  const GUA = /[乾兌離震巽坎艮坤]/;
  const out = {};

  const jy = by.juyeok;
  if (jy) out.juyeok = [String(factOf(jy, '상괘') ?? '').match(GUA)?.[0], String(factOf(jy, '하괘') ?? '').match(GUA)?.[0]].filter(Boolean);

  const ym = by.yukim;
  if (ym) {
    const TJ = /(귀인|등사|주작|육합|구진|청룡|천공|백호|태상|현무|태음|천후)/;
    out.yukim = ['초전', '중전', '말전'].map((l) => String(factOf(ym, l) ?? '').match(TJ)?.[1]).filter(Boolean);
  }
  const hg = by.hongguk;
  if (hg) {
    const cell = String(factOf(hg, '내 궁') ?? '') + ' ' + head(hg);
    out.hongguk = [cell.match(/(휴문|생문|상문|두문|경문|사문|개문)/)?.[1]].filter(Boolean);
  }
  const te = by.taeeul;
  if (te) {
    const g = String(factOf(te, '태을궁') ?? '').match(/[離坎坤震巽乾兌艮中]/)?.[0];
    out.taeeul = [g === '中' ? '坤' : g].filter(Boolean);
  }
  const gj = by.gujeong;
  if (gj) {
    const NS = /(일백|이흑|삼벽|사록|오황|육백|칠적|팔백|구자)/;
    const H = { 一白: '일백', 二黑: '이흑', 三碧: '삼벽', 四綠: '사록', 五黃: '오황', 六白: '육백', 七赤: '칠적', 八白: '팔백', 九紫: '구자' };
    const pick = (l) => { const v = String(factOf(gj, l) ?? ''); return v.match(NS)?.[1] ?? H[v.slice(0, 2)] ?? null; };
    out.gujeong = [pick('본명성') ?? head(gj).match(NS)?.[1], pick('월명성')].filter(Boolean);
  }
  const sk = by.sukyo;
  if (sk) {
    const m = head(sk).match(/([角亢氐房心尾箕斗牛女虛危室壁奎婁胃昴畢觜參井鬼柳星張翼軫])宿/);
    out.sukyo = [IN.SUKYO_YO?.[m?.[1]]].filter(Boolean);
  }
  const tj = by.tojeong;
  if (tj) {
    const T = { 1: '乾', 2: '兌', 3: '離', 4: '震', 5: '巽', 6: '坎', 7: '艮', 8: '坤' };
    out.tojeong = [T[Number(factOf(tj, '상괘'))]].filter(Boolean);
  }
  const kb = by.kabbalah;
  if (kb) {
    out.kabbalah = [Number(head(kb).match(/라이프 패스\s*(\d+)/)?.[1]), Number(factOf(kb, '생일수'))]
      .filter((n) => Number.isFinite(n) && NA.NUMBER_NATURE[n]);
  }
  const mh = by.mahabote;
  if (mh) {
    const S = /(빈가|아하|야자|아디|마라나|푸티|타트)/;
    out.mahabote = [head(mh).match(S)?.[1] ?? String(factOf(mh, '내 자리') ?? '').match(S)?.[1]].filter(Boolean);
  }
  const th = by.thai;
  if (th) out.thai = [String(factOf(th, '태어난 요일') ?? head(th)).match(/[일월화수목금토]요일/)?.[0]].filter(Boolean);
  const tr = by.tarot;
  if (tr) out.tarot = [String(factOf(tr, '생일 카드') ?? '').replace(/^\d+\.\s*/, '').trim()].filter(Boolean);

  return out;
}

export function gather(fortune, stack) {
  return {
    saju: safe(() => sajuFacts(fortune.chart)),
    ziwei: safe(() => ziweiPalaces(fortune.input, stack)),
    guk: GUK_NAMES[stack?.board?.guk?.n] ?? null,
    western: safe(() => westernFacts(fortune.input)),
    vedic: safe(() => vedicFacts(fortune.input)),
    others: safe(() => otherSymbols(fortune.results)) ?? {},
    gender: fortune.input?.gender ?? null,
    timeKnown: Boolean(fortune.input?.timeKnown),
  };
}

// ═════════════════════════════════════════════════════════════
// 3. 분야별 근거 뽑기
// ═════════════════════════════════════════════════════════════

/** 자미 — 분야마다 볼 궁 (전통 배당) */
const ZIWEI_SEAT = {
  personality: [['명궁', 'star', 1], ['복덕궁', 'star', 0.6]],
  relationship: [['부처궁', 'spouse', 1], ['복덕궁', 'star', 0.5]],
  marriage: [['부처궁', 'star', 1], ['명궁', 'star', 0.5]],
  children: [['자녀궁', 'child', 1]],
  education: [['관록궁', 'study', 1], ['자녀궁', 'study', 0.6]],
  wealth: [['재백궁', 'money', 1], ['전택궁', 'star', 0.5]],
  residence: [['전택궁', 'home', 1]],
  movement: [['천이궁', 'star', 1], ['명궁', 'star', 0.4]],
  health: [['질액궁', 'ill', 1]],
  majorChange: [['명궁', 'star', 1], ['천이궁', 'star', 0.7]],
  timing: [['명궁', 'star', 0.6]],
};

/** 배우자의 십성 — 여자는 관성 계열, 남자는 재성 계열 */
const SPOUSE_GODS = { female: ['정관', '편관'], male: ['정재', '편재'] };

/** 사주 — 분야마다 볼 십성 (명리 표준 배당) */
const SAJU_SEAT = {
  personality: null,                                  // 십성 전체를 쓴다
  // 여자는 관성, 남자는 재성을 배우자로 본다 (명리 표준).
  // 무리 이름이 아니라 **십성 낱낱**으로 적는다 — 표가 정관·편관을
  // 다르게 읽으므로 '관성' 한 덩어리로 찾으면 규칙에 닿지 않는다.
  relationship: (f, g) => SPOUSE_GODS[g] ?? [],
  marriage: (f, g) => [...(SPOUSE_GODS[g] ?? []), f.dayBranchGod].filter(Boolean),
  children: () => ['식신', '상관'],
  education: () => ['정인', '편인'],
  wealth: () => ['정재', '편재', '식신', '상관', '비견', '겁재'],
  residence: () => ['정인', '편인', '정재'],
  movement: null,
  health: () => ['편관', '상관', '겁재', '편인'],
  majorChange: null,
  timing: null,
};

function pushHits(list, arr) { for (const h of arr) if (h) list.push(h); }

/**
 * 한 분야에 대해 체계별 근거를 뽑는다.
 * @returns {Record<string, {status, hits?, facts?, why?}>}
 */
export function extractDomain(raw, domain) {
  const out = {};
  const nat = (system, sym, group, w, basis) => {
    const src = NATURE_SOURCE[system];
    if (!src) return null;
    return hit(`${src.prefix}:${sym}`, basis, group, w);
  };

  // ── 사주 ──
  if (!raw.saju) out.saju = { status: 'unavailable', why: '월주를 세우지 못했다' };
  else {
    const hits = [];
    const seat = SAJU_SEAT[domain];
    const wanted = typeof seat === 'function' ? seat(raw.saju, raw.gender) : null;
    if (wanted) {
      for (const g of wanted) {
        const n = raw.saju.all[g] ?? 0;
        if (n > 0) hits.push(hit(`god:${g}`, `${g} ${n.toFixed(1)}개 — ${DOMAIN_LABEL[domain]}의 자리`, `god:${g}`, Math.min(1, 0.45 + n * 0.25)));
      }
      if (!wanted.some((g) => (raw.saju.all[g] ?? 0) > 0)) {
        // 그 십성이 아예 없는 것도 전통이 읽는 정보다
        hits.push(hit(`god:${wanted[0]}`, `${wanted[0]}이 원국에 없다 — 자리가 비었다`, 'absent', 0.35));
      }
    } else {
      // 전용 자리가 없는 분야는 십성 전체의 물상으로
      for (const [g, n] of Object.entries(raw.saju.all)) {
        pushHits(hits, [nat('saju', g, `god:${g}`, Math.min(1, 0.4 + n * 0.25), `천간·지지 ${g} ${n.toFixed(1)}개`)]);
      }
    }
    if (domain === 'movement' && raw.saju.yeokma) {
      hits.push(hit('god:편재', `역마 ${raw.saju.yeokma}개`, 'yeokma', Math.min(1, 0.4 + raw.saju.yeokma * 0.2)));
    }
    if (domain === 'health' && raw.saju.elementSpread != null) {
      const g = raw.saju.elementSpread >= 28 ? '편관' : '정인';
      hits.push(hit(`god:${g}`, `오행 편중 ${raw.saju.elementSpread.toFixed(1)}%p`, 'element', 0.6));
    }
    out.saju = hits.length ? { status: 'ok', hits } : { status: 'empty', why: '읽을 자리가 비었다' };
  }

  // ── 자미두수 ──
  if (!raw.ziwei) out.jamidusu = { status: 'unavailable', why: '출생 시각을 알아야 판을 세운다' };
  else {
    const hits = [];
    for (const [palace, prefix, w] of ZIWEI_SEAT[domain] ?? []) {
      const row = raw.ziwei[palace];
      for (const s of row?.main ?? []) {
        const cond = prefix === 'star' ? `star:${s}` : `${prefix}:${s}`;
        hits.push(hit(cond, `원국 ${palace} ${s}${row.borrowed ? ' (대궁에서 빌림)' : ''}`, palace, w));
      }
      for (const s of row?.sihwa ?? []) {
        const kind = ['화록', '화권', '화과', '화기'].find((k) => String(s).endsWith(k));
        if (kind && domain === 'career') continue;
      }
    }
    if (raw.guk && domain === 'personality') {
      hits.push(hit(`star:${'자미'}`, `오행국 ${raw.guk}`, 'guk', 0.3));
    }
    out.jamidusu = hits.length ? { status: 'ok', hits } : { status: 'empty', why: '볼 궁이 비었다' };
  }

  // ── 점성술 ──
  if (!raw.western) out.astrology = { status: 'unavailable', why: '출생 시각을 알아야 하우스를 세운다' };
  else {
    const W = raw.western;
    const HOUSE = {
      personality: [1], relationship: [7, 5], marriage: [7], children: [5],
      education: [9, 3], wealth: [2, 8], residence: [4], movement: [3, 9, 12],
      health: [6, 1], majorChange: [1, 8], timing: [10],
    }[domain] ?? [];
    const hits = [];
    for (const h of HOUSE) {
      const s = W.sign(h);
      const exp = EXPLICIT.astrology?.[domain];
      // 전용 표가 있으면 그 표로, 없으면 물상으로
      if (exp?.signPrefix && h === HOUSE[0]) {
        hits.push(hit(`${exp.signPrefix}:${s}`, `${h}하우스 ${IN.SIGN_NAME[s]}`, `h${h}`, 1));
      } else {
        pushHits(hits, [nat('astrology', s, `h${h}`, h === HOUSE[0] ? 0.9 : 0.6, `${h}하우스 ${IN.SIGN_NAME[s]}`)]);
      }
      for (const p of W.inHouse(h)) {
        if (exp?.planetPrefix) hits.push(hit(`${exp.planetPrefix}:${p}`, `${h}하우스에 ${p}`, `h${h}`, 0.95));
        else pushHits(hits, [nat('astrology', W.signOfPlanet(p), `h${h}p`, 0.7, `${h}하우스에 ${p}`)]);
      }
      const lord = W.lordOf(h);
      if (lord) {
        const lh = W.houseOfPlanet(lord);
        pushHits(hits, [nat('astrology', W.signOfPlanet(lord), `h${h}lord`, 0.7,
          `${h}하우스 주인 ${lord}${lh ? ` → ${lh}하우스` : ''}`)]);
      }
    }
    if (domain === 'personality') {
      pushHits(hits, [nat('astrology', W.signOfPlanet('태양'), 'sun', 0.8, `태양 ${IN.SIGN_NAME[W.signOfPlanet('태양')]}`)]);
      pushHits(hits, [nat('astrology', W.signOfPlanet('달'), 'moon', 0.8, `달 ${IN.SIGN_NAME[W.signOfPlanet('달')]}`)]);
    }
    out.astrology = hits.length ? { status: 'ok', hits } : { status: 'empty', why: '볼 하우스가 없다' };
  }

  // ── 베딕 ──
  if (!raw.vedic?.d1) out.vedic = { status: 'unavailable', why: '차트를 세우지 못했다' };
  else {
    const V = raw.vedic, d1 = V.d1;
    const HOUSE = {
      personality: [1], relationship: [7, 5], marriage: [7], children: [5],
      education: [4, 5, 9], wealth: [2, 11], residence: [4], movement: [3, 9, 12],
      health: [6], majorChange: [8, 1], timing: [10],
    }[domain] ?? [];
    const exp = EXPLICIT.vedic?.[domain];
    const hits = [];
    for (const h of HOUSE) {
      const l = safe(() => d1.lordOf(h));
      if (l?.lord) {
        if (exp?.planetPrefix) hits.push(hit(`${exp.planetPrefix}:${l.lord}`, `D1 ${h}궁주 ${l.lord}`, `h${h}`, h === HOUSE[0] ? 1 : 0.7));
        else pushHits(hits, [nat('vedic', l.lord, `h${h}`, h === HOUSE[0] ? 0.9 : 0.6, `D1 ${h}궁주 ${l.lord}`)]);
      }
      for (const p of safe(() => d1.inHouse(h)) ?? []) {
        if (exp?.planetPrefix) hits.push(hit(`${exp.planetPrefix}:${p}`, `D1 ${h}궁에 ${p}`, `h${h}p`, 0.85));
        else pushHits(hits, [nat('vedic', p, `h${h}p`, 0.7, `D1 ${h}궁에 ${p}`)]);
      }
    }
    // 카라카 — 분야마다 지정된 것이 다르다 (BPHS)
    const KARAKA = { relationship: '다라카라카', marriage: '다라카라카', children: '푸트라카라카',
      personality: '아트마카라카', career: '아마탸카라카', wealth: '아마탸카라카' }[domain];
    const kp = V.karakas?.all?.[KARAKA]?.planet ?? (KARAKA === '아트마카라카' ? V.karakas?.atmakaraka?.planet : null);
    if (kp) {
      if (exp?.planetPrefix) hits.push(hit(`${exp.planetPrefix}:${kp}`, `${KARAKA} ${kp}`, 'karaka', 0.8));
      else pushHits(hits, [nat('vedic', kp, 'karaka', 0.75, `${KARAKA} ${kp}`)]);
    }
    out.vedic = hits.length ? { status: 'ok', hits } : { status: 'empty', why: '볼 궁이 없다' };
  }

  // ── 나머지 열한 체계 — 물상으로 ──
  for (const [system, syms] of Object.entries(raw.others)) {
    const src = NATURE_SOURCE[system];
    if (!src || !syms?.length) { out[system] ??= { status: 'unavailable', why: '기호를 집어내지 못했다' }; continue; }
    const hits = [];
    syms.forEach((s, i) => {
      const traits = Array.isArray(src.table) ? src.table[s] : src.table[s];
      if (!traits) return;
      hits.push(hit(`${src.prefix}:${s}`, `${src.where} ${s} (물상 ${traits.join('·')})`, `sym${i}`, i === 0 ? 1 : 0.8));
    });
    out[system] = hits.length ? { status: 'ok', hits } : { status: 'empty', why: '물상표에 없는 기호' };
  }

  for (const id of SYSTEM_IDS) {
    if (!out[id]) out[id] = { status: 'unavailable', why: '이번 계산에서 값이 나오지 않았다' };
  }
  return out;
}

// ═════════════════════════════════════════════════════════════
// 4. 체계별 해석 — 직업과 같은 방식 (묶음 → 포화 → noisy-OR)
// ═════════════════════════════════════════════════════════════

function noisyOr(domain, contributions) {
  const acc = Object.fromEntries((AXES[domain] ?? []).map((k) => [k, 1]));
  for (const { features, weight } of contributions) {
    for (const [k, v] of Object.entries(features)) {
      if (!(k in acc)) continue;
      acc[k] *= (1 - Math.max(0, Math.min(0.95, v * weight)));
    }
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, 1 - v]));
}

export function interpretOne(systemId, domain, read) {
  const base = { system: systemId, systemName: SYSTEM_NAME[systemId], lineage: lineageOf(systemId), domain };
  if (read.status !== 'ok') return { ...base, status: read.status, why: read.why, features: null, evidence: [] };

  const groups = new Map();
  const evidence = [];
  const missing = [];
  let bestType = 'weak';
  let stSum = 0, spSum = 0, n = 0;

  for (const h of read.hits) {
    const rule = domainRuleFor(systemId, domain, h.condition);
    if (!rule) { missing.push(h.condition); continue; }
    const w = h.weight * EVIDENCE_WEIGHT[rule.evidenceType] * rule.traditionalStrength;
    const g = h.group ?? rule.where ?? 'default';
    const acc = groups.get(g) ?? zero(domain);
    for (const [k, v] of Object.entries(rule.features)) {
      if (!(k in acc)) continue;
      acc[k] = Math.max(acc[k], v * w);
    }
    groups.set(g, acc);
    evidence.push({
      rule: rule.id, source: rule.where, value: String(rule.symbol), basis: h.basis, group: g,
      evidenceType: rule.evidenceType, traditionalStrength: rule.traditionalStrength,
      specificity: rule.specificity, contribution: rule.features,
      nature: rule.note ?? null, kind: rule.source,
      weight: Math.round(w * 1000) / 1000,
    });
    if (rule.evidenceType === 'direct') bestType = 'direct';
    else if (rule.evidenceType === 'indirect' && bestType !== 'direct') bestType = 'indirect';
    stSum += rule.traditionalStrength; spSum += rule.specificity; n++;
  }

  if (!groups.size) {
    return { ...base, status: 'empty',
      why: missing.length ? `규칙표에 없는 기호: ${missing.slice(0, 3).join('·')}` : '축으로 옮길 근거가 없다',
      features: null, evidence };
  }

  // 정보량 불균형 보정 — 묶음 수의 제곱근으로 나눈다
  const scale = 1 / Math.sqrt(groups.size);
  const features = round3(noisyOr(domain, [...groups.values()].map((f) => ({ features: f, weight: scale }))));
  if (isEmpty(features)) return { ...base, status: 'empty', why: '모든 축이 0', features: null, evidence };

  return {
    ...base, status: 'ok', features, evidence, evidenceType: bestType,
    groupCount: groups.size,
    confidence: Math.round(((stSum / n) * (0.5 + 0.5 * (spSum / n)) * EVIDENCE_WEIGHT[bestType]) * 1000) / 1000,
  };
}

/** 한 사람 × 한 분야 × 열다섯 체계 */
export function interpretDomain(raw, domain) {
  const reads = extractDomain(raw, domain);
  return SYSTEM_IDS.map((id) => interpretOne(id, domain, reads[id]));
}

// ═════════════════════════════════════════════════════════════
// 5. 커버리지 — 어느 체계가 어느 분야를 얼마나 읽는가
// ═════════════════════════════════════════════════════════════

/**
 * 규칙 등록소에서 바로 센다. 문서와 코드가 갈라질 수 없다.
 *
 *   ◎ 전용 자리 + 규칙 여럿      ○ 전용 자리
 *   △ 물상으로만                — 말하지 않는다
 */
export function coverage() {
  const out = {};
  for (const id of SYSTEM_IDS) {
    out[id] = {};
    for (const domain of DOMAINS) {
      const rs = domain === 'career'
        ? null                                   // 직업은 rules.js 쪽 등록소
        : DOMAIN_RULES.filter((r) => r.system === id && r.domain === domain);
      if (rs == null) { out[id][domain] = null; continue; }
      const direct = rs.filter((r) => r.evidenceType === 'direct').length;
      const total = rs.length;
      const mark = !total ? '—' : direct >= 10 ? '◎' : direct > 0 ? '○' : '△';
      out[id][domain] = { mark, total, direct, where: [...new Set(rs.map((r) => r.where))] };
    }
  }
  return out;
}
