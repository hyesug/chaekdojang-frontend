/**
 * occupations.js — 직업 이름 → **정답 라벨**
 *
 * ── 이것은 해석 규칙이 아니라 정답의 정의다 ──────────────────
 * 여기 적힌 것은 "개발자라는 일이 무엇을 쓰는 일인가"이지 "어떤 명반이
 * 개발자인가"가 아니다. 명반은 이 파일을 보지 않는다. 그래서 이 표를
 * 고쳐도 엔진의 예측은 바뀌지 않는다 — **채점 기준만 바뀐다.**
 *
 * ── 왜 속성을 함께 적는가 ──────────────────────────────────
 * 직업은 라벨 하나가 아니다. 개발자는 기술·분석·조직이 동시에 참이고,
 * 헬스트레이너는 신체·대인·독립이 동시에 참이다. 업종 하나만 채점하면
 * "IT 는 틀렸지만 기술성은 맞혔다"를 영영 볼 수 없다.
 *
 * ── 표본에 있는 직업만 적지 않는다 ──────────────────────────
 * 가진 사례의 직업만 적으면 이 파일이 곧 표본의 사본이 된다. 흔한
 * 직업을 고르게 적어 둔다.
 */

const J = (category, attributes, employmentForm = null) => ({ category, attributes, employmentForm });

export const OCCUPATIONS = {
  // IT·공학
  개발자: J('it_software', ['technical', 'analytical', 'organization'], 'organization'),
  프로그래머: J('it_software', ['technical', 'analytical'], 'organization'),
  데이터분석가: J('it_software', ['analytical', 'research', 'technical'], 'organization'),
  엔지니어: J('engineering', ['technical', 'analytical', 'organization'], 'organization'),
  기술직: J('engineering', ['technical', 'physical'], 'organization'),
  정비사: J('transport_machine', ['technical', 'physical'], 'organization'),

  // 연구·분석
  연구원: J('research_analysis', ['research', 'analytical', 'technical', 'organization'], 'organization'),
  대학원생: J('research_analysis', ['research', 'analytical'], 'organization'),
  회계사: J('finance_insurance', ['analytical', 'organization', 'public'], 'organization'),

  // 기획·관리·사무
  기획자: J('planning_management', ['analytical', 'management', 'organization'], 'organization'),
  관리자: J('planning_management', ['management', 'organization'], 'organization'),
  경리: J('finance_insurance', ['analytical', 'organization'], 'organization'),
  사무직: J('planning_management', ['organization', 'analytical'], 'organization'),
  인사담당: J('planning_management', ['management', 'organization', 'interpersonal'], 'organization'),

  // 금융·보험·영업
  은행원: J('finance_insurance', ['commercial', 'analytical', 'organization'], 'organization'),
  보험설계사: J('finance_insurance', ['commercial', 'interpersonal', 'independence'], 'self_employed'),
  보험교육: J('finance_insurance', ['commercial', 'verbal', 'interpersonal'], 'self_employed'),
  영업직: J('sales_commerce', ['commercial', 'interpersonal', 'verbal'], 'organization'),
  대리점운영: J('sales_commerce', ['commercial', 'independence', 'physical'], 'self_employed'),
  도소매: J('sales_commerce', ['commercial', 'independence'], 'self_employed'),

  // 교육·상담·공공
  교사: J('education_counsel', ['verbal', 'interpersonal', 'public', 'organization'], 'organization'),
  강사: J('education_counsel', ['verbal', 'interpersonal'], 'freelance'),
  상담사: J('education_counsel', ['interpersonal', 'verbal', 'care'], 'organization'),
  공무원: J('public_admin', ['public', 'organization', 'stability'], 'organization'),
  경찰소방: J('public_admin', ['public', 'physical', 'organization'], 'organization'),

  // 의료·돌봄
  간호사: J('medical_health', ['care', 'technical', 'organization'], 'organization'),
  의사: J('medical_health', ['care', 'research', 'technical'], 'organization'),
  물리치료사: J('medical_health', ['care', 'physical', 'technical'], 'organization'),
  병원실장: J('medical_health', ['management', 'interpersonal', 'commercial', 'care'], 'organization'),
  요양보호: J('medical_health', ['care', 'physical'], 'organization'),

  // 체육
  헬스트레이너: J('sports', ['physical', 'interpersonal', 'independence'], 'self_employed'),
  운동선수: J('sports', ['physical', 'independence'], 'freelance'),
  체육지도자: J('sports', ['physical', 'interpersonal', 'verbal'], 'organization'),

  // 미용·디자인·예술
  미용사: J('beauty_design', ['aesthetic', 'interpersonal', 'technical'], 'self_employed'),
  미용실운영: J('beauty_design', ['aesthetic', 'interpersonal', 'commercial', 'independence'], 'self_employed'),
  디자이너: J('beauty_design', ['creative', 'aesthetic'], 'organization'),
  인테리어디자이너: J('beauty_design', ['creative', 'aesthetic', 'technical', 'independence'], 'freelance'),
  작가: J('arts_content', ['creative', 'verbal', 'independence'], 'freelance'),
  콘텐츠제작: J('arts_content', ['creative', 'verbal', 'independence'], 'freelance'),

  // 요식·서비스
  요식업운영: J('food_service', ['interpersonal', 'commercial', 'physical', 'independence'], 'self_employed'),
  주점운영: J('food_service', ['interpersonal', 'commercial', 'independence'], 'self_employed'),
  요리사: J('food_service', ['physical', 'technical', 'creative'], 'organization'),
  서비스직: J('food_service', ['interpersonal', 'care'], 'organization'),

  // 제조·건설·운송
  생산직: J('manufacturing_construction', ['physical', 'organization'], 'organization'),
  건설현장: J('manufacturing_construction', ['physical', 'management'], 'organization'),
  기관사: J('transport_machine', ['technical', 'physical', 'organization', 'public'], 'organization'),
  운전기사: J('transport_machine', ['physical', 'organization'], 'organization'),
};

/** 같은 일을 부르는 다른 이름. 표를 늘리는 대신 여기로 보낸다 */
export const ALIAS = {
  성형외과실장: '병원실장', 병원코디네이터: '병원실장',
  지하철기관사: '기관사', 철도기관사: '기관사',
  우유대리점: '대리점운영', 유통대리점: '대리점운영',
  요리주점: '주점운영', 호프집: '주점운영', 식당운영: '요식업운영',
  헬스장운영: '헬스트레이너', 퍼스널트레이너: '헬스트레이너',
  소프트웨어개발자: '개발자', 웹개발자: '개발자',
  회사원: '사무직', 경리사무: '경리',
};

/** 표에 없으면 **지어내지 않는다.** 그 사람은 직업 채점에서 빠진다 */
export function labelFor(name) {
  const raw = String(name ?? '').replace(/\s/g, '');
  const key = ALIAS[raw] ?? raw;
  return OCCUPATIONS[key] ?? null;
}

export const CATEGORY_KEYS = [...new Set(Object.values(OCCUPATIONS).map((v) => v.category))];
