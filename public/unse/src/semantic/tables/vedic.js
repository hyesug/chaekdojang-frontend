/**
 * tables/vedic.js — 베딕(자이오티시) **해석표**
 *
 * 전에는 D10 라그나주와 10궁주만 봤다. 표준 독법에서 직업을 보는 자리는
 * 그보다 넓다 — **아트마카라카 · D1 10궁주 · D10 라그나와 그 주인 ·
 * D10 10궁 거주 · 6궁(고용)과 7궁(거래처)** 이다.
 *
 * 역산에서 확인된 것: 일곱 지표를 전부 동원해도 여덟 중 여섯이고,
 * 그마저 사람마다 다른 지표를 골라야 나왔다. 그래서 **지표를 골라
 * 쓰지 않고 전부 약한 증거로 함께 싣는다** — 사후에 고르는 순간
 * 그건 규칙이 아니라 갖다 붙인 것이 된다.
 *
 * 행성 배당은 BPHS 의 카라카에서 나온다.
 */

/** 행성 → 일의 결 (카라카) */
export const PLANET_CAREER = {
  태양: { public: 0.80, management: 0.70, organization: 0.55, competitive: 0.50, specialist: 0.35, physical: 0.35 },
  달: { care: 0.80, interpersonal: 0.65, commercial: 0.50, aesthetic: 0.35 },
  // BPHS 의 화성 카라카에는 체력·무예·운동(파라크라마)이 함께 들어 있다
  화성: { physical: 0.85, competitive: 0.85, technical: 0.75, problemSolving: 0.55,
          independence: 0.50, management: 0.45, specialist: 0.40 },
  수성: { information: 0.90, commercial: 0.75, verbal: 0.75, analytical: 0.65,
          problemSolving: 0.60, technical: 0.55, specialist: 0.45 },
  목성: { information: 0.75, verbal: 0.70, research: 0.70, public: 0.60,
          specialist: 0.55, care: 0.55, commercial: 0.45 },
  금성: { aesthetic: 0.90, creative: 0.70, interpersonal: 0.65, commercial: 0.45, specialist: 0.40 },
  토성: { organization: 0.75, stability: 0.70, specialist: 0.65, physical: 0.60,
          technical: 0.45, problemSolving: 0.40 },
  라후: { change: 0.80, technical: 0.60, commercial: 0.55, independence: 0.55,
          information: 0.55, competitive: 0.50, problemSolving: 0.50 },
  // 케투는 '한 가지를 깊게 파고드는' 별이다 — 전통이 모크샤 카라카로 둔 자리
  케투: { specialist: 0.85, research: 0.70, problemSolving: 0.60, technical: 0.60,
          independence: 0.55, information: 0.50, care: 0.35 },
};

/** 행성 → 관계 (7궁·다라카라카·금성) */
export const PLANET_RELATIONSHIP = {
  금성: { bonding: 0.85, commitment: 0.60, earlyUnion: 0.55 },
  목성: { bonding: 0.70, commitment: 0.75, earlyUnion: 0.50 },
  달: { bonding: 0.75, commitment: 0.50 },
  수성: { bonding: 0.55, autonomy: 0.45 },
  태양: { commitment: 0.60, autonomy: 0.45 },
  화성: { volatility: 0.70, autonomy: 0.55 },
  토성: { lateUnion: 0.85, commitment: 0.55 },
  라후: { volatility: 0.75, autonomy: 0.60, change: 0.60 },
  케투: { lateUnion: 0.70, autonomy: 0.65 },
};

/** 행성 → 자녀 (5궁·목성) */
export const PLANET_CHILDREN = {
  목성: { childThick: 0.80, caregiving: 0.65 },
  달: { childThick: 0.65, caregiving: 0.65 },
  금성: { childThick: 0.55, caregiving: 0.50 },
  태양: { childThick: 0.50, caregiving: 0.40 },
  수성: { childThick: 0.40 },
  화성: { childThin: 0.50 },
  토성: { childThin: 0.75 },
  라후: { childThin: 0.55 },
  케투: { childThin: 0.65 },
};

/** 행성 → 재물 (2·11궁, 다나 요가) */
export const PLANET_WEALTH = {
  목성: { accumulation: 0.75, incomeStability: 0.55 },
  금성: { accumulation: 0.65, incomeStability: 0.55 },
  수성: { enterprise: 0.65, commercial: 0.60 },
  토성: { incomeStability: 0.70, accumulation: 0.50 },
  태양: { incomeStability: 0.60 },
  달: { volatility: 0.50 },
  화성: { enterprise: 0.60, volatility: 0.55 },
  라후: { speculation: 0.75, volatility: 0.70 },
  케투: { volatility: 0.60 },
};

/** 행성 → 학업 (4·5·9궁, 수성·목성) */
export const PLANET_EDUCATION = {
  목성: { formalContinuity: 0.80, credential: 0.65 },
  수성: { credential: 0.75, formalContinuity: 0.60 },
  금성: { formalContinuity: 0.50, credential: 0.45 },
  달: { formalContinuity: 0.50 },
  태양: { formalContinuity: 0.55, credential: 0.50 },
  토성: { repeatChallenge: 0.65, detour: 0.55, credential: 0.45 },
  화성: { detour: 0.55, repeatChallenge: 0.50 },
  라후: { detour: 0.70, repeatChallenge: 0.55 },
  케투: { detour: 0.60, research: 0.45 },
};

/** 행성 → 주거 (4궁·화성·달) */
export const PLANET_RESIDENCE = {
  화성: { ownership: 0.70, settled: 0.50 },
  달: { settled: 0.60, ownership: 0.45 },
  목성: { ownership: 0.60, settled: 0.55 },
  금성: { ownership: 0.55, settled: 0.50 },
  토성: { settled: 0.60, ownership: 0.45 },
  태양: { mobile: 0.45 },
  수성: { mobile: 0.55 },
  라후: { mobile: 0.80 },
  케투: { mobile: 0.70 },
};

/** 행성 → 건강 (6궁). 질환명은 만들지 않는다 */
export const PLANET_HEALTH = {
  토성: { physicalLoad: 0.65, vulnerability: 0.55 },
  화성: { physicalLoad: 0.70, vulnerability: 0.45 },
  라후: { vulnerability: 0.60 },
  케투: { vulnerability: 0.60 },
  태양: { physicalLoad: 0.40 }, 달: { vulnerability: 0.40 },
  수성: { vulnerability: 0.30 }, 금성: { physicalLoad: 0.25 }, 목성: { physicalLoad: 0.30 },
};

/**
 * 라시(사인) → 일의 결. D10 라그나가 어느 라시인가.
 * 서양 사인표와 같은 순서(백양~물고기)이지만 **사이드리얼**이라
 * 같은 생일이라도 대개 한 칸 앞이다. 표를 공유하지 않는 이유가 이것이다.
 */
export const RASHI_CAREER = [
  { physical: 0.75, competitive: 0.75, independence: 0.60, management: 0.45 },
  { commercial: 0.70, stability: 0.65, aesthetic: 0.55, specialist: 0.45 },
  { information: 0.80, verbal: 0.80, commercial: 0.60, analytical: 0.50, problemSolving: 0.45 },
  { care: 0.75, interpersonal: 0.55, stability: 0.50 },
  { management: 0.70, public: 0.60, competitive: 0.55, creative: 0.55 },
  { analytical: 0.75, organization: 0.65, information: 0.65, problemSolving: 0.65, specialist: 0.65, technical: 0.50 },
  { interpersonal: 0.70, aesthetic: 0.65, commercial: 0.50 },
  { research: 0.70, specialist: 0.65, problemSolving: 0.65, analytical: 0.60, change: 0.55 },
  { verbal: 0.70, information: 0.60, research: 0.55, public: 0.55 },
  { organization: 0.75, stability: 0.70, specialist: 0.55, management: 0.60 },
  { technical: 0.75, problemSolving: 0.70, information: 0.70, change: 0.65, independence: 0.60 },
  { creative: 0.70, care: 0.65, aesthetic: 0.55 },
];

/** 행성 상태 — 강하면 그 뜻이 진하게, 약하면 옅게 나온다 */
export const DIGNITY_SCALE = {
  고양: 1.15, 정위: 1.10, 무랄라트리코나: 1.10, 우호: 1.0,
  중립: 0.95, 적대: 0.85, 쇠약: 0.75,
};

export const dignityScale = (d) => DIGNITY_SCALE[d] ?? 1;

export const DOMAIN_PLANET_TABLE = {
  career: PLANET_CAREER, relationship: PLANET_RELATIONSHIP, children: PLANET_CHILDREN,
  wealth: PLANET_WEALTH, education: PLANET_EDUCATION, residence: PLANET_RESIDENCE,
  health: PLANET_HEALTH,
};
