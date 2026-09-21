/**
 * tables/western.js — 서양 점성술 **해석표**
 *
 * 전에는 10하우스 커스프 사인 하나만 읽었다. 표준 독법은 그보다 넓다 —
 * **MC 사인 · MC 주인의 자리와 상태 · 10하우스 거주 행성 · 6하우스(일상
 * 노동) · 2하우스(벌이)** 를 함께 본다. 있는 지표를 안 쓰고 있었다.
 *
 * 사인 배당은 전통 표준(원소·양태·지배성)에서, 행성 배당은 각 행성의
 * 전통적 주재 영역에서 나온다.
 */

/** 12사인 → 일의 결 (0=양자리) */
export const SIGN_CAREER = [
  { physical: 0.80, competitive: 0.80, independence: 0.65, change: 0.55, management: 0.45, problemSolving: 0.40 },
  { commercial: 0.70, stability: 0.70, aesthetic: 0.60, specialist: 0.50, physical: 0.40 },
  { verbal: 0.85, information: 0.85, commercial: 0.60, technical: 0.50, analytical: 0.50, problemSolving: 0.50, change: 0.45 },
  { care: 0.80, interpersonal: 0.55, stability: 0.55, commercial: 0.35 },
  { management: 0.70, creative: 0.65, public: 0.60, competitive: 0.60, interpersonal: 0.55, specialist: 0.35 },
  { analytical: 0.80, organization: 0.70, information: 0.70, problemSolving: 0.70, specialist: 0.70, technical: 0.50 },
  { interpersonal: 0.75, aesthetic: 0.70, verbal: 0.55, organization: 0.45, information: 0.40 },
  { research: 0.75, problemSolving: 0.70, specialist: 0.70, analytical: 0.65, change: 0.55, care: 0.45 },
  { verbal: 0.70, public: 0.60, research: 0.55, change: 0.55, information: 0.45, specialist: 0.40 },
  { organization: 0.80, stability: 0.75, management: 0.65, specialist: 0.60, competitive: 0.50, physical: 0.50 },
  { technical: 0.80, problemSolving: 0.75, change: 0.70, independence: 0.60, analytical: 0.55, specialist: 0.55 },
  { creative: 0.75, care: 0.65, aesthetic: 0.60, research: 0.35, specialist: 0.30 },
];

/** 12사인 → 관계의 결 (7하우스에서 읽는다) */
export const SIGN_RELATIONSHIP = [
  { autonomy: 0.65, earlyUnion: 0.50, volatility: 0.50 },     // 양자리
  { commitment: 0.70, stability: 0.75, bonding: 0.55 },       // 황소
  { autonomy: 0.60, bonding: 0.55, volatility: 0.45 },        // 쌍둥이
  { bonding: 0.80, commitment: 0.65, earlyUnion: 0.50 },      // 게
  { bonding: 0.70, commitment: 0.55 },                        // 사자
  { lateUnion: 0.60, autonomy: 0.50, commitment: 0.50 },      // 처녀
  { bonding: 0.75, commitment: 0.75, earlyUnion: 0.50 },      // 천칭
  { bonding: 0.65, volatility: 0.60, commitment: 0.55 },      // 전갈
  { autonomy: 0.65, lateUnion: 0.55, change: 0.45 },          // 사수
  { commitment: 0.70, stability: 0.65, lateUnion: 0.65 },     // 염소
  { autonomy: 0.75, lateUnion: 0.55, volatility: 0.45 },      // 물병
  { bonding: 0.70, commitment: 0.50, volatility: 0.45 },      // 물고기
];

/** 12사인 → 거주 (4하우스에서 읽는다) */
export const SIGN_RESIDENCE = [
  { mobile: 0.60 }, { settled: 0.75, ownership: 0.70 }, { mobile: 0.65 }, { settled: 0.75, ownership: 0.60 },
  { settled: 0.55, ownership: 0.50 }, { settled: 0.55 }, { settled: 0.45 }, { settled: 0.50, ownership: 0.45 },
  { mobile: 0.70 }, { ownership: 0.70, settled: 0.65 }, { mobile: 0.60 }, { mobile: 0.50 },
];

/** 행성 → 일의 결 */
export const PLANET_CAREER = {
  태양: { public: 0.70, management: 0.70, competitive: 0.50, creative: 0.50, organization: 0.50 },
  달: { care: 0.80, interpersonal: 0.70, commercial: 0.40, change: 0.50 },
  수성: { information: 0.90, verbal: 0.85, analytical: 0.75, problemSolving: 0.60,
          commercial: 0.60, technical: 0.55, specialist: 0.45 },
  금성: { aesthetic: 0.90, creative: 0.70, interpersonal: 0.70, commercial: 0.50 },
  화성: { physical: 0.85, competitive: 0.85, technical: 0.70, independence: 0.60,
          problemSolving: 0.50, change: 0.50 },
  목성: { information: 0.70, verbal: 0.70, public: 0.70, research: 0.60, care: 0.35,
          commercial: 0.50, specialist: 0.45 },
  토성: { organization: 0.80, stability: 0.80, specialist: 0.70, management: 0.60,
          physical: 0.50, problemSolving: 0.45, technical: 0.40 },
  천왕성: { change: 0.85, technical: 0.80, problemSolving: 0.80, information: 0.75,
            independence: 0.70, analytical: 0.55, specialist: 0.50 },
  해왕성: { creative: 0.80, aesthetic: 0.70, care: 0.60, research: 0.35 },
  명왕성: { change: 0.80, problemSolving: 0.75, research: 0.70, analytical: 0.70,
            specialist: 0.60 },
};

/** 행성 → 관계 (7하우스 거주·7주인) */
export const PLANET_RELATIONSHIP = {
  금성: { bonding: 0.85, commitment: 0.65, earlyUnion: 0.60 },
  목성: { bonding: 0.70, commitment: 0.70, earlyUnion: 0.55 },
  달: { bonding: 0.75, commitment: 0.55, earlyUnion: 0.50 },
  태양: { bonding: 0.60, commitment: 0.60 },
  수성: { autonomy: 0.50, bonding: 0.50 },
  화성: { volatility: 0.70, autonomy: 0.55, lateUnion: 0.45 },
  토성: { lateUnion: 0.85, commitment: 0.60, stability: 0.55 },
  천왕성: { autonomy: 0.80, volatility: 0.70, lateUnion: 0.50 },
  해왕성: { bonding: 0.55, volatility: 0.55 },
  명왕성: { volatility: 0.70, bonding: 0.55 },
};

/** 행성 → 자녀 (5하우스) */
export const PLANET_CHILDREN = {
  목성: { childThick: 0.75, caregiving: 0.60 },
  금성: { childThick: 0.60, caregiving: 0.55 },
  달: { childThick: 0.70, caregiving: 0.70 },
  태양: { childThick: 0.55, caregiving: 0.45 },
  수성: { childThick: 0.40 },
  화성: { childThin: 0.45 },
  토성: { childThin: 0.70 },
  천왕성: { childThin: 0.55 },
  해왕성: { childThin: 0.40, caregiving: 0.40 },
  명왕성: { childThin: 0.50 },
};

/** 행성 → 재물 (2하우스·8하우스) */
export const PLANET_WEALTH = {
  목성: { accumulation: 0.70, incomeStability: 0.55 },
  금성: { accumulation: 0.65, incomeStability: 0.55 },
  토성: { incomeStability: 0.75, accumulation: 0.60 },
  태양: { incomeStability: 0.60 },
  달: { volatility: 0.55, incomeStability: 0.40 },
  수성: { enterprise: 0.55, commercial: 0.50 },
  화성: { volatility: 0.60, enterprise: 0.55 },
  천왕성: { volatility: 0.75, speculation: 0.55 },
  해왕성: { volatility: 0.60, speculation: 0.50 },
  명왕성: { speculation: 0.65, volatility: 0.65 },
};

/** 행성 → 건강 (6하우스). 질환명은 만들지 않는다 */
export const PLANET_HEALTH = {
  토성: { physicalLoad: 0.65, vulnerability: 0.55 },
  화성: { physicalLoad: 0.70, vulnerability: 0.45 },
  명왕성: { physicalLoad: 0.55, vulnerability: 0.60 },
  천왕성: { vulnerability: 0.50 },
  해왕성: { vulnerability: 0.55 },
  태양: { physicalLoad: 0.35 }, 달: { vulnerability: 0.40 },
  수성: { vulnerability: 0.30 }, 금성: { physicalLoad: 0.25 }, 목성: { physicalLoad: 0.30 },
};

/**
 * MC 주인이 어느 하우스에 앉았는가 — 일이 어느 무대에서 벌어지는가.
 * 전통 하우스 뜻을 축으로 옮긴다.
 */
export const LORD_HOUSE_CAREER = {
  1: { independence: 0.65, physical: 0.35 },
  2: { commercial: 0.70, stability: 0.45 },
  3: { verbal: 0.70, commercial: 0.45, change: 0.40 },
  4: { care: 0.60, stability: 0.55, organization: 0.35 },
  5: { creative: 0.70, aesthetic: 0.50, interpersonal: 0.45 },
  6: { organization: 0.70, technical: 0.50, care: 0.45, physical: 0.45 },
  7: { interpersonal: 0.70, commercial: 0.55 },
  8: { research: 0.65, analytical: 0.55, change: 0.50 },
  9: { verbal: 0.65, research: 0.60, public: 0.45, change: 0.45 },
  10: { management: 0.70, public: 0.60, organization: 0.55 },
  11: { interpersonal: 0.60, organization: 0.50, technical: 0.40 },
  12: { care: 0.55, research: 0.50, creative: 0.45, independence: 0.40 },
};

/** 양태 → 고용형태 쪽. 활동궁은 자기 판, 고정궁은 조직, 변통궁은 프리 */
export const QUALITY_FORM = [
  { independence: 0.55, change: 0.40 },   // 활동
  { organization: 0.60, stability: 0.50 }, // 고정
  { change: 0.55, independence: 0.35 },    // 변통
];

export const QUALITY_NAME = ['활동', '고정', '변통'];
