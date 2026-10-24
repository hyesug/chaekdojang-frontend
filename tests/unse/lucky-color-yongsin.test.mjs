/**
 * 행운의 색 — 용신 검토 회귀 테스트 (2026-10-24 사용자 지정 규칙)
 *
 * 가장 약한 오행 하나로 색을 고르던 것을, 계절·조후 → 신강·신약(억부) → 용신·희신·기신 순서로 고르게 바꿨다.
 * 억부와 조후가 같은 쪽이거나 조후가 따로 요구하지 않을 때만 용신을 확정으로 보고, 그때만 평생의 색으로 말한다.
 * 다른 체계(태국 점성술 요일 색)가 사주의 기피색을 권하면 기준이 다르다는 이유를 적는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { readFortune } from '../../public/unse/src/engine.js';
import { readForecast } from '../../public/unse/src/forecast.js';
import { buildContext } from '../../public/unse/src/aiContext.js';
import { luckyDays } from '../../public/unse/src/reading.js';
import { usefulGod, colorAdvice, colorElement, ELEMENT_COLOR } from '../../public/unse/src/semantic/structure/yongsin.js';

const NOW = new Date('2026-10-25T00:00:00Z');
const at = (year, month, day) => ({
  name: '색', gender: 'male', year, month, day, hour: 12, minute: 0, birthPlace: '서울', homePlace: '서울',
});
// 상태마다 하나씩 — 표본을 훑어 고른 명반이다(값을 맞추려고 고친 기준은 없다)
const SETTLED = at(1984, 7, 3);       // 여름 · 신강 — 억부·조후가 같은 쪽
const SPLIT = at(1981, 7, 17);        // 여름 · 신약 — 억부는 화, 조후는 수
const NONE = at(1980, 1, 3);          // 중화 · 조후도 급하지 않음
const CLIMATE = at(1981, 12, 3);      // 겨울 · 중화 — 조후로만 본 후보
const EOKBU = at(1980, 1, 17);        // 겨울이지만 화가 이미 넉넉 — 억부대로
const CLASH = at(1988, 7, 3);         // 태국 요일 색(빨강)이 사주 기신(화)의 색

const chartOf = (form) => readFortune(form, { now: NOW }).chart;
const sajuRemedy = (form) => readFortune(form, { now: NOW }).results
  .find((x) => x.id === 'saju').readings.find((x) => x.title === '보태면 좋은 것').text;

test('AI 지침에 행운의 색 규칙이 문구 그대로 있다', () => {
  const PROMPT = readFileSync('app/fortune-ai/route.ts', 'utf8');
  assert.ok(PROMPT.includes('오행의 부족함만으로 행운의 색을 결정하지 않는다. 계절과 조후, 신강·신약, 용신·희신을 검토하고, '
    + '체계 간 추천색과 기피색이 충돌하면 그 이유를 명시한다. 용신이 확정되지 않았다면 평생의 행운색이라고 단정하지 않는다.'));
  assert.match(PROMPT, /가장 약한 오행만 들어 색을 고르지 마세요/);
});

test('용신은 계절·조후와 신강·신약을 함께 보고, 둘이 같은 쪽일 때만 확정한다', () => {
  const s = usefulGod(chartOf(SETTLED));
  assert.equal(s.status, 'settled');
  assert.equal(s.settled, true);
  assert.equal(s.season, '여름');
  assert.ok(s.climate.need === s.yong || s.climate.need === s.hee, '조후 오행이 용신·희신 어느 쪽도 아니다');

  const p = usefulGod(chartOf(SPLIT));
  assert.equal(p.status, 'split');
  assert.equal(p.settled, false);
  assert.notEqual(p.eokbu.yong, p.climate.need);

  assert.equal(usefulGod(chartOf(NONE)).status, 'none');
  assert.equal(usefulGod(chartOf(CLIMATE)).status, 'climateOnly');
  const e = usefulGod(chartOf(EOKBU));
  assert.equal(e.status, 'eokbuOnly');
  assert.equal(e.climate.urgent, false);
  assert.match(e.climate.why, /이미 고르게 나눈 몫 이상 있어 조후는 급하지 않다/);
  // 기신은 용신을 극하는 오행
  for (const u of [s, p, e]) assert.equal(u.gi, (u.yong + 3) % 5);
});

test('용신이 확정되지 않으면 평생의 행운색이라고 하지 않고, 정할 것이 없으면 색을 내지 않는다', () => {
  const settled = colorAdvice(chartOf(SETTLED));
  assert.equal(settled.lifetime, true);
  assert.match(settled.text, /억부와 조후가 같은 쪽이라 용신은 .+ 오래 곁에 두기 좋은 색은 /);
  assert.deepEqual(settled.colors, [ELEMENT_COLOR[settled.el]]);
  assert.deepEqual(settled.avoid, [ELEMENT_COLOR[settled.review.gi]]);

  for (const form of [SPLIT, CLIMATE]) {
    const a = colorAdvice(chartOf(form));
    assert.equal(a.lifetime, false);
    assert.match(a.text, /용신이 확정되지 않아 평생의 행운색이라고 단정하지 않는다 — 지금 기준의 후보 색은 /);
    assert.doesNotMatch(a.text, /오래 곁에 두기 좋은 색/);
  }
  assert.match(colorAdvice(chartOf(SPLIT)).text, /억부는 .+, 조후는 .+ 가리켜 둘이 갈린다/);

  const none = colorAdvice(chartOf(NONE));
  assert.equal(none.el, null);
  assert.deepEqual(none.colors, []);
  assert.equal(none.lifetime, false);
  assert.match(none.text, /행운의 색을 하나로 정하지 않는다/);
});

test('가장 약한 오행만으로 색을 고르지 않는다 — 사주 풀이 문장도 용신 검토를 쓴다', () => {
  const a = colorAdvice(chartOf(SPLIT));
  assert.notEqual(a.review.weak, a.el);
  assert.match(a.text, /가장 약한 오행\(.\)만 보고 그 색을 고르지는 않았다/);

  for (const form of [SETTLED, SPLIT, NONE, CLIMATE, EOKBU]) {
    const text = sajuRemedy(form);
    assert.doesNotMatch(text, /약한 .+ 채우는 쪽이 도움이 됩니다/);
    assert.match(text, /(봄|여름|가을|겨울)에 태어/);
    assert.match(text, /신강|신약|중화/);
    // 조사가 받침에 맞는다 ("수이", "토을" 같은 것이 나오지 않는다)
    assert.doesNotMatch(text, /(화|토|수)(이|을|은) |(목|금)(가|를|는) /);
    assert.doesNotMatch(text, /(자주|베이지)(은|이고|이다)|(청색|은색|남색)(는|고,|다\.)/);
  }
  // 색 이름 뒤 조사 — 받침 없는 '자주'·'베이지'
  const clash = sajuRemedy(CLASH);
  assert.match(clash, /기신 화의 빨강·자주는 덜 쓰는 편이 낫다/);
  // 정할 것이 없으면 방향·숫자도 붙이지 않는다
  assert.doesNotMatch(sajuRemedy(NONE), /같은 기운의 방향/);
});

test('태국 요일 색이 사주 기피색과 겹치면 AI 문맥에 충돌과 그 이유를 적는다', () => {
  const r = readFortune(CLASH, { now: NOW });
  const text = buildContext(CLASH, r, readForecast(CLASH, NOW));
  assert.match(text, /## 행운의 색 — 사주 용신 검토와 다른 체계의 색/);
  assert.match(text, /- 사주: 억부·조후가 같은 쪽 — 용신 확정 · 계절 여름 /);
  assert.match(text, /⚠ 충돌: 태국 점성술은 빨강을 권하지만 사주로는 그 색이 기신 화의 색이다 — 태국 점성술은 태어난 요일\(.요일\)의 수호 행성 \S+으로, 사주는 오행 균형\(조후·억부\)으로 색을 정해 기준이 다르다/);

  const split = readFortune(SPLIT, { now: NOW });
  const ctx = buildContext(SPLIT, split, readForecast(SPLIT, NOW));
  assert.match(ctx, /억부와 조후가 갈림 — 용신 미확정/);
  assert.match(ctx, /평생의 행운색으로 말해도 되는가: 아니오\(후보로만\)/);
});

test('색 → 오행은 오방색에 뚜렷한 것만 견주고, 월간 처방 색도 용신 검토를 따른다', () => {
  assert.equal(colorElement('빨강'), 1);
  assert.equal(colorElement('파랑'), 0);
  assert.equal(colorElement('검정·진회색'), 4);
  assert.equal(colorElement('주황'), null);
  assert.equal(colorElement('보라'), null);

  const days = [{ d: 1, score: 50, wealth: 50, love: 50, sinsal: [], taekil: null }];
  assert.deepEqual(luckyDays(days, 0, null).color, []);
  assert.deepEqual(luckyDays(days, 0, 1).color, ['빨강', '분홍']);
});
