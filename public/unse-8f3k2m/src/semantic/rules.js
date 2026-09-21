/**
 * rules.js — **해석 규칙 등록소**
 *
 * 규칙 하나는 이렇게 생겼다.
 *
 *   {
 *     id, system, lineage, domain, condition, symbol,
 *     features: { technical: 0.72, ... },
 *     evidenceType: 'direct' | 'indirect' | 'weak',
 *     traditionalStrength: 0~1,   전통이 이 자리를 이 뜻으로 지정한 강도
 *     specificity: 0~1,           얼마나 좁게 말하는가 (자동 계산)
 *     empiricalSupport: 0~1,      실제 사례가 뒷받침하는 정도
 *     sampleSize, provisional
 *   }
 *
 * ── specificity 를 자동으로 재는 이유 ──────────────────────
 * 손으로 매기면 "내가 믿는 규칙"에 높은 값을 주게 된다. 대신 벡터의
 * 모양에서 잰다 — 축 몇 개를 세게 가리키면 좁은 것이고, 모든 축을
 * 고루 조금씩 건드리면 넓은 것이다. 정규화 엔트로피로 잰다.
 *
 *   specificity = 1 − H(p) / H_max
 *
 * 넓게 말하는 규칙은 이 값이 낮아서 **저절로 무게가 깎인다.**
 *
 * ── empiricalSupport ───────────────────────────────────────
 * 실제 사례에서 그 규칙이 실린 사람들의 속성 유사도 평균이다.
 * `calibration.js` 가 채워 넣고, 없으면 `null` 이며 `provisional: true` 다.
 * **사례가 적다고 0 으로 만들지 않는다** — 모르는 것과 나쁜 것은 다르다.
 */

import * as ZI from './tables/ziwei.js';
import * as SA from './tables/saju.js';
import * as WE from './tables/western.js';
import * as VE from './tables/vedic.js';
import * as OT from './tables/others.js';
const { AUX_SYSTEMS } = OT;
import { lineageOf } from './lineage.js';
import { AXES } from './axes.js';

/** 증거 등급이 기여에 곱해지는 몫 */
export const EVIDENCE_WEIGHT = { direct: 1, indirect: 0.55, weak: 0.3 };

/**
 * 벡터가 얼마나 **좁게** 말하는가. 0~1, 높을수록 좁다.
 *
 * 축 하나만 1.0 이면 1 에 가깝고, 스무 축이 전부 같으면 0 이다.
 */
export function specificityOf(features, domain = 'career') {
  const n = AXES[domain]?.length ?? Object.keys(features).length;
  const vals = Object.values(features).filter((v) => v > 0);
  const sum = vals.reduce((a, b) => a + b, 0);
  if (!sum || vals.length <= 1) return 1;
  const p = vals.map((v) => v / sum);
  const H = -p.reduce((a, x) => a + x * Math.log(x), 0);
  const Hmax = Math.log(n);
  return Math.max(0, Math.min(1, 1 - H / Hmax));
}

const r3 = (v) => Math.round(v * 1000) / 1000;

/**
 * 규칙 하나를 만든다.
 * `empiricalSupport` 는 여기서 채우지 않는다 — calibration 이 나중에 얹는다.
 */
export function makeRule(o) {
  const features = Object.fromEntries(
    Object.entries(o.features).filter(([k]) => (AXES[o.domain] ?? []).includes(k)));
  return {
    id: `${o.system}|${o.domain}|${o.condition}`,
    system: o.system, lineage: lineageOf(o.system), domain: o.domain,
    condition: o.condition, symbol: o.symbol ?? o.condition,
    where: o.where ?? null,
    features,
    evidenceType: o.evidenceType ?? 'direct',
    traditionalStrength: o.traditionalStrength ?? 0.8,
    specificity: r3(specificityOf(features, o.domain)),
    empiricalSupport: null, sampleSize: 0, provisional: true,
    note: o.note ?? null,
    source: o.source ?? 'traditional',
  };
}

// ─────────────────────────────────────────────────────────────
// 직업 규칙 — 열다섯 체계
// ─────────────────────────────────────────────────────────────

const rules = [];
const push = (o) => { rules.push(makeRule({ domain: 'career', ...o })); };

// ── 자미두수 — 관록궁 주성 (직업 전용 자리) ──
for (const [star, f] of Object.entries(ZI.CAREER)) {
  push({ system: 'jamidusu', condition: `career:${star}`, symbol: star, features: f,
    where: '원국 관록궁', evidenceType: 'direct', traditionalStrength: 0.9 });
  // 명궁 — 타고난 결. 관록궁의 삼방이라 두수는 둘을 함께 본다
  push({ system: 'jamidusu', condition: `myeong:${star}`, symbol: star, features: f,
    where: '원국 명궁', evidenceType: 'direct', traditionalStrength: 0.8 });
  // 재백궁 — 돈이 들어오는 방식. 역시 관록궁의 삼방이다
  push({ system: 'jamidusu', condition: `money:${star}`, symbol: star, features: f,
    where: '원국 재백궁', evidenceType: 'indirect', traditionalStrength: 0.7 });
  // 천이궁 — 밖에 나가서 하는 일
  push({ system: 'jamidusu', condition: `travel:${star}`, symbol: star, features: f,
    where: '원국 천이궁', evidenceType: 'indirect', traditionalStrength: 0.6 });
}
for (const [guk, f] of Object.entries(OT.ZIWEI_GUK)) {
  push({ system: 'jamidusu', condition: `guk:${guk}`, symbol: guk, features: f,
    where: '오행국', evidenceType: 'weak', traditionalStrength: 0.45 });
}
// 보조성·사화 — 세기를 조절하는 몫
for (const [star, f] of Object.entries(ZI.AUX_MODIFIER)) {
  push({ system: 'jamidusu', condition: `aux:${star}`, symbol: star, features: f,
    where: '관록궁 보조성', evidenceType: 'indirect', traditionalStrength: 0.6 });
}
for (const [kind, f] of Object.entries(ZI.SIHWA_MODIFIER)) {
  push({ system: 'jamidusu', condition: `sihwa:${kind}`, symbol: kind, features: f,
    where: '관록궁 사화', evidenceType: 'indirect', traditionalStrength: 0.7 });
}

// ── 사주 — 십성 (격국의 자리) ──
for (const [god, f] of Object.entries(SA.CAREER)) {
  push({ system: 'saju', condition: `god:${god}`, symbol: god, features: f,
    where: '십성', evidenceType: 'direct', traditionalStrength: 0.85 });
}
SA.DAY_ELEMENT_CAREER.forEach((f, i) => {
  const name = ['목', '화', '토', '금', '수'][i];
  push({ system: 'saju', condition: `dayElement:${i}`, symbol: name,
    features: f, where: '일간 오행', evidenceType: 'indirect', traditionalStrength: 0.6 });
  // 원국에서 가장 두터운 기운 — 일간과 다를 수 있다
  push({ system: 'saju', condition: `elementTop:${i}`, symbol: name,
    features: f, where: '원국 최강 오행', evidenceType: 'indirect', traditionalStrength: 0.55 });
});

// ── 서양 — MC 사인 · MC 주인의 하우스 · 10H 거주 행성 · 6H ──
WE.SIGN_CAREER.forEach((f, i) => {
  push({ system: 'astrology', condition: `mcSign:${i}`, symbol: i, features: f,
    where: '10하우스 사인', evidenceType: 'direct', traditionalStrength: 0.85 });
});
for (const [planet, f] of Object.entries(WE.PLANET_CAREER)) {
  push({ system: 'astrology', condition: `tenth:${planet}`, symbol: planet, features: f,
    where: '10하우스 거주 행성', evidenceType: 'direct', traditionalStrength: 0.85 });
  push({ system: 'astrology', condition: `mcLord:${planet}`, symbol: planet, features: f,
    where: 'MC 주인', evidenceType: 'direct', traditionalStrength: 0.9 });
  push({ system: 'astrology', condition: `sixth:${planet}`, symbol: planet, features: f,
    where: '6하우스 거주 행성 (일상 노동)', evidenceType: 'indirect', traditionalStrength: 0.6 });
}
for (const [house, f] of Object.entries(WE.LORD_HOUSE_CAREER)) {
  push({ system: 'astrology', condition: `mcLordHouse:${house}`, symbol: house, features: f,
    where: 'MC 주인이 앉은 하우스', evidenceType: 'indirect', traditionalStrength: 0.7 });
}
// 상승점 — 몸과 기질. 일을 '어떤 방식으로' 하는가
WE.SIGN_CAREER.forEach((f, i) => {
  push({ system: 'astrology', condition: `ascSign:${i}`, symbol: i, features: f,
    where: '상승점 사인', evidenceType: 'indirect', traditionalStrength: 0.7 });
  push({ system: 'astrology', condition: `sunSign:${i}`, symbol: i, features: f,
    where: '태양 사인', evidenceType: 'indirect', traditionalStrength: 0.65 });
});
for (const [house, f] of Object.entries(WE.LORD_HOUSE_CAREER)) {
  push({ system: 'astrology', condition: `sunHouse:${house}`, symbol: house, features: f,
    where: '태양이 앉은 하우스', evidenceType: 'indirect', traditionalStrength: 0.6 });
}
for (const [planet, f] of Object.entries(WE.PLANET_CAREER)) {
  push({ system: 'astrology', condition: `second:${planet}`, symbol: planet, features: f,
    where: '2하우스 거주 행성 (벌이)', evidenceType: 'indirect', traditionalStrength: 0.55 });
}
WE.QUALITY_FORM.forEach((f, i) => {
  push({ system: 'astrology', condition: `mcQuality:${WE.QUALITY_NAME[i]}`, symbol: WE.QUALITY_NAME[i],
    features: f, where: '10하우스 사인의 양태', evidenceType: 'indirect', traditionalStrength: 0.6 });
});

// ── 베딕 — D10 라그나·라그나주·10궁주·10궁 거주·AK ──
for (const [planet, f] of Object.entries(VE.PLANET_CAREER)) {
  push({ system: 'vedic', condition: `d10Lagnesh:${planet}`, symbol: planet, features: f,
    where: 'D10 라그나주', evidenceType: 'direct', traditionalStrength: 0.85 });
  push({ system: 'vedic', condition: `d10TenthLord:${planet}`, symbol: planet, features: f,
    where: 'D10 10궁주', evidenceType: 'direct', traditionalStrength: 0.8 });
  push({ system: 'vedic', condition: `d10TenthIn:${planet}`, symbol: planet, features: f,
    where: 'D10 10궁 거주', evidenceType: 'indirect', traditionalStrength: 0.65 });
  push({ system: 'vedic', condition: `atmakaraka:${planet}`, symbol: planet, features: f,
    where: '아트마카라카', evidenceType: 'indirect', traditionalStrength: 0.6 });
  push({ system: 'vedic', condition: `d1TenthLord:${planet}`, symbol: planet, features: f,
    where: 'D1 10궁주', evidenceType: 'direct', traditionalStrength: 0.75 });
  push({ system: 'vedic', condition: `d1TenthIn:${planet}`, symbol: planet, features: f,
    where: 'D1 10궁 거주', evidenceType: 'direct', traditionalStrength: 0.75 });
  // BPHS 가 경력·생계에 지정한 카라카. 아트마카라카보다 직업에 가깝다
  push({ system: 'vedic', condition: `amatyakaraka:${planet}`, symbol: planet, features: f,
    where: '아마탸카라카', evidenceType: 'direct', traditionalStrength: 0.8 });
  push({ system: 'vedic', condition: `d10Sixth:${planet}`, symbol: planet, features: f,
    where: 'D10 6궁주 (고용)', evidenceType: 'indirect', traditionalStrength: 0.55 });
  push({ system: 'vedic', condition: `d10Seventh:${planet}`, symbol: planet, features: f,
    where: 'D10 7궁주 (거래처)', evidenceType: 'indirect', traditionalStrength: 0.55 });
}
VE.RASHI_CAREER.forEach((f, i) => {
  push({ system: 'vedic', condition: `d10Lagna:${i}`, symbol: i, features: f,
    where: 'D10 라그나 라시', evidenceType: 'indirect', traditionalStrength: 0.7 });
});

// ── 나머지 열한 체계 — 대표 기호 ──
for (const [system, def] of Object.entries(AUX_SYSTEMS)) {
  for (const [symbol, f] of Object.entries(def.table)) {
    push({ system, condition: `symbol:${symbol}`, symbol, features: f,
      where: def.where, evidenceType: def.evidenceType,
      traditionalStrength: def.traditionalStrength });
  }
}

// ── 감사로 메운 자리 ──
// 숙요 — 28수 낱낱. 칠요 일곱은 28을 뭉갠 것이라 넷이 한 칸에 들어갔다
for (const [m, f] of Object.entries(OT.SUKYO_MANSION)) {
  push({ system: 'sukyo', condition: `mansion:${m}`, symbol: `${m}宿`, features: f,
    where: '본명숙 28수', evidenceType: 'indirect', traditionalStrength: 0.55 });
}
// 홍국 — 구성(기질)과 팔문(하는 일)은 다른 층이다
for (const [st, f] of Object.entries(OT.HONGGUK_STAR)) {
  push({ system: 'hongguk', condition: `star:${st}`, symbol: st, features: f,
    where: '내 궁의 구성', evidenceType: 'indirect', traditionalStrength: 0.55 });
}
for (const [g, f] of Object.entries(OT.EIGHT_GATE)) {
  push({ system: 'hongguk', condition: `gate:${g}`, symbol: g, features: f,
    where: '내 궁의 팔문', evidenceType: 'indirect', traditionalStrength: 0.6 });
  push({ system: 'taeeul', condition: `gate:${g}`, symbol: g, features: f,
    where: '태을 문', evidenceType: 'weak', traditionalStrength: 0.4 });
}
// 태을 — 주산과 객산을 견주는 것이 이 산법의 알맹이다
for (const [k, f] of Object.entries(OT.TAEEUL_HOST)) {
  push({ system: 'taeeul', condition: `host:${k}`, symbol: k, features: f,
    where: '주산 · 객산', evidenceType: 'indirect', traditionalStrength: 0.6 });
}
// 카발라 — 생일수가 라이프 패스보다 직업(재능)에 가깝다
for (const [n, f] of Object.entries(OT.KABBALAH_BIRTHDAY)) {
  push({ system: 'kabbalah', condition: `birthday:${n}`, symbol: n, features: f,
    where: '생일수', evidenceType: 'weak', traditionalStrength: 0.45 });
}
// 마하보테 — 요일 행성 (태국과 같은 재료라 계보가 묶인다)
for (const [p, f] of Object.entries(OT.MAHABOTE_PLANET)) {
  push({ system: 'mahabote', condition: `planet:${p}`, symbol: p, features: f,
    where: '요일 행성', evidenceType: 'weak', traditionalStrength: 0.35 });
}

export const RULES = rules;
const INDEX = new Map(rules.map((r) => [r.id, r]));

/**
 * 체계마다 **자기 표의 평균 벡터**.
 *
 * ── 왜 필요한가 (실측) ─────────────────────────────────────
 * 열한 명의 합친 벡터끼리 코사인이 **0.90** 이었다. 사람이 달라도 답이
 * 거의 같았다는 뜻이다. 원인은 이것이다 — 체계 열하나가 저마다 한 기호씩
 * 내는데, 그 기호들의 벡터를 그냥 더하면 **표 전체의 평균**에 수렴한다.
 * 누가 와도 같은 답이 나온다.
 *
 * 사람을 가르는 것은 절대값이 아니라 **그 표의 평균에서 얼마나 벗어났나**다.
 * 탐랑이 '미적감각 0.85' 라는 사실보다, 열네 주성 평균이 0.35 인데 탐랑만
 * 0.85 라는 것이 정보다.
 *
 * 이 평균은 **표의 성질**이지 사람 자료가 아니다. 열한 명을 보지 않고
 * 구해지므로 누수가 없다.
 */
export const TABLE_MEAN = (() => {
  const bySystem = {};
  for (const r of rules) {
    if (r.domain !== 'career') continue;
    (bySystem[r.system] ??= []).push(r.features);
  }
  const out = {};
  for (const [system, list] of Object.entries(bySystem)) {
    const m = {};
    for (const ax of AXES.career) {
      m[ax] = list.reduce((a, f) => a + (f[ax] ?? 0), 0) / list.length;
    }
    out[system] = m;
  }
  return out;
})();

/** 그 기호가 자기 표의 평균에서 얼마나 벗어났는가 (−1 ~ +1) */
export function deviationOf(system, features) {
  const m = TABLE_MEAN[system] ?? {};
  return Object.fromEntries(AXES.career.map((ax) => [ax, (features[ax] ?? 0) - (m[ax] ?? 0)]));
}

export const ruleFor = (system, domain, condition) => INDEX.get(`${system}|${domain}|${condition}`) ?? null;
export const rulesOf = (system, domain = 'career') => rules.filter((r) => r.system === system && r.domain === domain);
export const allRules = () => rules;

/**
 * calibration 결과를 규칙에 얹는다. **규칙의 features 는 건드리지 않는다** —
 * 실측은 "이 규칙을 얼마나 믿을지"를 바꿀 뿐 "무슨 뜻인지"를 바꾸지 않는다.
 */
export function applyEmpirical(support) {
  for (const r of rules) {
    const s = support?.[r.id];
    if (!s) continue;
    r.empiricalSupport = r3(s.value);
    r.sampleSize = s.n;
    r.provisional = s.n < 4;
  }
  return rules;
}
