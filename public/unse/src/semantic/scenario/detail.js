/**
 * scenario/detail.js — **축을 사람이 읽을 수 있는 넓은 갈래로 옮긴다**
 *
 * 여기 있는 표는 **직업 예언표가 아니다.** `{technical: 0.62, analytical: 0.55}`
 * 라는 숫자를 "기술·분석·정보 처리 계열" 이라고 부르는 것뿐이고, 새로운
 * 운세 규칙을 하나도 만들지 않는다. 축 값은 전부 정적 해석(`readPerson`)이
 * 이미 구해 놓은 것이다.
 *
 * ── 하나의 직업을 짚지 않는다 ──────────────────────────────
 * "자바 개발자"·"의사"·"변호사" 는 명반에서 나오지 않는다. 이 저장소는
 * 그것을 여러 번 시도해 여러 번 실패했다(README 의 직업 예측 표). 넓은
 * 갈래까지가 근거가 닿는 곳이고, 그 아래는 사용자가 말해 준 것(context)
 * 이거나 나중에 실제 자료와 맞대는 Reality Matcher 의 몫이다.
 *
 * ── 애매하면 null ──────────────────────────────────────────
 * 1위와 2위의 차이가 작으면 고르지 않는다. 고르지 않는 것이 정답인 자리가
 * 있고, 이 층은 그 자리를 비워 두는 것이 일이다.
 */

import { AXES, AXIS_LABEL } from '../axes.js';

/** 직업 — 축 묶음을 넓은 역할 갈래로 */
export const CAREER_FAMILIES = [
  { key: 'technical_analytical', label: '기술·분석·정보 처리 계열',
    axes: ['technical', 'analytical', 'information', 'problemSolving'] },
  { key: 'research_specialist', label: '연구·전문 분석 계열',
    axes: ['research', 'analytical', 'specialist'] },
  { key: 'management_org', label: '조직 운영·관리 계열',
    axes: ['management', 'organization', 'interpersonal'] },
  { key: 'sales_client', label: '영업·협상·고객 접점 계열',
    axes: ['verbal', 'interpersonal', 'commercial'] },
  { key: 'creative_design', label: '창작·디자인 계열',
    axes: ['creative', 'aesthetic'] },
  { key: 'public_institution', label: '공공·제도 조직 계열',
    axes: ['public', 'organization'] },
  { key: 'field_care', label: '현장·돌봄 계열',
    axes: ['physical', 'care'] },
  { key: 'independent_business', label: '자영·사업형',
    axes: ['independence', 'commercial'] },
];

/** 일하는 방식 — 한 축이 뚜렷할 때만 */
const WORK_STYLE = [
  { key: 'specialist_technical', label: '전문 기술 역할', axes: ['specialist', 'technical'] },
  { key: 'management_role', label: '관리·조율 역할', axes: ['management'] },
  { key: 'changing_role', label: '역할 변화가 큰 자리', axes: ['change'] },
  { key: 'steady_role', label: '한자리를 오래 지키는 쪽', axes: ['stability'] },
];

/** 어디에 속해서 버는가 */
const EMPLOYMENT = [
  { key: 'organization', label: '조직형 — 소속되어 일하는 쪽', axes: ['organization', 'stability'] },
  { key: 'independent', label: '독립·사업형 — 자기 판에서 버는 쪽', axes: ['independence', 'commercial'] },
];

/** 분야마다 상세를 담는 칸 이름 */
export const DETAIL_SLOT = {
  career: 'roleFamily',
  relationship: 'relationshipStyle',
  marriage: 'marriageDetail',
  children: 'childrenMode',
  education: 'educationMode',
  wealth: 'wealthMode',
  residence: 'residenceMode',
  movement: 'movementMode',
  health: 'healthMode',
  majorChange: 'changeMode',
};

const mean = (profile, axes) => {
  const xs = axes.map((a) => profile?.[a]).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
};
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

/**
 * 여러 갈래 중 하나를 고른다. **1위가 뚜렷하지 않으면 고르지 않는다.**
 *
 * @param floor  이 값을 넘어야 갈래라고 부른다
 * @param margin 2위와 이만큼 벌어져야 고른다
 */
export function pickFamily(profile, families, { floor = 0.3, margin = 0.08 } = {}) {
  if (!profile) return { pick: null, why: '정적 프로필이 없다', ranked: [] };
  const ranked = families
    .map((f) => ({ key: f.key, label: f.label, axes: f.axes, score: r3(mean(profile, f.axes)) }))
    .filter((f) => Number.isFinite(f.score))
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return { pick: null, why: '축 값이 없다', ranked };
  const [a, b] = ranked;
  if (a.score < floor) {
    return { pick: null, why: `가장 높은 갈래도 ${a.score} 로 얕다`, ranked };
  }
  if (b && a.score - b.score < margin) {
    return { pick: null, why: `1위(${a.label} ${a.score})와 2위(${b.label} ${b.score})가 팽팽하다`, ranked };
  }
  return { pick: { key: a.key, label: a.label, score: a.score, axes: a.axes }, why: null, ranked };
}

/** 그 분야에서 가장 두드러진 축 하나 (라벨을 그대로 쓴다 — 말을 지어내지 않는다) */
export function topAxis(profile, domain, { floor = 0.3, margin = 0.06 } = {}) {
  const axes = AXES[domain] ?? [];
  const ranked = axes
    .map((a) => ({ axis: a, label: AXIS_LABEL[a] ?? a, score: r3(profile?.[a]) }))
    .filter((x) => Number.isFinite(x.score))
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return { pick: null, why: '축 값이 없다', ranked };
  const [a, b] = ranked;
  if (a.score < floor) return { pick: null, why: `가장 높은 축도 ${a.score} 로 얕다`, ranked };
  if (b && a.score - b.score < margin) {
    return { pick: null, why: `${a.label}(${a.score})와 ${b.label}(${b.score})가 팽팽하다`, ranked };
  }
  return { pick: { key: a.axis, label: a.label, score: a.score }, why: null, ranked };
}

/**
 * 한 분야의 상세를 만든다. **허용 단계 위로는 아무것도 만들지 않는다.**
 *
 * @param o
 *   domain, profile, level (specificity allowedLevel)
 * @returns {{detail, why}} detail 의 칸은 못 고르면 null 이다
 */
export function detailFor(o = {}) {
  const { domain, profile, level = 0 } = o;
  const slot = DETAIL_SLOT[domain] ?? null;
  const detail = {
    roleFamily: null, workStyle: null, employmentSetting: null, industryFamily: null,
    relationshipStyle: null, marriageDetail: null, childrenMode: null, educationMode: null,
    wealthMode: null, residenceMode: null, movementMode: null, healthMode: null, changeMode: null,
  };
  const why = {};
  if (!slot || level < 3) {
    return { detail, why: { gate: `허용 단계 ${level} — 방향·역할 아래로 내려가지 않는다` } };
  }

  if (domain === 'career') {
    const fam = pickFamily(profile, CAREER_FAMILIES);
    detail.roleFamily = fam.pick;
    if (fam.why) why.roleFamily = fam.why;

    const style = pickFamily(profile, WORK_STYLE, { floor: 0.3, margin: 0.06 });
    detail.workStyle = style.pick;
    if (style.why) why.workStyle = style.why;

    if (level >= 4) {
      const emp = pickFamily(profile, EMPLOYMENT, { floor: 0.3, margin: 0.1 });
      detail.employmentSetting = emp.pick;
      if (emp.why) why.employmentSetting = emp.why;
      // 산업군은 역할 갈래가 **아주 뚜렷할 때만**. 모호하면 비우는 것이 정답이다
      const clear = fam.pick && fam.ranked[1] && fam.pick.score - fam.ranked[1].score >= 0.18;
      detail.industryFamily = clear ? { key: fam.pick.key, label: fam.pick.label, score: fam.pick.score } : null;
      if (!clear) why.industryFamily = '산업군이라 부를 만큼 갈래가 벌어지지 않았다';
    } else {
      why.employmentSetting = `허용 단계 ${level} — 고용형태까지 내려가지 않는다`;
      why.industryFamily = `허용 단계 ${level} — 산업군까지 내려가지 않는다`;
    }
    return { detail, why };
  }

  // 나머지 분야는 그 분야 축의 1위를 그대로 옮긴다. 없는 말을 만들지 않는다
  const t = topAxis(profile, domain);
  detail[slot] = t.pick;
  if (t.why) why[slot] = t.why;
  return { detail, why };
}

export { AXIS_LABEL };
