/**
 * tables/ziwei.js — 자미두수 **해석표**
 *
 * 십사주성이 궁마다 무엇을 뜻하는지를 축으로 적는다. 같은 별이라도
 * 관록궁에서는 일의 결, 부처궁에서는 배우자와의 결, 전택궁에서는
 * 거주의 결이 된다 — **두수가 원래 그렇게 읽는다.**
 *
 * 값의 출처는 각 별에 붙어 있는 전통적 성격(화기·오행·격국·별명)이다.
 *   자미 帝座 · 천기 智星 · 태양 貴星 · 무곡 財星/將星 · 천동 福星
 *   염정 囚星 · 천부 庫星 · 태음 富星 · 탐랑 桃花/才藝 · 거문 暗星/口舌
 *   천상 印星 · 천량 蔭星 · 칠살 將星 · 파군 耗星
 *
 * ── 이 표를 고칠 때 ────────────────────────────────────────
 * 한 사람을 맞히려고 값을 움직이지 않는다. 움직였으면 그 사람을 뺀
 * 검증(LOO)에서도 나아지는지 확인한다.
 */

/**
 * 관록궁 — 일의 결.
 *
 * 별 이름에 붙은 전통적 뜻을 축으로 옮긴 것이다. 예를 들어 천기는
 * **智星**이라 머리로 셈하고 기획하는 자리이고(analytical·information·
 * problemSolving), 거문은 **暗星이자 口舌**이라 말과 전문성으로 먹고사는
 * 자리다(verbal·information·specialist).
 */
export const CAREER = {
  자미: { management: 0.85, organization: 0.80, public: 0.60, stability: 0.50, specialist: 0.35, care: 0.30 },
  천기: { analytical: 0.85, information: 0.85, problemSolving: 0.75, research: 0.70,
          specialist: 0.55, technical: 0.50, change: 0.55, verbal: 0.40 },
  태양: { public: 0.80, verbal: 0.70, management: 0.60, interpersonal: 0.60,
          organization: 0.50, competitive: 0.45, information: 0.40 },
  무곡: { commercial: 0.75, technical: 0.70, management: 0.55, specialist: 0.55,
          physical: 0.50, organization: 0.50, competitive: 0.50, problemSolving: 0.45 },
  천동: { care: 0.70, interpersonal: 0.65, organization: 0.60, stability: 0.60, aesthetic: 0.30 },
  염정: { management: 0.60, change: 0.60, competitive: 0.50, aesthetic: 0.45,
          technical: 0.45, commercial: 0.40, problemSolving: 0.40 },
  천부: { organization: 0.80, stability: 0.75, commercial: 0.60, management: 0.60,
          analytical: 0.40, information: 0.40, specialist: 0.40 },
  태음: { research: 0.60, analytical: 0.60, information: 0.60, specialist: 0.60,
          aesthetic: 0.55, stability: 0.60, care: 0.50, organization: 0.50 },
  탐랑: { aesthetic: 0.85, interpersonal: 0.75, commercial: 0.70, creative: 0.65,
          independence: 0.55, competitive: 0.45, specialist: 0.40 },
  거문: { verbal: 0.90, information: 0.80, analytical: 0.60, specialist: 0.60,
          research: 0.50, problemSolving: 0.50, interpersonal: 0.50, independence: 0.40 },
  천상: { organization: 0.80, management: 0.60, stability: 0.60, interpersonal: 0.50,
          care: 0.50, information: 0.45, specialist: 0.40 },
  천량: { care: 0.75, public: 0.65, stability: 0.60, specialist: 0.60, organization: 0.55,
          research: 0.50, verbal: 0.50, information: 0.50 },
  칠살: { competitive: 0.80, change: 0.75, physical: 0.70, independence: 0.65,
          technical: 0.50, problemSolving: 0.50, management: 0.45 },
  파군: { change: 0.85, independence: 0.75, competitive: 0.60, problemSolving: 0.55,
          physical: 0.55, technical: 0.50, creative: 0.45 },
};

/**
 * 부처궁 — 관계의 결.
 * 정성(자미·천부·천상·천량·태음·천동·무곡)은 오래 가는 쪽,
 * 동성(파군·칠살·탐랑·염정)은 흔들리는 쪽이라는 전통 배당을 축으로 옮긴다.
 */
export const RELATIONSHIP = {
  자미: { commitment: 0.70, stability: 0.70, bonding: 0.50 },
  천기: { autonomy: 0.55, change: 0.50, bonding: 0.45, lateUnion: 0.40 },
  태양: { bonding: 0.70, commitment: 0.60, earlyUnion: 0.40 },
  무곡: { commitment: 0.60, stability: 0.55, autonomy: 0.45, lateUnion: 0.45 },
  천동: { bonding: 0.75, commitment: 0.60, stability: 0.55, earlyUnion: 0.45 },
  염정: { bonding: 0.60, volatility: 0.65, change: 0.55 },
  천부: { commitment: 0.70, stability: 0.75, bonding: 0.45 },
  태음: { bonding: 0.70, commitment: 0.60, stability: 0.55 },
  탐랑: { bonding: 0.80, volatility: 0.60, earlyUnion: 0.50, autonomy: 0.45 },
  거문: { volatility: 0.55, autonomy: 0.50, lateUnion: 0.50 },
  천상: { commitment: 0.75, stability: 0.65, bonding: 0.50 },
  천량: { commitment: 0.55, stability: 0.60, lateUnion: 0.50, autonomy: 0.40 },
  칠살: { autonomy: 0.70, volatility: 0.65, lateUnion: 0.55 },
  파군: { volatility: 0.75, autonomy: 0.70, change: 0.65, lateUnion: 0.50 },
};

/** 자녀궁 — 두터운 쪽/얇은 쪽 */
export const CHILDREN = {
  자미: { childThick: 0.55, caregiving: 0.50 },
  천기: { childThin: 0.50, caregiving: 0.35 },
  태양: { childThick: 0.55, caregiving: 0.45 },
  무곡: { childThin: 0.45 },
  천동: { childThick: 0.65, caregiving: 0.60 },
  염정: { childThin: 0.50 },
  천부: { childThick: 0.70, caregiving: 0.55 },
  태음: { childThick: 0.65, caregiving: 0.60 },
  탐랑: { childThick: 0.45, caregiving: 0.35 },
  거문: { childThick: 0.45, caregiving: 0.30 },
  천상: { childThick: 0.50, caregiving: 0.50 },
  천량: { childThick: 0.60, caregiving: 0.65 },
  칠살: { childThin: 0.65 },
  파군: { childThin: 0.65 },
};

/** 전택궁 — 쌓는 쪽/움직이는 쪽. 태음이 전택주(田宅主)다 */
export const RESIDENCE = {
  태음: { ownership: 0.80, settled: 0.70 },
  천부: { ownership: 0.75, settled: 0.65 },
  자미: { ownership: 0.65, settled: 0.60 },
  무곡: { ownership: 0.65, settled: 0.50 },
  천상: { settled: 0.55, ownership: 0.45 },
  천량: { settled: 0.55, ownership: 0.40 },
  천동: { settled: 0.50, ownership: 0.35 },
  태양: { mobile: 0.45, settled: 0.35 },
  거문: { mobile: 0.45 },
  염정: { mobile: 0.45, ownership: 0.35 },
  탐랑: { mobile: 0.50 },
  천기: { mobile: 0.80 },
  파군: { mobile: 0.75 },
  칠살: { mobile: 0.70 },
};

/** 재백궁 — 돈의 모양 */
export const WEALTH = {
  무곡: { accumulation: 0.80, incomeStability: 0.60, enterprise: 0.50 },
  천부: { accumulation: 0.80, incomeStability: 0.70 },
  태음: { accumulation: 0.75, incomeStability: 0.65 },
  자미: { incomeStability: 0.70, accumulation: 0.60 },
  천상: { incomeStability: 0.70, accumulation: 0.50 },
  천량: { incomeStability: 0.60, accumulation: 0.45 },
  천동: { incomeStability: 0.60, accumulation: 0.40 },
  태양: { incomeStability: 0.55, enterprise: 0.45 },
  거문: { volatility: 0.50, enterprise: 0.45 },
  천기: { volatility: 0.55, speculation: 0.45, enterprise: 0.40 },
  탐랑: { speculation: 0.65, enterprise: 0.60, volatility: 0.55 },
  염정: { speculation: 0.60, volatility: 0.60 },
  칠살: { volatility: 0.70, enterprise: 0.55, speculation: 0.50 },
  파군: { volatility: 0.80, enterprise: 0.60, speculation: 0.55 },
};

/**
 * 학업 — 두수는 명궁·관록궁 주성과 **문창·문곡**으로 본다.
 *
 * 문창문곡만으로 재면 말한 다섯 중 둘이라 영점보다 나빴다. 그래서
 * 문창문곡을 단독 담당으로 쓰지 않고 **주성 쪽 성향과 함께** 약한
 * 증거로만 얹는다.
 */
export const EDUCATION = {
  천기: { formalContinuity: 0.55, credential: 0.55, repeatChallenge: 0.40 },
  태음: { formalContinuity: 0.65, credential: 0.55 },
  천량: { formalContinuity: 0.60, credential: 0.60 },
  자미: { formalContinuity: 0.60, credential: 0.50 },
  천부: { formalContinuity: 0.60, credential: 0.50 },
  천상: { formalContinuity: 0.55, credential: 0.50 },
  태양: { formalContinuity: 0.50, credential: 0.50 },
  거문: { credential: 0.60, repeatChallenge: 0.50, formalContinuity: 0.40 },
  천동: { formalContinuity: 0.45, detour: 0.35 },
  무곡: { credential: 0.45, detour: 0.40 },
  염정: { detour: 0.50, repeatChallenge: 0.45 },
  탐랑: { detour: 0.55, repeatChallenge: 0.40 },
  칠살: { detour: 0.65, repeatChallenge: 0.40 },
  파군: { detour: 0.70, repeatChallenge: 0.45 },
};

/** 질액궁 — 몸의 부담. 질환명은 만들지 않는다 */
export const HEALTH = {
  파군: { physicalLoad: 0.65, vulnerability: 0.55 },
  칠살: { physicalLoad: 0.65, vulnerability: 0.50 },
  염정: { physicalLoad: 0.55, vulnerability: 0.55 },
  탐랑: { physicalLoad: 0.45, vulnerability: 0.40 },
  거문: { vulnerability: 0.50, physicalLoad: 0.35 },
  천기: { physicalLoad: 0.40, vulnerability: 0.45 },
  무곡: { physicalLoad: 0.45 },
  태양: { physicalLoad: 0.40 },
  자미: { physicalLoad: 0.25 },
  천부: { physicalLoad: 0.20 },
  천동: { physicalLoad: 0.25 },
  천상: { physicalLoad: 0.25 },
  천량: { physicalLoad: 0.30, vulnerability: 0.30 },
  태음: { physicalLoad: 0.35, vulnerability: 0.35 },
};

/**
 * 보조성이 얹는 몫.
 *
 * 살성이 끼면 그 자리가 눌리고 변동이 커지며, 길성이 들면 받쳐진다.
 * 별 자체의 뜻을 바꾸지는 않고 **세기만 조절**한다 — 두수가 삼방사정을
 * 그렇게 읽는다.
 */
export const AUX_MODIFIER = {
  // 육살성 — 변동·부담 쪽으로 민다
  경양: { change: 0.35, physical: 0.30 },
  타라: { change: 0.30, stability: -0.20 },
  화성: { change: 0.40, physical: 0.35 },
  영성: { change: 0.35, physical: 0.25 },
  지공: { change: 0.35, creative: 0.25, stability: -0.20 },
  지겁: { change: 0.40, stability: -0.25 },
  // 길성 — 받쳐 준다
  녹존: { stability: 0.35, commercial: 0.30 },
  천마: { change: 0.40, physical: 0.25 },
  천괴: { organization: 0.30, public: 0.25 },
  천월: { organization: 0.30, care: 0.25 },
  문창: { verbal: 0.45, analytical: 0.35, credential: 0.45, formalContinuity: 0.35 },
  문곡: { verbal: 0.40, creative: 0.35, credential: 0.45, formalContinuity: 0.30 },
  좌보: { organization: 0.35, management: 0.25 },
  우필: { organization: 0.35, care: 0.25 },
};

/** 사화 — 그 자리를 켜거나 막는다 */
export const SIHWA_MODIFIER = {
  화록: { commercial: 0.30, stability: 0.25, incomeStability: 0.30, accumulation: 0.25, ownership: 0.25 },
  화권: { management: 0.35, independence: 0.25, commitment: 0.20 },
  화과: { credential: 0.40, formalContinuity: 0.30, research: 0.25, public: 0.20 },
  화기: { change: 0.40, volatility: 0.40, detour: 0.30, vulnerability: 0.30, physicalLoad: 0.25 },
};

export const DOMAIN_TABLE = {
  career: CAREER, relationship: RELATIONSHIP, children: CHILDREN,
  residence: RESIDENCE, wealth: WEALTH, education: EDUCATION, health: HEALTH,
};

/** 궁 이름 — extract 가 어느 궁을 볼지 */
export const DOMAIN_PALACE = {
  career: ['직업', '관록궁'], relationship: ['결혼', '부처궁'], children: ['자녀', '자녀궁'],
  residence: ['주거', '전택궁'], wealth: ['재물', '재백궁'], education: ['학업', '관록궁'],
  health: ['건강', '질액궁'],
};
