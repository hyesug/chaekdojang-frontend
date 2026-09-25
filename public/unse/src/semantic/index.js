/**
 * index.js — 의미축 해석 엔진 v1 의 입구 (**직업**)
 *
 *   LEVEL 1  15체계 원시 계산       engine.js · hires/
 *   LEVEL 2  체계별 전통 해석        extract.js → rules.js → systems.js
 *   LEVEL 3  공통 의미축            axes.js (스무 축)
 *   LEVEL 4  현실 결과 카테고리       categories.js (A→B→C→D 네 층)
 *   LEVEL 5  15체계 종합            ensemble.js (평균이 아니다)
 *   LEVEL 6  사례 검증·보정          calibration.js + scripts/analyze-career.mjs
 *   LEVEL 7  시기운 결합            timing.js (이음매만)
 *
 * 처음 보는 사람의 생년월일시만으로 답이 나온다. 근거가 약하면 "모르겠다"가
 * 아니라 **최선의 추정 + 그 추정의 확신도**를 낸다.
 *
 * ── 결혼·자녀·학업·재물·주거 ───────────────────────────────
 * 표는 이미 `tables/` 에 있고(ziwei·saju·western·vedic 각 분야), 이번
 * 작업에서는 **직업만** 끝까지 돌렸다. 방법이 실제로 도는지 한 분야에서
 * 먼저 확인하고 같은 방식으로 넓힌다.
 */

import { readFortune } from '../engine.js';
import * as ZW from '../hires/ziwei.js';
import { interpretCareer } from './systems.js';
import { poolCareer } from './ensemble.js';
import { categorizeCareer } from './categories.js';
import { AXES, AXIS_LABEL } from './axes.js';
import { SYSTEM_NAME } from './extract.js';
import { INDEPENDENT_LINEAGES } from './lineage.js';
import { interpretDomain, gather, DOMAINS, DOMAIN_LABEL } from './domains.js';
import { poolDomain } from './ensemble.js';

const safe = (fn) => { try { return fn(); } catch { return null; } };

export const PRINCIPLES = [
  '한 사례의 오답을 맞히기 위한 규칙을 추가하지 않는다.',
  '같은 방향의 오류가 서로 독립인 여러 사례에서 반복될 때만 수정 후보로 본다.',
  '자료를 보고 고친 규칙은 그 사람을 뺀 검증(LOO)에서도 나아져야 남긴다.',
  '"열다섯 중 하나가 맞았다"를 적중으로 세지 않는다.',
  '근거가 약해도 답은 낸다. 대신 확신도를 함께 적는다.',
];

/**
 * 확신도 — 이 답을 얼마나 믿어도 되는가.
 *
 * 세 가지를 센다. **맞을 확률이 아니라 근거의 두께**다.
 */
function confidenceOf(pool) {
  const direct = pool.directCount ?? 0;
  const lineages = new Set(pool.contributors.map((c) => c.lineage));
  const indep = [...lineages].filter((L) => INDEPENDENT_LINEAGES.includes(L)).length;
  const score = Math.min(1, (direct / 4) * 0.5 + (indep / 4) * 0.3 + Math.min(1, pool.spokeCount / 12) * 0.2);
  return {
    score: Math.round(score * 100) / 100,
    level: score >= 0.7 ? '두꺼움' : score >= 0.45 ? '보통' : '얇음',
    directSystems: direct,
    independentLineages: indep,
    spokeCount: pool.spokeCount,
    note: '실제 사례 열한 명에 대고 잰 값이라, 이 확신도는 근거의 두께이지 적중률이 아니다.',
  };
}

/**
 * **원국을 읽을 때는 태어난 순간을 기준으로 세운다.**
 *
 * ── 왜 (실제로 걸린 버그) ──────────────────────────────────
 * 열다섯 가운데 몇은 '지금'을 재료로 쓴다 — 육임은 묻는 순간으로 판을
 * 세우고, 태을·구성학은 그 해의 연반을 본다. 그대로 두었더니 **같은
 * 사람의 '타고난 결'이 해가 바뀌면 달라졌다.** 원국이 올해에 따라
 * 바뀌면 그건 원국이 아니다.
 *
 * 그래서 원국 해석에는 `now` 를 **출생 시각**으로 준다. 본명국을 세우는
 * 셈이라 전통적으로도 이쪽이 맞고, 무엇보다 같은 사람에게 늘 같은 답이
 * 나온다. `asOfDate` 는 나중에 시기 층이 붙을 때 쓸 자리다.
 */
export function natalFortune(birth) {
  const at = new Date(Date.UTC(birth.year, (birth.month ?? 1) - 1, birth.day ?? 1, 3, 0, 0));
  const fortune = readFortune(birth, { now: at });
  const stack = fortune.input.timeKnown
    ? safe(() => ZW.stackAt(fortune.input, fortune.input.sajuYear ?? fortune.input.currentYear, null))
    : null;
  return { fortune, stack };
}

/** 두드러진 축 — 평균에서 가장 많이 벗어난 쪽 */
export function leadingAxes(profile, n = 5, floor = 0.25) {
  if (!profile) return [];
  return Object.entries(profile)
    .filter(([, v]) => v >= floor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => ({ axis: k, label: AXIS_LABEL[k], value: v }));
}

/**
 * 한 사람의 직업 성향을 읽는다.
 *
 * @param {object} birth `readFortune` 과 같은 입력
 * @param {object} opts
 *   asOfDate     'YYYY-MM-DD'. 원국 결과는 이 값에 흔들리지 않는다
 *   featureWeights calibration.weightsFrom 결과 (없으면 보정 없음)
 */
export function readCareer(birth, opts = {}) {
  const { fortune, stack } = natalFortune(birth);
  const input = fortune.input;
  const systems = interpretCareer(fortune, stack);
  const pool = poolCareer(systems, opts.featureWeights ?? null);
  const categories = pool.features ? categorizeCareer(pool.features, pool.profile) : null;

  return {
    domain: 'career',
    // 평균에서 벗어난 방향 — 이것이 엔진이 실제로 읽은 것이다
    profile: pool.profile,
    // 0~1 로 편 값 — 화면·문장용
    features: pool.features,
    leading: leadingAxes(pool.profile),
    categories,
    confidence: confidenceOf(pool),
    // 체계마다 따로 낸 것. **합친 것과 나란히 남긴다**
    systems: systems.map((s) => ({
      system: s.system, name: s.systemName, lineage: s.lineage, status: s.status,
      why: s.why ?? null, evidenceType: s.evidenceType ?? null,
      features: s.features,
      top: s.features ? leadingAxes(s.features, 4, 0.15) : [],
      evidence: s.evidence ?? [],
    })),
    consensus: pool.consensus,
    contributors: pool.contributors,
    silent: pool.silent,
    meta: {
      asOfDate: opts.asOfDate ?? null,
      timeKnown: input.timeKnown,
      directCount: pool.directCount,
      auxScale: pool.auxScale,
      calibrated: Boolean(opts.featureWeights),
      principles: PRINCIPLES,
      // 출생명반으로 말할 수 없는 것
      notFromNatal: '지금 이직 준비 중인지, 올해 합격할지 같은 것은 출생명반에 들어 있지 않다.',
    },
  };
}

/**
 * 한 사람의 **열두 분야**를 모두 읽는다.
 *
 * 직업만 깊고 나머지는 빈약한 상태로 끝내지 않으려고 만든 입구다.
 * 분야마다 열다섯 체계가 각자 말하고, 합치는 방식은 직업과 같다.
 *
 * @param {object} birth `readFortune` 과 같은 입력
 * @param {object} opts { domains?: string[] — 고르면 그것만 }
 */
export function readPerson(birth, opts = {}) {
  const { fortune, stack } = natalFortune(birth);
  const raw = gather(fortune, stack);
  const want = opts.domains ?? DOMAINS;
  const out = {};
  for (const d of want) {
    const reads = d === 'career' ? interpretCareer(fortune, stack) : interpretDomain(raw, d);
    const spoke = reads.filter((r) => r.status === 'ok');
    const pool = poolDomain(reads, d);
    out[d] = {
      label: DOMAIN_LABEL[d],
      features: pool.features,
      profile: pool.profile,
      leading: leadingAxes(pool.profile, 4, 0.25),
      spokeCount: spoke.length,
      directCount: spoke.filter((r) => r.evidenceType === 'direct').length,
      systems: reads.map((r) => ({
        system: r.system, name: r.systemName, status: r.status, why: r.why ?? null,
        evidenceType: r.evidenceType ?? null, groupCount: r.groupCount ?? null,
        features: r.features, evidence: r.evidence ?? [],
      })),
      ...(d === 'career' ? { categories: pool.features ? categorizeCareer(pool.features, pool.profile) : null } : {}),
      ...(d === 'health' ? {
        notMedical: true,
        caution: '질환명·수술 여부를 말하지 않는다. 전통이 말하는 몸의 부담 신호까지다.',
      } : {}),
      ...(d === 'timing' ? {
        note: '여기서 연도를 말하지 않는다. 시기를 보는 장치가 있는지와 기운이 앞뒤 어디에 실리는지까지다.',
      } : {}),
    };
  }
  return {
    domains: out,
    meta: {
      timeKnown: fortune.input.timeKnown,
      asOfDate: opts.asOfDate ?? null,
      principles: PRINCIPLES,
      notFromNatal: '지금 이직 준비 중인지, 올해 합격할지 같은 것은 출생명반에 들어 있지 않다.',
    },
  };
}

export { interpretCareer } from './systems.js';
export { interpretDomain, gather, coverage, DOMAINS, DOMAIN_LABEL } from './domains.js';
export { poolCareer } from './ensemble.js';
export { categorizeCareer, CAREER_CATEGORIES, LEVEL_A, LEVEL_B } from './categories.js';
export { measure, weightsFrom, compareOne } from './calibration.js';
export { buildDictionary, byAxis, toMarkdown } from './dictionary.js';
export { RULES, allRules } from './rules.js';
export { AXES, AXIS_LABEL, SYSTEM_NAME };
