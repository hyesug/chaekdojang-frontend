/**
 * tables/saju.js — 사주(자평 명리) **해석표**
 *
 * ── 왜 십성을 열로 늘렸나 ──────────────────────────────────
 * 전에는 다섯 무리(비겁·식상·재성·관성·인성)만 썼다. 열한 명에게
 * 돌려 보니 **서로 다른 벡터가 5/11** 밖에 안 나왔다 — 열한 명 중
 * 여섯이 다른 사람과 똑같은 답을 받았다는 뜻이다.
 *
 * 명리는 원래 열 십성을 갈라 읽는다. 정재와 편재, 정관과 편관,
 * 정인과 편인은 **전통에서 이미 다른 뜻**이다. 있는 구별을 안 쓰고
 * 있었다. 열로 늘렸다.
 *
 * 값은 각 십성의 전통적 뜻에서 나온다.
 *   비견 比肩  나와 같은 것 — 자립·경쟁
 *   겁재 劫財  재를 겁탈 — 경쟁·동업·변동
 *   식신 食神  낳아 기름 — 표현·향유·꾸준함
 *   상관 傷官  관을 상함 — 재주·비판·틀 깨기
 *   정재 正財  바른 재물 — 성실한 축적
 *   편재 偏財  치우친 재물 — 사업·유동
 *   정관 正官  바른 자리 — 제도·직책
 *   편관 偏官(七殺) 억누르는 자리 — 무력·결단·현장
 *   정인 正印  바른 도장 — 학문·문서
 *   편인 偏印  치우친 도장 — 기술·전문·비주류 학문
 *
 * ── 고친 자리 ─────────────────────────────────────────────
 * `interpersonal` 이 식신·상관·정재에 빠져 있었다. 열한 명 가운데 넷에서
 * **대인이 실제로 가장 높은 축인데 사주가 한 번도 그것을 말하지 않는**
 * 일이 되풀이됐다. 한 사람 때문이 아니라 표의 구멍이었다 — 명리는 식상을
 * '표현과 사교', 정재를 '사람을 상대해 꾸준히 버는 자리'로 읽는다.
 * 있는 뜻을 안 적어 두었던 것이라 메웠다.
 */

/** 십성 → 일의 결 */
export const CAREER = {
  비견: { independence: 0.70, competitive: 0.60, physical: 0.50, stability: 0.40, organization: 0.30 },
  겁재: { independence: 0.80, competitive: 0.80, change: 0.60, commercial: 0.50, physical: 0.50 },
  식신: { creative: 0.70, care: 0.60, verbal: 0.55, interpersonal: 0.55, aesthetic: 0.50,
          stability: 0.50, specialist: 0.45, information: 0.40 },
  상관: { creative: 0.80, verbal: 0.80, problemSolving: 0.70, change: 0.70, technical: 0.60,
          independence: 0.60, information: 0.60, interpersonal: 0.55, competitive: 0.50, specialist: 0.50 },
  정재: { commercial: 0.75, stability: 0.70, organization: 0.60, analytical: 0.50,
          interpersonal: 0.45, specialist: 0.45, information: 0.40 },
  편재: { commercial: 0.85, independence: 0.70, change: 0.60, competitive: 0.60,
          interpersonal: 0.60, information: 0.40 },
  정관: { organization: 0.85, public: 0.75, management: 0.70, stability: 0.70,
          specialist: 0.50, information: 0.50 },
  편관: { competitive: 0.75, management: 0.70, physical: 0.65, change: 0.60,
          problemSolving: 0.55, public: 0.55, technical: 0.50 },
  정인: { information: 0.85, research: 0.80, specialist: 0.70, verbal: 0.60,
          stability: 0.60, care: 0.55, organization: 0.50, problemSolving: 0.45 },
  편인: { specialist: 0.80, research: 0.75, information: 0.75, analytical: 0.70,
          problemSolving: 0.65, technical: 0.60, creative: 0.50, independence: 0.50 },
};

/** 배우자 자리 — 여자는 관성, 남자는 재성을 배우자로 본다 */
export const RELATIONSHIP = {
  비견: { autonomy: 0.60, lateUnion: 0.40 },
  겁재: { autonomy: 0.65, volatility: 0.55, lateUnion: 0.40 },
  식신: { bonding: 0.65, commitment: 0.55, stability: 0.50 },
  상관: { autonomy: 0.65, volatility: 0.60, change: 0.55 },
  정재: { commitment: 0.75, stability: 0.70, bonding: 0.60, earlyUnion: 0.45 },
  편재: { bonding: 0.70, volatility: 0.55, earlyUnion: 0.50, autonomy: 0.45 },
  정관: { commitment: 0.80, stability: 0.70, bonding: 0.60, earlyUnion: 0.45 },
  편관: { bonding: 0.60, volatility: 0.60, change: 0.50 },
  정인: { stability: 0.55, lateUnion: 0.45, commitment: 0.45 },
  편인: { autonomy: 0.55, lateUnion: 0.55 },
};

/** 자녀 — 명리는 식상을 자식의 자리로 본다 */
export const CHILDREN = {
  식신: { childThick: 0.75, caregiving: 0.65 },
  상관: { childThick: 0.60, caregiving: 0.45 },
  정인: { caregiving: 0.55, childThick: 0.40 },
  편인: { childThin: 0.50 },
  정재: { childThick: 0.45, caregiving: 0.40 },
  편재: { childThick: 0.40 },
  정관: { childThick: 0.45, caregiving: 0.45 },
  편관: { childThin: 0.45 },
  비견: { childThin: 0.40 },
  겁재: { childThin: 0.45 },
};

/** 학업 — 인성이 문서·학문·자격의 자리다 */
export const EDUCATION = {
  정인: { formalContinuity: 0.85, credential: 0.65 },
  편인: { credential: 0.75, repeatChallenge: 0.55, formalContinuity: 0.50 },
  정관: { formalContinuity: 0.65, credential: 0.60 },
  편관: { credential: 0.50, repeatChallenge: 0.50, detour: 0.40 },
  식신: { formalContinuity: 0.50, credential: 0.40 },
  상관: { detour: 0.65, repeatChallenge: 0.50, credential: 0.40 },
  정재: { formalContinuity: 0.45, credential: 0.45 },
  편재: { detour: 0.55, repeatChallenge: 0.35 },
  비견: { detour: 0.50 },
  겁재: { detour: 0.60, repeatChallenge: 0.40 },
};

/** 재물 */
export const WEALTH = {
  정재: { accumulation: 0.80, incomeStability: 0.70 },
  편재: { enterprise: 0.80, speculation: 0.55, volatility: 0.55, accumulation: 0.50 },
  식신: { enterprise: 0.55, accumulation: 0.50, incomeStability: 0.45 },
  상관: { enterprise: 0.60, volatility: 0.55 },
  정관: { incomeStability: 0.80, accumulation: 0.45 },
  편관: { volatility: 0.55, incomeStability: 0.45 },
  정인: { incomeStability: 0.65, accumulation: 0.40 },
  편인: { volatility: 0.45, incomeStability: 0.40 },
  비견: { volatility: 0.50, enterprise: 0.40 },
  겁재: { volatility: 0.70, speculation: 0.50 },
};

/** 주거·이동 — 인성은 집·문서, 역마는 이동 */
export const RESIDENCE = {
  정인: { settled: 0.70, ownership: 0.60 },
  편인: { settled: 0.45, mobile: 0.40 },
  정재: { ownership: 0.65, settled: 0.55 },
  편재: { mobile: 0.60, ownership: 0.40 },
  정관: { settled: 0.60, ownership: 0.50 },
  편관: { mobile: 0.55 },
  식신: { settled: 0.50 },
  상관: { mobile: 0.60 },
  비견: { mobile: 0.45 },
  겁재: { mobile: 0.60 },
};

/** 건강 — 부담이 실리는 쪽까지만 */
export const HEALTH = {
  편관: { physicalLoad: 0.60, vulnerability: 0.50 },
  상관: { physicalLoad: 0.45, vulnerability: 0.45 },
  겁재: { physicalLoad: 0.50, vulnerability: 0.40 },
  편인: { vulnerability: 0.45 },
  비견: { physicalLoad: 0.40 },
  편재: { physicalLoad: 0.35 },
  정관: { physicalLoad: 0.25 },
  정재: { physicalLoad: 0.25 },
  정인: { physicalLoad: 0.20 },
  식신: { physicalLoad: 0.25 },
};

/**
 * 일간 오행 — 성격의 바탕. 십성보다 약하게 얹는다.
 * 목 곡직 / 화 염상 / 토 가색 / 금 종혁 / 수 윤하
 */
export const DAY_ELEMENT_CAREER = [
  { creative: 0.45, care: 0.40, verbal: 0.35, research: 0.35 },              // 목
  { interpersonal: 0.50, verbal: 0.45, aesthetic: 0.40, public: 0.35 },      // 화
  { organization: 0.50, stability: 0.50, management: 0.35, physical: 0.35 }, // 토
  { technical: 0.50, analytical: 0.45, management: 0.40, physical: 0.40 },   // 금
  { analytical: 0.50, research: 0.45, change: 0.40, commercial: 0.35 },      // 수
];

/**
 * 오행 편중 — 몸에 실리는 부담. 질환명은 만들지 않는다.
 * 값은 (최다 − 최소) 퍼센트포인트 구간으로 가른다.
 */
export const ELEMENT_SPREAD_HEALTH = [
  { at: 0, features: { physicalLoad: 0.20 } },
  { at: 18, features: { physicalLoad: 0.40, vulnerability: 0.30 } },
  { at: 28, features: { physicalLoad: 0.60, vulnerability: 0.50 } },
  { at: 38, features: { physicalLoad: 0.75, vulnerability: 0.65 } },
];

/** 역마(寅申巳亥)가 지지에 몇 개인가 — 이동의 글자 */
export const YEOKMA_RESIDENCE = [
  { at: 0, features: { settled: 0.45 } },
  { at: 1, features: { mobile: 0.40 } },
  { at: 2, features: { mobile: 0.60 } },
  { at: 3, features: { mobile: 0.80 } },
];

export const DOMAIN_TABLE = {
  career: CAREER, relationship: RELATIONSHIP, children: CHILDREN,
  education: EDUCATION, wealth: WEALTH, residence: RESIDENCE, health: HEALTH,
};

/** 구간표에서 값을 고른다 */
export function bandOf(table, value) {
  if (value == null) return null;
  let hit = null;
  for (const row of table) if (value >= row.at) hit = row;
  return hit?.features ?? null;
}
