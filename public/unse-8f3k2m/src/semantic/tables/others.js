/**
 * tables/others.js — 나머지 열한 체계의 **직업 해석표**
 *
 * (파일 이름이 `aux.js` 가 아닌 이유: 윈도에서 `AUX` 는 예약된 장치
 * 이름이라 git 이 그 경로를 아예 열지 못한다.)
 *
 * ── 왜 이 체계들도 참여시키는가 ─────────────────────────────
 * "이 전통엔 직업 전용 궁이 없다 → 직업 해석에서 제외" 로 버리면 안 된다.
 * 전통에 '직업'이라는 현대어가 없어도, **사회적 역할 · 성취 형태 · 재능 ·
 * 재물 획득 방식 · 행동 양식**을 통해 간접 증거는 낸다.
 *
 * 다만 직접 증거와 같은 무게로 세지도 않는다. 세 등급으로 가른다.
 *
 *   direct    그 전통에 이 질문을 보는 자리가 따로 있다 (자미 관록궁 등)
 *   indirect  자리는 없지만 역할·재능·행동을 통해 말한다 (팔문·구성·천장)
 *   weak      상징 하나로 성향만 말한다 (요일 행성·생일 카드·수)
 *
 * 값의 출처는 각 기호에 전통이 붙여 둔 뜻이다. `hires/interpret.js` 의
 * 직업 문구표가 출발점이고, 그 문구를 축으로 펴 놓았다.
 */

/** 구성학 — 구성 아홉 (기학 표준 배당) */
export const GUJEONG = {
  일백: { interpersonal: 0.65, care: 0.55, information: 0.50, change: 0.50, commercial: 0.45 },
  이흑: { care: 0.70, organization: 0.65, stability: 0.65, physical: 0.50 },
  삼벽: { change: 0.75, verbal: 0.65, creative: 0.60, competitive: 0.50, independence: 0.50 },
  사록: { commercial: 0.75, interpersonal: 0.65, verbal: 0.55, change: 0.55 },
  오황: { change: 0.85, independence: 0.60, management: 0.50, competitive: 0.45 },
  육백: { public: 0.75, organization: 0.70, management: 0.65, technical: 0.50, stability: 0.50 },
  칠적: { interpersonal: 0.70, commercial: 0.65, aesthetic: 0.55, verbal: 0.55 },
  팔백: { stability: 0.75, organization: 0.60, commercial: 0.55, specialist: 0.45 },
  구자: { aesthetic: 0.75, creative: 0.70, public: 0.55, verbal: 0.55, specialist: 0.50 },
};

/** 육임 — 십이천장 (대육임 표준 배당) */
export const YUKIM = {
  귀인: { public: 0.75, organization: 0.70, management: 0.55, stability: 0.50 },
  등사: { change: 0.75, independence: 0.50, competitive: 0.40 },
  주작: { verbal: 0.85, information: 0.70, public: 0.50, competitive: 0.45 },
  육합: { interpersonal: 0.80, commercial: 0.65, care: 0.45 },
  구진: { physical: 0.70, organization: 0.60, public: 0.50, competitive: 0.50, stability: 0.45 },
  청룡: { commercial: 0.80, management: 0.55, independence: 0.50, competitive: 0.45 },
  천공: { change: 0.65, information: 0.50, commercial: 0.45, independence: 0.45 },
  백호: { physical: 0.80, technical: 0.60, competitive: 0.65, care: 0.40, public: 0.40 },
  태상: { care: 0.65, aesthetic: 0.55, organization: 0.55, stability: 0.55, commercial: 0.45 },
  현무: { change: 0.65, information: 0.55, independence: 0.55, physical: 0.45 },
  태음: { aesthetic: 0.70, analytical: 0.55, specialist: 0.50, organization: 0.50, care: 0.40 },
  천후: { aesthetic: 0.70, interpersonal: 0.70, care: 0.55, commercial: 0.45 },
};

/** 홍국기문 — 팔문 (기문둔갑 표준 배당) */
export const HONGGUK = {
  개문: { public: 0.70, commercial: 0.60, independence: 0.55, management: 0.50 },
  휴문: { care: 0.70, stability: 0.60, organization: 0.45, verbal: 0.40 },
  생문: { commercial: 0.80, independence: 0.60, stability: 0.50, management: 0.45 },
  상문: { physical: 0.80, technical: 0.70, competitive: 0.60, problemSolving: 0.50 },
  두문: { specialist: 0.80, research: 0.70, technical: 0.65, independence: 0.55, information: 0.55 },
  경문: { verbal: 0.70, public: 0.55, change: 0.55, competitive: 0.45 },      // 驚門
  사문: { care: 0.55, organization: 0.55, specialist: 0.45, change: 0.45 },
  경문2: { physical: 0.70, competitive: 0.65, change: 0.55, public: 0.45 },   // 景門
};

/** 카발라 — 라이프 패스 (수비학 표준) */
export const KABBALAH = {
  1: { independence: 0.80, management: 0.60, competitive: 0.60, change: 0.45 },
  2: { interpersonal: 0.75, care: 0.60, organization: 0.55, aesthetic: 0.40 },
  3: { creative: 0.80, verbal: 0.75, aesthetic: 0.60, interpersonal: 0.55 },
  4: { organization: 0.80, stability: 0.75, technical: 0.55, physical: 0.50, specialist: 0.45 },
  5: { change: 0.80, commercial: 0.60, interpersonal: 0.55, independence: 0.55 },
  6: { care: 0.80, interpersonal: 0.65, verbal: 0.55, aesthetic: 0.45 },
  7: { research: 0.85, analytical: 0.80, specialist: 0.75, information: 0.65, technical: 0.55, independence: 0.50 },
  8: { management: 0.80, commercial: 0.70, competitive: 0.60, organization: 0.55 },
  9: { care: 0.70, public: 0.60, creative: 0.55, verbal: 0.50 },
  11: { verbal: 0.65, care: 0.60, creative: 0.55, information: 0.50, specialist: 0.45 },
  22: { management: 0.75, organization: 0.70, technical: 0.60, specialist: 0.55, problemSolving: 0.50 },
};

/** 마하보테 — 칠요 출생별 (버마 점성 표준) */
export const MAHABOTE = {
  빈가: { competitive: 0.70, management: 0.60, independence: 0.55, public: 0.45 },
  아하: { interpersonal: 0.75, commercial: 0.60, care: 0.45 },
  야자: { care: 0.75, verbal: 0.60, organization: 0.50, stability: 0.45 },
  아디: { independence: 0.75, change: 0.65, competitive: 0.50, commercial: 0.45 },
  마라나: { care: 0.60, technical: 0.55, problemSolving: 0.55, change: 0.55, specialist: 0.45 },
  푸티: { commercial: 0.75, stability: 0.55, organization: 0.45 },
  타트: { change: 0.70, commercial: 0.60, physical: 0.55, interpersonal: 0.45 },
};

/** 태국 점성술 — 요일 수호행성 (태국 전통) */
export const THAI = {
  일요일: { public: 0.70, management: 0.60, competitive: 0.50, organization: 0.45 },
  월요일: { care: 0.75, interpersonal: 0.65, commercial: 0.45, stability: 0.45 },
  화요일: { physical: 0.80, competitive: 0.70, technical: 0.60, independence: 0.50 },
  수요일: { information: 0.80, verbal: 0.70, commercial: 0.60, analytical: 0.55 },
  목요일: { verbal: 0.70, information: 0.65, public: 0.60, care: 0.50, specialist: 0.45 },
  금요일: { aesthetic: 0.80, creative: 0.65, interpersonal: 0.65 },
  토요일: { organization: 0.75, stability: 0.70, physical: 0.55, specialist: 0.50 },
};

/** 숙요 — 본명숙의 칠요 속성 (숙요경 표준) */
export const SUKYO = {
  일: { public: 0.70, management: 0.60, competitive: 0.50 },
  월: { care: 0.75, interpersonal: 0.65, stability: 0.45 },
  화: { physical: 0.80, competitive: 0.70, technical: 0.60 },
  수: { information: 0.80, verbal: 0.70, commercial: 0.60, analytical: 0.55 },
  목: { verbal: 0.70, information: 0.65, public: 0.60, specialist: 0.50 },
  금: { aesthetic: 0.80, creative: 0.65, interpersonal: 0.65 },
  토: { organization: 0.75, stability: 0.70, physical: 0.55, specialist: 0.50 },
};

/** 타로 — 생일 카드 (메이저 아르카나 표준 의미) */
export const TAROT = {
  마법사: { technical: 0.70, commercial: 0.60, verbal: 0.55, problemSolving: 0.55, independence: 0.50 },
  여사제: { research: 0.80, specialist: 0.70, information: 0.65, analytical: 0.55, care: 0.40 },
  여황제: { care: 0.70, aesthetic: 0.70, creative: 0.60, interpersonal: 0.50 },
  황제: { management: 0.85, organization: 0.70, public: 0.50, stability: 0.50 },
  교황: { verbal: 0.75, public: 0.60, organization: 0.55, specialist: 0.50, care: 0.45 },
  연인: { interpersonal: 0.80, aesthetic: 0.50, commercial: 0.45 },
  전차: { competitive: 0.80, physical: 0.65, independence: 0.55, management: 0.50 },
  힘: { physical: 0.70, care: 0.60, competitive: 0.50, stability: 0.45 },
  은둔자: { research: 0.80, specialist: 0.80, independence: 0.60, information: 0.55, technical: 0.45 },
  운명의수레바퀴: { change: 0.75, commercial: 0.55, information: 0.45 },
  정의: { analytical: 0.75, public: 0.65, organization: 0.60, information: 0.55, specialist: 0.50 },
  매달린사람: { care: 0.55, creative: 0.55, research: 0.45, stability: 0.40 },
  죽음: { change: 0.85, problemSolving: 0.55, independence: 0.50 },
  절제: { care: 0.65, organization: 0.55, technical: 0.50, specialist: 0.45 },
  악마: { commercial: 0.70, competitive: 0.55, interpersonal: 0.50, change: 0.45 },
  탑: { change: 0.85, technical: 0.55, problemSolving: 0.55, competitive: 0.45 },
  별: { creative: 0.70, aesthetic: 0.65, care: 0.55, information: 0.40 },
  달: { creative: 0.65, aesthetic: 0.55, care: 0.45, change: 0.45 },
  태양: { public: 0.70, creative: 0.55, interpersonal: 0.60, care: 0.45 },
  심판: { public: 0.70, care: 0.55, verbal: 0.50, change: 0.50 },
  세계: { management: 0.65, information: 0.60, change: 0.55, public: 0.50, interpersonal: 0.45 },
  바보: { change: 0.80, independence: 0.70, creative: 0.55 },
};

/**
 * 팔괘 물상 — 주역·태을신수·토정비결이 **함께** 쓴다.
 *
 * 셋의 답이 겹쳐도 교차검증이 아니다. `lineage.js` 가 셋을 한 계보로
 * 묶어 무게를 1/3 씩 나눈다.
 */
export const TRIGRAM = {
  乾: { public: 0.70, management: 0.65, organization: 0.60, technical: 0.50, commercial: 0.45 },
  兌: { verbal: 0.75, interpersonal: 0.65, commercial: 0.60, aesthetic: 0.45 },
  離: { aesthetic: 0.70, creative: 0.65, public: 0.55, verbal: 0.55, technical: 0.45 },
  震: { change: 0.75, competitive: 0.60, verbal: 0.55, technical: 0.50, physical: 0.45 },
  巽: { commercial: 0.75, interpersonal: 0.60, change: 0.55, information: 0.45 },
  坎: { care: 0.60, research: 0.55, specialist: 0.50, change: 0.50, physical: 0.45 },
  艮: { stability: 0.75, organization: 0.60, specialist: 0.50, physical: 0.45 },
  坤: { care: 0.70, organization: 0.65, stability: 0.60, physical: 0.50, commercial: 0.45 },
};

/**
 * 체계 → 표 · 증거 등급 · 전통 강도.
 *
 * `traditionalStrength` 는 "그 전통이 이 자리를 이 뜻으로 지정한 강도"다.
 * 관록궁처럼 직업 전용 자리면 높고, 요일 행성 하나로 성향만 말하는
 * 자리면 낮다. 사례를 보고 매긴 값이 아니다.
 */
export const AUX_SYSTEMS = {
  gujeong: { table: GUJEONG, where: '본명성', evidenceType: 'indirect', traditionalStrength: 0.55 },
  yukim: { table: YUKIM, where: '초전 천장', evidenceType: 'indirect', traditionalStrength: 0.55 },
  hongguk: { table: HONGGUK, where: '팔문', evidenceType: 'indirect', traditionalStrength: 0.60 },
  kabbalah: { table: KABBALAH, where: '라이프 패스', evidenceType: 'weak', traditionalStrength: 0.40 },
  mahabote: { table: MAHABOTE, where: '출생별', evidenceType: 'weak', traditionalStrength: 0.35 },
  thai: { table: THAI, where: '출생 요일', evidenceType: 'weak', traditionalStrength: 0.35 },
  sukyo: { table: SUKYO, where: '본명숙 칠요', evidenceType: 'weak', traditionalStrength: 0.40 },
  tarot: { table: TAROT, where: '생일 카드', evidenceType: 'weak', traditionalStrength: 0.35 },
  juyeok: { table: TRIGRAM, where: '본괘 상괘', evidenceType: 'indirect', traditionalStrength: 0.50 },
  taeeul: { table: TRIGRAM, where: '태을궁', evidenceType: 'indirect', traditionalStrength: 0.45 },
  tojeong: { table: TRIGRAM, where: '상괘', evidenceType: 'indirect', traditionalStrength: 0.45 },
};
