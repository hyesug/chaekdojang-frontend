/**
 * lexicon.js — 전통이 쓰는 **낱말**을 의미축으로 옮기는 단 하나의 자리
 *
 * ── 왜 낱말인가 ───────────────────────────────────────────
 * 열다섯 체계의 직업표는 이미 우리말로 적혀 있다.
 *
 *   탐랑  '재주가 여럿 — 영업·예술·사교·미용'
 *   두문  '숨기고 파는 일 — 연구·기술·은둔'
 *
 * 기호마다 축 벡터를 손으로 새로 쓰면, 쓰는 사람이 **답을 알고** 쓰게 된다.
 * 그래서 축은 기호가 아니라 **표에 이미 적혀 있는 낱말**에서 만든다.
 * 표를 고치면 축이 따라 바뀌고, 축을 고치려면 낱말 뜻을 고쳐야 한다.
 *
 * ── 이 표를 고칠 때 ────────────────────────────────────────
 * **한 사람을 맞히려고 낱말 무게를 바꾸지 않는다.** 여기 값은 그 낱말이
 * 한국어에서 뜻하는 바이지 사례의 정답이 아니다. 고쳤으면 반드시
 * `node scripts/validate-semantic.mjs` 의 LOO 를 다시 돌린다.
 *
 * ── 스케일 ────────────────────────────────────────────────
 * 0.9~1.0  그 낱말이 곧 그 축이다 (기술=technical)
 * 0.5~0.7  강하게 딸려 있다 (의료→care 가 주, technical 이 부)
 * 0.2~0.4  곁가지
 */

/**
 * 낱말 → 축 기여.
 *
 * 긴 낱말이 먼저 걸리게 정렬해서 쓴다 ('신기술'이 '기술'보다 먼저).
 * 그 처리는 rules.js 가 한다.
 */
export const LEXICON = {
  // ── 기술·분석·연구 ──
  기술: { technical: 0.9 },
  신기술: { technical: 0.8, change: 0.6 },
  공학: { technical: 0.9, analytical: 0.4 },
  IT: { technical: 0.9, analytical: 0.5 },
  전산: { technical: 0.9, analytical: 0.4 },
  컴퓨터: { technical: 0.9, analytical: 0.4 },
  네트워크: { technical: 0.8, change: 0.3 },
  전기: { technical: 0.8, physical: 0.4 },
  기계: { technical: 0.7, physical: 0.5 },
  수리: { technical: 0.7, physical: 0.5 },
  금속: { technical: 0.5, physical: 0.6 },
  분석: { analytical: 0.9 },
  기획: { analytical: 0.6, management: 0.5 },
  연구: { research: 0.9, analytical: 0.6 },
  학술: { research: 0.8, analytical: 0.4 },
  학문: { research: 0.8, verbal: 0.3 },
  전문성: { research: 0.6, technical: 0.4, organization: 0.3 },
  조사: { research: 0.7, analytical: 0.6 },
  머리: { analytical: 0.6 },

  // ── 창작·미감 ──
  창작: { creative: 0.9 },
  예술: { creative: 0.9, aesthetic: 0.7 },
  예능: { creative: 0.7, interpersonal: 0.5 },
  음악: { creative: 0.8, aesthetic: 0.5 },
  디자인: { creative: 0.7, aesthetic: 0.9 },
  미용: { aesthetic: 0.9, interpersonal: 0.5 },
  꾸미는: { aesthetic: 0.8, creative: 0.5 },
  치장: { aesthetic: 0.7 },
  영성: { creative: 0.4, care: 0.4 },
  상상: { creative: 0.8 },

  // ── 대인·언어 ──
  사교: { interpersonal: 0.9 },
  접객: { interpersonal: 0.8, care: 0.3 },
  상담: { interpersonal: 0.7, verbal: 0.6, care: 0.5 },
  중재: { interpersonal: 0.7, verbal: 0.5 },
  중개: { commercial: 0.7, interpersonal: 0.5 },
  인사: { management: 0.5, organization: 0.6, interpersonal: 0.4 },
  서비스: { interpersonal: 0.6, care: 0.4 },
  교육: { verbal: 0.7, interpersonal: 0.5, public: 0.3 },
  가르치는: { verbal: 0.7, interpersonal: 0.5 },
  말: { verbal: 0.9 },
  글: { verbal: 0.8 },
  문서: { organization: 0.6, analytical: 0.4, verbal: 0.3 },
  언론: { verbal: 0.8, public: 0.4 },
  방송: { verbal: 0.8, creative: 0.4, public: 0.3 },
  출판: { verbal: 0.6, creative: 0.3 },
  소송: { verbal: 0.6, analytical: 0.5, public: 0.4 },
  경보: { verbal: 0.5, public: 0.4 },

  // ── 상업·금전 ──
  영업: { commercial: 0.9, interpersonal: 0.7 },
  상업: { commercial: 0.9 },
  장사: { commercial: 0.9, independence: 0.6 },
  유통: { commercial: 0.7, physical: 0.3 },
  무역: { commercial: 0.7, change: 0.4 },
  물류: { commercial: 0.5, physical: 0.5 },
  거래: { commercial: 0.7 },
  사업: { commercial: 0.7, independence: 0.7 },
  신규사업: { commercial: 0.5, change: 0.7, independence: 0.5 },
  허업: { commercial: 0.4, change: 0.4 },
  금융: { commercial: 0.6, analytical: 0.5, organization: 0.4 },
  재무: { analytical: 0.6, organization: 0.5, commercial: 0.4 },
  회계: { analytical: 0.6, organization: 0.6 },
  투자: { commercial: 0.6, analytical: 0.4, change: 0.4 },
  보상: { commercial: 0.4 },
  부동산: { commercial: 0.5, stability: 0.6 },
  상속: { stability: 0.6, commercial: 0.4 },
  창고: { stability: 0.6, organization: 0.4 },
  토지: { stability: 0.5, physical: 0.4 },
  농업: { physical: 0.6, stability: 0.5 },
  농식품: { physical: 0.5, commercial: 0.4 },
  수산: { physical: 0.6, commercial: 0.4 },
  식품: { commercial: 0.5, care: 0.3 },
  의복: { aesthetic: 0.5, commercial: 0.4 },

  // ── 관리·조직·공공 ──
  경영: { management: 0.9, organization: 0.5 },
  관리: { management: 0.8, organization: 0.6 },
  관리직: { management: 0.8, organization: 0.7 },
  운영: { management: 0.7, organization: 0.6 },
  직책: { management: 0.6, organization: 0.7 },
  권한: { management: 0.7 },
  보좌: { organization: 0.6, care: 0.3 },
  보조: { organization: 0.6, care: 0.3 },
  비서: { organization: 0.6, care: 0.3 },
  실무: { organization: 0.6 },
  조율: { organization: 0.5, interpersonal: 0.5 },
  조직: { organization: 0.9 },
  제도권: { organization: 0.8, public: 0.6 },
  제도: { organization: 0.6, public: 0.6 },
  공공: { public: 0.9, organization: 0.5 },
  공직: { public: 0.9, organization: 0.7 },
  관공서: { public: 0.8, organization: 0.6 },
  관공: { public: 0.8, organization: 0.6 },
  행정: { public: 0.7, organization: 0.7 },
  법률: { public: 0.6, analytical: 0.6, verbal: 0.5 },
  법무: { public: 0.5, analytical: 0.5, verbal: 0.5 },
  군경: { physical: 0.7, public: 0.6, organization: 0.5 },
  봉사: { care: 0.8, public: 0.5 },
  종교: { care: 0.5, verbal: 0.5, public: 0.3 },
  국제: { change: 0.5, verbal: 0.4 },
  외국: { change: 0.5 },

  // ── 몸·현장 ──
  체육: { physical: 0.9 },
  운동: { physical: 0.9 },
  스포츠: { physical: 0.9 },
  몸: { physical: 0.9 },
  현장: { physical: 0.7, organization: 0.3 },
  제조: { physical: 0.6, organization: 0.5, technical: 0.4 },
  건설: { physical: 0.7, organization: 0.4 },
  건축: { physical: 0.6, technical: 0.5, creative: 0.3 },
  운송: { physical: 0.6, organization: 0.3 },
  여행: { change: 0.6, interpersonal: 0.3 },
  숙박: { commercial: 0.5, care: 0.4, stability: 0.4 },
  요식: { interpersonal: 0.5, physical: 0.4, commercial: 0.5 },
  음식: { interpersonal: 0.4, physical: 0.4, commercial: 0.5 },
  유흥: { interpersonal: 0.7, commercial: 0.5 },
  주류: { commercial: 0.5, interpersonal: 0.4 },
  야간: { change: 0.3, physical: 0.3 },

  // ── 돌봄·의료 ──
  돌봄: { care: 0.9 },
  돌보는: { care: 0.8 },
  기르는: { care: 0.7 },
  먹이는: { care: 0.7 },
  가정: { care: 0.7, stability: 0.4 },
  아동: { care: 0.7, verbal: 0.3 },
  의료: { care: 0.7, technical: 0.4, research: 0.3 },
  치과: { care: 0.6, technical: 0.5 },
  치유: { care: 0.7 },
  휴양: { care: 0.5, stability: 0.4 },
  장례: { care: 0.4, organization: 0.4 },

  // ── 독립 ↔ 조직 ──
  독립: { independence: 0.9 },
  창업: { independence: 0.8, change: 0.6, commercial: 0.5 },
  개척: { independence: 0.7, change: 0.7 },
  개업: { independence: 0.7, commercial: 0.5 },
  비정규: { independence: 0.6, change: 0.5 },
  비정통: { change: 0.7, independence: 0.4 },
  은둔: { independence: 0.5, research: 0.4 },
  경쟁: { physical: 0.4, independence: 0.4, change: 0.3 },

  // ── 안정 ↔ 변화 ──
  안정: { stability: 0.8 },
  유지: { stability: 0.7 },
  견디는: { stability: 0.8 },
  지키는: { stability: 0.7 },
  쌓는: { stability: 0.7, accumulation: 0.6 },
  인내: { stability: 0.6 },
  변동: { change: 0.9 },
  변화: { change: 0.9 },
  전환: { change: 0.9 },
  해체: { change: 0.8 },
  재건: { change: 0.7, organization: 0.3 },
  정리: { change: 0.5, organization: 0.4 },
  구조: { change: 0.5, technical: 0.3 },
  자격: { credential: 0.8, organization: 0.4, research: 0.3 },
};

/** 낱말이 긴 것부터. '신기술'이 '기술'보다 먼저 걸려야 한다 */
export const LEXICON_KEYS = Object.keys(LEXICON).sort((a, b) => b.length - a.length);
