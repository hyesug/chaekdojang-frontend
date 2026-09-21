/**
 * categories.js — LEVEL 4. 축을 **현실 질문의 답**으로 옮긴다
 *
 * ── 계층으로 나눈 이유 ─────────────────────────────────────
 * 업종 열여섯 칸을 바로 맞히려 들면 정보가 너무 얇게 퍼진다. 그리고
 * 사람이 실제로 궁금해하는 것은 대개 업종보다 앞의 것이다 — "이 사람은
 * 무엇을 다루는 사람인가", "어디에 속해서 일하는 사람인가".
 *
 *   LEVEL A  일의 본질      기술·분석·창작·대인·신체·관리·상업·돌봄·언어
 *   LEVEL B  작업 환경      조직·독립·프리랜서·사업·현장·사무·전문직
 *   LEVEL C  산업군         A/B 조합에서 도출
 *   LEVEL D  구체 직업      예시로만 보여 준다
 *
 * A·B 가 엔진이 실제로 읽는 것이고, C 는 그 조합이며, D 는 **범주를
 * 설명하는 보기**이지 짚는 답이 아니다.
 *
 * ── 산업군 원형을 손으로 쓰지 않는다 ────────────────────────
 * 처음엔 업종마다 원형 벡터를 손으로 적었다. 그랬더니 **정답 속성을
 * 그대로 넣어도 정답 업종이 1위로 안 나왔다(6/11).** 금융·보험 원형에
 * `verbal` 이 없어 보험교육이 영업으로, 영업 원형에 `physical` 이 없어
 * 대리점이 요식으로 갔다. 명반과 무관한 **변환층 자체의 버그**였다.
 *
 * 그래서 업종 원형은 **그 업종에 속한 직업들의 평균**으로 만든다.
 * 업종이란 곧 그 안의 직업들이므로, 손으로 따로 적을 이유가 없고
 * 적는 순간 어긋난다.
 */

import { cosine, restrictTo, AXES } from './axes.js';
import { OCCUPATIONS, OCCUPATION_MEAN, centered } from './tables/occupations.js';

/** 닮음을 분포로 바꿀 때의 날카로움. 사례를 보고 고른 값이 아니다 */
export const SHARPNESS = 3;
/** 어떤 범주도 0 으로 두지 않는다 — 명반은 '절대 아니다'를 말할 수 없다 */
export const MIN_P = 0.02;

// ─────────────────────────────────────────────────────────────
// LEVEL A — 일의 본질
// ─────────────────────────────────────────────────────────────

export const LEVEL_A = {
  technical: '기술', analytical: '분석', creative: '창작', interpersonal: '대인',
  physical: '신체', management: '관리', commercial: '상업', care: '돌봄', verbal: '언어',
};

/**
 * A 는 원형이 필요 없다. 축 자체가 답이라 **그대로 정규화**한다.
 * 다만 `research·information·problemSolving·specialist` 는 분석 계열의
 * 결을 나누는 축이라 A 에서는 `analytical` 에 합쳐 읽는다.
 */
const A_MERGE = {
  analytical: ['analytical', 'information', 'problemSolving'],
  technical: ['technical'], creative: ['creative', 'aesthetic'],
  interpersonal: ['interpersonal'], physical: ['physical'],
  management: ['management'], commercial: ['commercial'],
  care: ['care'], verbal: ['verbal'],
};

export function levelA(features) {
  if (!features) return null;
  const raw = Object.fromEntries(Object.entries(A_MERGE)
    .map(([k, axes]) => [k, Math.max(...axes.map((a) => features[a] ?? 0))]));
  return toDist(raw, LEVEL_A);
}

// ─────────────────────────────────────────────────────────────
// LEVEL B — 작업 환경
// ─────────────────────────────────────────────────────────────

export const LEVEL_B = {
  organization: { label: '조직', proto: { organization: 0.9, stability: 0.6, public: 0.4 } },
  independent: { label: '독립', proto: { independence: 0.9, commercial: 0.5, change: 0.4 } },
  freelance: { label: '프리랜서', proto: { independence: 0.8, change: 0.6, creative: 0.5, specialist: 0.5 } },
  business: { label: '사업', proto: { commercial: 0.9, independence: 0.8, management: 0.6 } },
  field: { label: '현장', proto: { physical: 0.9, technical: 0.5, competitive: 0.4 } },
  office: { label: '사무', proto: { organization: 0.8, information: 0.6, analytical: 0.5, stability: 0.5 } },
  professional: { label: '전문직', proto: { specialist: 0.9, research: 0.6, technical: 0.6, analytical: 0.5 } },
};

// ─────────────────────────────────────────────────────────────
// LEVEL C — 산업군. 그 업종에 속한 직업들의 평균이다
// ─────────────────────────────────────────────────────────────

const CATEGORY_LABEL = {
  it_software: 'IT·개발', engineering: '공학·기술', research_analysis: '연구·분석',
  planning_management: '기획·관리', finance_insurance: '금융·보험', sales_commerce: '영업·상업',
  education_counsel: '교육·상담', medical_health: '의료·건강', sports: '체육',
  beauty_design: '미용·디자인', arts_content: '예술·콘텐츠', food_service: '요식·서비스',
  public_admin: '행정·공공', manufacturing_construction: '제조·건설', transport_machine: '운송·기계',
};

export const CAREER_CATEGORIES = (() => {
  const groups = {};
  for (const [name, o] of Object.entries(OCCUPATIONS)) {
    (groups[o.category] ??= []).push({ name, features: o.features });
  }
  const out = {};
  for (const [key, members] of Object.entries(groups)) {
    const proto = {};
    for (const ax of AXES.career) {
      proto[ax] = members.reduce((a, m) => a + (m.features[ax] ?? 0), 0) / members.length;
    }
    out[key] = {
      label: CATEGORY_LABEL[key] ?? key,
      proto: Object.fromEntries(Object.entries(proto).filter(([, v]) => v > 0.05)),
      examples: members.map((m) => m.name),
      memberCount: members.length,
    };
  }
  return out;
})();

// ─────────────────────────────────────────────────────────────

function toDist(raw, labels) {
  const keys = Object.keys(raw);
  const pow = keys.map((k) => [k, Math.max(0, raw[k]) ** SHARPNESS]);
  const sum = pow.reduce((a, [, v]) => a + v, 0);
  if (sum <= 0) return null;
  const lifted = Object.fromEntries(pow.map(([k, v]) => [k, v / sum + MIN_P]));
  const lsum = Object.values(lifted).reduce((a, b) => a + b, 0);
  const dist = Object.fromEntries(keys.map((k) => [k, lifted[k] / lsum]));
  const ranked = Object.entries(dist).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, p]) => ({
      key, p: Math.round(p * 1000) / 1000,
      label: typeof labels[key] === 'string' ? labels[key] : labels[key]?.label ?? key,
      examples: labels[key]?.examples ?? [],
    }));
  const spread = ranked.length >= 2 ? ranked[0].p - ranked[1].p : 1;
  return { dist, ranked, spread: Math.round(spread * 1000) / 1000, flat: spread < 0.05 };
}

/** 원형표에 대고 분포를 만든다 */
export function distribute(features, set) {
  if (!features) return null;
  const used = [...new Set(Object.values(set).flatMap((d) => Object.keys(d.proto)))];
  const v = restrictTo(features, used);
  const raw = Object.fromEntries(Object.entries(set)
    .map(([k, d]) => [k, Math.max(0, cosine(v, d.proto))]));
  return toDist(raw, set);
}

/**
 * 산업군은 **평균을 뺀 자리에서** 견준다.
 *
 * 그냥 견주면 "보통 직업"에 가까운 업종(대인·조직이 중간쯤인 것들)이
 * 언제나 이긴다. 직업들이 서로 닮았기 때문이다. 양쪽에서 평균을 빼면
 * "이 사람이 치우친 쪽"과 "이 업종이 치우친 쪽"을 견주게 된다.
 */
const CENTERED_CATEGORIES = Object.fromEntries(Object.entries(CAREER_CATEGORIES)
  .map(([k, d]) => [k, { ...d, proto: centered(d.proto, AXES.career) }]));

export function distributeCentered(profile, set = CENTERED_CATEGORIES) {
  if (!profile) return null;
  const raw = Object.fromEntries(Object.entries(set)
    .map(([k, d]) => [k, Math.max(0, cosine(profile, d.proto))]));
  return toDist(raw, set);
}

/**
 * 네 층을 한 번에.
 * @param {object} features 0~1 로 편 값 (화면·문장용)
 * @param {object|null} profile 평균에서 벗어난 방향 (−1~+1). 있으면 산업군에 쓴다
 */
export function categorizeCareer(features, profile = null) {
  if (!features) return null;
  const a = levelA(features);
  const b = distribute(features, LEVEL_B);
  const c = profile ? distributeCentered(profile) : distribute(features, CAREER_CATEGORIES);
  return {
    levelA: a, levelB: b, levelC: c,
    // LEVEL D — 범주를 설명하는 보기일 뿐, 이 직업을 짚는 것이 아니다
    levelD: c ? [...new Set(c.ranked.slice(0, 3).flatMap((x) => x.examples ?? []))].slice(0, 6) : [],
  };
}

export const CATEGORY_SETS = { career: { levelB: LEVEL_B, levelC: CAREER_CATEGORIES } };
