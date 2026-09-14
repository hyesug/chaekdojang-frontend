/**
 * _base.js — 체계 모듈의 공통 규격
 *
 * 사주와 타로는 서로 아무 관계가 없다. 쓰는 언어가 다르고 보는 대상도 다르다.
 * 그래도 "이 사람은 어떤 사람인가"에 대해서는 둘 다 뭔가를 말한다.
 *
 * 그 말을 겹쳐 보려면 공통 축이 필요하다. 각 모듈은 자기 결과를
 * 아래 네 가지 지표로 환산해서 내놓는다. 종합 레이어는 원본 해석은
 * 건드리지 않고 이 지표만 가지고 합산한다.
 *
 *   elements  오행 다섯 축. 동양 체계는 그대로, 서양 4원소는 아래 표로 환산
 *   traits    기질 다섯 축. −1 ~ +1
 *   domains   삶의 영역별 점수. 0 ~ 100. 그 체계가 말할 게 없으면 null
 *   tags      아래 고정 목록에서만 고른다. 겹침을 세는 축이다
 *   keywords  그 체계 고유의 낱말. 화면 표시용이고 종합에는 쓰지 않는다
 *
 * tags와 keywords를 나눈 이유가 있다. 사주는 "의리"라 하고 구성학은
 * "신용"이라 하고 숙요는 "약속"이라 한다. 셋 다 같은 얘기인데 글자가
 * 달라서 겹치지 않는다. 자유 낱말로는 교집합이 영원히 안 나온다.
 * 그래서 종합에 쓰는 축은 고정 어휘로 강제한다.
 */

export const ELEMENT_NAMES = ['목', '화', '토', '금', '수'];
export const TRAIT_NAMES = ['주도', '외향', '감성', '안정', '실리'];
export const DOMAIN_NAMES = ['재물', '관계', '직업', '건강', '학업'];

/**
 * 서양 4원소 → 오행 환산표.
 *
 * 불·흙·물은 화·토·수에 곧바로 대응한다. 문제는 공기와 금이다.
 * 서양에 금(응축·결단)에 해당하는 원소가 없고, 동양에 공기가 없다.
 * 여기서는 공기를 목(확산·소통)에 주로 싣고 일부를 금에 나눈다.
 * 완전한 대응이 아니라 근사라는 점은 화면에도 밝혀 둔다.
 */
export const WESTERN_TO_OHAENG = {
  불:   [0, 1, 0, 0, 0],
  흙:   [0, 0, 0.7, 0.3, 0],
  공기: [0.7, 0, 0, 0.3, 0],
  물:   [0, 0, 0, 0, 1],
};

/** 요일 → 칠요 행성 → 오행. 숙요·태국·마하보테가 공유한다 */
export const WEEKDAY_PLANET = [
  { name: '태양', element: 1, color: '빨강' },   // 일
  { name: '달',   element: 4, color: '노랑' },   // 월
  { name: '화성', element: 1, color: '분홍' },   // 화
  { name: '수성', element: 4, color: '초록' },   // 수
  { name: '목성', element: 0, color: '주황' },   // 목
  { name: '금성', element: 3, color: '파랑' },   // 금
  { name: '토성', element: 2, color: '보라' },   // 토
];

/**
 * 종합용 고정 어휘. 모든 체계는 여기서만 태그를 고른다.
 * 함부로 늘리면 겹침이 다시 흐려지니, 스무 개를 넘기지 않는다.
 */
export const TAGS = [
  '독립', '주도', '결단', '실행', '책임',   // 미는 힘
  '표현', '사교', '자유', '변화',           // 밖으로 뻗는 힘
  '내향', '직관', '감수성', '돌봄',         // 안으로 향하는 힘
  '분석', '학습', '완벽',                   // 다듬는 힘
  '인내', '안정', '재물', '명예',           // 쌓는 힘
];

const TAG_SET = new Set(TAGS);

/** 고정 어휘에 없는 태그는 버린다. 오타 하나로 교집합이 깨지는 걸 막는다 */
export function validateTags(tags = []) {
  const bad = tags.filter((t) => !TAG_SET.has(t));
  if (bad.length) {
    console.warn(`[운세] 등록되지 않은 태그가 무시되었습니다: ${bad.join(', ')}`);
  }
  return tags.filter((t) => TAG_SET.has(t));
}

export function zeroElements() {
  return [0, 0, 0, 0, 0];
}

export function zeroTraits() {
  return { 주도: 0, 외향: 0, 감성: 0, 안정: 0, 실리: 0 };
}

export function emptyDomains() {
  return { 재물: null, 관계: null, 직업: null, 건강: null, 학업: null };
}

/** 합이 1이 되도록 정규화. 전부 0이면 그대로 둔다 */
export function normalizeElements(arr) {
  const sum = arr.reduce((a, b) => a + b, 0);
  if (sum <= 0) return zeroElements();
  return arr.map((v) => v / sum);
}

/**
 * 체계 모듈의 결과를 만든다.
 *
 * @param {object} o
 * @param {string} o.id        모듈 식별자
 * @param {string} o.name      화면에 뜨는 이름
 * @param {string} o.hanja     한자/원어 표기
 * @param {string} o.headline  한 줄 요약
 * @param {Array}  o.facts     계산 결과 원본 [{label, value, note?}]
 *                             — 해석이 아니라 "무엇이 나왔는가"
 * @param {Array}  o.readings  해석문 [{title, text}]
 * @param {object} o.signals   종합용 지표
 * @param {number} [o.confidence=1] 이 결과를 종합에 얼마나 반영할지 (0~1).
 *                             출생 시간을 모르면 시주에 의존하는 체계는 낮춘다.
 */
export function result(o) {
  return {
    id: o.id,
    name: o.name,
    hanja: o.hanja ?? '',
    headline: o.headline ?? '',
    facts: o.facts ?? [],
    readings: o.readings ?? [],
    confidence: o.confidence ?? 1,
    signals: {
      elements: normalizeElements(o.signals?.elements ?? zeroElements()),
      traits: { ...zeroTraits(), ...(o.signals?.traits ?? {}) },
      domains: { ...emptyDomains(), ...(o.signals?.domains ?? {}) },
      tags: validateTags(o.signals?.tags),
      keywords: o.signals?.keywords ?? [],
    },
  };
}

// ── 숫자 놀음에 쓰는 잔 도구들 ───────────────────────────────

/** 각 자리 숫자를 더해 한 자리로 줄인다. 마스터 수(11·22·33)는 남긴다 */
export function digitRoot(n, keepMaster = true) {
  let v = Math.abs(n);
  while (v > 9) {
    if (keepMaster && (v === 11 || v === 22 || v === 33)) return v;
    v = String(v).split('').reduce((a, c) => a + Number(c), 0);
  }
  return v;
}

/** 1부터 시작하는 나머지. (n mod m) 이 0이면 m을 준다 — 동양 산법의 관례 */
export function modFrom1(n, m) {
  const r = n % m;
  return r === 0 ? m : r;
}

/** 요일 (0=일요일). 율리우스일 기준이라 달력 구현에 의존하지 않는다 */
export function weekdayFromJDN(jdn) {
  return (jdn + 1) % 7;
}

export const WEEKDAY_KR = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 주제 적합도 — 어느 체계가 어느 영역에 할 말이 있는가
 *
 * 체계마다 이미 weight 가 하나씩 붙어 있지만 그건 다른 축이다.
 * 그쪽은 "이 산법을 얼마나 믿을 수 있나"(사주 1.5, 태을 0.6)이고,
 * 여기는 "이 질문에 이 체계가 맞나"다. 둘은 곱해서 쓴다.
 *
 * 값은 취향이 아니라 그 전통 안에 전용 장치가 있느냐로 정한다.
 *
 *   1.0  그 영역을 보는 자리가 따로 있다
 *        — 자미두수 재백궁, 사주 재성, 베딕 7하우스, 홍국 생문
 *   0.6~0.9  전체 기운에서 간접적으로 유추한다
 *   0.3~0.5  원래 그걸 보는 물건이 아니다
 *        — 태을신수는 국운을 보지 개인 애정을 보지 않는다
 *
 * 낮은 값은 "틀렸다"가 아니라 "이 질문에서는 뒤로 물러나라"는 뜻이다.
 * 서로 다른 걸 재는 체계를 같은 무게로 평균 내면 합의가 아니라
 * 잡음 상쇄가 되고, 점수가 전부 가운데로 몰린다.
 */
const DOMAIN_WEIGHT = {
  //            총운  애정  금전  직장  학업  건강
  saju:      [1.0, 1.0, 1.0, 1.0, 0.9, 0.8], // 십신이 영역마다 배정돼 있다
  jamidusu:  [1.0, 1.0, 1.0, 1.0, 0.7, 1.0], // 12궁 — 부처·재백·관록·질액
  astrology: [1.0, 1.0, 0.8, 0.9, 0.7, 0.6], // 하우스. 6하우스는 현대에 덜 쓴다
  vedic:     [1.0, 1.0, 0.8, 0.9, 0.9, 0.9], // 하우스 + 다샤. 질병 하우스가 뚜렷
  juyeok:    [1.0, 0.6, 0.6, 0.6, 0.5, 0.5], // 괘는 상황 전체를 본다
  yukim:     [0.9, 0.7, 0.7, 0.8, 0.4, 0.4], // 일의 성패를 보는 점법
  hongguk:   [0.9, 0.5, 1.0, 1.0, 0.5, 0.6], // 팔문 — 생문이 재물, 개문이 관직
  gujeong:   [0.9, 0.6, 0.7, 0.7, 0.5, 0.6], // 방위와 시기가 본령
  sukyo:     [0.8, 1.0, 0.4, 0.5, 0.4, 0.4], // 삼구의 비법이 관계 전용 장치
  tojeong:   [1.0, 0.6, 0.8, 0.6, 0.5, 0.5], // 한 해 전체를 보라고 만든 것
  mahabote:  [0.9, 0.7, 0.6, 0.6, 0.5, 0.5], // 요일 행성 — 기질 중심
  thai:      [0.8, 0.9, 0.4, 0.4, 0.3, 0.4], // 벗·적 구도가 관계를 본다
  kabbalah:  [0.9, 0.6, 0.4, 0.5, 0.5, 0.3], // 수비학 — 기질 중심
  tarot:     [0.9, 0.7, 0.5, 0.5, 0.4, 0.4], // 생일 카드의 상징
  taeeul:    [1.0, 0.3, 0.5, 0.6, 0.3, 0.3], // 국운·대세를 보는 물건
};

/** DOMAIN_WEIGHT 의 열 순서. forecast.js 의 AREAS 와 같아야 한다 */
export const DOMAIN_ORDER = ['총운', '애정운', '금전운', '직장운', '학업운', '건강운'];

/** 등록되지 않은 체계나 영역은 1 로 둔다 — 가중치를 모르면 깎지 않는다 */
export function domainWeight(id, area) {
  const row = DOMAIN_WEIGHT[id];
  if (!row) return 1;
  const i = DOMAIN_ORDER.indexOf(area);
  return i < 0 ? 1 : row[i];
}
