/**
 * occupations.js — 실제 직업을 **속성 벡터**로 적는다
 *
 * ── 이것은 해석 규칙이 아니라 '정답'의 정의다 ────────────────
 * 여기 적힌 것은 "개발자라는 일이 실제로 무엇을 쓰는 일인가"이지
 * "어떤 명반이 개발자인가"가 아니다. **명반은 이 파일을 보지 않는다.**
 * 고쳐도 엔진의 예측은 한 글자도 안 바뀌고 채점 기준만 바뀐다.
 *
 * ── 왜 직업명 하나로 채점하지 않는가 ────────────────────────
 * 'IT·개발'이라는 칸 하나를 맞혔나 틀렸나로 세면, 연구원을 개발자로
 * 읽은 것과 미용사로 읽은 것이 **똑같은 오답**이 된다. 앞은 거의 맞은
 * 것이고 뒤는 완전히 틀린 것인데 구별이 사라진다.
 *
 * 그래서 정답도 속성 벡터로 적는다. 그러면 "업종은 틀렸지만 기술성과
 * 전문성은 맞혔다" 를 볼 수 있고, **체계마다 어떤 속성을 잘 읽는지**
 * 를 잴 수 있다. 그것이 이 작업의 목적이다.
 *
 * ── 눈금 ───────────────────────────────────────────────────
 *   0.9  높음   그 일의 핵심
 *   0.7  중상   자주 쓴다
 *   0.5  중간   어느 정도
 *   0.2  낮음   거의 안 쓴다
 *   생략 0     쓰지 않는다
 *
 * 값은 그 직업이 실제로 하는 일에서 나온다. 사례에 있는 사람의 명반을
 * 보고 조정하지 않았다.
 */

const H = 0.9, MH = 0.7, M = 0.5, L = 0.2;

/**
 * @param {string} category 업종 (categories.js 의 키)
 * @param {object} f 속성 벡터
 * @param {string} form 고용형태
 */
const J = (category, f, form = null) => ({ category, features: f, employmentForm: form });

export const OCCUPATIONS = {
  // ── IT·공학 ──
  개발자: J('it_software', {
    technical: H, analytical: H, information: H, problemSolving: H,
    specialist: H, organization: MH, research: M, competitive: L, commercial: L,
  }, 'organization'),
  프로그래머: J('it_software', {
    technical: H, analytical: H, information: H, problemSolving: H, specialist: MH, organization: M,
  }, 'organization'),
  데이터분석가: J('it_software', {
    analytical: H, information: H, technical: MH, research: MH, problemSolving: MH,
    specialist: MH, organization: MH,
  }, 'organization'),
  엔지니어: J('engineering', {
    technical: H, problemSolving: H, analytical: MH, specialist: MH,
    organization: MH, physical: M, stability: M,
  }, 'organization'),
  기술직: J('engineering', {
    technical: H, physical: MH, problemSolving: M, specialist: M, organization: M, stability: M,
  }, 'organization'),
  정비사: J('transport_machine', {
    technical: H, physical: MH, problemSolving: MH, specialist: M, organization: M, stability: M,
  }, 'organization'),

  // ── 연구·분석 ──
  연구원: J('research_analysis', {
    research: H, analytical: H, technical: MH, specialist: H, information: MH,
    problemSolving: MH, organization: MH, stability: MH, competitive: L,
  }, 'organization'),
  대학원생: J('research_analysis', {
    research: H, analytical: H, information: MH, specialist: MH, problemSolving: M,
  }, 'organization'),
  회계사: J('finance_insurance', {
    analytical: H, information: MH, organization: H, specialist: MH, public: M, stability: MH,
  }, 'organization'),

  // ── 기획·관리·사무 ──
  기획자: J('planning_management', {
    analytical: MH, management: MH, information: MH, organization: H, verbal: M, commercial: M,
  }, 'organization'),
  관리자: J('planning_management', {
    management: H, organization: H, interpersonal: MH, verbal: M, stability: M,
  }, 'organization'),
  경리: J('finance_insurance', {
    analytical: MH, organization: H, information: M, stability: MH, specialist: M, care: L,
  }, 'organization'),
  사무직: J('planning_management', { organization: H, information: M, analytical: M, stability: MH }, 'organization'),
  인사담당: J('planning_management', {
    management: MH, organization: H, interpersonal: MH, verbal: M, information: M,
  }, 'organization'),

  // ── 금융·보험·영업 ──
  은행원: J('finance_insurance', {
    commercial: MH, analytical: MH, organization: H, interpersonal: M, information: M, stability: MH,
  }, 'organization'),
  보험설계사: J('finance_insurance', {
    commercial: H, interpersonal: H, verbal: MH, independence: MH, competitive: MH, information: M,
  }, 'self_employed'),
  보험교육: J('finance_insurance', {
    verbal: H, interpersonal: H, commercial: MH, information: MH, independence: M,
    management: M, competitive: M, specialist: M,
  }, 'self_employed'),
  영업직: J('sales_commerce', {
    commercial: H, interpersonal: H, verbal: MH, competitive: MH, change: M,
  }, 'organization'),
  대리점운영: J('sales_commerce', {
    commercial: H, independence: H, physical: MH, interpersonal: MH, management: M, stability: M,
  }, 'self_employed'),
  도소매: J('sales_commerce', {
    commercial: H, independence: MH, interpersonal: M, physical: M,
  }, 'self_employed'),

  // ── 교육·상담·공공 ──
  교사: J('education_counsel', {
    verbal: H, interpersonal: H, care: MH, public: MH, organization: MH, information: M, stability: MH,
  }, 'organization'),
  강사: J('education_counsel', {
    verbal: H, interpersonal: MH, information: MH, independence: MH, specialist: M, competitive: M,
  }, 'freelance'),
  상담사: J('education_counsel', {
    interpersonal: H, verbal: MH, care: H, specialist: M, information: M,
  }, 'organization'),
  공무원: J('public_admin', {
    public: H, organization: H, stability: H, information: M, verbal: M,
  }, 'organization'),
  경찰소방: J('public_admin', {
    public: H, physical: H, organization: MH, competitive: M, problemSolving: M,
  }, 'organization'),

  // ── 의료·돌봄 ──
  간호사: J('medical_health', {
    care: H, technical: M, organization: MH, interpersonal: MH, physical: M, specialist: MH,
  }, 'organization'),
  의사: J('medical_health', {
    care: H, research: MH, technical: MH, specialist: H, analytical: MH, problemSolving: MH,
  }, 'organization'),
  물리치료사: J('medical_health', {
    care: H, physical: MH, technical: M, interpersonal: MH, specialist: M,
  }, 'organization'),
  병원실장: J('medical_health', {
    management: H, interpersonal: H, commercial: MH, organization: MH, care: M, verbal: M,
  }, 'organization'),
  요양보호: J('medical_health', { care: H, physical: MH, interpersonal: M }, 'organization'),

  // ── 체육 ──
  헬스트레이너: J('sports', {
    physical: H, interpersonal: H, competitive: MH, independence: MH,
    commercial: MH, technical: M, specialist: M, analytical: L,
  }, 'self_employed'),
  운동선수: J('sports', { physical: H, competitive: H, specialist: MH, independence: M }, 'freelance'),
  체육지도자: J('sports', { physical: H, interpersonal: MH, verbal: MH, competitive: M, care: M }, 'organization'),

  // ── 미용·디자인·예술 ──
  미용사: J('beauty_design', {
    aesthetic: H, interpersonal: H, technical: MH, specialist: MH, creative: M, commercial: M,
  }, 'self_employed'),
  미용실운영: J('beauty_design', {
    aesthetic: H, interpersonal: H, commercial: H, independence: H,
    creative: MH, management: M, technical: M,
  }, 'self_employed'),
  디자이너: J('beauty_design', {
    creative: H, aesthetic: H, technical: M, specialist: MH, information: M,
  }, 'organization'),
  인테리어디자이너: J('beauty_design', {
    aesthetic: H, creative: H, technical: MH, independence: MH,
    interpersonal: M, commercial: M, specialist: M, problemSolving: M,
  }, 'freelance'),
  작가: J('arts_content', { creative: H, verbal: H, independence: H, information: M, specialist: M }, 'freelance'),
  콘텐츠제작: J('arts_content', { creative: H, information: MH, independence: MH, verbal: M, aesthetic: M }, 'freelance'),

  // ── 요식·서비스 ──
  요식업운영: J('food_service', {
    interpersonal: H, commercial: H, physical: H, independence: H, management: M, aesthetic: L,
  }, 'self_employed'),
  주점운영: J('food_service', {
    interpersonal: H, commercial: H, independence: H, physical: MH, management: M,
  }, 'self_employed'),
  요리사: J('food_service', { physical: H, technical: MH, creative: M, specialist: M, aesthetic: M }, 'organization'),
  서비스직: J('food_service', { interpersonal: H, care: MH, physical: M, organization: M }, 'organization'),

  // ── 제조·건설·운송 ──
  생산직: J('manufacturing_construction', { physical: H, organization: MH, technical: M, stability: MH }, 'organization'),
  건설현장: J('manufacturing_construction', {
    physical: H, management: MH, organization: M, technical: M, problemSolving: M,
  }, 'organization'),
  기관사: J('transport_machine', {
    technical: MH, physical: MH, organization: H, public: MH, stability: H, specialist: M,
  }, 'organization'),
  운전기사: J('transport_machine', { physical: H, organization: M, stability: M, technical: L }, 'organization'),
};

/** 같은 일을 부르는 다른 이름 */
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
  const hit = OCCUPATIONS[key];
  return hit ? { ...hit, key } : null;
}

/** 값이 0.4 이상인 축 — multi-label 로 볼 때의 '해당하는 속성' */
export const attributesOf = (features, floor = 0.45) =>
  Object.entries(features).filter(([, v]) => v >= floor).map(([k]) => k);

/**
 * 표 전체의 평균 — **"보통 직업"의 모양**.
 *
 * ── 왜 필요한가 ───────────────────────────────────────────
 * 직업 벡터를 그대로 견주면 **모두에게 이 평균 벡터를 주는 것이 가장
 * 좋은 답**이 된다. 실측에서 그랬다 — 평균 벡터의 유사도가 0.66 으로
 * 엔진이 낸 어떤 값보다 높았다. 직업들이 서로 꽤 닮았기 때문이다
 * (대부분 조직에 속해 일하고, 대부분 대인이 어느 정도 있다).
 *
 * 그래서 **평균을 빼고** 견준다. 물어야 할 것은 "이 사람이 얼마나
 * 기술적인가"가 아니라 **"보통 사람과 견주어 어느 쪽으로 치우쳤나"**다.
 * 명반이 말할 수 있는 것도 그쪽이다.
 *
 * 이 평균은 직업 사전의 성질이지 사례 자료가 아니다 — 열한 명을 보지
 * 않고 구해지므로 누수가 없다.
 */
export const OCCUPATION_MEAN = (() => {
  const list = Object.values(OCCUPATIONS).map((o) => o.features);
  const keys = [...new Set(list.flatMap((f) => Object.keys(f)))];
  return Object.fromEntries(keys.map((k) =>
    [k, list.reduce((a, f) => a + (f[k] ?? 0), 0) / list.length]));
})();

/** 보통 직업에서 얼마나 벗어났는가 (−1 ~ +1) */
export const centered = (features, axes = Object.keys(OCCUPATION_MEAN)) =>
  Object.fromEntries(axes.map((k) => [k, (features?.[k] ?? 0) - (OCCUPATION_MEAN[k] ?? 0)]));

export const CATEGORY_KEYS = [...new Set(Object.values(OCCUPATIONS).map((v) => v.category))];
