/**
 * categories.js — LEVEL 4. 축을 **현실 질문의 답**으로 옮긴다
 *
 * 축 벡터는 "무엇을 다루는 사람인가"까지다. 사람이 실제로 묻는 것은
 * "무슨 일을 하게 되나", "결혼은 이른 편인가" 같은 것이다. 그 사이를
 * 잇는 자리가 여기다.
 *
 * ── 하나를 고르지 않는다 ───────────────────────────────────
 * 답은 **분포**다. 1위만 내면 2위가 정답이었던 경우를 영영 모른다
 * (실제로 그런 사례가 있었다 — 미용업 운영자에게 2위가 정답이었다).
 *
 * ── 범주는 원형(prototype)으로 정의한다 ────────────────────
 * 범주마다 "그 일이 원래 어떤 축을 쓰는가"를 적어 두고, 사람의 축
 * 벡터와의 **코사인 닮음**으로 점수를 낸다. 범주를 사례에 맞춰 만들지
 * 않는다 — 개발자가 실제로 있어서 IT 범주를 만든 것이 아니라, IT 라는
 * 일이 원래 기술·분석을 쓰기 때문에 그렇게 적는다.
 *
 * ── 날카로움은 고정값이다 ──────────────────────────────────
 * `SHARPNESS` 는 자유 모수다. **열한 명을 보고 고르지 않았다.** 이 값을
 * 바꾸면 반드시 `scripts/validate-semantic.mjs` 의 LOO 를 다시 돌린다.
 */

import { cosine, restrictTo } from './axes.js';

/** 닮음을 분포로 바꿀 때의 날카로움. 사례를 보고 고른 값이 아니다 */
export const SHARPNESS = 3;

/** '기타'에 늘 남겨 두는 몫. 목록에 없는 직업이 실제로 있다 */
export const OTHER_FLOOR = 0.06;

/**
 * 어떤 범주도 0 으로 두지 않는다.
 *
 * 0 이면 그 범주가 정답이었을 때 로그 손실이 무한대가 되어 채점이
 * 깨진다. 무엇보다 **"이 사람은 절대 이 일을 하지 않는다"는 말을 명반이
 * 할 수 있다고 인정하는 셈**이라 그 자체로 틀렸다.
 */
export const MIN_P = 0.02;

// ─────────────────────────────────────────────────────────────
// 직업 — 세 갈래로 따로 낸다
//
// 업종(무슨 일), 고용형태(어디에 속해서), 일하는 결(어떤 역할로)은
// **서로 다른 질문**이다. 한 목록에 섞으면 'IT 개발자인 프리랜서'가
// 두 칸으로 갈려 서로의 몫을 깎는다.
// ─────────────────────────────────────────────────────────────

/** 업종 — 한국표준산업·직업분류의 큰 갈래를 따랐다 */
export const CAREER_CATEGORIES = {
  it_software: { label: 'IT·개발', proto: { technical: 1, analytical: 0.8, research: 0.4, organization: 0.5, change: 0.3 },
    examples: ['개발자', '데이터 분석', '기술기획'] },
  engineering: { label: '공학·기술', proto: { technical: 1, analytical: 0.6, physical: 0.5, organization: 0.5, stability: 0.4 },
    examples: ['엔지니어', '설비·품질', '기술직'] },
  research_analysis: { label: '연구·분석', proto: { research: 1, analytical: 0.9, technical: 0.5, organization: 0.4, stability: 0.4 },
    examples: ['연구원', '분석가', '학술'] },
  planning_management: { label: '기획·관리', proto: { management: 1, organization: 0.8, analytical: 0.6, verbal: 0.5, commercial: 0.3 },
    examples: ['기획', '관리자', '운영'] },
  finance_insurance: { label: '금융·보험', proto: { commercial: 0.8, analytical: 0.7, organization: 0.6, interpersonal: 0.5, management: 0.4 },
    examples: ['금융', '보험', '회계·경리'] },
  sales_commerce: { label: '영업·상업', proto: { commercial: 1, interpersonal: 0.8, verbal: 0.6, independence: 0.4, change: 0.4 },
    examples: ['영업', '유통·대리점', '무역'] },
  education_counsel: { label: '교육·상담', proto: { verbal: 1, interpersonal: 0.8, care: 0.6, public: 0.4, research: 0.3 },
    examples: ['교사·강사', '상담', '교육 기획'] },
  medical_health: { label: '의료·건강', proto: { care: 1, technical: 0.5, research: 0.4, physical: 0.4, public: 0.4 },
    examples: ['의료인', '보건', '요양·돌봄'] },
  sports: { label: '체육', proto: { physical: 1, interpersonal: 0.4, independence: 0.4, change: 0.3 },
    examples: ['지도자', '트레이너', '선수'] },
  beauty_design: { label: '미용·디자인', proto: { aesthetic: 1, creative: 0.7, interpersonal: 0.6, independence: 0.5, commercial: 0.4 },
    examples: ['미용', '디자이너', '스타일링'] },
  arts_content: { label: '예술·콘텐츠', proto: { creative: 1, aesthetic: 0.7, verbal: 0.5, independence: 0.6, change: 0.4 },
    examples: ['작가', '콘텐츠', '공연·예술'] },
  food_service: { label: '요식·서비스', proto: { interpersonal: 0.8, commercial: 0.6, physical: 0.5, care: 0.4, independence: 0.5 },
    examples: ['요식업', '접객', '서비스 운영'] },
  public_admin: { label: '행정·공공', proto: { public: 1, organization: 0.9, stability: 0.7, management: 0.4 },
    examples: ['공무원', '공공기관', '행정'] },
  manufacturing_construction: { label: '제조·건설', proto: { physical: 0.8, technical: 0.6, organization: 0.6, stability: 0.6 },
    examples: ['제조', '건설', '현장 관리'] },
  transport_machine: { label: '운송·기계', proto: { physical: 0.7, technical: 0.7, organization: 0.5, stability: 0.5 },
    examples: ['운전·운송', '기계 조작', '정비'] },
};

/** 고용형태 — 업종과 **따로** 낸다 */
export const EMPLOYMENT_FORMS = {
  organization: { label: '조직형', proto: { organization: 1, stability: 0.7, public: 0.4 } },
  self_employed: { label: '자영업형', proto: { independence: 1, commercial: 0.8, change: 0.5 } },
  freelance: { label: '프리랜서형', proto: { independence: 0.9, creative: 0.5, change: 0.6, verbal: 0.4 } },
};

/** 일하는 결 */
export const WORK_STYLES = {
  specialist: { label: '전문직형', proto: { research: 0.8, technical: 0.8, analytical: 0.7 } },
  manager: { label: '관리형', proto: { management: 1, organization: 0.8 } },
  sales: { label: '영업형', proto: { commercial: 1, interpersonal: 0.8 } },
  creator: { label: '창작형', proto: { creative: 1, aesthetic: 0.7 } },
};

/** 안정형 / 변동형 */
export const CAREER_TEMPO = {
  steady: { label: '안정형', proto: { stability: 1, organization: 0.6 } },
  shifting: { label: '변동형', proto: { change: 1, independence: 0.5 } },
};

// ─────────────────────────────────────────────────────────────
// 직업 밖
// ─────────────────────────────────────────────────────────────

export const UNION_TIMING = {
  early: { label: '조혼 경향', proto: { earlyUnion: 1, bonding: 0.5, commitment: 0.4 } },
  mid: { label: '중간', proto: { bonding: 0.6, commitment: 0.6, earlyUnion: 0.35, lateUnion: 0.35 } },
  late: { label: '만혼 경향', proto: { lateUnion: 1, autonomy: 0.4 } },
};

export const CHILDREN_COUNT = {
  few: { label: '적음', proto: { childThin: 1 } },
  average: { label: '보통', proto: { childThin: 0.5, childThick: 0.5, caregiving: 0.4 } },
  many: { label: '많음', proto: { childThick: 1, caregiving: 0.6 } },
};

export const EDUCATION_PATH = {
  formal_continuous: { label: '정규 과정 지속', proto: { formalContinuity: 1, credential: 0.6 } },
  interrupted_detour: { label: '중단·우회', proto: { detour: 1, repeatChallenge: 0.5 } },
  credential_repeat: { label: '자격·반복 도전', proto: { credential: 1, repeatChallenge: 0.8, detour: 0.4 } },
};

export const RESIDENCE_MODE = {
  settled: { label: '정착 쪽', proto: { settled: 1 } },
  mobile: { label: '이동 쪽', proto: { mobile: 1 } },
};

export const WEALTH_SHAPE = {
  salary_stable: { label: '고정 수입형', proto: { incomeStability: 1, accumulation: 0.4 } },
  accumulating: { label: '축적형', proto: { accumulation: 1, incomeStability: 0.5 } },
  enterprise: { label: '사업형', proto: { enterprise: 1, speculation: 0.4, volatility: 0.3 } },
  speculative: { label: '변동·투기형', proto: { speculation: 1, volatility: 0.8 } },
};

/** 분야 → 그 분야가 내는 분포들 */
export const CATEGORY_SETS = {
  career: { industry: CAREER_CATEGORIES, employmentForm: EMPLOYMENT_FORMS, workStyle: WORK_STYLES, tempo: CAREER_TEMPO },
  relationship: { unionTiming: UNION_TIMING },
  children: { count: CHILDREN_COUNT },
  education: { path: EDUCATION_PATH },
  residence: { mode: RESIDENCE_MODE },
  wealth: { shape: WEALTH_SHAPE },
  // 건강은 범주를 만들지 않는다. 질환명·수술 여부를 뜻하는 칸이 생기는 순간
  // 엔진이 의료 판단처럼 읽힌다. 축 값만 그대로 내보낸다.
  health: {},
};

/**
 * 축 벡터를 범주 분포로.
 *
 * @param {object} features 축 벡터 (0~1)
 * @param {object} set      범주표
 * @param {object} opts     { other: true 면 '기타' 몫을 남긴다 }
 * @returns {{dist: Record<string, number>, ranked: Array, flat: boolean}|null}
 */
export function distribute(features, set, opts = {}) {
  if (!features) return null;

  // 이 범주표가 실제로 쓰는 축만 남긴다.
  //
  // 안 자르면 '독립·조직' 같은 고용형태 축이 업종 분포의 분모에 끼어든다.
  // 어느 업종 원형에도 없는 축이라 모든 닮음을 똑같이 깎아, 순위는 그대로인데
  // **분포만 평평해진다.** 실제로 1위가 0.13 까지 눌렸다.
  const used = [...new Set(Object.values(set).flatMap((d) => Object.keys(d.proto)))];
  const v = restrictTo(features, used);

  const raw = Object.entries(set).map(([key, def]) => [key, Math.max(0, cosine(v, def.proto)) ** SHARPNESS]);
  const sum = raw.reduce((a, [, x]) => a + x, 0);
  if (sum <= 0) return null;

  const floor = opts.other ? OTHER_FLOOR : 0;
  let dist = Object.fromEntries(raw.map(([k, x]) => [k, (x / sum) * (1 - floor)]));
  if (opts.other) dist.other = floor;

  // 바닥을 깔고 다시 정규화 — 0 짜리 범주를 만들지 않는다
  const keys = Object.keys(dist);
  const lifted = Object.fromEntries(keys.map((k) => [k, dist[k] + MIN_P]));
  const lsum = keys.reduce((a, k) => a + lifted[k], 0);
  dist = Object.fromEntries(keys.map((k) => [k, lifted[k] / lsum]));

  const ranked = Object.entries(dist)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, p]) => ({ key, label: set[key]?.label ?? '기타', p: Math.round(p * 1000) / 1000,
      examples: set[key]?.examples ?? [] }));

  // 1위와 2위가 붙어 있으면 '골랐다'고 말하면 안 된다.
  // `hires` 의 FLAT_SPREAD 와 같은 취지다 — 못 가리면 못 가린다고 적는다.
  const spread = ranked.length >= 2 ? ranked[0].p - ranked[1].p : 1;
  return {
    dist: Object.fromEntries(ranked.map((r) => [r.key, r.p])),
    ranked, spread: Math.round(spread * 1000) / 1000,
    flat: spread < 0.05,
  };
}

/** 한 분야의 모든 분포를 한 번에 */
export function categorize(domain, features) {
  const sets = CATEGORY_SETS[domain] ?? {};
  const out = {};
  for (const [name, set] of Object.entries(sets)) {
    out[name] = distribute(features, set, { other: name === 'industry' });
  }
  return out;
}
