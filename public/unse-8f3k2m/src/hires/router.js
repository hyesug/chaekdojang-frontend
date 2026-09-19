/**
 * router.js — 질문에 따라 계산량을 고른다
 *
 * 모든 질문에 모든 계산을 돌릴 필요가 없다. "어느 도시가 좋은가"에
 * 안타르다샤 전환일이 필요하지 않고, "올해 이직할까"에 릴로케이션 차트가
 * 필요하지 않다. 필요 없는 계산을 돌리면 화면이 느려지고, 문맥이 길어져
 * 정작 중요한 값이 묻힌다.
 *
 * 낱말로 가른다. 맞히지 못하면 '일반'으로 떨어뜨리고, 그때는 분야를
 * 좁히지 않았다는 사실을 문맥에 그대로 적는다 — 엉뚱한 분야를 골라
 * 그럴듯하게 답하는 것보다 낫다.
 */

import { CITIES } from '../core/place.js';

const RULES = [
  { domain: '이사', words: ['이사', '이주', '전세', '월세', '집을 옮', '거처', '이삿', '이전'] },
  { domain: '주거', words: ['집', '부동산', '아파트', '매매', '매수', '청약', '전셋', '내 집'] },
  { domain: '자녀', words: ['아이', '자녀', '출산', '임신', '아기', '둘째', '첫째'] },
  { domain: '결혼', words: ['결혼', '혼인', '예식', '상견례', '약혼', '청혼', '웨딩', '신혼'] },
  { domain: '관계', words: ['연애', '애인', '남친', '여친', '썸', '소개팅', '이별', '재회', '인연', '짝'] },
  { domain: '직업', words: ['이직', '직장', '회사', '취업', '퇴사', '승진', '연봉', '커리어', '일자리', '면접', '입사', '직무', '부서', '창업', '사업'] },
  { domain: '재물', words: ['돈', '재물', '재테크', '수입', '자산', '빚', '대출', '투자', '정산', '계약금'] },
  { domain: '건강', words: ['건강', '몸', '병', '수술', '치료', '검진', '체력', '아픈'] },
  { domain: '학업', words: ['공부', '시험', '자격', '학업', '합격', '진학', '유학', '전공'] },
];

/** 지역·방향을 묻는가 — 분야와 별개로 켠다 */
const PLACE_WORDS = ['어디', '지역', '도시', '방향', '방위', '남쪽', '북쪽', '동쪽', '서쪽',
                     '이사', '이주', '살면', '거주', '통근', '출퇴근', '수도권', '지방', '해외'];

/** 하루짜리 날짜를 묻는가 — 이때만 일진까지 내려간다 */
const DAY_WORDS = ['며칠', '날짜', '날 잡', '택일', '무슨 요일', '언제가 좋은 날', '길일', '개업일', '수술 날'];

/** 몇 해를 볼 것인가 */
function spanFromQuestion(q, thisYear) {
  const years = [...q.matchAll(/(20\d{2})\s*년?/g)].map((m) => Number(m[1]))
    .filter((y) => y >= thisYear - 30 && y <= thisYear + 30);
  if (years.length) {
    const from = Math.min(...years, thisYear);
    const to = Math.max(...years);
    return { fromYear: from, years: Math.max(1, Math.min(6, to - from + 1)) };
  }
  if (/올해|금년|이번 ?해/.test(q)) return { fromYear: thisYear, years: 1 };
  if (/내년|다음 ?해/.test(q)) return { fromYear: thisYear, years: 2 };
  if (/앞으로|향후|몇 ?년|장기/.test(q)) return { fromYear: thisYear, years: 5 };
  return { fromYear: thisYear, years: 3 };
}

/**
 * 질문 하나를 계산 계획으로 옮긴다.
 *
 * @param {string} question
 * @param {number} thisYear 사주 연도 기준 올해
 */
export function routeQuestion(question, thisYear) {
  const q = String(question ?? '');
  // 먼저 나온 낱말이 그 사람이 정말로 묻는 것이다. "이직할까요? 이사도
  // 하게 되나요?" 에서 주된 분야는 이직이지 이사가 아니다. 규칙을 적어 둔
  // 순서가 아니라 질문에 나온 순서로 고른다.
  const hits = RULES
    .map((r) => {
      const at = r.words
        .map((w) => q.indexOf(w))
        .filter((i) => i >= 0);
      return at.length ? { domain: r.domain, at: Math.min(...at), n: at.length } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at || b.n - a.n);
  const domains = hits.map((h) => h.domain);

  // 이직은 직업과 이사를 함께 묻는 일이 많다. 둘 다 켜 두고 선후를 따진다
  if (domains.includes('직업') && /이사|통근|출퇴근|옮기|지방|수도권/.test(q)) {
    if (!domains.includes('이사')) domains.push('이사');
  }
  if (domains.includes('결혼') && !domains.includes('주거') && /집|살림|신혼/.test(q)) {
    domains.push('주거');
  }
  // 결혼을 물으면 상대의 직업·경제가 곧바로 따라 나온다 (확장 추론).
  // 묻지 않았어도 계산이 되는 자리는 미리 켜 둔다.
  if (domains.includes('결혼') && !domains.includes('재물')) domains.push('재물');

  const primary = domains[0] ?? null;
  const span = spanFromQuestion(q, thisYear);

  // 질문에 실제 도시 이름이 나오면 그 도시로 릴로케이션 차트를 견준다
  const cities = CITIES.filter((c) => c.kr && q.includes(c.name)).map((c) => c.name).slice(0, 5);

  return {
    question: q,
    matched: domains.length > 0,
    primary,
    domains: domains.length ? domains.slice(0, 3) : ['직업'],
    // 맞히지 못했으면 그 사실을 문맥에 적는다
    fallback: domains.length === 0,
    needsPlace: PLACE_WORDS.some((w) => q.includes(w)) || cities.length > 0,
    needsDay: DAY_WORDS.some((w) => q.includes(w)),
    cities,
    ...span,
    pipeline: pipelineFor(domains.length ? domains : ['직업'], {
      place: PLACE_WORDS.some((w) => q.includes(w)) || cities.length > 0,
      day: DAY_WORDS.some((w) => q.includes(w)),
    }),
  };
}

/** 어느 계산을 돌릴지 — 분야마다 다르다 */
export function pipelineFor(domains, flags = {}) {
  const p = {
    bazi: ['세운', '월운'],
    ziwei: ['대한', '유년', '유월'],
    western: ['transit'],
    vedic: ['dasha'],
    location: false,
    day: false,
  };
  if (flags.day) { p.bazi.push('일진'); p.day = true; }
  if (flags.place) p.location = true;

  const d = new Set(domains);
  if (d.has('직업') || d.has('재물')) {
    p.western.push('solarReturn', 'progression');
    p.vedic.push('D10', 'gochara');
  }
  if (d.has('결혼') || d.has('관계')) {
    p.western.push('progression');
    p.vedic.push('D9');
  }
  if (d.has('재물')) p.vedic.push('D2');
  if (d.has('자녀')) p.vedic.push('D7');
  if (d.has('주거') || d.has('이사')) {
    p.vedic.push('D4');
    p.location = true;
  }
  // 연도를 좁히는 기법은 어느 분야에서나 쓴다
  p.western.push('solarArc', 'profection');
  if (d.has('건강')) p.bazi.push('오행편중');
  return p;
}

/** 화면에서 바로 쓰는 기본 계획 (질문을 아직 모를 때) */
export function defaultPlan(thisYear) {
  return {
    question: '', matched: false, primary: null, fallback: true,
    domains: ['직업', '재물', '관계'],
    needsPlace: false, needsDay: false, cities: [],
    fromYear: thisYear, years: 3,
    pipeline: pipelineFor(['직업', '재물', '관계']),
  };
}
