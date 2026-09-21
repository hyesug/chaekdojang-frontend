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

// ─────────────────────────────────────────────────────────────
// 감사에서 드러난 구멍을 메운 표들
//
// 열다섯을 "대표 기호 하나"로만 읽고 있었다. 체계마다 계산은 이미
// 되어 있는데 꺼내 쓰지 않은 자리가 많았다 — 그 상태에서 성능을
// 견주면 **체계가 틀린 것인지 우리가 얕게 읽은 것인지** 가릴 수 없다.
// ─────────────────────────────────────────────────────────────

/**
 * 숙요 — **28수 낱낱**. 전에는 칠요 일곱으로만 읽었다.
 *
 * 숙요경은 수마다 고유한 물상을 준다. 일곱으로 뭉개면 네 수가 한 칸에
 * 들어가 구별이 사라진다. 배당은 28수-나크샤트라 대응의 표준 직업
 * 의미(브리하트 자타카 계열)에서 옮겼다 — 둘은 같은 별자리 띠다.
 */
export const SUKYO_MANSION = {
  角: { aesthetic: 0.80, creative: 0.75, technical: 0.45, specialist: 0.45 },   // 치트라 — 형태를 만드는 일
  亢: { independence: 0.75, change: 0.60, commercial: 0.50, interpersonal: 0.45 }, // 스와티 — 바람·거래
  氐: { interpersonal: 0.75, commercial: 0.60, care: 0.50, aesthetic: 0.45 },   // 비샤카 — 맺는 일
  房: { care: 0.75, interpersonal: 0.65, organization: 0.50, public: 0.45 },    // 아누라다 — 벗을 모으는 일
  心: { research: 0.70, specialist: 0.70, competitive: 0.55, management: 0.50 }, // 제슈타 — 맏이·권한
  尾: { research: 0.75, specialist: 0.70, problemSolving: 0.60, change: 0.55 }, // 물라 — 뿌리를 캐는 일
  箕: { physical: 0.70, change: 0.65, commercial: 0.50, public: 0.45 },         // 푸르바샤다 — 물과 이동
  斗: { public: 0.70, organization: 0.65, management: 0.60, specialist: 0.50 }, // 우타라샤다 — 제도·지속
  牛: { care: 0.70, commercial: 0.60, verbal: 0.55, aesthetic: 0.45 },          // 슈라바나 — 듣고 전하는 일
  女: { creative: 0.70, aesthetic: 0.65, interpersonal: 0.55, physical: 0.45 }, // 다니슈타 — 가락·무리
  虛: { research: 0.70, information: 0.60, care: 0.55, specialist: 0.50 },      // 샤타비샤 — 감춰진 것·치유
  危: { change: 0.75, physical: 0.60, problemSolving: 0.55, independence: 0.50 }, // 푸르바바드라 — 부수고 세움
  室: { organization: 0.70, stability: 0.65, research: 0.55, public: 0.45 },    // 우타라바드라 — 깊고 고요함
  壁: { care: 0.70, verbal: 0.60, creative: 0.55, public: 0.50 },               // 레바티 — 기르고 건네는 일
  奎: { technical: 0.70, problemSolving: 0.65, competitive: 0.60, physical: 0.55 }, // 아슈비니 — 빠른 손
  婁: { commercial: 0.70, physical: 0.55, stability: 0.55, care: 0.45 },        // 바라니 — 담고 나르는 일
  胃: { commercial: 0.70, stability: 0.65, organization: 0.55, care: 0.50 },    // 크리티카 — 베고 거두는 일
  昴: { aesthetic: 0.70, commercial: 0.60, stability: 0.55, interpersonal: 0.50 }, // 로히니 — 기르고 꾸미는 일
  畢: { physical: 0.70, technical: 0.60, stability: 0.55, commercial: 0.50 },   // 므리가시라 — 찾아다니는 일
  觜: { information: 0.70, verbal: 0.65, analytical: 0.55, change: 0.50 },      // 아르드라 — 헤집는 지성
  參: { verbal: 0.70, information: 0.65, commercial: 0.55, change: 0.50 },      // 푸나르바수 — 오가며 잇는 일
  井: { information: 0.75, verbal: 0.70, analytical: 0.60, technical: 0.50 },   // 푸샤·아슐레샤 계열 — 말과 셈
  鬼: { care: 0.75, research: 0.55, organization: 0.50, specialist: 0.45 },     // 돌보고 감추는 일
  柳: { care: 0.65, change: 0.60, analytical: 0.55, independence: 0.50 },       // 휘감는 지혜
  星: { public: 0.70, management: 0.60, creative: 0.55, competitive: 0.50 },    // 마가 — 자리와 이름
  張: { creative: 0.70, interpersonal: 0.65, aesthetic: 0.60, commercial: 0.50 }, // 푸르바팔구니 — 즐거움
  翼: { verbal: 0.70, public: 0.60, organization: 0.55, care: 0.50 },           // 우타라팔구니 — 베풂과 약속
  軫: { commercial: 0.70, physical: 0.60, change: 0.55, management: 0.50 },     // 하스타 — 손으로 다루는 일
};

/**
 * 홍국기문 — **구성(九星)**. 전에는 팔문 하나만 읽었다.
 *
 * 기문둔갑은 문(門)·성(星)·궁(宮)을 함께 본다. 문이 '무엇을 하는가'라면
 * 성은 '어떤 기질로 하는가'다. 하나만 읽으면 절반이다.
 */
export const HONGGUK_STAR = {
  천봉: { change: 0.70, physical: 0.55, independence: 0.55, competitive: 0.50 },
  천예: { care: 0.70, research: 0.55, stability: 0.50, specialist: 0.45 },
  천충: { physical: 0.70, competitive: 0.65, change: 0.60, technical: 0.50 },
  천보: { verbal: 0.70, information: 0.65, research: 0.60, public: 0.50 },
  천금: { organization: 0.65, stability: 0.65, management: 0.55, commercial: 0.45 },
  천심: { management: 0.70, public: 0.60, specialist: 0.55, organization: 0.55 },
  천주: { specialist: 0.70, research: 0.60, independence: 0.55, technical: 0.50 },
  천임: { stability: 0.70, organization: 0.60, care: 0.55, physical: 0.50 },
  천영: { aesthetic: 0.65, creative: 0.60, public: 0.60, verbal: 0.55 },
};

/**
 * 태을신수 — **주산과 객산**. 전에는 태을궁 팔괘 하나만 읽었다.
 *
 * 태을은 주산(내가 쥔 몫)과 객산(상대·환경이 쥔 몫)을 견주는 것이
 * 산법의 알맹이다. 그것을 안 쓰고 궁만 읽고 있었다.
 */
export const TAEEUL_HOST = {
  주산우세: { independence: 0.70, management: 0.55, competitive: 0.50 },
  객산우세: { organization: 0.70, stability: 0.55, care: 0.45 },
  대등: { interpersonal: 0.45, organization: 0.35, independence: 0.35 },
};

/** 태을·홍국이 함께 쓰는 팔문 — 문이 가리키는 일의 결 */
export const EIGHT_GATE = {
  개문: { public: 0.70, commercial: 0.60, independence: 0.55, management: 0.50 },
  휴문: { care: 0.70, stability: 0.60, organization: 0.45, verbal: 0.40 },
  생문: { commercial: 0.80, independence: 0.60, stability: 0.50, management: 0.45 },
  상문: { physical: 0.80, technical: 0.70, competitive: 0.60, problemSolving: 0.50 },
  두문: { specialist: 0.80, research: 0.70, technical: 0.65, independence: 0.55 },
  경문: { verbal: 0.70, public: 0.55, change: 0.55, competitive: 0.45 },
  사문: { care: 0.55, organization: 0.55, specialist: 0.45, change: 0.45 },
  경문2: { physical: 0.70, competitive: 0.65, change: 0.55, public: 0.45 },
};

/**
 * 카발라 — **생일수**. 전에는 라이프 패스 하나만 읽었다.
 *
 * 수비학에서 라이프 패스가 '삶의 길'이라면 생일수는 **타고난 재능의 결**
 * 이다. 직업을 물을 때 오히려 생일수 쪽이 직접적이다. 값은 라이프 패스와
 * 같은 수 의미를 쓰되, 재능 쪽으로 좁혔다.
 */
export const KABBALAH_BIRTHDAY = {
  1: { independence: 0.75, competitive: 0.55, management: 0.50 },
  2: { interpersonal: 0.70, care: 0.55, organization: 0.50 },
  3: { creative: 0.80, verbal: 0.70, aesthetic: 0.55 },
  4: { organization: 0.75, technical: 0.55, stability: 0.65, specialist: 0.45 },
  5: { change: 0.75, commercial: 0.60, interpersonal: 0.50 },
  6: { care: 0.75, aesthetic: 0.55, interpersonal: 0.60 },
  7: { research: 0.80, analytical: 0.75, specialist: 0.70, information: 0.60 },
  8: { management: 0.75, commercial: 0.70, competitive: 0.55 },
  9: { care: 0.65, public: 0.55, creative: 0.55 },
  11: { verbal: 0.60, information: 0.55, care: 0.55, specialist: 0.45 },
  22: { management: 0.70, organization: 0.65, technical: 0.55, problemSolving: 0.50 },
};

/**
 * 마하보테 — **요일 행성**. 전에는 여덟 자리만 읽었다.
 *
 * 다만 이 신호는 태국 점성술과 **같은 재료**(출생 요일)에서 나온다.
 * `lineage.js` 가 둘을 한 계보로 묶어 무게를 나눈다.
 */
export const MAHABOTE_PLANET = {
  태양: { public: 0.65, management: 0.60, competitive: 0.50 },
  달: { care: 0.70, interpersonal: 0.60, commercial: 0.45 },
  화성: { physical: 0.75, competitive: 0.65, technical: 0.55 },
  수성: { information: 0.75, verbal: 0.65, commercial: 0.55, analytical: 0.50 },
  목성: { verbal: 0.65, information: 0.60, public: 0.55, specialist: 0.45 },
  금성: { aesthetic: 0.75, creative: 0.60, interpersonal: 0.60 },
  토성: { organization: 0.70, stability: 0.65, physical: 0.50, specialist: 0.45 },
};

/** 자미두수 오행국 — 판의 바탕 기질 (납음 오행) */
export const ZIWEI_GUK = {
  수이국: { analytical: 0.55, research: 0.50, change: 0.45, information: 0.45 },
  목삼국: { creative: 0.55, care: 0.45, verbal: 0.45, research: 0.40 },
  금사국: { technical: 0.55, management: 0.50, competitive: 0.45, organization: 0.45 },
  토오국: { organization: 0.60, stability: 0.55, physical: 0.45, management: 0.40 },
  화육국: { interpersonal: 0.55, aesthetic: 0.50, public: 0.45, independence: 0.45 },
};
