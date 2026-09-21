/**
 * 의미축 해석 엔진 v1 (직업) — 이 파일이 고정하는 것은 **정확도가 아니라
 * 구조**다. 정확도는 `scripts/analyze-career.mjs` 가 잰다.
 *
 * 여기서 막는 것은 조용히 무너지는 방식들이다 — 평균이 다시 들어오는 것,
 * 같은 계보를 여러 표로 세는 것, 넓게 말하는 규칙이 이기는 것, 근거 없이
 * 답이 나가는 것.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { readFortune } from '../../public/unse-8f3k2m/src/engine.js';
import * as ZW from '../../public/unse-8f3k2m/src/hires/ziwei.js';
import { readCareer, leadingAxes } from '../../public/unse-8f3k2m/src/semantic/index.js';
import { interpretCareer, noisyOr } from '../../public/unse-8f3k2m/src/semantic/systems.js';
import { poolCareer, auxScale, ET_SCALE } from '../../public/unse-8f3k2m/src/semantic/ensemble.js';
import { SYSTEM_IDS, SYSTEM_NAME } from '../../public/unse-8f3k2m/src/semantic/extract.js';
import { RULES, ruleFor, specificityOf, TABLE_MEAN, deviationOf, applyEmpirical } from '../../public/unse-8f3k2m/src/semantic/rules.js';
import { AXES } from '../../public/unse-8f3k2m/src/semantic/axes.js';
import { LINEAGE, independenceFactors } from '../../public/unse-8f3k2m/src/semantic/lineage.js';
import { categorizeCareer, CAREER_CATEGORIES, LEVEL_B } from '../../public/unse-8f3k2m/src/semantic/categories.js';
import { OCCUPATIONS, OCCUPATION_MEAN, centered, labelFor } from '../../public/unse-8f3k2m/src/semantic/tables/occupations.js';
import { measure, weightsFrom, driftCap, pearson, cosineOf, unitize, compareOne } from '../../public/unse-8f3k2m/src/semantic/calibration.js';
import { buildDictionary, byAxis } from '../../public/unse-8f3k2m/src/semantic/dictionary.js';
import { narrate, narrateCareer } from '../../public/unse-8f3k2m/src/semantic/narrate.js';

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

test('열다섯 체계가 저마다 구조화된 직업 해석을 낸다', () => {
  const { fortune, stack } = runOf(BIRTH);
  const reads = interpretCareer(fortune, stack);
  assert.equal(reads.length, SYSTEM_IDS.length, '열다섯이 모두 자기 칸을 가진다');

  const spoke = reads.filter((r) => r.status === 'ok');
  assert.ok(spoke.length >= 12, `열둘 이상이 말해야 한다 (실제 ${spoke.length})`);
  for (const r of spoke) {
    assert.deepEqual(Object.keys(r.features).sort(), [...AXES.career].sort(), '축이 공통이다');
    assert.ok(r.evidence.length, `${r.systemName} 은 근거를 남긴다`);
    for (const e of r.evidence) {
      assert.ok(e.rule && e.source && e.value, '근거에 규칙·자리·값이 모두 있다');
      assert.ok(['direct', 'indirect', 'weak'].includes(e.evidenceType));
      assert.ok(e.traditionalStrength > 0 && e.specificity >= 0);
    }
  }
});

test('전통에 직업 자리가 없는 체계도 간접 증거로 참여한다', () => {
  const { fortune, stack } = runOf(BIRTH);
  const reads = interpretCareer(fortune, stack);
  const aux = reads.filter((r) => r.status === 'ok' && r.evidenceType !== 'direct');
  assert.ok(aux.length >= 6, `간접·약한 증거도 답에 들어온다 (실제 ${aux.length})`);
  // 다만 직접 증거와 같은 무게는 아니다
  assert.ok(ET_SCALE.direct > ET_SCALE.indirect && ET_SCALE.indirect > ET_SCALE.weak);
});

test('한 체계의 뜻을 다른 체계의 어휘로 옮기지 않는다', () => {
  for (const r of RULES) assert.ok(r.id.startsWith(`${r.system}|`), `${r.id} 의 주인이 뒤섞였다`);
});

// ─────────────────────────────────────────────────────────────
// 2. 평균을 쓰지 않는다 — 이 저장소에서 가장 중요한 검사
// ─────────────────────────────────────────────────────────────

test('강한 소수 의견이 침묵한 다수에 희석되지 않는다', () => {
  // 셋이 기술을 세게 가리키고 열둘이 침묵하는 상황
  const strong = { features: { technical: 0.9 }, weight: 1 };
  const silent = { features: {}, weight: 1 };
  const withSilence = noisyOr('career', [strong, strong, strong, ...Array(12).fill(silent)]);
  const alone = noisyOr('career', [strong, strong, strong]);
  assert.equal(withSilence.technical, alone.technical,
    '침묵은 반대가 아니다 — 말하지 않은 체계가 신호를 깎으면 안 된다');
  assert.ok(withSilence.technical > 0.9, '겹치면 오히려 진해진다');
});

test('같은 표를 쓰는 계보는 한 표로 나눠 갖는다', () => {
  assert.equal(LINEAGE.juyeok, LINEAGE.taeeul);
  assert.equal(LINEAGE.taeeul, LINEAGE.tojeong, '주역·태을·토정은 같은 팔괘를 읽는다');
  assert.equal(LINEAGE.kabbalah, LINEAGE.tarot, '둘 다 생년월일 수에서 나온다');
  assert.equal(LINEAGE.thai, LINEAGE.mahabote, '둘 다 출생 요일 행성에서 나온다');

  const f = independenceFactors(['juyeok', 'taeeul', 'tojeong', 'saju']);
  assert.ok(Math.abs(f.juyeok - 1 / 3) < 1e-9, '팔괘 셋은 1/3 씩');
  assert.equal(f.saju, 1, '혼자인 계보는 온전히');
});

test('직접 증거가 적으면 보조 증거의 몫도 같이 줄어든다', () => {
  // 시각 미상이면 자미·점성이 빠져 직접 증거가 사주 하나뿐이다.
  // 그때 간접·약한 증거 열하나가 답을 가져가면 안 된다.
  assert.ok(auxScale(1) < auxScale(4), '직접 증거가 줄면 보조 몫도 줄어야 한다');
  assert.equal(auxScale(4), 1);
  assert.ok(auxScale(0) >= 0.35, '아주 0 으로 만들지는 않는다');

  const withTime = readCareer(BIRTH, { asOfDate: AS_OF });
  const noTime = readCareer({ ...BIRTH, hour: undefined, minute: undefined }, { asOfDate: AS_OF });
  assert.ok(withTime.meta.directCount > noTime.meta.directCount);
  assert.ok(withTime.meta.auxScale > noTime.meta.auxScale);
});

test('표의 평균에서 벗어난 만큼으로 합친다 — 절대값으로 더하면 누구나 같아진다', () => {
  for (const id of SYSTEM_IDS) {
    if (!TABLE_MEAN[id]) continue;
    const mean = TABLE_MEAN[id];
    // 평균과 똑같은 벡터는 아무것도 기여하지 않아야 한다
    const dev = deviationOf(id, mean);
    for (const v of Object.values(dev)) assert.ok(Math.abs(v) < 1e-9, `${id} 평균의 편차는 0`);
  }
});

// ─────────────────────────────────────────────────────────────
// 3. 넓게 말하면 저절로 깎인다
// ─────────────────────────────────────────────────────────────

test('좁게 말하는 규칙이 넓게 말하는 규칙보다 높은 좁기를 받는다', () => {
  const narrow = specificityOf({ technical: 1 }, 'career');
  const broad = specificityOf(Object.fromEntries(AXES.career.map((k) => [k, 0.5])), 'career');
  assert.ok(narrow > broad, `좁음 ${narrow} 이 넓음 ${broad} 보다 커야 한다`);
  assert.ok(broad < 0.1, '스무 축을 고루 건드리면 좁기가 거의 0');
});

test('모든 규칙에 전통강도·좁기·증거등급이 붙어 있다', () => {
  for (const r of RULES) {
    assert.ok(r.traditionalStrength > 0 && r.traditionalStrength <= 1, r.id);
    assert.ok(r.specificity >= 0 && r.specificity <= 1, r.id);
    assert.ok(['direct', 'indirect', 'weak'].includes(r.evidenceType), r.id);
    assert.ok(Object.keys(r.features).length, `${r.id} 에 축이 없다`);
    for (const k of Object.keys(r.features)) assert.ok(AXES.career.includes(k), `${r.id} 에 없는 축 ${k}`);
  }
});

test('실측이 없으면 0 이 아니라 null 이다', () => {
  const fresh = RULES.find((r) => r.empiricalSupport == null);
  assert.ok(fresh, '실측을 안 얹은 규칙은 null 로 남는다');
  assert.equal(fresh.provisional, true);
  // 얹으면 표본 수와 잠정 여부가 함께 붙는다
  applyEmpirical({ [fresh.id]: { value: 0.62, n: 3 } });
  const after = ruleFor(fresh.system, 'career', fresh.condition);
  assert.equal(after.empiricalSupport, 0.62);
  assert.equal(after.sampleSize, 3);
  assert.equal(after.provisional, true, '3명은 잠정');
  applyEmpirical({ [fresh.id]: { value: 0.62, n: 9 } });
  assert.equal(ruleFor(fresh.system, 'career', fresh.condition).provisional, false);
  // 원래대로 되돌린다
  fresh.empiricalSupport = null; fresh.sampleSize = 0; fresh.provisional = true;
});

// ─────────────────────────────────────────────────────────────
// 4. 작은 표본이 큰 무게 차이를 만들지 못한다
// ─────────────────────────────────────────────────────────────

test('표본 수에 따라 무게가 움직일 수 있는 폭이 묶여 있다', () => {
  assert.equal(driftCap(0), 0);
  assert.equal(driftCap(2), 0.03);
  assert.equal(driftCap(5), 0.05);
  assert.equal(driftCap(11), 0.10);
  assert.ok(driftCap(50) > 0.10 && driftCap(50) <= 0.30, '자료가 늘면 천천히 열린다');
});

test('속성별 보정 무게가 좁은 범위 안에 머문다', () => {
  const rows = [
    { id: 'A', truth: OCCUPATIONS.개발자.features, systems: interpretCareer(...Object.values(runOf(BIRTH))) },
    { id: 'B', truth: OCCUPATIONS.미용사.features,
      systems: interpretCareer(...Object.values(runOf({ ...BIRTH, year: 1990, month: 10, day: 6 }))) },
  ];
  const w = weightsFrom(measure(rows));
  for (const perAxis of Object.values(w)) {
    for (const v of Object.values(perAxis)) {
      assert.ok(v >= 0.85 && v <= 1.15, `보정 무게가 ${v} — 0.85~1.15 를 벗어났다`);
    }
  }
});

// ─────────────────────────────────────────────────────────────
// 5. 결정론 · 시각 미상
// ─────────────────────────────────────────────────────────────

test('같은 입력이면 결과가 똑같다', () => {
  const a = readCareer(BIRTH, { asOfDate: AS_OF });
  const b = readCareer(BIRTH, { asOfDate: AS_OF });
  assert.deepEqual(a.profile, b.profile);
  assert.deepEqual(a.categories, b.categories);
});

test('원국 해석은 asOfDate 에 흔들리지 않는다', () => {
  const a = readCareer(BIRTH, { asOfDate: '2026-09-21' });
  const b = readCareer(BIRTH, { asOfDate: '2031-02-14' });
  assert.deepEqual(a.profile, b.profile, '타고난 결이 올해에 따라 바뀌면 원국이 아니다');
});

test('시각을 모르면 그 체계만 빠지고 나머지는 계속 말한다', () => {
  const r = readCareer({ ...BIRTH, hour: undefined, minute: undefined }, { asOfDate: AS_OF });
  const byId = Object.fromEntries(r.systems.map((s) => [s.system, s]));
  assert.equal(byId.jamidusu.status, 'unavailable');
  assert.match(byId.jamidusu.why, /시각/);
  assert.equal(byId.astrology.status, 'unavailable');
  assert.equal(byId.saju.status, 'ok', '사주는 시각 없이도 말한다');
  assert.ok(r.profile, '나머지로 답은 나온다');
  assert.equal(r.meta.timeKnown, false);
});

// ─────────────────────────────────────────────────────────────
// 6. 분포·범주
// ─────────────────────────────────────────────────────────────

test('네 층이 모두 나오고 분포의 합이 1이다', () => {
  const r = readCareer(BIRTH, { asOfDate: AS_OF });
  for (const level of ['levelA', 'levelB', 'levelC']) {
    const d = r.categories[level];
    assert.ok(d, `${level} 이 없다`);
    const sum = Object.values(d.dist).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 0.01, `${level} 합이 ${sum}`);
    for (const [k, p] of Object.entries(d.dist)) {
      assert.ok(p > 0, `${level}.${k} 가 0 — 명반은 '절대 아니다'를 말할 수 없다`);
    }
  }
  assert.ok(r.categories.levelD.length, 'LEVEL D 예시가 나온다');
});

test('산업군 원형은 손으로 쓰지 않고 그 업종의 직업들에서 나온다', () => {
  for (const [key, def] of Object.entries(CAREER_CATEGORIES)) {
    assert.ok(def.memberCount >= 1, `${key} 에 속한 직업이 없다`);
    assert.ok(def.examples.length === def.memberCount);
    // 원형이 실제로 그 직업들의 평균인지
    const members = Object.values(OCCUPATIONS).filter((o) => o.category === key);
    const tech = members.reduce((a, m) => a + (m.features.technical ?? 0), 0) / members.length;
    assert.ok(Math.abs((def.proto.technical ?? 0) - tech) < 1e-9 || tech <= 0.05, key);
  }
});

test('정답 속성을 그대로 넣으면 정답 업종이 위쪽에 온다 — 변환층 자체 점검', () => {
  // 명반과 무관한 검사다. 여기서 떨어지면 그건 변환층의 버그다.
  let top3 = 0;
  const jobs = Object.entries(OCCUPATIONS);
  for (const [, o] of jobs) {
    const ranked = categorizeCareer(o.features, centered(o.features, AXES.career)).levelC.ranked;
    const rank = ranked.findIndex((x) => x.key === o.category) + 1;
    if (rank <= 3) top3++;
  }
  const rate = top3 / jobs.length;
  assert.ok(rate >= 0.8, `정답 업종이 3위 안에 드는 비율이 ${rate.toFixed(2)} — 변환층을 보라`);
});

// ─────────────────────────────────────────────────────────────
// 7. 채점 도구
// ─────────────────────────────────────────────────────────────

test('평균을 빼고 견준다 — 안 빼면 모두에게 평균을 주는 것이 최선이 된다', () => {
  const dev = centered(OCCUPATIONS.개발자.features, AXES.career);
  assert.ok(dev.technical > 0, '개발자는 보통보다 기술이 높다');
  assert.ok(dev.physical < 0, '보통보다 신체는 낮다');
  const flat = centered(OCCUPATION_MEAN, AXES.career);
  for (const v of Object.values(flat)) assert.ok(Math.abs(v) < 1e-9, '평균 자신의 편차는 0');
});

test('상관은 변화가 없으면 말하지 않는다', () => {
  assert.equal(pearson([1, 1, 1], [1, 2, 3]), null, '한쪽이 상수면 null');
  assert.ok(pearson([1, 2, 3], [1, 2, 3]) > 0.99);
  assert.ok(pearson([1, 2, 3], [3, 2, 1]) < -0.99);
});

test('맞힌 축·놓친 축·과하게 읽은 축을 구별한다', () => {
  const truth = { technical: 0.9, physical: 0.1 };
  const pred = { technical: 0.8, physical: 0.9 };
  const c = compareOne(truth, pred);
  assert.ok(c.hit.includes('technical'));
  assert.ok(c.over.includes('physical'), '실제로 낮은데 세게 읽으면 과함');
});

// ─────────────────────────────────────────────────────────────
// 8. 해석 사전
// ─────────────────────────────────────────────────────────────

test('해석 사전은 규칙 등록소에서 그대로 나온다', () => {
  const dict = buildDictionary('career');
  assert.equal(Object.keys(dict).length, SYSTEM_IDS.length, '열다섯이 다 실린다');
  const zi = dict.jamidusu;
  assert.ok(zi.places['원국 관록궁'], '자미 관록궁 자리가 있다');
  const tamrang = zi.places['원국 관록궁'].find((e) => e.symbol === '탐랑');
  assert.ok(tamrang, '탐랑이 사전에 있다');
  const axes = tamrang.features.map((f) => f.axis);
  assert.ok(axes.includes('aesthetic') && axes.includes('interpersonal'),
    '탐랑은 미적감각·대인을 가리킨다');
  // 사전의 값이 규칙의 값과 같아야 한다
  const rule = ruleFor('jamidusu', 'career', 'career:탐랑');
  assert.equal(tamrang.features[0].value, Math.round(rule.features[tamrang.features[0].axis] * 100) / 100);
});

test('축 하나를 어느 기호들이 가리키는지 거꾸로 찾을 수 있다', () => {
  const rows = byAxis('aesthetic', 'career', 0.7);
  assert.ok(rows.length >= 3, '미적감각을 가리키는 기호가 여럿이다');
  assert.ok(rows.some((r) => r.symbol === '탐랑' || r.symbol === '금성'));
});

// ─────────────────────────────────────────────────────────────
// 9. 답은 낸다 — 다만 확신도와 함께
// ─────────────────────────────────────────────────────────────

test('처음 보는 사람에게도 답이 나온다', () => {
  const child = readCareer({
    name: '아이', gender: 'male', year: 2018, month: 5, day: 9,
    hour: 7, minute: 20, birthPlace: '서울', homePlace: '서울',
  }, { asOfDate: AS_OF });
  assert.ok(child.profile, '아무 과거 정보가 없어도 읽는다');
  assert.ok(child.categories.levelC.ranked[0].p > 0);
  assert.ok(child.confidence.score > 0);
  assert.ok(['두꺼움', '보통', '얇음'].includes(child.confidence.level));

  const text = narrateCareer(child);
  assert.match(text, /직업 방향은/);
  assert.match(text, /확신도/);
  assert.doesNotMatch(text, /판단 불가|알 수 없습니다|사람을 더 모/);
});

test('확신도는 근거의 두께이지 적중률이 아니라고 적는다', () => {
  const r = readCareer(BIRTH, { asOfDate: AS_OF });
  assert.match(r.confidence.note, /적중률이 아니다/);
  assert.match(narrate(r), /적중률이 아닙니다/);
});

test('근거 없는 값은 내지 않는다', () => {
  const r = readCareer(BIRTH, { asOfDate: AS_OF });
  for (const s of r.systems) {
    if (s.status !== 'ok') { assert.ok(s.why, `${s.name} 은 왜 침묵하는지 적는다`); continue; }
    assert.ok(s.evidence.length, `${s.name} 은 근거를 남긴다`);
  }
});

test('직업 사전에 없는 직업은 정답으로 지어내지 않는다', () => {
  assert.equal(labelFor('우주비행사'), null);
  assert.ok(labelFor('개발자'));
  assert.ok(labelFor('성형외과 실장'), '같은 일의 다른 이름도 찾는다');
});
