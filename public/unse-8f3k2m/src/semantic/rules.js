/**
 * rules.js — LEVEL 2. **해석 규칙 등록소**
 *
 * 거대한 if 문 대신 규칙을 자료로 둔다. 규칙 하나는 이렇게 생겼다.
 *
 *   { id, system, domain, condition, contribution, source, confidence }
 *
 * `source` 가 중요하다.
 *   'traditional'  그 전통의 표·배당에서 곧바로 나온 것
 *   'derived'      전통 표의 **문구**를 lexicon 으로 옮긴 것
 *   'empirical'    실제 사례를 보고 만든 것 — **지금은 하나도 없다**
 *
 * ── 규칙을 더할 때 지키는 것 ────────────────────────────────
 *   1. 한 사례의 오답을 맞히려고 규칙을 추가하지 않는다.
 *   2. 같은 방향의 오류가 **서로 독립인 여러 사례**에서 되풀이될 때만
 *      수정 후보로 본다.
 *   3. 자료를 보고 고친 규칙은 **그 사례를 뺀 검증(LOO)** 에서도
 *      나아지는지 확인한다. 안 나아지면 되돌린다.
 *   4. `source: 'empirical'` 규칙에는 근거가 된 사례 수와 p값을 적는다.
 */

import * as T from '../hires/interpret.js';
import { LEXICON, LEXICON_KEYS } from './lexicon.js';
import { zero, add, scaleToUnit, round3 } from './axes.js';

// ─────────────────────────────────────────────────────────────
// 전통 문구 → 축 (source: 'derived')
// ─────────────────────────────────────────────────────────────

/**
 * 표에 적힌 문구에서 낱말을 집어 축으로 옮긴다.
 *
 * 긴 낱말부터 걸고, 걸린 자리는 덮어 둔다 — '신기술'을 잡은 자리에서
 * '기술'을 다시 세면 한 낱말이 두 번 계산된다.
 */
export function contributionFromText(text, domain = 'career') {
  const s = String(text ?? '');
  const used = new Array(s.length).fill(false);
  let vec = zero(domain);
  const words = [];
  for (const key of LEXICON_KEYS) {
    let from = 0;
    for (;;) {
      const i = s.indexOf(key, from);
      if (i < 0) break;
      from = i + 1;
      if (used.slice(i, i + key.length).some(Boolean)) continue;
      for (let k = i; k < i + key.length; k++) used[k] = true;
      vec = add(vec, LEXICON[key]);
      words.push(key);
    }
  }
  return { vec: scaleToUnit(vec), words };
}

// ─────────────────────────────────────────────────────────────
// 자기 판 / 조직 — 각 전통이 그 기호에 붙여 둔 뜻
//
// 이 표는 `scripts/validate-axes.mjs` 가 쓰던 것과 같은 배당이다. 축마다
// 표를 새로 쓰면 답을 보고 표를 고르게 되므로 **한 표로 여러 축을 잰다.**
// ─────────────────────────────────────────────────────────────

export const FORM_SELF = {
  jamidusu: T.ZIWEI_SELF,
  saju: T.SAJU_SELF,
  juyeok: ['震', '離', '兌', '艮'],
  taeeul: ['震', '離', '兌', '艮'],
  tojeong: ['震', '離', '兌', '艮'],
  gujeong: ['삼벽', '구자', '칠적', '팔백'],
  hongguk: ['개문', '경문', '생문'],
  yukim: ['청룡', '육합', '백호', '현무'],
  mahabote: ['빈가', '아디', '타트'],
  thai: ['화요일', '일요일', '목요일'],
  sukyo: ['화', '일', '목'],
  kabbalah: [1, 3, 5, 8],
  tarot: ['마법사', '전차', '바보', '악마', '탑', '운명의수레바퀴', '황제'],
  // 점성술은 10하우스 사인의 활동/고정 구분으로 본다 (extract.js 가 넘긴다)
  astrology: ['활동'],
  vedic: ['화성', '태양', '목성'],
};

export const FORM_ORG = {
  jamidusu: T.ZIWEI_ORG,
  saju: T.SAJU_ORG,
  juyeok: ['乾', '坤', '巽', '坎'],
  taeeul: ['乾', '坤', '巽', '坎'],
  tojeong: ['乾', '坤', '巽', '坎'],
  gujeong: ['육백', '이흑', '사록', '일백'],
  hongguk: ['휴문', '두문', '사문', '상문'],
  yukim: ['귀인', '주작', '태상', '구진'],
  mahabote: ['야자', '마라나', '푸티', '아하'],
  thai: ['토요일', '수요일', '금요일', '월요일'],
  sukyo: ['토', '수', '금', '월'],
  kabbalah: [2, 4, 6, 7, 9],
  tarot: ['교황', '정의', '여황제', '은둔자', '힘', '절제', '심판', '세계',
          '여사제', '매달린사람', '연인', '별', '달', '태양', '죽음'],
  astrology: ['고정'],
  vedic: ['토성', '수성', '금성', '달'],
};

/** 그 기호가 '자기 판' 쪽인가 '조직' 쪽인가. 어느 쪽도 아니면 null */
export function formOf(systemId, symbol) {
  if (symbol == null) return null;
  if ((FORM_SELF[systemId] ?? []).includes(symbol)) return 'self';
  if ((FORM_ORG[systemId] ?? []).includes(symbol)) return 'org';
  return null;
}

/** 자기 판/조직 배당이 축에 얹는 몫 */
export const FORM_CONTRIBUTION = {
  self: { independence: 0.7, change: 0.2 },
  org: { organization: 0.7, stability: 0.2 },
};

// ─────────────────────────────────────────────────────────────
// 직업 — 열다섯 체계의 전통 직업표
// ─────────────────────────────────────────────────────────────

/** 체계 id → 그 전통의 직업표. 표 자체는 hires/interpret.js 에 있다 */
export const CAREER_TABLES = {
  jamidusu: { table: T.ZIWEI_TRADE, where: '원국 관록궁' },
  saju: { table: T.SAJU_TRADE, where: '월지·천간 십성' },
  astrology: { table: Object.fromEntries(T.WEST_TRADE.map((v, i) => [T.SIGN_NAME[i], v])), where: '10하우스 사인' },
  vedic: { table: T.VEDIC_TRADE, where: 'D10 라그나주·10궁주' },
  gujeong: { table: T.GUJEONG_TRADE, where: '본명성' },
  yukim: { table: T.YUKIM_TRADE, where: '초전 천장' },
  hongguk: { table: T.HONGGUK_TRADE, where: '팔문' },
  mahabote: { table: T.MAHABOTE_TRADE, where: '출생별' },
  thai: { table: T.THAI_TRADE, where: '출생 요일' },
  sukyo: { table: T.SUKYO_TRADE, where: '본명숙 칠요' },
  tarot: { table: T.TAROT_TRADE, where: '생일 카드' },
  kabbalah: { table: T.KABBALAH_TRADE, where: '라이프 패스' },
  // 셋 다 팔괘로 말한다. **답이 겹쳐도 교차검증이 아니다** — 같은 표를
  // 세 번 읽은 것이므로 ensemble.js 가 한 덩어리로 묶어 무게를 나눈다.
  juyeok: { table: T.TRIGRAM_TRADE, where: '본괘 상괘' },
  taeeul: { table: T.TRIGRAM_TRADE, where: '태을궁' },
  tojeong: { table: T.TRIGRAM_TRADE, where: '상괘' },
};

/** 같은 표를 쓰는 체계 묶음 — 겹침을 교차검증으로 세지 않기 위한 것 */
export const SHARED_TABLE_GROUPS = [['juyeok', 'taeeul', 'tojeong']];

/**
 * 직업 규칙 하나를 만든다.
 *
 * 기호마다 축 벡터를 손으로 쓰지 않는다. 표에 이미 적힌 문구를
 * lexicon 으로 옮기고, 자기 판/조직 배당만 그 위에 얹는다.
 */
function careerRule(systemId, symbol, text) {
  const { vec, words } = contributionFromText(text, 'career');
  const form = formOf(systemId, symbol);
  const contribution = round3(scaleToUnit(form ? add(vec, FORM_CONTRIBUTION[form]) : vec));
  return {
    id: `${systemId}|career|${symbol}`,
    system: systemId, domain: 'career',
    condition: `${CAREER_TABLES[systemId].where} = ${symbol}`,
    symbol, text, words, form,
    contribution,
    source: 'derived',
    confidence: 1,
  };
}

/** 열다섯 체계 × 기호 전부. 한 번 만들어 두고 돌려 쓴다 */
export const CAREER_RULES = (() => {
  const out = new Map();
  for (const [systemId, { table }] of Object.entries(CAREER_TABLES)) {
    for (const [symbol, text] of Object.entries(table)) {
      const r = careerRule(systemId, symbol, text);
      out.set(r.id, r);
    }
  }
  return out;
})();

export const careerRuleFor = (systemId, symbol) =>
  CAREER_RULES.get(`${systemId}|career|${symbol}`) ?? null;

// ─────────────────────────────────────────────────────────────
// 직업 밖 — 조건이 기호가 아니라 '개수·자리'인 규칙들
//
// 전부 그 전통이 원래 그 자리에서 말하던 것이다. 여기서 새로 만든
// 대응은 없고, 없는 자리는 만들지 않았다.
// ─────────────────────────────────────────────────────────────

const rule = (system, domain, condition, contribution, note, opts = {}) => ({
  id: `${system}|${domain}|${condition}`,
  system, domain, condition, contribution, note,
  source: opts.source ?? 'traditional',
  confidence: opts.confidence ?? 1,
});

export const FACT_RULES = [
  // ── 관계 ──
  // 명리 — 여자는 관성, 남자는 재성을 배우자로 본다. 천간에 없으면 늦거나
  // 약하고, 여럿이면 인연이 잦다고 본다. (interpret.js 의 배우자자리와 같은 규칙)
  rule('saju', 'relationship', 'spouseGod:0', { lateUnion: 0.7, bonding: 0.2 }, '배우자 십성이 천간에 없다'),
  rule('saju', 'relationship', 'spouseGod:1', { bonding: 0.5, commitment: 0.5 }, '배우자 십성 하나 — 보통'),
  rule('saju', 'relationship', 'spouseGod:2+', { bonding: 0.8, earlyUnion: 0.5, volatility: 0.4 }, '배우자 십성이 여럿 — 인연이 잦다'),

  // 자미 — 부처궁 주성의 정성/동성 배당. **혼인안정 축은 출력에서 막힌다**
  // (실측이 영점보다 나빴다. reliability.js 의 SUPPRESSED 참조)
  rule('jamidusu', 'relationship', 'spouse:stable', { bonding: 0.6, commitment: 0.6, stability: 0.7 }, '부처궁 정성'),
  rule('jamidusu', 'relationship', 'spouse:shaky', { bonding: 0.6, autonomy: 0.5, volatility: 0.7 }, '부처궁 동성'),

  // 점성 — 7하우스·그 주인·혼인 자연지표. 길성/앵글이면 이른 쪽,
  // 흉성/쇠약자리(6·8·12)·역행이면 늦는 쪽 (릴리 이래의 표준 배당)
  rule('astrology', 'relationship', 'seventh:early', { earlyUnion: 0.8, bonding: 0.5, commitment: 0.4 }, '7하우스가 이른 쪽'),
  rule('astrology', 'relationship', 'seventh:late', { lateUnion: 0.8, autonomy: 0.4 }, '7하우스가 늦는 쪽'),

  // 베딕 — 7궁주가 두스타나(6·8·12)면 지연, 앵글(1·4·7·10)이면 순조
  rule('vedic', 'relationship', 'seventhLord:dusthana', { lateUnion: 0.7 }, 'D1 7궁주가 6·8·12'),
  rule('vedic', 'relationship', 'seventhLord:angle', { earlyUnion: 0.6, commitment: 0.4 }, 'D1 7궁주가 앵글'),
  rule('vedic', 'relationship', 'seventh:malefic', { lateUnion: 0.5, volatility: 0.4 }, '7궁에 흉성'),
  rule('vedic', 'relationship', 'seventh:benefic', { earlyUnion: 0.5, bonding: 0.5 }, '7궁에 길성'),

  // ── 자녀 ──
  // 명리는 식상을 자식의 자리로 본다
  rule('saju', 'children', 'childGod:0', { childThin: 0.7 }, '천간 식상 없음'),
  rule('saju', 'children', 'childGod:1', { childThick: 0.3, childThin: 0.3, caregiving: 0.3 }, '천간 식상 하나'),
  rule('saju', 'children', 'childGod:2+', { childThick: 0.7, caregiving: 0.5 }, '천간 식상 여럿'),
  rule('jamidusu', 'children', 'child:many', { childThick: 0.6, caregiving: 0.4 }, '자녀궁 주성이 두터운 쪽'),
  rule('jamidusu', 'children', 'child:few', { childThin: 0.6 }, '자녀궁 주성이 얇은 쪽'),
  rule('vedic', 'children', 'fifth:malefic', { childThin: 0.5 }, 'D1 5궁에 흉성'),
  rule('vedic', 'children', 'fifth:benefic', { childThick: 0.5, caregiving: 0.4 }, 'D1 5궁에 길성'),

  // ── 학업 ──
  // 명리에서 인성은 문서·학문·자격의 자리다
  rule('saju', 'education', 'schoolGod:0', { detour: 0.7, repeatChallenge: 0.3 }, '천간 인성 없음'),
  rule('saju', 'education', 'schoolGod:1+', { formalContinuity: 0.8, credential: 0.5 }, '천간 인성 있음'),
  // 자미 문창·문곡은 **넣지 않았다.** 글과 시험의 별이라 자리는 그럴듯한데
  // 같은 정답표로 재니 말한 다섯 중 둘이었다 — 영점보다 나빴다.

  // ── 주거 ──
  // 자미 전택궁. 태음이 전택주이고 천부(庫)·자미(帝座)·무곡(財)이 쌓는 쪽,
  // 천기·파군·칠살이 움직이는 쪽이다.
  // **ownership 축은 출력에서 막힌다** — 자가/임차는 실측이 영점보다 나빴다.
  rule('jamidusu', 'residence', 'home:own', { ownership: 0.7, settled: 0.6 }, '전택궁 정성·고'),
  rule('jamidusu', 'residence', 'home:move', { mobile: 0.7 }, '전택궁 동성'),
  rule('vedic', 'residence', 'travelHouses:strong', { mobile: 0.6 }, 'D1 3·9·12에 행성이 몰림'),
  rule('vedic', 'residence', 'fourth:strong', { settled: 0.6, ownership: 0.4 }, 'D1 4궁이 튼튼함'),

  // ── 재물 ──
  // 명리 십성의 표준 배당. 재성은 재물, 식상은 생재(生財), 비겁은 분재(分財),
  // 관성·인성은 고정 수입·문서 쪽이다.
  rule('saju', 'wealth', 'wealthGod:2+', { accumulation: 0.7, incomeStability: 0.3 }, '천간 재성 여럿'),
  rule('saju', 'wealth', 'wealthGod:1', { accumulation: 0.4 }, '천간 재성 하나'),
  rule('saju', 'wealth', 'outputGod:1+', { enterprise: 0.6, accumulation: 0.3 }, '식상이 재물을 낳는 자리'),
  rule('saju', 'wealth', 'peerGod:2+', { volatility: 0.6, speculation: 0.3 }, '비겁이 여럿 — 재물이 나뉜다'),
  rule('saju', 'wealth', 'officerGod:1+', { incomeStability: 0.7 }, '관성 — 고정 수입의 자리'),
  // 자미 재백궁도 정성/동성으로 가른다 (부처궁과 같은 전통 배당)
  rule('jamidusu', 'wealth', 'money:stable', { incomeStability: 0.6, accumulation: 0.6 }, '재백궁 정성'),
  rule('jamidusu', 'wealth', 'money:shaky', { speculation: 0.6, volatility: 0.6, enterprise: 0.4 }, '재백궁 동성'),

  // ── 건강 ──
  // **질환명·수술 여부를 만들지 않는다.** 오행 편중이 크면 몸에 실리는
  // 부담이 한쪽으로 쏠린다는 것까지가 전통이 말하는 전부다.
  rule('saju', 'health', 'elementSpread:high', { physicalLoad: 0.6, vulnerability: 0.5 }, '오행 편중이 크다'),
  rule('saju', 'health', 'elementSpread:low', { physicalLoad: 0.2 }, '오행이 고르다'),
  rule('jamidusu', 'health', 'illness:evil', { vulnerability: 0.6 }, '질액궁에 살성'),
];

const FACT_RULE_INDEX = new Map(FACT_RULES.map((r) => [r.id, r]));

export const factRuleFor = (system, domain, condition) =>
  FACT_RULE_INDEX.get(`${system}|${domain}|${condition}`) ?? null;

/** 등록된 규칙 전부 — 테스트와 근거 보고서가 같은 목록을 본다 */
export const allRules = () => [...CAREER_RULES.values(), ...FACT_RULES];
