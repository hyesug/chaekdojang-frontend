/**
 * index.js — 의미축 해석 엔진의 입구
 *
 *   LEVEL 1  15체계 원시 계산            engine.js / hires/
 *   LEVEL 2  체계별 전통 해석            semantic/extract.js + rules.js + systems.js
 *   LEVEL 3  공통 의미축                 semantic/axes.js
 *   LEVEL 4  현실 결과 카테고리           semantic/categories.js
 *   LEVEL 5  15체계 종합                 semantic/ensemble.js
 *   LEVEL 6  실제 사례 검증·보정          src/validation/ + scripts/validate-semantic.mjs
 *   LEVEL 7  시기운 결합                 semantic/timing.js (이음매만)
 *
 * ── 출생명반으로 말할 수 있는 것과 없는 것을 가른다 ───────────
 *   natal          타고난 결. 출생 정보만으로 말한다
 *   currentState   지금 무엇을 하고 있나 — **원국만으로는 말하지 않는다**
 *   timing         시기. 뼈대는 인구통계이고 명반은 곡선을 조금 밀 뿐이다
 *
 * 셋을 한 덩어리로 내보내면 읽는 쪽이 구별하지 못한다. 그래서 가른다.
 */

import { readFortune } from '../engine.js';
import * as ZW from '../hires/ziwei.js';
import { interpretSystems } from './systems.js';
import { ensemble } from './ensemble.js';
import { marriageTimingCurve, natalSusceptibility } from './timing.js';
import { TIMING_EVIDENCE } from './reliability.js';

const safe = (fn) => { try { return fn(); } catch { return null; } };

export const PRINCIPLES = [
  '한 사례의 오답을 맞히기 위한 규칙을 추가하지 않는다.',
  '동일한 방향의 오류가 여러 독립 사례에서 반복될 때만 해석 규칙 수정 후보로 본다.',
  '실제 데이터를 본 뒤 수정한 규칙은 반드시 그 사례를 제외한 검증(LOO)에서도 개선되는지 확인한다.',
  '"열다섯 중 하나가 맞았다"를 적중으로 세지 않는다. 확률형 채점 규칙으로만 잰다.',
  '시기(날짜)는 검증에서 살아남지 못했다. 성향까지만 말한다.',
];

/**
 * 한 사람을 읽는다.
 *
 * @param {object} birth `readFortune` 과 같은 입력
 * @param {object} opts
 *   asOfDate     'YYYY-MM-DD'. 없으면 오늘. **원국 결과는 이 값에 흔들리지 않는다**
 *   calibration  체계×분야 실측값 (없으면 실측 무게는 전부 1.0)
 */
export function interpretPerson(birth, opts = {}) {
  const asOfDate = opts.asOfDate ?? null;
  const now = asOfDate ? new Date(`${asOfDate}T12:00:00+09:00`) : new Date();
  const fortune = readFortune(birth, { now });
  const input = fortune.input;

  const stack = input.timeKnown
    ? safe(() => ZW.stackAt(input, input.currentYear, null))
    : null;

  const interpreted = interpretSystems(fortune, stack);
  const { domains, weights } = ensemble(interpreted, opts.calibration ?? null);

  const timing = {
    marriage: marriageTimingCurve({ age: input.age, gender: input.gender },
      domains.relationship?.categories?.unionTiming ?? null),
    susceptibility: natalSusceptibility(domains),
    evidence: TIMING_EVIDENCE,
    note: '사건이 일어나는 해를 말하지 않는다. 구간 사이의 상대적 높낮이까지다.',
  };

  return {
    natal: {
      domains,
      // 건강은 분야 자체에 표시를 단다. 답변에서 진단처럼 쓰지 못하게
      health: { ...domains.health, notMedical: true,
        caution: '질환명·수술 여부를 말하지 않는다. 전통이 말하는 몸의 부담 신호까지다.' },
    },
    currentState: {
      available: false,
      why: '지금 이직 준비 중인지, 자격증 공부 중인지 같은 것은 출생명반에 들어 있지 않다. ' +
           '현재 상태를 물으면 본인에게 물어야 한다.',
      asOfDate, age: input.age, gender: input.gender,
    },
    timing,
    systems: interpreted.byDomain,
    meta: {
      asOfDate,
      timeKnown: input.timeKnown,
      weights,
      skipped: fortune.skipped,
      errors: fortune.errors,
      principles: PRINCIPLES,
      calibratedWith: opts.calibration ? '실측 무게 적용됨' : '실측 무게 없음 — 전부 1.0',
    },
  };
}

export { interpretSystems } from './systems.js';
export { ensemble } from './ensemble.js';
export { AXES, AXIS_LABEL } from './axes.js';
export { CATEGORY_SETS } from './categories.js';
export { allRules } from './rules.js';
