/**
 * 고해상도 계산 레이어 테스트
 *
 * 보는 것은 넷이다.
 *   결정론 — 같은 입력이면 언제 돌려도 같은 값이 나오는가
 *   경계   — 입춘·자정·서머타임·시각 미상에서 무너지지 않는가
 *   규칙   — 각 전통의 계산 규칙을 실제로 지키는가 (대한 시작 나이, 다샤 합 등)
 *   회귀   — 이번 변경으로 기존 원국 계산이 달라지지 않았는가
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { readFortune } from '../../public/unse-8f3k2m/src/engine.js';
import { readForecast, monthsOfYear } from '../../public/unse-8f3k2m/src/forecast.js';
import { planetPositions, houses } from '../../public/unse-8f3k2m/src/core/planets.js';
import { toJD } from '../../public/unse-8f3k2m/src/core/astro.js';

import { monthlyTrack, annualTrack, daeunAt } from '../../public/unse-8f3k2m/src/hires/bazi.js';
import * as ZW from '../../public/unse-8f3k2m/src/hires/ziwei.js';
import * as WS from '../../public/unse-8f3k2m/src/hires/western.js';
import * as VD from '../../public/unse-8f3k2m/src/hires/vedic.js';
import * as LOC from '../../public/unse-8f3k2m/src/hires/location.js';
import { buildGrid } from '../../public/unse-8f3k2m/src/hires/grid.js';
import { inferEvents, chainOf, fitFor, EVENT_CANDIDATES, EVENT_GROUPS } from '../../public/unse-8f3k2m/src/hires/events.js';
import { routeQuestion, defaultPlan } from '../../public/unse-8f3k2m/src/hires/router.js';
import { buildHiRes } from '../../public/unse-8f3k2m/src/hires/context.js';
import { branchPair, fullCombos } from '../../public/unse-8f3k2m/src/hires/relations.js';

const NOW = new Date('2026-09-19T00:00:00Z');

const FORM = {
  name: '고해상도 A', gender: 'female',
  year: 1992, month: 1, day: 30, hour: 16, minute: 28,
  birthPlace: '여주', homePlace: '대전',
};
const FORM_M = {
  name: '고해상도 B', gender: 'male',
  year: 1999, month: 4, day: 28, hour: 10, minute: 15,
  birthPlace: '대전', homePlace: '서울',
};

const load = (form) => {
  const r = readFortune(form, { now: NOW });
  const f = readForecast(form, NOW);
  return { r, f };
};

// ─────────────────────────────────────────────────────────────
// 결정론
// ─────────────────────────────────────────────────────────────

test('같은 입력은 두 번 돌려도 글자 하나까지 같다', () => {
  const plan = defaultPlan(2026);
  const a = buildHiRes(load(FORM).r, load(FORM).f, plan).text;
  const b = buildHiRes(load(FORM).r, load(FORM).f, plan).text;
  assert.equal(a, b);
  assert.ok(a.length > 1000, '문맥이 비어 있다');
});

test('고해상도 계산은 기존 원국 계산을 바꾸지 않는다', () => {
  const { r } = load(FORM);
  assert.equal(
    ['year', 'month', 'day', 'hour'].map((k) => r.chart.pillars[k].hanja).join(' '),
    '辛未 辛丑 乙巳 甲申'
  );
  assert.deepEqual(r.errors, []);
  // 새 모듈을 돌린 뒤에도 값이 그대로여야 한다
  buildHiRes(r, load(FORM).f, defaultPlan(2026));
  assert.equal(r.chart.pillars.day.hanja, '乙巳');
});

// ─────────────────────────────────────────────────────────────
// 경계
// ─────────────────────────────────────────────────────────────

test('입춘 전후로 사주 연도가 갈리고 양쪽 모두 계산된다', () => {
  const before = readFortune({ ...FORM, year: 1990, month: 2, day: 3, hour: 10 }, { now: NOW });
  const after = readFortune({ ...FORM, year: 1990, month: 2, day: 6, hour: 10 }, { now: NOW });
  assert.equal(before.chart.sajuYear, 1989);
  assert.equal(after.chart.sajuYear, 1990);
  for (const r of [before, after]) {
    const g = buildGrid(r.input, r.chart, { fromYear: 2026, years: 1, domain: '직업' });
    assert.equal(g.months.length, 12);
  }
});

test('자정 부근과 서머타임 구간도 층이 서 있다', () => {
  const cases = [
    { ...FORM, hour: 23, minute: 59 },
    { ...FORM, hour: 0, minute: 1 },
    { ...FORM, year: 1988, month: 7, day: 10, hour: 12 },   // 한국 서머타임 시행 구간
  ];
  for (const form of cases) {
    const r = readFortune(form, { now: NOW });
    const g = buildGrid(r.input, r.chart, { fromYear: 2026, years: 1, domain: '직업' });
    assert.equal(g.months.length, 12, `${form.year}-${form.hour} 실패`);
    assert.ok(g.board.myeong >= 0 && g.board.myeong < 12);
  }
});

test('출생 시각을 모르면 자미 층을 세우지 않고 그 사실을 적는다', () => {
  const noTime = { ...FORM, hour: null, minute: 0 };
  const { r, f } = load(noTime);
  const h = buildHiRes(r, f, defaultPlan(2026));
  assert.equal(h.json.ziwei.unavailable !== undefined, true);
  assert.match(h.text, /출생 시각을 몰라/);
  // 사주·베딕은 시각이 없어도 돌아간다
  assert.ok(h.json.bazi.monthly.length >= 12);
});

// ─────────────────────────────────────────────────────────────
// 사주 다층
// ─────────────────────────────────────────────────────────────

test('월운은 절기월 열둘이고 간지가 기존 엔진과 일치한다', () => {
  const { r } = load(FORM);
  const track = monthlyTrack(r.input, r.chart, 2027);
  const base = monthsOfYear(2027);
  assert.equal(track.length, 12);
  track.forEach((m, i) => {
    assert.equal(m.gz.hanja, base[i].gz.month.hanja, `${i}번째 달 간지 불일치`);
    assert.equal(m.from.m, base[i].termStart.m);
  });
});

test('축월은 이듬해 1월에 시작하고 라벨에 달력 연도가 들어간다', () => {
  const { r } = load(FORM);
  const track = monthlyTrack(r.input, r.chart, 2027);
  const last = track[11];
  assert.equal(last.from.y, 2028);
  assert.ok(last.label.startsWith('2028.'), `라벨이 ${last.label}`);
});

test('원국에 이미 선 합은 달마다 되풀이 적지 않는다', () => {
  // 寅卯辰 가운데 둘만으로는 방합이 서지 않는다
  assert.equal(branchPair(2, 3).some((x) => x.kind === '방합'), false);
  // 셋이 다 모이면 선다
  assert.equal(fullCombos([2, 3, 4]).some((x) => x.kind === '방합'), true);
  // 원국만으로 이미 서 있으면 시기 신호로 세지 않는다
  assert.equal(fullCombos([2, 3, 4], [2, 3, 4]).length, 0);
});

test('대운은 소수 경계로 고르고 전환까지 남은 햇수를 돌려준다', () => {
  const { r } = load(FORM);
  const d = daeunAt(r.input, r.chart, r.input.nowJD);
  assert.ok(d.current, '현재 대운이 없다');
  assert.ok(d.toTurn > 0 && d.toTurn <= 10);
  assert.ok(d.elapsed > 30 && d.elapsed < 40);
});

test('연도별 층은 요청한 범위만큼 나오고 대운 전환 해를 표시한다', () => {
  const { r } = load(FORM);
  const years = annualTrack(r.input, r.chart, 2026, 2030);
  assert.equal(years.length, 5);
  assert.equal(years[0].year, 2026);
  assert.ok(years.every((y) => typeof y.god === 'string'));
});

// ─────────────────────────────────────────────────────────────
// 자미두수 대한 · 유년 · 유월
// ─────────────────────────────────────────────────────────────

test('대한은 오행국 수에서 시작해 열 해씩 이어진다', () => {
  const { r } = load(FORM);
  const b = ZW.buildBoard(r.input);
  const limits = ZW.decadeLimits(r.input, b);
  assert.equal(limits[0].fromAge, b.guk.n);
  assert.equal(limits[0].branch, b.myeong, '첫 대한은 명궁에서 시작한다');
  for (let i = 1; i < limits.length; i++) {
    assert.equal(limits[i].fromAge - limits[i - 1].fromAge, 10);
    assert.equal(limits[i].fromYear - limits[i - 1].fromYear, 10);
  }
  // 양남음녀 순행 / 음남양녀 역행
  const step = (limits[1].branch - limits[0].branch + 12) % 12;
  assert.ok(step === 1 || step === 11);
});

test('유년 명궁은 그 해 태세 지지이고 열두 궁이 다시 붙는다', () => {
  const { r } = load(FORM);
  const b = ZW.buildBoard(r.input);
  for (const y of [2026, 2027, 2030]) {
    const a = ZW.annualLayer(b, y);
    assert.equal(a.branch, ((y - 4) % 12 + 12) % 12);
    assert.equal(a.map[a.branch], '명궁');
    assert.equal(a.sihwa.length, 4);
  }
});

test('유월은 두군에서 순행하는 열두 칸이다', () => {
  const { r } = load(FORM);
  const b = ZW.buildBoard(r.input);
  const ml = ZW.monthLayers(r.input, b, 2027);
  assert.equal(ml.months.length, 12);
  assert.equal(ml.months[0].branch, ml.ducun);
  ml.months.forEach((m, i) => {
    assert.equal(m.branch, (ml.ducun + i) % 12);
    assert.equal(m.map[m.branch], '명궁');
  });
});

test('보조 네 별이 판에 놓여 사화가 허공에 떨어지지 않는다', () => {
  for (const form of [FORM, FORM_M]) {
    const { r } = load(form);
    const b = ZW.buildBoard(r.input);
    for (const name of ['좌보', '우필', '문창', '문곡']) {
      assert.ok(b.board.some((cell) => cell.includes(name)), `${name} 미배치`);
    }
    for (const s of ZW.sihwaOn(b.board, b.yearStem)) {
      assert.notEqual(s.branch, null, `${s.star} 사화가 자리를 못 찾았다`);
    }
  }
});

test('질문 분야에 따라 볼 궁이 자동으로 골라진다', () => {
  const { r } = load(FORM);
  const s = ZW.stackAt(r.input, 2027, 6);
  const ov = ZW.overlapFor(s.board, '직업', s.layers);
  assert.deepEqual(ov.rows.map((x) => x.palace), ['명궁', '관록궁', '천이궁', '재백궁']);
  const marry = ZW.overlapFor(s.board, '결혼', s.layers);
  assert.deepEqual(marry.rows.map((x) => x.palace), ['명궁', '부처궁', '복덕궁', '전택궁']);
});

// ─────────────────────────────────────────────────────────────
// 서양 점성술
// ─────────────────────────────────────────────────────────────

test('솔라 리턴은 태양이 출생 황경으로 돌아오는 순간이다', () => {
  const { r } = load(FORM);
  const N = WS.natalPack(r.input);
  for (const y of [2026, 2027]) {
    const sr = WS.solarReturn(r.input, N, y, r.input.home);
    const sun = planetPositions(sr.jd).태양.lon;
    const diff = Math.abs(((sun - N.pos.태양.lon + 540) % 360) - 180);
    assert.ok(diff < 0.01, `${y}년 솔라 리턴 태양이 ${diff}° 어긋났다`);
    assert.equal(sr.at.y, y);
  }
});

test('진행 각은 한 해에 몇 도씩만 움직인다 (일도일년법)', () => {
  const { r } = load(FORM);
  const N = WS.natalPack(r.input);
  const a = WS.progressedAt(r.input, N, toJD(2026, 6, 1, 12));
  const b = WS.progressedAt(r.input, N, toJD(2027, 6, 1, 12));
  const move = Math.abs(((b.mc.lon - a.mc.lon + 540) % 360) - 180);
  assert.ok(move < 5, `진행 중천이 한 해에 ${move}° 움직였다 — 각 계산이 잘못됐다`);
  assert.ok(move > 0.1, '진행 중천이 아예 안 움직인다');
});

test('트랜싯은 마주 보는 커스프에 같은 각을 두 번 적지 않는다', () => {
  const { r } = load(FORM);
  const N = WS.natalPack(r.input);
  const t = WS.transitsAt(N, toJD(2027, 6, 1, 12), { timeKnown: true, domain: '직업' });
  const keys = t.hits.map((h) => `${h.planet}|${Math.round(h.orb * 100)}`);
  assert.equal(new Set(keys).size, keys.length, '같은 각이 두 줄로 적혔다');
});

// ─────────────────────────────────────────────────────────────
// 베딕
// ─────────────────────────────────────────────────────────────

test('다샤 하위 구간의 합은 상위 구간 길이와 같다', () => {
  const { r } = load(FORM);
  const tree = VD.dashaTree(r.input, 3);
  const md = tree.list[2];
  const adSum = md.sub.reduce((t, x) => t + x.span, 0);
  assert.ok(Math.abs(adSum - (md.toAge - md.fromAge)) < 1e-6);
  const ad = md.sub[3];
  const pdSum = ad.sub.reduce((t, x) => t + x.span, 0);
  assert.ok(Math.abs(pdSum - ad.span) < 1e-6);
  // 하위 구간은 언제나 상위 구간의 주인부터 시작한다
  assert.equal(md.sub[0].lord, md.lord);
  assert.equal(ad.sub[0].lord, ad.lord);
});

test('그 시점의 MD·AD·PD 가 한 줄로 집힌다', () => {
  const { r } = load(FORM);
  const tree = VD.dashaTree(r.input, 3);
  const at = VD.dashaAt(r.input, tree, toJD(2027, 6, 1, 12));
  assert.ok(at.md && at.ad && at.pd);
  assert.ok(at.ad.fromAge >= at.md.fromAge && at.ad.toAge <= at.md.toAge + 1e-9);
  assert.ok(at.pd.fromAge >= at.ad.fromAge && at.pd.toAge <= at.ad.toAge + 1e-9);
});

test('분할 차트는 파라샤라 표준 대응을 따른다', () => {
  // D9 — 활동궁은 자기 자리, 고정궁은 아홉째, 변통궁은 다섯째에서 시작
  assert.equal(VD.navamsa(0), 0);      // 메샤 0° → 메샤
  assert.equal(VD.navamsa(30), 9);     // 브리샤바 0° → 마카라
  assert.equal(VD.navamsa(60), 6);     // 미투나 0° → 툴라
  assert.equal(VD.navamsa(90), 3);     // 카르카 0° → 카르카
  // D10 — 홀수 별자리는 자기 자리, 짝수는 아홉째
  assert.equal(VD.dasamsa(0), 0);
  assert.equal(VD.dasamsa(30), 9);
  assert.equal(VD.dasamsa(3), 1);
  // D2 — 홀수 앞 절반 사자, 뒤 절반 게
  assert.equal(VD.hora(5), 4);
  assert.equal(VD.hora(20), 3);
  assert.equal(VD.hora(35), 3);
  // D4 — 7°30′ 마다 세 칸씩
  assert.equal(VD.chaturthamsa(0), 0);
  assert.equal(VD.chaturthamsa(8), 3);
});

test('고차라는 출생 달에서 몇 번째인지를 세고 사데사티를 표시한다', () => {
  const { r } = load(FORM);
  const g = VD.gocharaAt(r.input, toJD(2027, 6, 1, 12));
  assert.equal(g.rows.length, 4);
  for (const row of g.rows) {
    assert.ok(row.fromMoon >= 1 && row.fromMoon <= 12);
  }
  const saturn = g.rows.find((x) => x.planet === '토성');
  assert.equal(g.sadeSati, [12, 1, 2].includes(saturn.fromMoon));
});

// ─────────────────────────────────────────────────────────────
// 지역
// ─────────────────────────────────────────────────────────────

test('MC 라인 경도에서 그 행성은 실제로 중천에 온다', () => {
  const { r } = load(FORM);
  const acg = LOC.astrocartography(r.input.jdUT);
  const pos = planetPositions(r.input.jdUT);
  for (const line of acg.lines.slice(0, 3)) {
    const h = houses(r.input.jdUT, 37, line.mc);
    const diff = Math.abs(((h.mc - pos[line.planet].lon + 540) % 360) - 180);
    assert.ok(diff < 0.5, `${line.planet} MC 라인이 ${diff}° 어긋났다`);
  }
});

test('방위각과 대권거리가 실제 지리와 맞는다', () => {
  const seoul = { lat: 37.5665, lon: 126.9780 };
  const busan = { lat: 35.1796, lon: 129.0756 };
  const km = LOC.distanceKm(seoul, busan);
  assert.ok(km > 300 && km < 350, `서울-부산 ${km}km`);
  const deg = LOC.bearing(seoul, busan);
  assert.ok(deg > 120 && deg < 160, `서울→부산 방위 ${deg}°`);
  assert.equal(LOC.dir8(deg), '남동');
});

test('후보 도시는 방향과 거리로만 고른다', () => {
  const list = LOC.candidatesToward('대전', 0, { maxKm: 200 });
  assert.ok(list.length > 0);
  for (const c of list) {
    assert.ok(c.km <= 200);
    assert.ok(c.off <= 33, `${c.name} 방향이 ${c.off}° 벗어났다`);
  }
});

test('릴로케이션은 하우스만 바꾸고 행성 자리는 그대로 둔다', () => {
  const { r } = load(FORM);
  const a = LOC.relocation(r.input, '서울');
  const b = LOC.relocation(r.input, '부산');
  assert.ok(a && b);
  assert.notEqual(a.asc, b.asc);
  assert.ok(Array.isArray(a.moved));
});

// ─────────────────────────────────────────────────────────────
// 질문 라우팅
// ─────────────────────────────────────────────────────────────

test('질문에 먼저 나온 낱말이 주 분야가 된다', () => {
  const p = routeQuestion('2027년에 이직하게 될까요? 이사도 같이 하나요?', 2026);
  assert.equal(p.primary, '직업');
  assert.ok(p.domains.includes('이사'));
  assert.equal(p.fromYear, 2026);
  assert.equal(p.years, 2);
});

test('지역 질문은 지역 계산을 켜고 도시 이름을 집어낸다', () => {
  const p = routeQuestion('대전과 성남 중에 어디서 사는 게 좋을까요?', 2026);
  assert.equal(p.needsPlace, true);
  assert.ok(p.cities.includes('대전') && p.cities.includes('성남'));
  assert.equal(p.pipeline.location, true);
});

test('날짜를 물을 때만 일진까지 내려간다', () => {
  assert.equal(routeQuestion('올해 이직할까요?', 2026).pipeline.day, false);
  assert.equal(routeQuestion('계약 날짜를 잡아주세요', 2026).pipeline.day, true);
});

test('분야를 못 가려내면 그 사실을 표시한다', () => {
  const p = routeQuestion('요즘 어떤가요', 2026);
  assert.equal(p.fallback, true);
  assert.equal(p.matched, false);
});

// ─────────────────────────────────────────────────────────────
// 사건 추론
// ─────────────────────────────────────────────────────────────

test('구간 등급은 절대 점수가 아니라 그 기간 안에서의 순위다', () => {
  const { r, f } = load(FORM);
  const grid = buildGrid(r.input, r.chart, { fromYear: 2026, years: 3, domain: '직업', forecast: f });
  const inf = inferEvents(grid, '직업');
  assert.equal(inf.rows.length, 36);
  const bands = new Set(inf.rows.map((x) => x.band));
  assert.ok(bands.has('최강'));
  assert.ok(bands.has('약함'), '전부 강함으로 잡히면 시기를 좁힌 것이 아니다');
  // 최강은 항상 총점 1등을 포함한다
  const top = inf.rows.slice().sort((a, b) => b.total - a.total)[0];
  assert.equal(top.band, '최강');
});

test('사건 후보와 속성이 함께 나오고 좁히지 못한 축은 비워 둔다', () => {
  const { r, f } = load(FORM_M);
  const grid = buildGrid(r.input, r.chart, { fromYear: 2026, years: 2, domain: '직업', forecast: f });
  const inf = inferEvents(grid, '직업');
  assert.ok(inf.candidates.length >= 5);
  assert.ok(inf.attributes.length === 6);
  for (const a of inf.attributes) {
    assert.ok(['뚜렷', '약간', '팽팽', '근거 부족'].includes(a.strength));
    if (a.strength === '근거 부족') assert.equal(a.lean, null);
  }
  assert.ok(inf.scenarios.main);
});

test('여러 분야를 겹치면 사건의 선후가 나온다', () => {
  const { r, f } = load(FORM);
  const opts = { fromYear: 2026, years: 2, forecast: f };
  const a = inferEvents(buildGrid(r.input, r.chart, { ...opts, domain: '직업' }), '직업');
  const b = inferEvents(buildGrid(r.input, r.chart, { ...opts, domain: '주거' }), '주거');
  const chain = chainOf([a, b]);
  assert.ok(chain.peaks.length >= 1);
  assert.ok(typeof chain.order === 'string');
});

// ─────────────────────────────────────────────────────────────
// 문맥
// ─────────────────────────────────────────────────────────────

test('문맥은 계산과 해석을 구획으로 갈라 놓는다', () => {
  const { r, f } = load(FORM);
  const h = buildHiRes(r, f, routeQuestion('2027년 이직 시기가 언제인가요?', 2026));
  assert.match(h.text, /\[A\] 계산 사실 — 사주 다층/);
  assert.match(h.text, /\[A\] 계산 사실 — 자미두수 층/);
  assert.match(h.text, /\[A\] 계산 사실 — 서양 점성술/);
  assert.match(h.text, /\[A\] 계산 사실 — 베딕/);
  assert.match(h.text, /\[B~E\] 사건 추론/);
  assert.match(h.text, /신뢰도 표기/);
  // route.ts 의 MAX_FOCUS_CHARS
  assert.ok(h.text.length <= 40_000, `고해상도 문맥이 ${h.text.length}자`);
});

test('지역을 물으면 방향은 계산으로, 도시는 추정으로 표시한다', () => {
  const { r, f } = load(FORM);
  const h = buildHiRes(r, f, routeQuestion('서울과 부산 중 어디가 나을까요?', 2026));
  assert.ok(h.location, '지역 계산이 돌지 않았다');
  assert.match(h.text, /방향 신호\(A\)/);
  assert.match(h.text, /초구체화 추정/);
  assert.equal(h.location.relocation.length, 2);
});

// ─────────────────────────────────────────────────────────────
// 시기 선택의 공정성 — 블라인드 검증을 준비하다 찾은 두 가지
// ─────────────────────────────────────────────────────────────

test('대표 구간은 시간 순서가 아니라 점수로 고른다', () => {
  // windows 는 시간 순서다. 거기서 첫 최강 구간을 집으면 최강이 여럿일 때
  // 언제나 이른 쪽이 뽑혀, 앞쪽 달이 구조적으로 유리해진다.
  const { r, f } = load(FORM);
  const grid = buildGrid(r.input, r.chart, { fromYear: 2026, years: 5, domain: '직업', forecast: f });
  const inf = inferEvents(grid, '직업');
  assert.ok(inf.bestWindow, 'bestWindow 가 없다');

  const scoreOf = (w) => inf.rows.find((x) => x.key === w.peakKey)?.total ?? -Infinity;
  for (const w of inf.windows) {
    assert.ok(scoreOf(inf.bestWindow) >= scoreOf(w),
      `${w.label} 이 대표 구간보다 점수가 높은데 뽑히지 않았다`);
  }
});

test('한 분야에 계산식이 같은 사건 후보를 두지 않는다', () => {
  // 후보 둘의 점수가 늘 같으면 서로의 여유를 0으로 깎아 신호가 사라진다.
  // 실제로 관계 분야에 '새 만남'과 '교제 시작'을 함께 뒀다가 같은 사건의
  // 순위가 180달 중 7위에서 39위로 떨어졌다.
  const { r } = load(FORM);
  for (const domain of Object.keys(EVENT_CANDIDATES)) {
    const grid = buildGrid(r.input, r.chart, { fromYear: 2026, years: 2, domain });
    const inf = inferEvents(grid, domain);
    const names = EVENT_CANDIDATES[domain];
    for (let i = 0; i < names.length; i++) {
      for (let k = i + 1; k < names.length; k++) {
        const same = inf.rows.every((row) =>
          row.candidateScore[names[i]] === row.candidateScore[names[k]]);
        assert.ok(!same,
          `${domain} 분야의 '${names[i]}' 와 '${names[k]}' 가 모든 달에서 같은 점수다 — 서로를 상쇄한다`);
      }
    }
  }
});

test('한 사건의 여러 모양은 묶어서 본다', () => {
  // '이직'은 스스로 옮기는 것, 제안을 받아 옮기는 것, 조직이 바꿔 놓는 것으로
  // 후보가 갈려 있다. 겪는 사람에게는 같은 사건인데 셋이 서로의 몫을 깎는다.
  // 실제로 '자발적 이직'만 재면 180달 중 153위, 묶어서 재면 66위였다.
  const { r } = load(FORM);
  const grid = buildGrid(r.input, r.chart, { fromYear: 2024, years: 2, domain: '직업' });
  const inf = inferEvents(grid, '직업');
  const family = EVENT_GROUPS['자발적 이직'];
  assert.ok(family?.length >= 2, '이직 묶음이 없다');

  for (const row of inf.rows) {
    const grouped = fitFor(row, '자발적 이직');
    const alone = fitFor(row, ['자발적 이직']);
    assert.ok(grouped.share >= alone.share,
      `${row.label}: 묶어서 잰 몫이 하나만 잰 것보다 작다`);
    assert.ok(grouped.share <= 1, `${row.label}: 점유율이 1을 넘는다`);
    // 묶음 안의 다른 후보는 경쟁자가 아니다 — 여유 계산에서 빠져야 한다
    const sibling = Math.max(...family.slice(1).map((n) => row.candidateScore[n] ?? -Infinity));
    if (sibling === grouped.score) {
      const outsider = Math.max(...row.candidates
        .filter((c) => !family.includes(c.name)).map((c) => c.score));
      assert.equal(grouped.margin, Math.round((grouped.score - outsider) * 100) / 100,
        `${row.label}: 같은 묶음 후보를 경쟁자로 셌다`);
    }
  }
});

test('사건을 지정하면 그 사건 기준으로, 아니면 활성도 기준으로 줄을 세운다', () => {
  const { r } = load(FORM);
  const grid = buildGrid(r.input, r.chart, { fromYear: 2026, years: 3, domain: '관계' });

  const withEvent = inferEvents(grid, '관계', { event: '새 만남' });
  assert.equal(withEvent.focusEvent, '새 만남');
  assert.match(withEvent.rankedBy, /사건 점유율/);
  // fit 은 그 달 후보 총량 가운데 이 사건의 몫이다 — 달끼리 비교하려면
  // 크기가 달마다 다른 '여유'가 아니라 비율이어야 한다
  for (const row of withEvent.rows) {
    assert.equal(typeof row.fit, 'number');
    assert.ok(row.fit <= 1, `점유율이 1을 넘는다: ${row.label} ${row.fit}`);
    assert.equal(typeof row.fitDetail.margin, 'number');
  }

  // 지정하지 않으면 **짐작하지 않는다**. 짐작해서 정반대 사건을 고르면
  // 답이 뒤집힌다 (실측: 같은 사건이 7위 vs 177위)
  const without = inferEvents(grid, '관계');
  assert.equal(without.focusEvent, null);
  assert.equal(without.rankedBy, '영역 활성도');
  // 대신 사건마다 따로 세운 달을 준다
  assert.ok(Object.keys(without.perEvent).length >= 3);

  // 그 분야에 없는 사건은 조용히 무시하지 않는다
  const bogus = inferEvents(grid, '관계', { event: '임신·출산' });
  assert.equal(bogus.focusEvent, null);
  assert.equal(bogus.eventNotFound, '임신·출산');
  assert.match(bogus.rankedBy, /후보가 아니다/);
});

test('한 해만 점수 항이 더 붙지 않는다', () => {
  // readForecast 의 영역 점수는 올해 열두 달에만 있다. 그것을 합산에 넣으면
  // 올해 달들만 폭이 넓어지고, 최댓값을 고르므로 올해가 과대표집된다.
  const { r, f } = load(FORM);
  const withF = inferEvents(
    buildGrid(r.input, r.chart, { fromYear: 2026, years: 3, domain: '직업', forecast: f }), '직업');
  const withoutF = inferEvents(
    buildGrid(r.input, r.chart, { fromYear: 2026, years: 3, domain: '직업' }), '직업');
  // forecast 를 주든 안 주든 점수가 같아야 한다 — 합산에 쓰지 않는다는 뜻
  for (let i = 0; i < withF.rows.length; i++) {
    assert.equal(withF.rows[i].total, withoutF.rows[i].total,
      `${withF.rows[i].label} 점수가 forecast 유무로 달라진다`);
  }
});

test('절기월 위치가 1위를 고르게 나눠 가진다', () => {
  // 엔진이 사람을 읽는다면 1위 달은 사람마다 흩어져야 한다.
  // 특정 위치(특히 첫 달)에 쏠리면 그건 사람이 아니라 계산 구조가 만든 답이다.
  const cities = ['서울', '대전', '부산', '대구', '수원', '전주'];
  let seed = 777;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const idx = new Array(12).fill(0);
  let n = 0;

  for (let i = 0; i < 30; i++) {
    const form = {
      name: 'p' + i, gender: rnd() < 0.5 ? 'male' : 'female',
      year: 1975 + Math.floor(rnd() * 25), month: 1 + Math.floor(rnd() * 12),
      day: 1 + Math.floor(rnd() * 27), hour: Math.floor(rnd() * 24),
      minute: Math.floor(rnd() * 60),
      birthPlace: cities[Math.floor(rnd() * 6)], homePlace: cities[Math.floor(rnd() * 6)],
    };
    const rr = readFortune(form, { now: NOW });
    const inf = inferEvents(
      buildGrid(rr.input, rr.chart, { fromYear: 2026, years: 3, domain: '직업' }), '직업');
    const row = inf.rows.find((x) => x.key === inf.bestWindow?.peakKey);
    if (row) { idx[row.index] += 1; n += 1; }
  }

  assert.ok(n >= 25, `1위를 낸 명반이 ${n}개뿐이다`);
  // 한 위치가 전체의 3분의 1을 넘게 가져가면 쏠린 것이다.
  // (고르게 나뉘면 위치당 8% 남짓이다)
  const max = Math.max(...idx);
  assert.ok(max / n < 0.34,
    `절기월 ${idx.indexOf(max)}번 위치가 1위를 ${max}/${n}번 가져갔다 — 위치 쏠림이다 (${idx.join(',')})`);
});

test('구조화 JSON 이 약속한 모양대로 나온다', () => {
  const { r, f } = load(FORM);
  const { json } = buildHiRes(r, f, defaultPlan(2026));
  for (const key of ['questionType', 'period', 'bazi', 'ziwei', 'western', 'vedic',
                     'crossValidation', 'timingWindows', 'candidateEvents', 'chain']) {
    assert.ok(key in json, `JSON 에 ${key} 가 없다`);
  }
  assert.ok(Array.isArray(json.bazi.monthly));
  assert.ok(Array.isArray(json.timingWindows));
  assert.ok(json.crossValidation.byDomain.every((d) => 'ABCDE'.includes(d.confidence.grade)));
});
