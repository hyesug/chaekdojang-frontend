/**
 * 의미축 해석 엔진 — 이 파일이 고정하는 것은 **정확도가 아니라 정직성**이다.
 *
 * 아래 검사들은 "엔진이 맞히는가"를 재지 않는다. 그건 LOO 가 한다.
 * 여기서 막는 것은 조용히 나빠지는 방식들이다 — 침묵해야 할 자리가
 * 채워지는 것, 모르는 것이 오답으로 세어지는 것, 넓게 말하는 쪽이
 * 이기는 채점법이 다시 들어오는 것.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { readFortune } from '../../public/unse-8f3k2m/src/engine.js';
import * as ZW from '../../public/unse-8f3k2m/src/hires/ziwei.js';
import * as IN from '../../public/unse-8f3k2m/src/hires/interpret.js';
import { interpretPerson } from '../../public/unse-8f3k2m/src/semantic/index.js';
import { interpretSystems } from '../../public/unse-8f3k2m/src/semantic/systems.js';
import { SYSTEM_IDS } from '../../public/unse-8f3k2m/src/semantic/extract.js';
import { allRules } from '../../public/unse-8f3k2m/src/semantic/rules.js';
import { AXES } from '../../public/unse-8f3k2m/src/semantic/axes.js';
import { distribute, CAREER_CATEGORIES } from '../../public/unse-8f3k2m/src/semantic/categories.js';
import { narrate } from '../../public/unse-8f3k2m/src/semantic/narrate.js';
import { logLoss, brier, marginalDist, scoreOne } from '../../public/unse-8f3k2m/src/validation/scoring.js';
import { assertNoPersonalFields, isScorable, childrenBand } from '../../public/unse-8f3k2m/src/validation/labels.js';
import { precompute, leaveOnePersonOut, calibrateFrom } from '../../public/unse-8f3k2m/src/validation/loo.js';
import { SUPPRESSED, buildWeights, shrinkToOne } from '../../public/unse-8f3k2m/src/semantic/reliability.js';

const BIRTH = {
  gender: 'female', year: 1992, month: 1, day: 30,
  hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전',
};
const AS_OF = '2026-09-21';

const runOf = (birth) => {
  const fortune = readFortune({ ...birth, name: 'x' }, { now: new Date(`${AS_OF}T12:00:00+09:00`) });
  const stack = fortune.input.timeKnown
    ? (() => { try { return ZW.stackAt(fortune.input, fortune.input.currentYear, null); } catch { return null; } })()
    : null;
  return { fortune, stack };
};

// ─────────────────────────────────────────────────────────────
// 1. 열다섯이 각자 말한다
// ─────────────────────────────────────────────────────────────

test('직업은 열다섯 체계가 저마다 구조화된 해석을 낸다', () => {
  const { fortune, stack } = runOf(BIRTH);
  const { byDomain } = interpretSystems(fortune, stack);
  const career = byDomain.career;

  assert.equal(career.length, SYSTEM_IDS.length, '열다섯이 모두 자기 칸을 가진다');
  const spoke = career.filter((r) => r.status === 'ok');
  assert.ok(spoke.length >= 10, `열 이상이 말해야 한다 (실제 ${spoke.length})`);

  for (const r of spoke) {
    assert.ok(r.features, `${r.systemName} 은 축 벡터를 낸다`);
    assert.deepEqual(Object.keys(r.features).sort(), [...AXES.career].sort(), '축 이름이 공통이다');
    assert.ok(r.evidence.length, `${r.systemName} 은 근거를 남긴다`);
    for (const e of r.evidence) {
      assert.ok(e.rule && e.source && e.value, '근거에는 규칙·자리·값이 모두 있다');
    }
  }
});

test('한 체계의 뜻을 다른 체계의 어휘로 옮기지 않는다', () => {
  // 규칙 id 는 언제나 자기 체계로 시작한다. 자미 관록궁이 행성 카라카로
  // 둔갑하는 식의 변환이 들어오면 여기서 걸린다.
  for (const r of allRules()) {
    assert.ok(r.id.startsWith(`${r.system}|`), `${r.id} 의 주인이 뒤섞였다`);
  }
});

// ─────────────────────────────────────────────────────────────
// 2. 결정론
// ─────────────────────────────────────────────────────────────

test('같은 입력이면 결과가 똑같다', () => {
  const a = interpretPerson(BIRTH, { asOfDate: AS_OF });
  const b = interpretPerson(BIRTH, { asOfDate: AS_OF });
  assert.deepEqual(a.natal.domains, b.natal.domains);
  assert.deepEqual(a.timing.marriage, b.timing.marriage);
});

test('원국 해석은 asOfDate 에 흔들리지 않는다', () => {
  const a = interpretPerson(BIRTH, { asOfDate: '2026-09-21' });
  const b = interpretPerson(BIRTH, { asOfDate: '2031-02-14' });
  assert.deepEqual(a.natal.domains.career.features, b.natal.domains.career.features,
    '타고난 결이 올해에 따라 바뀌면 그건 원국이 아니다');
  assert.deepEqual(a.natal.domains.relationship.features, b.natal.domains.relationship.features);
});

// ─────────────────────────────────────────────────────────────
// 3. 모르는 것을 오답으로 세지 않는다
// ─────────────────────────────────────────────────────────────

test('unknown·not_applicable 은 채점에서 빠진다', () => {
  assert.equal(isScorable({ status: 'known', category: 'it_software' }), true);
  assert.equal(isScorable({ status: 'unknown' }), false);
  assert.equal(isScorable({ status: 'not_applicable' }), false);
  assert.equal(isScorable({ status: 'censored', observedUntilAge: 34 }), false);

  const people = [
    { id: 'A', birth: BIRTH, labels: { career: { status: 'known', category: 'it_software', attributes: [] } } },
    { id: 'B', birth: BIRTH, labels: { career: { status: 'unknown' } } },
    { id: 'C', birth: BIRTH, labels: { career: { status: 'not_applicable' } } },
  ];
  const rows = precompute(people, runOf);
  const rep = leaveOnePersonOut(rows, [['career', 'industry']], { shuffleRounds: 20 });
  assert.equal(rep['career.industry'].scorable, 1, '아는 한 명만 채점한다');
});

test('전통에 자리가 없는 체계는 not_applicable 로 적힌다', () => {
  const { fortune, stack } = runOf(BIRTH);
  const { byDomain } = interpretSystems(fortune, stack);
  const tarot = byDomain.relationship.find((r) => r.system === 'tarot');
  assert.equal(tarot.status, 'not_applicable');
  assert.match(tarot.why, /자리가 없다/);
});

// ─────────────────────────────────────────────────────────────
// 4. 시각 미상
// ─────────────────────────────────────────────────────────────

test('시각을 모르면 그 체계만 빠지고 나머지는 계속 말한다', () => {
  const { fortune, stack } = runOf({ ...BIRTH, hour: undefined, minute: undefined });
  assert.equal(stack, null);
  const { byDomain } = interpretSystems(fortune, stack);

  const ziwei = byDomain.career.find((r) => r.system === 'jamidusu');
  const astro = byDomain.career.find((r) => r.system === 'astrology');
  assert.equal(ziwei.status, 'unavailable');
  assert.match(ziwei.why, /시각/);
  assert.equal(astro.status, 'unavailable');

  const saju = byDomain.career.find((r) => r.system === 'saju');
  assert.equal(saju.status, 'ok', '사주는 시각 없이도 말한다');

  const r = interpretPerson({ ...BIRTH, hour: undefined, minute: undefined }, { asOfDate: AS_OF });
  assert.ok(r.natal.domains.career.features, '나머지 체계로 결과는 나온다');
  assert.equal(r.meta.timeKnown, false);
});

// ─────────────────────────────────────────────────────────────
// 5. 확률 정규화
// ─────────────────────────────────────────────────────────────

test('모든 분포는 합이 1이고 0인 칸이 없다', () => {
  const r = interpretPerson(BIRTH, { asOfDate: AS_OF });
  for (const [domain, d] of Object.entries(r.natal.domains)) {
    for (const [name, dist] of Object.entries(d.categories ?? {})) {
      if (!dist) continue;
      const sum = Object.values(dist.dist).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 0.01, `${domain}.${name} 합이 ${sum}`);
      for (const [k, p] of Object.entries(dist.dist)) {
        assert.ok(p > 0, `${domain}.${name}.${k} 가 0 — 명반이 '절대 아니다'를 말할 수는 없다`);
      }
    }
  }
  const t = r.timing.marriage;
  const tsum = t.bands.reduce((a, b) => a + b.score, 0);
  assert.ok(Math.abs(tsum - 1) < 0.01, `결혼 시기 곡선 합이 ${tsum}`);
});

// ─────────────────────────────────────────────────────────────
// 6. 넓게 말하는 쪽이 이기지 않는다 — 이 저장소에서 가장 중요한 검사
// ─────────────────────────────────────────────────────────────

test('좁게 맞힌 예측이 넓게 말한 예측보다 높은 평가를 받는다', () => {
  const keys = Object.keys(CAREER_CATEGORIES).concat('other');
  const truth = 'it_software';

  const narrow = Object.fromEntries(keys.map((k) => [k, k === truth ? 0.65 : 0.35 / (keys.length - 1)]));
  const broad = Object.fromEntries(keys.map((k) => [k, 1 / keys.length]));

  assert.ok(logLoss(narrow, truth) < logLoss(broad, truth), '로그 손실이 좁은 쪽을 택한다');
  assert.ok(brier(narrow, truth) < brier(broad, truth), '브라이어가 좁은 쪽을 택한다');

  // 넓은 쪽은 정답을 '포함'하지만 1위를 가려내지 못한다 — 동점 평균 순위로 처리한다
  const broadScore = scoreOne(broad, truth);
  assert.equal(broadScore.top1, false, '고루 퍼뜨린 분포가 top1 을 공짜로 가져가면 안 된다');
  assert.ok(Math.abs(broadScore.rankPercentile - 0.5) < 1e-9, '평평하면 딱 우연이다');
});

test("'열다섯 중 하나라도 맞음'은 성적표가 아니라 대조용이다", () => {
  const people = [
    { id: 'A', birth: BIRTH, labels: { career: { status: 'known', category: 'it_software', attributes: [] } } },
    { id: 'B', birth: { ...BIRTH, year: 1990, month: 10, day: 6, hour: 14, minute: 11, gender: 'male' },
      labels: { career: { status: 'known', category: 'research_analysis', attributes: [] } } },
  ];
  const rep = leaveOnePersonOut(precompute(people, runOf), [['career', 'industry']], { shuffleRounds: 20 });
  const r = rep['career.industry'];
  assert.ok('contrastAtLeastOneTop1' in r, '대조 지표가 따로 표시된다');
  assert.ok(r.pooled.logLoss != null, '본 성적은 확률형 채점 규칙으로 낸다');
});

// ─────────────────────────────────────────────────────────────
// 7·8. LOO 는 사람 단위이고, 같은 사람이 양쪽에 들어가지 않는다
// ─────────────────────────────────────────────────────────────

test('보정값은 테스트할 사람을 빼고 만들어진다', () => {
  const people = [
    { id: 'A', birth: BIRTH,
      labels: { career: { status: 'known', category: 'it_software', attributes: [] },
                children: { status: 'known', count: 0, band: 'few' } } },
    { id: 'B', birth: { ...BIRTH, year: 1990, month: 10, day: 6, hour: 14, minute: 11, gender: 'male' },
      labels: { career: { status: 'known', category: 'research_analysis', attributes: [] },
                children: { status: 'known', count: 2, band: 'average' } } },
    { id: 'C', birth: { ...BIRTH, year: 1988, month: 7, day: 2, hour: 5, minute: 30, gender: 'male' },
      labels: { career: { status: 'known', category: 'transport_machine', attributes: [] },
                children: { status: 'unknown' } } },
  ];
  const rows = precompute(people, runOf);
  const targets = [['career', 'industry'], ['children', 'count']];

  // A 를 빼고 만든 보정값에는 A 가 한 건도 들어가지 않는다 —
  // **A 의 직업으로 배워 A 의 자녀를 채점하는 것도 누수다.**
  const withoutA = calibrateFrom(rows.filter((r) => r.id !== 'A'), targets);
  const all = calibrateFrom(rows, targets);
  const nOf = (cal, id, domain) => cal[id]?.[domain]?.n ?? 0;
  assert.ok(nOf(all, 'saju', 'career') > nOf(withoutA, 'saju', 'career'),
    'A 를 빼면 보정에 쓰인 건수가 줄어야 한다');

  // 분야를 가로질러서도 줄어든다 = 사람이 통째로 빠졌다는 뜻
  assert.ok(nOf(all, 'saju', 'children') >= nOf(withoutA, 'saju', 'children'));
});

test('한계분포 기준선도 훈련 쪽 라벨만 본다', () => {
  const keys = ['a', 'b', 'c'];
  const d = marginalDist(keys, ['a', 'a']);
  assert.ok(d.a > d.b && d.b === d.c, '훈련 쪽 빈도만 반영된다');
  assert.ok(Math.abs(Object.values(d).reduce((x, y) => x + y, 0) - 1) < 1e-9);
  assert.ok(d.c > 0, '안 나온 답도 0 이 되지 않는다');
});

// ─────────────────────────────────────────────────────────────
// 9. 개인정보
// ─────────────────────────────────────────────────────────────

test('정답표에 이름 같은 것이 들어오면 멈춘다', () => {
  assert.throws(() => assertNoPersonalFields({ id: 'A', name: '홍길동', birth: {} }), /개인 식별/);
  assert.doesNotThrow(() => assertNoPersonalFields({ id: 'A', birth: { gender: 'male' } }));
});

// ─────────────────────────────────────────────────────────────
// 10. 기존 판단을 훼손하지 않는다
// ─────────────────────────────────────────────────────────────

test("영점보다 나빴던 축은 새 층에서도 막혀 있다", () => {
  assert.ok('residence.ownership' in SUPPRESSED.axes, '자가/임차는 답하지 않는다');
  assert.ok('relationship.stability' in SUPPRESSED.axes, '혼인 안정은 답하지 않는다');
  assert.ok('career.tempo' in SUPPRESSED.outputs, '직업 전환은 답하지 않는다');

  const r = interpretPerson(BIRTH, { asOfDate: AS_OF });
  assert.equal(r.natal.domains.residence.features.ownership, 0);
  assert.equal(r.natal.domains.relationship.features.stability, 0);
  assert.ok(!('tempo' in r.natal.domains.career.categories));
  assert.ok(r.natal.domains.career.suppressedOutputs.some((s) => s.name === 'tempo'));
});

test('막는 판단은 AXIS_OWNER 한 곳에서만 정한다', () => {
  // 저쪽 담당표가 '비움'이 아니게 되면 여기 막음도 같이 풀려야 한다.
  // 두 군데에 적어 두면 한쪽만 고쳐져 조용히 갈라진다.
  const pol = IN.axisPolicy();
  for (const axis of ['거주형태', '혼인안정', '직업전환']) {
    assert.equal(pol[axis].grade, '비움', `${axis} 가 열리면 semantic 쪽 막음도 다시 봐야 한다`);
  }
});

test('전통 무게를 지우지 않고 실측 무게와 따로 들고 있다', () => {
  const w = buildWeights(null);
  assert.equal(w.saju.career.empiricalWeight, 1, '자료가 없으면 실측 무게는 1.0');
  assert.ok(w.saju.career.traditionalWeight > w.tarot.career.traditionalWeight,
    '_base.js 의 전통 무게가 살아 있다');
  assert.equal(w.saju.career.finalWeight,
    Math.round(w.saju.career.traditionalWeight * w.saju.career.empiricalWeight * 1000) / 1000);
});

test('작은 표본이 큰 무게 차이를 만들지 못한다', () => {
  // 3명에서 완벽해도 1.0 근처에 머물러야 한다
  assert.ok(shrinkToOne(1.0, 3) < 1.14, `3명 완벽에서 ${shrinkToOne(1.0, 3)}`);
  assert.ok(shrinkToOne(1.0, 10) < 1.34, `10명 완벽에서 ${shrinkToOne(1.0, 10)}`);
  assert.ok(shrinkToOne(1.0, 400) > 1.9, '자료가 충분해지면 실제로 움직인다');
  assert.equal(shrinkToOne(0.5, 10), 1, '우연 수준이면 1.0 그대로');
  assert.equal(shrinkToOne(null, 0), 1);
});

test('점성 7하우스 규칙이 interpret.js 와 갈라지지 않는다', () => {
  // 같은 전통 규칙을 두 군데서 쓴다. 한쪽만 고쳐지면 여기서 걸린다.
  const { fortune, stack } = runOf(BIRTH);
  const { byDomain } = interpretSystems(fortune, stack);
  const mine = byDomain.relationship.find((r) => r.system === 'astrology');
  const theirs = IN.westernRead(fortune.input).결혼경험;

  if (!theirs) {
    assert.ok(mine.status !== 'ok' || !mine.evidence.some((e) => /seventh:(early|late)/.test(e.rule)),
      'interpret.js 가 침묵하면 여기도 방향을 내면 안 된다');
    return;
  }
  const dir = /이른/.test(theirs.value) ? 'early' : 'late';
  assert.ok(mine.evidence.some((e) => e.rule.includes(`seventh:${dir}`)),
    `interpret.js 는 ${dir} 라는데 semantic 은 다르게 읽었다`);
  void stack;
});

// ─────────────────────────────────────────────────────────────
// 덤 — 말이 되는 글이 나오는가
// ─────────────────────────────────────────────────────────────

test('자연어 답에 단정과 날짜가 섞여 들어가지 않는다', () => {
  const r = interpretPerson(BIRTH, { asOfDate: AS_OF });
  const text = narrate(r);
  assert.match(text, /## 직업/);
  assert.match(text, /## 결혼/);
  assert.match(text, /예시 직업/);
  // 달력 연도를 짚지 않는다 — 시기 검증에서 신호가 없었다
  assert.doesNotMatch(text, /\d{4}년에/);
  // 단정을 막는 문장이 실제로 실린다
  assert.match(text, /뜻이 아닙니다|단정하지 않습니다/);
  assert.match(text, /통계청 혼인율이 뼈대/);
  assert.match(text, /출생명반에 들어 있지 않다/);
});

test('자녀 수는 숫자로 단정하지 않는다', () => {
  assert.equal(childrenBand(0), 'few');
  assert.equal(childrenBand(2), 'average');
  assert.equal(childrenBand(4), 'many');
  const r = interpretPerson(BIRTH, { asOfDate: AS_OF });
  const keys = Object.keys(r.natal.domains.children.categories.count.dist);
  assert.deepEqual(keys.sort(), ['average', 'few', 'many']);
});

test('건강은 진단처럼 나가지 않는다', () => {
  const r = interpretPerson(BIRTH, { asOfDate: AS_OF });
  assert.equal(r.natal.health.notMedical, true);
  assert.deepEqual(Object.keys(r.natal.domains.health.categories), [], '건강에는 범주가 없다');
  assert.match(r.natal.health.caution, /질환명/);
});

test('현재 상태는 원국으로 답하지 않는다', () => {
  const r = interpretPerson(BIRTH, { asOfDate: AS_OF });
  assert.equal(r.currentState.available, false);
  assert.equal(r.currentState.asOfDate, AS_OF);
});

test('분포가 평평하면 평평하다고 신고한다', () => {
  const flat = distribute(Object.fromEntries(AXES.career.map((k) => [k, 0.5])), CAREER_CATEGORIES);
  assert.ok(flat.spread < 0.2, '모든 축이 같으면 범주가 갈리지 않는다');
});
