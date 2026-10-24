/**
 * 진로·이직 의사결정 해석 규칙 — 회귀 테스트 (2026-10-24 사용자 지정 8개 규칙)
 *
 * 관록궁·관성 같은 기회 신호를 "남는다/옮긴다"로 확정하거나, 다음 해가 더 좋다며 지금 기회를 미루라고 하거나,
 * 기질을 능력으로 바꿔 말하거나, 근거 체계 없이 업종을 권하거나, 트랜짓을 각도·오차 없이 쓰는 일을 막는다.
 * AI 지침(route.ts), 고해상도 문맥(hires/context.js), AI 명반 문맥(aiContext.js), 리포트 문장(report.js)을 함께 본다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { readFortune } from '../../public/unse/src/engine.js';
import { readForecast } from '../../public/unse/src/forecast.js';
import { routeQuestion } from '../../public/unse/src/hires/router.js';
import { buildHiRes } from '../../public/unse/src/hires/context.js';
import { SOLAR_ARC_ORB } from '../../public/unse/src/hires/westernExt.js';
import { aspectNote, ASPECT_LEGEND, ASPECTS, forecast as westernForecast } from '../../public/unse/src/systems/astrology.js';
import { domainSections } from '../../public/unse/src/aiContext.js';
import { careerRoles, lifeEventItems } from '../../public/unse/src/report.js';
import { loadDicts } from '../../public/unse/src/semantic/dict.js';
import { toJD } from '../../public/unse/src/core/astro.js';

await loadDicts();

const NOW = new Date('2026-09-19T00:00:00Z');
const FORM = {
  name: '진로 A', gender: 'female',
  year: 1993, month: 3, day: 17, hour: 15, minute: 42,
  birthPlace: '여주', homePlace: '대전',
};
const load = (form) => ({ r: readFortune(form, { now: NOW }), f: readForecast(form, NOW) });

const PROMPT = readFileSync('app/fortune-ai/route.ts', 'utf8');

/** 사용자가 준 문구 그대로 — 한 글자도 바꾸지 않는다 */
const RULES = [
  '1. 관록궁 활성화, 관성 작용, 직업 관련 행성의 길각은 직업적 기회로 해석한다. 별도 근거 없이 현재 직장 잔류나 외부 이직 중 하나로 확정하지 않는다.',
  '2. 충·형·대운 전환 등 변화 신호는 변화 가능성을 나타내며, 내부 이동·외부 이직·업무 변화의 가능성을 구분하여 제시한다.',
  '3. 특정 연도가 유리하더라도 다른 연도에 발생한 좋은 기회를 포기하도록 권하지 않는다. 여러 시기의 기회는 상호 배타적이지 않다.',
  '4. 진행·트랜짓 등 출생 명반 외 계산을 사용할 때는 적용 기법, 정확한 각도, 허용 오차를 표시한다.',
  '5. 명반상 기질과 실제 직업 능력·적응력·성과를 동일시하지 않는다.',
  '6. 특정 산업·직무를 추천하려면 해당 명반 요소와 해석 체계를 명시한다.',
  '7. 실제 이직 여부를 질문받으면 명반상 기회와 위험을 먼저 해석하고, 최종 선택은 연봉·조직 안정성·업무 적합성·성장 가능성에 따라 조건부로 제시한다.',
  '8. 미래의 운세가 좋다는 이유만으로 현재의 검증 가능한 기회를 포기하라는 결론을 내리지 않는다.',
];

test('AI 지침에 진로·이직 의사결정 해석 규칙 여덟 개가 문구 그대로 있고, 다른 규칙보다 앞선다고 적는다', () => {
  assert.match(PROMPT, /## 진로·이직 의사결정 해석 규칙/);
  for (const rule of RULES) assert.ok(PROMPT.includes(rule), `빠진 규칙: ${rule.slice(0, 30)}`);
  assert.match(PROMPT, /아래 여덟 가지가 이 지침의 다른 어떤 규칙\(둘 중 하나 고르기, 주 시나리오 하나, 단정 등급\)보다 앞섭니다/);
});

test('AI 지침이 이직·잔류를 한쪽으로 고르게 하거나, 기회 신호를 잔류로 바로 읽는 예시를 싣지 않는다', () => {
  // 예전 예시: 관성 세운 → "이직보다 지금 자리에서 직급이 오르는 쪽이 먼저예요" (규칙 1 위반)
  assert.doesNotMatch(PROMPT, /이직보다 지금 자리에서 직급이 오르는 쪽이 먼저/);
  // "둘 중 하나를 물으면 하나를 고르세요"는 남기되 진로 선택은 예외로 뺀다
  const pick = PROMPT.slice(PROMPT.indexOf('## 둘 중 하나를 물으면 하나를 고르세요'));
  const head = pick.slice(0, pick.indexOf('**첫 문장에서'));
  assert.doesNotMatch(head, /이직할까 남을까/);
  assert.match(pick, /이직·잔류·퇴사처럼 진로를 고르는 질문은 예외/);
  // 규칙 7의 네 기준과 규칙 2의 세 갈래를 적용법으로도 적는다
  assert.match(PROMPT, /네 기준\(연봉·조직 안정성·업무 적합성·성장 가능성\)/);
  assert.match(PROMPT, /내부 이동 \/ 다른 곳으로 옮기는 외부 이직 \/ 같은 자리에서 맡는 일이 바뀌는 업무 변화/);
  assert.match(PROMPT, /"내년이 더 좋으니 지금 제안은 미루라"\(✗\)/);
  // 규칙 4 — 트랜짓을 쓸 땐 기법·각도·허용 오차, 각도가 없는 값은 각이라 하지 않는다
  assert.match(PROMPT, /트랜짓 토성–출생 중천 사각\(90°, 오차 1\.2°, 허용 ±7°\)/);
  assert.match(PROMPT, /각이라고 하지 말고 "별자리·영역 위치"로만/);
  // 규칙 6 — 분야를 말할 땐 체계와 명반 요소를 함께
  assert.match(PROMPT, /분야·직무를 말할 땐 그 분야를 낸 \*\*체계와 명반 요소\*\*/);
});

test('남을까 옮길까를 물으면 고해상도 문맥이 기회·위험 먼저, 선택은 네 기준의 조건부로 답하게 한다', () => {
  const { r, f } = load(FORM);
  for (const q of ['2027년에 회사를 지키는게 낫냐', '지금 회사에 남는 게 나을까 옮길까', '이직할까 말까']) {
    const plan = routeQuestion(q, 2026);
    assert.ok(plan.domains.includes('직업'), q);
    const text = buildHiRes(r, f, plan).text;
    assert.match(text, /\*\*직업적 기회\*\*다\. 별도 근거 없이 "지금 회사에 남는다" 또는 "밖으로 옮긴다" 한쪽으로 확정하지 말 것/, q);
    assert.match(text, /내부 이동\(지금 조직 안 자리·부서\) \/ 외부 이직\(다른 곳으로\) \/ 업무 변화\(같은 자리, 다른 일\)/, q);
    assert.match(text, /다른 해가 더 좋다는 이유만으로 지금 확인할 수 있는 기회.*포기하거나 미루라고 결론 내지 말 것/, q);
    assert.match(text, /연봉·조직 안정성·업무 적합성·성장 가능성에 따라 "~이면 남는 쪽, ~이면 옮기는 쪽"으로 조건부로/, q);
    // 다른 분야용 "기울기 하나를 고르라"는 안내는 직업 선택에 섞지 않는다
    assert.doesNotMatch(text, /지금 흐름은 ○○ 쪽과 더 맞는다/, q);
  }
  // 직업이 아닌 두 길 질문은 예전 안내를 그대로 쓴다
  const move = buildHiRes(r, f, routeQuestion('이사 갈까 말까', 2026)).text;
  assert.match(move, /지금 흐름은 ○○ 쪽과 더 맞는다/);
  assert.doesNotMatch(move, /연봉·조직 안정성·업무 적합성·성장 가능성/);
});

test('트랜짓·솔라 아크 줄에 기법·정확한 각도·허용 오차가 함께 실린다', () => {
  // 각 하나의 꼴 — 허용 오차는 그 기법의 값
  assert.equal(aspectNote('사각', 1.2), '사각 90°(오차 1.2°, 허용 ±7°)');
  assert.equal(aspectNote('합', 0.4, SOLAR_ARC_ORB), '합 0°(오차 0.4°, 허용 ±1°)');
  for (const a of ASPECTS) assert.ok(ASPECT_LEGEND.includes(`${a.name} ${a.angle}°(허용 ±${a.orb}°)`), a.name);

  const { r, f } = load(FORM);
  // 달을 묻는 질문이면 ai.js 가 wantsMonths 를 붙여 달별 트랜싯을 싣는다
  const plan = { ...routeQuestion('2027년 몇 월에 이직운이 가장 강해?', 2026), wantsMonths: true };
  const text = buildHiRes(r, f, plan).text;
  // 달별 트랜싯 표 바로 아래에 범례
  assert.match(text, /트랜싯 \(달별, 위 네 개까지\):\n {2}각의 정확한 각도·허용 오차: 합 0°\(허용 ±8°\) · 육각 60°\(허용 ±4°\) · 사각 90°\(허용 ±7°\)/);
  // 진행은 별자리 위치뿐이라 각으로 말하지 않게
  assert.match(text, /진행\(2차 프로그레션\) 석 달 간격 — 별자리 위치만이다\. 각도·오차가 없으니 각으로 말하지 말 것/);
  // 솔라 아크가 걸린 해가 있으면 줄마다 정확한 각도와 허용 ±1°
  const arcLines = text.split('\n').filter((l) => /^ {2}\d{4} \S+→출생 /.test(l) || /^ {2}\d{4} \S+→(상승점|중천|하강점|천저)/.test(l));
  for (const l of arcLines) assert.match(l, /(합|육각|사각|삼각|대각) \d+°\(오차 [\d.]+°, 허용 ±1°\)$/, l);
  assert.doesNotMatch(text, /\(오차 [\d.]+°\)$/m);
});

test('점성술 시기 카드 설명은 트랜짓이라는 기법과 각도·허용 오차를 밝힌다(리포트 화면이라 ° 대신 도)', () => {
  const input = readFortune(FORM, { now: NOW }).input;
  let seen = 0;
  for (let m = 1; m <= 12; m++) {
    const res = westernForecast(input, null, { kind: 'month', jd: toJD(2027, m, 15, 12) });
    if (/뚜렷한 트랜싯 없음/.test(res.headline)) continue;
    seen++;
    assert.match(res.text, /^트랜짓 — /);
    assert.match(res.text, /(합|육각|사각|삼각|대각) \d+도\(오차 [\d.]+도, 허용 ±\d+도\)/);
    assert.doesNotMatch(res.text, /°/);
  }
  assert.ok(seen > 0, '열두 달 내내 트랜싯이 없었다');
});

test('AI 명반 문맥의 직업 분야는 근거 체계·명반 요소와 함께, 기질이지 능력이 아니라고 싣는다', () => {
  const { r } = load(FORM);
  const text = domainSections(r, ['직업']);
  assert.match(text, /근거: 자미두수\([^)]*관록궁[^)]*\) \+ 육임\([^)]+\) \+ 숙요\([^)]+\)의 직업 성향을 합산한 상위 범주/);
  assert.match(text, /타고난 기질에 맞는 분야이지 그 일의 실제 능력·적응력·성과가 아니다/);
});

test('리포트의 직업 추천은 근거 체계를 밝히고, 이직 사건은 세 갈래·네 기준으로 쓰며 옮기라고 단정하지 않는다', () => {
  const { r } = load(FORM);
  const roles = careerRoles(r);
  assert.ok(roles.jobs.length >= 1);
  assert.match(roles.lead, /^잘 맞는 직업은 .+(이에요|예요)\.$/);
  assert.match(roles.basis, /^자미두수 직업을 보는 자리(의 별(\([가-힣·]+\))?|\(비어 있어 맞은편 별을 빌려 읽음: [가-힣·]+\)), 육임 타고난 판의 흐름, 숙요 타고난 별자리에서 읽은 직업 성향으로 고른 직업이에요\./);
  // 빈 자리(공궁)를 별 이름처럼 쓰지 않는다 — 이 명반은 직업 자리가 비어 맞은편 별을 빌려 읽는다
  assert.doesNotMatch(roles.basis, /공궁/);
  assert.match(roles.basis, /비어 있어 맞은편 별을 빌려 읽음: [가-힣·]+\)/);
  // 별이 든 명반은 그 별 이름을 그대로
  const full = careerRoles(readFortune({ ...FORM, year: 1990, month: 6, day: 15, hour: 12, minute: 0, gender: 'male', birthPlace: '서울', homePlace: '서울' }));
  assert.match(full.basis, /^자미두수 직업을 보는 자리의 별\([가-힣·]+\), /);
  assert.match(roles.basis, /명반으로 본 성향에 맞는 쪽이라는 뜻이고, 그 일을 실제로 얼마나 잘 해낼지는 경력과 실력이 정해요/);
  // '타고난 기질'은 사용자 요청으로 뺀 리포트 장 제목이라 문장에도 다시 쓰지 않는다(report-document-template)
  assert.doesNotMatch(roles.basis, /타고난 기질/);
  assert.equal(roles.source, '자미두수·육임·숙요');

  const career = lifeEventItems(r).filter((e) => e.domain === '직업');
  for (const e of career) {
    assert.doesNotMatch(e.prep, /옮긴다면 .+ 쪽이 이 명반에 맞습니다/);
    assert.match(e.prep, /일을 바꾼다면 자미두수·육임·숙요로 본 기질에는 .+ 쪽이 맞습니다\.$/);
  }

  // 사건 사전·기본 문장 — 외부 이직 하나로 못 박지 않는다
  const src = readFileSync('public/unse/src/report.js', 'utf8');
  assert.match(src, /지금 조직 안에서 자리나 부서가 바뀔 수도, 다른 곳으로 옮길 수도, 같은 자리에서 맡는 일이 바뀔 수도 있습니다/);
  assert.match(src, /지금 눈앞의 좋은 기회를 뒷날의 운 때문에 미룰 필요는 없습니다/);
  for (const file of ['public/unse/dict/event-2.json', 'public/unse/dict/event-3.json']) {
    const dict = JSON.parse(readFileSync(file, 'utf8'));
    for (const [k, v] of Object.entries(dict)) {
      if (!/\|직업\|/.test(k)) continue;
      assert.doesNotMatch(v.t, /따라 옮기는 일/, `${file} ${k}`);
    }
  }
});
