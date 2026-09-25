import test from 'node:test';
import assert from 'node:assert/strict';

import { readFortune } from '../../public/unse/src/engine.js';
import { readForecast } from '../../public/unse/src/forecast.js';
import { buildContext } from '../../public/unse/src/aiContext.js';
import {
  buildMultilayer, formatMultilayer, CORE_IDS, THEMES,
} from '../../public/unse/src/multilayerInterpretation.js';

const FORM = {
  name: '다층 테스트',
  year: 1990, month: 6, day: 15, hour: 12, minute: 0,
  birthPlace: '서울', homePlace: '서울',
  gender: 'male',
};

const NO_TIME = { ...FORM, hour: null, minute: 0 };

/** 핵심 넷만 담은 가짜 계산 결과 — 신호 강도 판정만 떼어 보려는 것 */
function fake(yearScores, natalScores = {}) {
  const results = CORE_IDS.map((id) => ({
    id, name: id, headline: '', confidence: 1,
    facts: [],
    signals: { domains: { 직업: natalScores[id] ?? null } },
  }));
  const yearResults = CORE_IDS
    .filter((id) => yearScores[id] != null)
    .map((id) => ({ id, name: id, headline: '', areas: { 직장운: yearScores[id] } }));
  return {
    r: { input: { timeKnown: true }, results },
    f: { year: { results: yearResults }, timeline: null },
  };
}

const theme = (m, key) => m.themes.find((t) => t.key === key);

test('핵심 셋 이상이 같은 쪽이면 강한 신호', () => {
  const { r, f } = fake({ saju: 67, jamidusu: 60, astrology: 58, vedic: 50 });
  const t = theme(buildMultilayer(r, f), '직업');
  assert.equal(t.level, '강함');
  assert.equal(t.up.length, 3);
  assert.equal(t.mayNarrow, true);
});

test('핵심 둘이면 중간 신호', () => {
  const { r, f } = fake({ saju: 67, jamidusu: 60, astrology: 50, vedic: 50 });
  const t = theme(buildMultilayer(r, f), '직업');
  assert.equal(t.level, '중간');
  assert.equal(t.mayNarrow, true);
});

test('하나뿐이면 약한 신호이고 현실 조건을 좁히지 못한다', () => {
  const { r, f } = fake({ saju: 67, jamidusu: 50, astrology: 50, vedic: 50 });
  const t = theme(buildMultilayer(r, f), '직업');
  assert.equal(t.level, '약함');
  assert.equal(t.mayNarrow, false);
});

test('같은 수로 갈리면 상충으로 보고 약한 신호로 내린다', () => {
  const { r, f } = fake({ saju: 67, jamidusu: 62, astrology: 40, vedic: 38 });
  const t = theme(buildMultilayer(r, f), '직업');
  assert.equal(t.conflict, true);
  assert.equal(t.level, '약함');
  assert.equal(t.mayNarrow, false);
});

test('갈리더라도 한쪽이 더 많으면 그쪽 개수로 판정하고 반대쪽을 지우지 않는다', () => {
  const { r, f } = fake({ saju: 67, jamidusu: 62, astrology: 58, vedic: 40 });
  const m = buildMultilayer(r, f);
  const t = theme(m, '직업');
  assert.equal(t.level, '강함');
  assert.equal(t.conflict, true);
  // 이름은 모듈이 등록된 체계 이름으로 되돌려 적는다 (프롬프트에 id 가 새지 않게)
  assert.deepEqual(t.down, ['베딕']);
  assert.match(formatMultilayer(m), /상충/);
});

test('50 언저리는 중립으로 세고 순풍·역풍 어느 쪽에도 넣지 않는다', () => {
  const { r, f } = fake({ saju: 54, jamidusu: 50, astrology: 46, vedic: 52 });
  const t = theme(buildMultilayer(r, f), '직업');
  assert.equal(t.up.length, 0);
  assert.equal(t.down.length, 0);
  assert.equal(t.flat.length, 4);
  assert.equal(t.level, '약함');
});

test('시기 계산이 없으면 월을 좁힐 근거가 없다고 적는다', () => {
  const { r } = fake({ saju: 67 });
  const m = buildMultilayer(r, null);
  assert.ok(m.caveats.some((c) => c.includes('시기 계산이 없어')));
  assert.match(formatMultilayer(m), /월 단위까지 좁힐 근거 부족/);
});

test('보조 체계는 활성 주제 집계에 들어가지 않는다', () => {
  const { r, f } = fake({ saju: 67 });
  // 보조 체계가 아무리 같은 쪽을 외쳐도 개수가 늘지 않아야 한다.
  for (const id of ['tarot', 'sukyo', 'tojeong', 'taeeul']) {
    r.results.push({ id, name: id, headline: '', confidence: 1, facts: [], signals: { domains: { 직업: 90 } } });
    f.year.results.push({ id, name: id, headline: '', areas: { 직장운: 90 } });
  }
  const t = theme(buildMultilayer(r, f), '직업');
  assert.equal(t.up.length, 1);
  assert.equal(t.level, '약함');
});

test('실제 명반으로 돌려도 다섯 주제가 모두 판정된다', () => {
  const r = readFortune(FORM);
  const f = readForecast(FORM);
  const m = buildMultilayer(r, f);

  assert.equal(m.themes.length, THEMES.length);
  for (const t of m.themes) {
    assert.ok(['강함', '중간', '약함'].includes(t.level), `${t.key} 강도 없음`);
    assert.ok(t.rows.length > 0, `${t.key} 근거 없음`);
  }
  assert.equal(m.coreCount, 4);
});

test('시기 교집합은 핵심 둘 이상이 같은 쪽인 구간만 싣는다', () => {
  const r = readFortune(FORM);
  const f = readForecast(FORM);
  const m = buildMultilayer(r, f);

  for (const t of m.themes) {
    for (const w of [...t.windows.up, ...t.windows.down]) {
      assert.ok(w.who.length >= 2, `${t.key} 구간 ${w.label}에 체계가 ${w.who.length}개뿐`);
      assert.match(w.label, /^\d{1,2}\/\d{1,2}~/);
    }
  }
});

test('태어난 시각을 모르면 자미두수가 빠지고 그 사실이 한계로 적힌다', () => {
  const r = readFortune(NO_TIME);
  const f = readForecast(NO_TIME);
  const m = buildMultilayer(r, f);

  assert.equal(m.coreCount, 3);
  assert.ok(m.coreMissing.includes('자미두수'));
  assert.ok(m.caveats.some((c) => c.includes('자미두수가 빠졌다')));
});

test('AI 문맥에 다층 해석 근거가 실리고 길이 상한을 넘지 않는다', () => {
  const r = readFortune(FORM);
  const f = readForecast(FORM);
  const ctx = buildContext(FORM, r, f);

  assert.match(ctx, /## 다층 해석 근거/);
  assert.match(ctx, /### 활성 주제/);
  assert.match(ctx, /### 시기 교집합/);
  // route.ts 의 MAX_CONTEXT_CHARS. 넘으면 413 으로 막힌다.
  assert.ok(ctx.length <= 60_000, `문맥이 ${ctx.length}자로 상한을 넘었다`);
});
