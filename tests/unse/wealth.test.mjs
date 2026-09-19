/**
 * 재물 경로·횡재 분석 테스트
 *
 * 특히 보는 것
 *   고전 표   — 섹트·디그니티·텀·페이스·로트가 표준 표를 지키는가
 *   ZR        — 기간표 한 바퀴 211년, 하위 구간 합 = 상위 구간, 끈 풀림
 *   경로 분리 — 돈이 한 덩어리로 뭉개지지 않고 갈라지는가
 *   복권      — "큰돈"을 곧바로 복권으로 옮기지 않는가, 표현 규칙을 지키는가
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { readFortune } from '../../public/unse-8f3k2m/src/engine.js';
import { readForecast } from '../../public/unse-8f3k2m/src/forecast.js';
import { planetPositions, houses } from '../../public/unse-8f3k2m/src/core/planets.js';
import { norm360 } from '../../public/unse-8f3k2m/src/core/astro.js';
import { signOf } from '../../public/unse-8f3k2m/src/systems/astrology.js';

import * as CL from '../../public/unse-8f3k2m/src/hires/classical.js';
import * as ZR from '../../public/unse-8f3k2m/src/hires/zr.js';
import * as W from '../../public/unse-8f3k2m/src/hires/wealth.js';
import * as WS from '../../public/unse-8f3k2m/src/hires/western.js';
import * as VD from '../../public/unse-8f3k2m/src/hires/vedic.js';
import * as ZW from '../../public/unse-8f3k2m/src/hires/ziwei.js';
import { routeQuestion } from '../../public/unse-8f3k2m/src/hires/router.js';
import { buildHiRes } from '../../public/unse-8f3k2m/src/hires/context.js';

const NOW = new Date('2026-09-20T00:00:00Z');
const FORM = { name: '재물 A', gender: 'female', year: 1992, month: 1, day: 30, hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전' };
const FORM_B = { name: '재물 B', gender: 'male', year: 1999, month: 4, day: 28, hour: 10, minute: 15, birthPlace: '대전', homePlace: '서울' };
const FORM_C = { name: '재물 C', gender: 'male', year: 1985, month: 11, day: 3, hour: 3, minute: 40, birthPlace: '부산', homePlace: '부산' };

const R = readFortune(FORM, { now: NOW });

// ─────────────────────────────────────────────────────────────
// 고전 — 섹트
// ─────────────────────────────────────────────────────────────

test('섹트는 태양이 지평선 위인지로 갈린다', () => {
  for (const form of [FORM, FORM_B, FORM_C]) {
    const r = readFortune(form, { now: NOW });
    const c = CL.classicalChart(r.input);
    const above = c.sect.sunHouse >= 7 && c.sect.sunHouse <= 12;
    assert.equal(c.sect.day, above);
    assert.equal(c.sect.benefic, c.sect.day ? '목성' : '금성');
    assert.equal(c.sect.malefic, c.sect.day ? '토성' : '화성');
    assert.notEqual(c.sect.malefic, c.sect.outOfSectMalefic);
  }
});

// ─────────────────────────────────────────────────────────────
// 고전 — 에센셜 디그니티
// ─────────────────────────────────────────────────────────────

test('도미사일·엑절테이션·디트리먼트·폴이 전통 표대로 매겨진다', () => {
  // 토성은 물병이 자기 자리, 사자가 디트리먼트
  assert.equal(CL.essentialDignity('토성', 10 * 30 + 5, true).domicile, true);
  assert.equal(CL.essentialDignity('토성', 4 * 30 + 5, true).detriment, true);
  // 태양은 양자리 엑절테이션, 천칭 폴, 물병 디트리먼트
  assert.equal(CL.essentialDignity('태양', 0 * 30 + 19, true).exaltation, true);
  assert.equal(CL.essentialDignity('태양', 6 * 30 + 21, true).fall, true);
  assert.equal(CL.essentialDignity('태양', 10 * 30 + 9, true).detriment, true);
  // 화성은 염소 엑절테이션
  assert.equal(CL.essentialDignity('화성', 9 * 30 + 28, true).exaltation, true);
  // 목성은 처녀 디트리먼트
  assert.equal(CL.essentialDignity('목성', 5 * 30 + 13, true).detriment, true);
});

test('트리플리시티는 도로테우스 방식으로 낮·밤이 갈린다', () => {
  // 불 — 낮 태양, 밤 목성, 협동 토성
  assert.deepEqual(CL.triplicityLords(0), ['태양', '목성', '토성']);
  // 공기 — 낮 토성, 밤 수성, 협동 목성
  assert.deepEqual(CL.triplicityLords(10), ['토성', '수성', '목성']);
  // 같은 자리라도 낮·밤에 따라 점수가 달라져야 한다
  const day = CL.essentialDignity('태양', 0 * 30 + 5, true);
  const night = CL.essentialDignity('태양', 0 * 30 + 5, false);
  assert.equal(day.triplicity, '낮 주인');
  assert.equal(night.triplicity, null);
  assert.ok(day.score > night.score);
});

test('텀은 이집트 표, 페이스는 칼데안 순서를 따른다', () => {
  // 양자리 0~6도는 목성 텀
  assert.equal(CL.termLord(1), '목성');
  assert.equal(CL.termLord(7), '금성');
  assert.equal(CL.termLord(29), '토성');
  // 양자리 첫 데칸은 화성, 둘째는 태양, 셋째는 금성
  assert.equal(CL.faceLord(5), '화성');
  assert.equal(CL.faceLord(15), '태양');
  assert.equal(CL.faceLord(25), '금성');
  // 황소 첫 데칸은 수성
  assert.equal(CL.faceLord(35), '수성');
});

test('카지미·조합·태양광 아래는 궤가 갈린다', () => {
  const r = readFortune(FORM, { now: NOW });
  const c = CL.classicalChart(r.input);
  for (const p of CL.SEVEN) {
    const a = c.dignities[p].accidental;
    if (p === '태양') { assert.equal(a.cazimi, false); continue; }
    if (a.cazimi) assert.ok(a.fromSun <= 0.3);
    if (a.combust) assert.ok(a.fromSun > 0.28 && a.fromSun <= 8.5);
    if (a.underBeams) assert.ok(a.fromSun > 8.5 && a.fromSun <= 15);
    // 셋은 서로 배타적이다
    assert.ok([a.cazimi, a.combust, a.underBeams].filter(Boolean).length <= 1);
  }
});

// ─────────────────────────────────────────────────────────────
// 고전 — 로트
// ─────────────────────────────────────────────────────────────

test('포춘과 스피릿은 낮·밤에 따라 공식이 뒤집힌다', () => {
  const r = readFortune(FORM, { now: NOW });
  const pos = planetPositions(r.input.jdUT);
  const h = houses(r.input.jdUT, r.input.place.lat, r.input.place.lon);
  const sect = CL.sectOf(pos, h);

  const day = CL.lots(pos, h, { ...sect, day: true });
  const night = CL.lots(pos, h, { ...sect, day: false });

  // 낮 포춘 = ASC + 달 − 태양
  assert.ok(Math.abs(day.fortune - norm360(h.asc + pos.달.lon - pos.태양.lon)) < 1e-9);
  // 밤 포춘 = ASC + 태양 − 달
  assert.ok(Math.abs(night.fortune - norm360(h.asc + pos.태양.lon - pos.달.lon)) < 1e-9);
  // 포춘과 스피릿은 서로 뒤집힌 관계다
  assert.ok(Math.abs(day.fortune - night.spirit) < 1e-9);
  assert.ok(Math.abs(day.spirit - night.fortune) < 1e-9);
});

test('로트는 자리만이 아니라 주인의 상태까지 함께 준다', () => {
  const c = CL.classicalChart(R.input);
  for (const name of ['fortune', 'spirit', 'eros', 'necessity', 'basis', 'substance']) {
    const l = c.lots[name];
    assert.ok(l, `${name} 로트 없음`);
    assert.ok(l.house >= 1 && l.house <= 12);
    assert.ok(l.ruler);
    assert.ok(l.rulerDignity && typeof l.rulerDignity.score === 'number');
    assert.ok(l.rulerCondition && l.rulerCondition.placement);
    assert.ok(Array.isArray(l.benefics) && Array.isArray(l.malefics));
  }
  // 서브스턴스는 아랍 전통 공식임을 표시한다
  assert.match(c.substanceNote, /아랍/);
});

test('출생 시각을 모르면 로트를 만들지 않는다', () => {
  const r = readFortune({ ...FORM, hour: null, minute: 0 }, { now: NOW });
  const c = CL.classicalChart(r.input);
  assert.ok(c.unavailable);
  assert.match(c.unavailable, /출생 시각/);
});

// ─────────────────────────────────────────────────────────────
// 고전 — 재물 하우스
// ─────────────────────────────────────────────────────────────

test('재물 하우스 다섯을 각각 다른 돈으로 본다', () => {
  const c = CL.classicalChart(R.input);
  for (const n of [2, 5, 8, 10, 11]) {
    const x = c.moneyHouses[n];
    assert.ok(x, `${n}하우스 없음`);
    assert.ok(x.topic, `${n}하우스에 주제가 없다`);
    assert.ok(x.ruler && x.rulerSign && x.rulerHouse);
    assert.ok(x.rulerDignity && x.rulerCondition);
  }
  // 다섯 자리가 서로 다른 주제를 가져야 한다
  const topics = new Set([2, 5, 8, 10, 11].map((n) => c.moneyHouses[n].topic));
  assert.equal(topics.size, 5);
});

// ─────────────────────────────────────────────────────────────
// 조디악 릴리징
// ─────────────────────────────────────────────────────────────

test('ZR 기간표는 발렌스 표준이고 한 바퀴가 211년이다', () => {
  assert.deepEqual(ZR.ZR_YEARS, [15, 8, 20, 25, 19, 20, 8, 15, 12, 27, 30, 12]);
  assert.equal(ZR.ZR_CIRCUIT, 211);
});

test('1단계는 로트 자리에서 출발해 순서대로 돈다', () => {
  const l1 = ZR.level1(5, 100);     // 처녀자리에서 출발
  assert.equal(l1[0].sign, 5);
  assert.equal(l1[0].years, ZR.ZR_YEARS[5]);
  for (let i = 1; i < l1.length; i++) {
    assert.equal(l1[i].sign, (l1[i - 1].sign + 1) % 12);
    assert.equal(l1[i].fromAge, l1[i - 1].toAge);
  }
});

test('2단계 합은 부모 구간과 같고 끈 풀림이 표시된다', () => {
  for (const start of [0, 5, 9, 10]) {
    for (const p of ZR.level1(start, 60)) {
      const sub = ZR.level2(p);
      const sum = sub.reduce((t, s) => t + (s.toAge - s.fromAge), 0);
      assert.ok(Math.abs(sum - (p.toAge - p.fromAge)) < 0.02,
        `${p.signName} 하위 합 ${sum} vs ${p.toAge - p.fromAge}`);
      assert.equal(sub[0].sign, p.sign, '하위는 부모 자리에서 출발한다');
      // 끈이 풀리면 출발 자리의 맞은편으로 건너뛴다
      const lb = sub.findIndex((s) => s.loosingOfTheBond);
      if (lb >= 0) assert.equal(sub[lb].sign, (p.sign + 6) % 12);
    }
  }
});

test('정점 구간은 기준 로트에서 앵귤러인 자리다', () => {
  const rel = ZR.releasing(5, '스피릿', 90);
  assert.deepEqual(rel.angularSigns.length, 4);
  for (const p of rel.periods) {
    const expect = [1, 4, 7, 10].includes((p.sign - 5 + 12) % 12 + 1);
    assert.equal(p.angular, expect, `${p.signName} 정점 판정이 어긋났다`);
  }
});

// ─────────────────────────────────────────────────────────────
// 재물 경로
// ─────────────────────────────────────────────────────────────

test('돈이 한 덩어리가 아니라 경로로 갈라진다', () => {
  for (const form of [FORM, FORM_B, FORM_C]) {
    const r = readFortune(form, { now: NOW });
    const stack = r.input.timeKnown ? ZW.stackAt(r.input, 2026) : null;
    const p = W.wealthPaths(r.input, r.chart, stack);
    assert.ok(p.ranked.length >= 3, '경로가 너무 적다');
    for (const row of p.ranked) {
      assert.ok(W.PATHS[row.path], `등록되지 않은 경로 ${row.path}`);
      assert.ok(row.systems.length >= 1, `${row.path} 에 지지 체계가 없다`);
    }
    // 순위가 실제로 갈려야 한다 — 전부 같은 점수면 순위가 아니다
    assert.ok(p.ranked[0].score > p.ranked[p.ranked.length - 1].score);
    assert.ok(p.verdict);
  }
});

test('근거는 어느 체계 어느 자리에서 왔는지 남는다', () => {
  const stack = ZW.stackAt(R.input, 2026);
  const p = W.wealthPaths(R.input, R.chart, stack);
  for (const b of p.basis) {
    assert.ok(b.system, '근거에 체계 이름이 없다');
    assert.ok(b.why && b.why.length > 3);
  }
  // 네 체계가 모두 무언가는 말해야 한다
  const systems = new Set(p.basis.map((b) => b.system));
  assert.ok(systems.size >= 3, `말한 체계가 ${[...systems]} 뿐이다`);
});

test('사주 재고는 창고 지지가 실제로 있을 때만 잡는다', () => {
  const bw = W.baziWealth(R.input, R.chart);
  const branches = ['year', 'month', 'day', 'hour']
    .map((k) => R.chart.pillars[k]?.branch).filter((b) => b != null);
  if (bw.vaultBranch != null) assert.ok(branches.includes(bw.vaultBranch));
  // 창고가 없으면 열리는 해도 없다
  if (bw.vaultBranch == null) assert.equal(W.vaultOpening(bw, R.chart, 2027), null);
});

// ─────────────────────────────────────────────────────────────
// 횡재 — 가장 중요한 부분
// ─────────────────────────────────────────────────────────────

test('큰돈 신호를 곧바로 복권으로 옮기지 않는다', () => {
  for (const form of [FORM, FORM_B, FORM_C]) {
    const r = readFortune(form, { now: NOW });
    if (!r.input.timeKnown) continue;
    const stack = ZW.stackAt(r.input, 2026);
    const N = WS.natalPack(r.input);
    const wf = W.windfall(r.input, r.chart, stack, { fromYear: 2026, years: 12, natal: N });

    // 출처 후보가 여럿이어야 한다 — 복권 하나로 뭉치면 안 된다
    if (wf.sources.length) {
      assert.ok(wf.sources.length >= 2, '출처 후보가 하나뿐이다');
      // 순수횡재가 1순위로 오려면 다른 경로가 전부 비어 있어야 한다
      if (wf.sources[0].source === '순수횡재') {
        assert.equal(wf.sources.length, 1);
      }
    }
    // 5하우스 계열이 안 켜졌으면 순수횡재를 후보에 올리지 않는다
    if (!wf.pureWindfallPossible) {
      assert.ok(!wf.sources.some((s) => s.source === '순수횡재'));
    }
    assert.match(wf.caveat, /무작위 확률/);
  }
});

test('여러 기법이 겹치는 해만 비정기 재물 시기로 센다', () => {
  const stack = ZW.stackAt(R.input, 2026);
  const N = WS.natalPack(R.input);
  const wf = W.windfall(R.input, R.chart, stack, { fromYear: 2026, years: 12, natal: N });
  for (const p of wf.peaks) {
    assert.ok(p.techs.length >= 2, `${p.year}년이 기법 ${p.techs.length}개로 뽑혔다`);
  }
  // 해마다 계산은 다 해 두되 뽑는 것은 겹치는 해만
  assert.equal(wf.years.length, 12);
});

test('타고난 횡재 구조는 잡힌 자리 수로 세기를 매긴다', () => {
  const stack = ZW.stackAt(R.input, 2026);
  const wf = W.windfall(R.input, R.chart, stack, { fromYear: 2026, years: 6 });
  assert.ok(['강함', '중간', '약함'].includes(wf.structuralStrength));
  if (wf.structuralStrength === '약함') assert.ok(wf.structural.length < 2);
  if (wf.structuralStrength === '강함') assert.ok(wf.structural.length >= 4);
});

// ─────────────────────────────────────────────────────────────
// 평생 곡선
// ─────────────────────────────────────────────────────────────

test('평생 재물 곡선은 십 년마다 중심을 말한다', () => {
  const life = W.lifetimeWealth(R.input, R.chart, { dashaTree: VD.dashaTree(R.input, 1) });
  assert.equal(life.decades.length, 5);
  for (const d of life.decades) {
    assert.ok(d.years.match(/^\d{4}~\d{4}$/));
    assert.ok(d.notes.length >= 1, `${d.from}대에 근거가 없다`);
    assert.ok(typeof d.peak === 'boolean');
  }
  assert.deepEqual(life.decades.map((d) => d.from), [20, 30, 40, 50, 60]);
});

// ─────────────────────────────────────────────────────────────
// 라우팅과 문맥
// ─────────────────────────────────────────────────────────────

test('횡재 질문은 재물 분야를 켜고 고전 계산까지 돌린다', () => {
  for (const q of ['나 횡재운 있어?', '로또 될 팔자야?', '큰돈 언제 들어와?']) {
    const p = routeQuestion(q, 2026);
    assert.equal(p.needsWealth, true, `"${q}" 에서 재물이 안 켜졌다`);
    assert.equal(p.needsWindfall, true, `"${q}" 에서 횡재가 안 켜졌다`);
    assert.ok(p.domains.includes('재물'));
  }
  // 재물과 무관한 질문에서는 켜지 않는다
  const j = routeQuestion('2027년에 이직할까요?', 2026);
  assert.equal(j.needsWindfall, false);
});

test('평생 질문은 십 년 곡선을 켠다', () => {
  const p = routeQuestion('평생 재물운이 어때?', 2026);
  assert.equal(p.needsLifetime, true);
  assert.equal(p.needsWealth, true);
});

test('문맥에 고전 계산과 재물 경로가 실린다', () => {
  const f = readForecast(FORM, NOW);
  const h = buildHiRes(R, f, routeQuestion('나 횡재운 있어?', 2026));
  assert.match(h.text, /고전 점성술 \(섹트·디그니티·로트\)/);
  assert.match(h.text, /낮 차트|밤 차트/);
  assert.match(h.text, /재물 — 돈이 어디서 들어오는가/);
  assert.match(h.text, /돈의 출처 후보/);
  assert.match(h.text, /무작위 확률/);
  assert.ok(h.text.length <= 40_000, `${h.text.length}자`);
});

test('재물과 무관한 질문에는 재물 구획을 싣지 않는다', () => {
  const f = readForecast(FORM, NOW);
  const h = buildHiRes(R, f, routeQuestion('2027년에 이직할까요?', 2026));
  assert.ok(!/돈의 출처 후보/.test(h.text), '필요 없는 재물 구획이 실렸다');
});

test('시각 미상이면 고전 계산을 건너뛰고 그렇다고 적는다', () => {
  const form = { ...FORM, hour: null, minute: 0 };
  const r = readFortune(form, { now: NOW });
  const f = readForecast(form, NOW);
  const h = buildHiRes(r, f, routeQuestion('나 횡재운 있어?', 2026));
  assert.match(h.text, /출생 시각을 알아야/);
  assert.ok(h.text.length > 500);
});
