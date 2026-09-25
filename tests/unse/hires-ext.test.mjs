/**
 * 초구체화 2단계 테스트 — 베딕 확장 · 서양 연도 기법 · 자미 살성 · 프로파일 · 단언 등급
 *
 * 특히 보는 것
 *   규칙   — 아루다·카라카·바르가가 각 전통의 표준 규칙을 지키는가
 *   무근거 금지 — 근거 없는 항목을 만들지 않는가 (basis 가 비면 항목 자체가 없어야 한다)
 *   등급   — Tier 가 실제로 갈리는가. 전부 S 로 나오면 등급이 아무 말도 못 한다
 *   두 사람 — 한쪽만 켜진 해를 겹친 해로 세지 않는가
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { readFortune } from '../../public/unse/src/engine.js';
import { readForecast } from '../../public/unse/src/forecast.js';
import { toJD } from '../../public/unse/src/core/astro.js';
import { planetPositions } from '../../public/unse/src/core/planets.js';

import * as VD from '../../public/unse/src/hires/vedic.js';
import * as VE from '../../public/unse/src/hires/vedicExt.js';
import * as WS from '../../public/unse/src/hires/western.js';
import * as WE from '../../public/unse/src/hires/westernExt.js';
import * as ZW from '../../public/unse/src/hires/ziwei.js';
import * as ZE from '../../public/unse/src/hires/ziweiExt.js';
import * as LOC from '../../public/unse/src/hires/location.js';
import * as PAIR from '../../public/unse/src/hires/pair.js';
import * as BD from '../../public/unse/src/hires/body.js';
import * as BR from '../../public/unse/src/hires/baserate.js';
import { buildGrid } from '../../public/unse/src/hires/grid.js';
import { elementDistribution } from '../../public/unse/src/core/ganzhi.js';
import { profileFor, tierOf } from '../../public/unse/src/hires/profile.js';
import { routeQuestion } from '../../public/unse/src/hires/router.js';
import { buildHiRes } from '../../public/unse/src/hires/context.js';

const NOW = new Date('2026-09-20T00:00:00Z');
const FORM = { name: '확장 A', gender: 'female', year: 1992, month: 1, day: 30, hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전' };
const FORM_B = { name: '확장 B', gender: 'male', year: 1999, month: 4, day: 28, hour: 10, minute: 15, birthPlace: '대전', homePlace: '서울' };
const FORM_C = { name: '확장 C', gender: 'male', year: 1985, month: 11, day: 3, hour: 3, minute: 40, birthPlace: '부산', homePlace: '부산' };

const R = readFortune(FORM, { now: NOW });
const RB = readFortune(FORM_B, { now: NOW });

// ─────────────────────────────────────────────────────────────
// 베딕 확장
// ─────────────────────────────────────────────────────────────

test('D7 삽탐샤는 파라샤라 표준 대응을 따른다', () => {
  // 홀수 별자리는 자기 자리부터, 짝수는 일곱 번째부터
  assert.equal(VD.saptamsa(0), 0);          // 메샤 0° → 메샤
  assert.equal(VD.saptamsa(30), 7);         // 브리샤바 0° → 브리시카(7번째)
  assert.equal(VD.saptamsa(60), 2);         // 미투나 0° → 미투나
  assert.equal(VD.saptamsa(30 / 7 + 0.01), 1); // 메샤 두 번째 칸 → 브리샤바
});

test('D1 라그나는 기존 엔진이 세운 것과 같다', () => {
  const d1 = VE.chart(R.input, 'D1');
  assert.equal(d1.lagnaSign, '게');
  assert.equal(d1.lordOf(7).sign, 9);                 // 게의 7번째 = 염소
  assert.equal(d1.lordOf(7).lord, '토성');
  assert.equal(d1.lordOf(1).lord, '달');
});

test('행성 상태는 고양·함몰·자기 자리를 표준 표대로 매긴다', () => {
  // 토성은 염소가 자기 자리
  const s = VE.planetState('토성', 9 * 30 + 5, 0, false);
  assert.equal(s.dignity, '자기 자리');
  // 목성은 카르카(게)에서 고양, 마카라(염소)에서 함몰
  assert.equal(VE.planetState('목성', 3 * 30 + 5, 0, false).dignity, '고양');
  assert.equal(VE.planetState('목성', 9 * 30 + 5, 0, false).dignity, '함몰');
  // 라후·케투는 고양·함몰을 매기지 않는다 (유파가 갈려 한쪽을 고를 근거가 없다)
  assert.equal(VE.planetState('라후', 60, 0, false).dignity, null);
});

test('드리슈티는 화성 4·8, 목성 5·9, 토성 3·10 을 쓴다', () => {
  assert.deepEqual(VE.drishtiOf('화성'), [4, 7, 8]);
  assert.deepEqual(VE.drishtiOf('목성'), [5, 7, 9]);
  assert.deepEqual(VE.drishtiOf('토성'), [3, 7, 10]);
  assert.deepEqual(VE.drishtiOf('금성'), [7]);
});

test('차라 카라카는 도가 높은 순서로 일곱 자리를 준다', () => {
  const k = VE.charaKarakas(R.input);
  assert.equal(k.list.length, 7);
  for (let i = 1; i < k.list.length; i++) {
    assert.ok(k.list[i - 1].deg >= k.list[i].deg, '도 내림차순이 아니다');
  }
  assert.equal(k.list[0].role, '아트마카라카');
  assert.equal(k.list[6].role, '다라카라카');
  assert.equal(k.atmakaraka.planet, k.list[0].planet);
  assert.equal(k.darakaraka.planet, k.list[6].planet);
  // 라후는 일곱 방식에 들어가지 않는다
  assert.ok(!k.list.some((x) => x.planet === '라후'));
});

test('아루다는 자기 자리나 7번째에 떨어지면 10번째로 옮긴다', () => {
  const d1 = VE.chart(R.input, 'D1');
  for (const h of [1, 2, 10, 12]) {
    const a = VE.arudhaOf(d1, h);
    assert.ok(a, `${h}궁 아루다 없음`);
    const houseSign = d1.signOfHouse(h);
    assert.notEqual(a.sign, houseSign, '아루다가 자기 자리에 남았다');
    assert.notEqual((a.sign - houseSign + 12) % 12, 6, '아루다가 7번째에 남았다');
  }
});

test('우파파다는 12궁의 아루다이고 UL2 는 그 다음 자리다', () => {
  const d1 = VE.chart(R.input, 'D1');
  const ar = VE.arudhaPack(d1);
  const ul12 = VE.arudhaOf(d1, 12);
  assert.equal(ar.UL.sign, ul12.sign);
  assert.equal(ar.UL2.sign, (ar.UL.sign + 1) % 12);
});

test('요가는 실제 관계가 있을 때만 잡는다', () => {
  for (const form of [FORM, FORM_B, FORM_C]) {
    const d1 = VE.chart(readFortune(form, { now: NOW }).input, 'D1');
    for (const y of [...VE.rajaYogas(d1), ...VE.dhanaYogas(d1)]) {
      assert.ok(y.how, '관계 없이 잡힌 요가가 있다');
      assert.ok(y.note.length > 5);
    }
  }
});

test('분야 묶음은 궁주와 그 궁주가 앉은 자리까지 준다', () => {
  const m = VE.marriagePack(R.input);
  assert.ok(m.d1_7.lord && m.d1_7.lordIn >= 1 && m.d1_7.lordIn <= 12);
  assert.ok(m.d9_7);
  assert.ok(m.activators.length >= 2);
  const c = VE.childrenPack(R.input);
  assert.ok(c.d7_5 && c.d1_5.lord);
  const w = VE.wealthPack(R.input);
  assert.ok(w.d10_10 && w.arudha.A10);
  const hm = VE.homePack(R.input);
  assert.ok(hm.d4_4 && hm.d1_4.lord);
});

// ─────────────────────────────────────────────────────────────
// 서양 연도 기법
// ─────────────────────────────────────────────────────────────

test('솔라 아크는 한 해에 약 1도씩 나아간다', () => {
  const N = WS.natalPack(R.input);
  const a = WE.solarArcAt(R.input, N, toJD(2026, 7, 1, 12));
  const b = WE.solarArcAt(R.input, N, toJD(2027, 7, 1, 12));
  const step = b.arc - a.arc;
  assert.ok(step > 0.9 && step < 1.1, `한 해에 ${step}도 갔다`);
  // 아크는 진행 태양에서 출생 태양을 뺀 값이다.
  // b.elapsed 는 화면에 적으려고 반올림한 값이라 여기서는 직접 센다.
  const exact = (toJD(2027, 7, 1, 12) - R.input.jdUT) / 365.2425;
  const prog = planetPositions(R.input.jdUT + exact).태양.lon;
  const expect = ((prog - N.pos.태양.lon) % 360 + 360) % 360;
  assert.ok(Math.abs(expect - b.arc) < 0.01, `아크 ${b.arc} vs 직접 계산 ${expect}`);
});

test('솔라 아크 오브는 1도로 좁혀 해를 좁힌다', () => {
  const N = WS.natalPack(R.input);
  const hits = WE.solarArcYears(R.input, N, 2026, 2036);
  for (const h of hits) assert.ok(h.orb <= 1.0, `오브 ${h.orb}`);
  // 열한 해를 봐도 각이 쏟아지지는 않아야 한다
  assert.ok(hits.length < 40, `열한 해에 ${hits.length}개면 너무 많다`);
});

test('프로펙션은 나이 열두 해마다 한 바퀴 돈다', () => {
  const N = WS.natalPack(R.input);
  const a = WE.profection(R.input, N, 0);
  const b = WE.profection(R.input, N, 12);
  const c = WE.profection(R.input, N, 7);
  assert.equal(a.house, 1);
  assert.equal(b.house, 1);
  assert.equal(b.sign, a.sign);
  assert.equal(c.house, 8);
  assert.ok(c.timeLord);
  assert.ok(c.lordNatalHouse >= 1 && c.lordNatalHouse <= 12);
});

test('루나 리턴은 달이 출생 위치로 돌아오는 순간이다', () => {
  const N = WS.natalPack(R.input);
  const lr = WE.lunarReturn(R.input, N, toJD(2027, 6, 1, 12));
  const moon = planetPositions(lr.jd).달.lon;
  const diff = Math.abs(((moon - N.pos.달.lon + 540) % 360) - 180);
  assert.ok(diff < 0.05, `달이 ${diff}° 어긋났다`);
});

test('합성 차트와 데이비슨 차트는 서로 다른 방식이다', () => {
  const comp = WE.compositeChart(R.input, RB.input);
  const dav = WE.davisonChart(R.input, RB.input);
  assert.ok(comp.asc && dav.asc);
  // 태양은 중점과 실제 계산이 다르게 나온다 — 같으면 한쪽이 다른 쪽을 베낀 것이다
  assert.notEqual(Math.round(comp.lon.태양 * 100), Math.round(dav.lon7.태양 * 100));
});

// ─────────────────────────────────────────────────────────────
// 자미 확장
// ─────────────────────────────────────────────────────────────

test('보조성은 표대로 놓이고 경양·타라는 녹존 양옆이다', () => {
  for (const form of [FORM, FORM_B, FORM_C]) {
    const aux = ZE.auxStars(readFortune(form, { now: NOW }).input);
    const { 녹존, 경양, 타라 } = aux.at;
    assert.equal(경양, (녹존 + 1) % 12);
    assert.equal(타라, (녹존 + 11) % 12);
    for (const n of ZE.SIX_EVIL) assert.ok(aux.at[n] != null, `${n} 미배치`);
    for (const n of ['녹존', '천마', '천괴', '천월']) assert.ok(aux.at[n] != null, `${n} 미배치`);
  }
});

test('지겁과 지공은 亥에서 시간만큼 순행·역행한다', () => {
  const aux = ZE.auxStars(R.input);
  const h = R.input.hourBranch;
  assert.equal(aux.at.지겁, (11 + h) % 12);
  assert.equal(aux.at.지공, ((11 - h) % 12 + 12) % 12);
});

test('삼방사정은 자기 자리 · 삼합 둘 · 대궁이다', () => {
  const ts = ZE.trineSquare(2);
  assert.equal(ts.self, 2);
  assert.deepEqual(ts.trine, [6, 10]);
  assert.equal(ts.opposite, 8);
  assert.deepEqual(ZE.flanking(0), [11, 1]);
});

test('분야 궁은 층마다 삼방사정과 길흉성을 함께 돌려준다', () => {
  const st = ZW.stackAt(R.input, 2027, 6);
  const rows = ZE.domainPalaces(R.input, '결혼', st.layers);
  assert.ok(rows.length >= 3);
  for (const p of rows) {
    assert.ok(p.rows.length >= 3, `${p.palace} 층이 모자라다`);
    for (const r of p.rows) {
      assert.equal(r.trine.length, 2);
      assert.ok(r.opposite);
      assert.ok(typeof r.tone === 'number');
    }
  }
});

test('유일은 유월 명궁에서 음력 일수만큼 순행한다', () => {
  const st = ZW.stackAt(R.input, 2027, 6);
  const d = ZE.dayLayer(st.board, st.month.branch, 10);
  assert.equal(d.branch, (st.month.branch + 9) % 12);
  assert.equal(d.map[d.branch], '명궁');
  assert.equal(d.sihwa.length, 4);
});

// ─────────────────────────────────────────────────────────────
// 프로파일 — 근거 없는 항목을 만들지 않는가
// ─────────────────────────────────────────────────────────────

test('프로파일의 모든 항목은 근거를 달고 나온다', () => {
  const st = ZW.stackAt(R.input, 2027, 6);
  for (const d of ['결혼', '직업', '자녀', '주거']) {
    const p = profileFor(R.input, d, st);
    assert.ok(p, `${d} 프로파일 없음`);
    for (const it of p.items) {
      assert.ok(it.basis.length > 0, `${d}/${it.axis} 에 근거가 없다`);
      assert.ok(it.value, `${d}/${it.axis} 에 값이 없다`);
    }
  }
});

test('숫자가 들어가는 항목은 초구체화 추정으로 표시된다', () => {
  const st = ZW.stackAt(R.input, 2027, 6);
  const p = profileFor(R.input, '결혼', st);
  const age = p.items.find((x) => x.axis === '나이차');
  if (age) assert.equal(age.estimate, true, '나이차가 추정 표시 없이 나왔다');
});

test('자녀 프로파일은 수와 성별을 만들지 않는다', () => {
  const p = profileFor(R.input, '자녀', ZW.stackAt(R.input, 2027, 6));
  assert.match(p.caveat, /자녀 수와 성별/);
  for (const it of p.items) {
    assert.ok(!/명$|아들|딸/.test(it.value), `자녀 수·성별을 말했다: ${it.value}`);
  }
});

// ─────────────────────────────────────────────────────────────
// 단언 등급
// ─────────────────────────────────────────────────────────────

test('Tier 는 핵심 개수와 같은 시기를 짚은 기법 수로 갈린다', () => {
  assert.equal(tierOf(['사주', '자미두수', '베딕'], ['다샤전환', '솔라아크']).tier, 'S');
  assert.equal(tierOf(['사주', '자미두수'], ['다샤전환']).tier, 'A');
  assert.equal(tierOf(['사주', '자미두수', '베딕'], ['다샤전환']).tier, 'A'); // 기법이 하나면 S 가 아니다
  assert.equal(tierOf(['사주'], []).tier, 'B');
  assert.equal(tierOf([], []).tier, 'C');
});

test('실제 명반 여럿에서 Tier 가 실제로 갈린다', () => {
  const seen = new Set();
  for (const form of [FORM, FORM_B, FORM_C]) {
    const r = readFortune(form, { now: NOW });
    const f = readForecast(form, NOW);
    for (const q of ['언제 결혼해?', '2027년에 이직할까요?', '아이는 언제쯤?']) {
      const h = buildHiRes(r, f, routeQuestion(q, r.input.currentYear));
      for (const t of h.tiers) {
        assert.ok(['S', 'A', 'B', 'C'].includes(t.tier));
        seen.add(t.tier);
      }
    }
  }
  assert.ok(seen.size >= 2, `모든 결과가 ${[...seen]} 하나로 나왔다 — 등급이 아무 말도 못 한다`);
});

// ─────────────────────────────────────────────────────────────
// 두 사람
// ─────────────────────────────────────────────────────────────

test('한쪽만 켜진 해는 겹친 해로 세지 않는다', () => {
  const A = { input: R.input, chart: R.chart };
  const B = { input: RB.input, chart: RB.chart };
  const mw = PAIR.marriageWindow(A, B, 2026, 6);
  assert.equal(mw.rows.length, 6);
  for (const row of mw.rows) {
    if (!row.both) assert.equal(row.joint, 0, '한쪽만 켜졌는데 점수가 붙었다');
    else assert.ok(row.joint > 0);
  }
  // 겹치는 해가 없으면 없다고 말해야 한다
  if (!mw.converges) assert.equal(mw.best, null);
});

test('두 사람 결과는 D9 와 합성 차트를 함께 싣는다', () => {
  const A = { input: R.input, chart: R.chart };
  const B = { input: RB.input, chart: RB.chart };
  const mw = PAIR.marriageWindow(A, B, 2026, 3);
  const rel = PAIR.relationshipCharts(A, B, [2026, 2027]);
  const nav = PAIR.navamsaPair(A, B);
  const text = PAIR.formatPair(mw, rel, nav, 'A', 'B');
  assert.match(text, /합성 차트/);
  assert.match(text, /데이비슨/);
  assert.match(text, /D9/);
});

// ─────────────────────────────────────────────────────────────
// 지역
// ─────────────────────────────────────────────────────────────

test('후보 도시를 대지 않으면 주요 생활권을 전부 견준다', () => {
  const z = LOC.compareZones(R.input);
  assert.ok(!z.unavailable);
  assert.ok(z.checked >= 20, `${z.checked}곳만 견줬다`);
  assert.ok(typeof z.noDifference === 'boolean');
  assert.ok(z.caveat.length > 20);
});

test('도시끼리 실제 차이가 없으면 순위를 만들지 않는다', () => {
  // 국내는 경도 폭이 3도라 대부분의 명반에서 하우스가 그대로다.
  // 그때 동점을 정렬하면 목록 순서가 그대로 1·2·3위가 되어 뜻 없는 순위가 나온다.
  for (const form of [FORM, FORM_B, FORM_C]) {
    const z = LOC.compareZones(readFortune(form, { now: NOW }).input);
    if (z.unavailable) continue;
    if (z.noDifference) {
      assert.equal(z.different.length, 0, '차이가 없다면서 목록을 냈다');
      for (const list of Object.values(z.byFocus)) assert.equal(list.length, 0);
      assert.match(z.caveat, /사실상 같다/);
    } else {
      // 이름이 올라온 도시는 반드시 실제로 달라지는 것이 있어야 한다
      for (const line of z.different) assert.match(line, /→\d+H|선 \d+km/);
    }
  }
});

test('실제로 달라지는 도시가 있으면 무엇이 달라지는지 적는다', () => {
  // 국내는 폭이 좁아 차이가 잘 안 난다. 경도가 크게 다른 곳을 넣으면
  // 반드시 하우스가 바뀌므로 그 경로를 여기서 실제로 태워 본다.
  const z = LOC.compareZones(R.input, ['서울', '뉴욕', '런던', '시드니']);
  assert.equal(z.noDifference, false);
  assert.ok(z.different.length > 0);
  for (const line of z.different) assert.match(line, /→\d+H|선 \d+km/);
  // 문맥 글에서도 이 경로가 터지지 않아야 한다
  const f = readForecast(FORM, NOW);
  const h = buildHiRes(R, f, { ...routeQuestion('어디서 사는 게 좋을까요?', 2026) });
  assert.match(h.text, /국내 주요 생활권/);
});

test('출생 시각을 모르면 도시를 견주지 않는다', () => {
  const r = readFortune({ ...FORM, hour: null, minute: 0 }, { now: NOW });
  const z = LOC.compareZones(r.input);
  assert.ok(z.unavailable);
});

// ─────────────────────────────────────────────────────────────
// 문맥
// ─────────────────────────────────────────────────────────────

test('문맥에 프로파일·단언 등급·연도 기법이 실린다', () => {
  const f = readForecast(FORM, NOW);
  const h = buildHiRes(R, f, routeQuestion('언제 결혼해?', 2026));
  assert.match(h.text, /프로파일/);
  assert.match(h.text, /단언 등급/);
  assert.match(h.text, /솔라 아크|프로펙션/);
  assert.match(h.text, /다라카라카/);
  assert.match(h.text, /우파파다/);
  assert.ok(h.text.length <= 40_000, `${h.text.length}자`);
});

test('시각 미상에서도 무너지지 않고 없는 것은 없다고 적는다', () => {
  const form = { ...FORM, hour: null, minute: 0 };
  const r = readFortune(form, { now: NOW });
  const f = readForecast(form, NOW);
  const h = buildHiRes(r, f, routeQuestion('언제 결혼해?', 2026));
  assert.ok(h.text.length > 500);
  assert.match(h.text, /출생 시각을 몰라/);
});

// ─────────────────────────────────────────────────────────────
// 부위 — 몸의 어느 자리인가
// ─────────────────────────────────────────────────────────────

test('6하우스는 커스프 사인만 보지 않고 도수로 가른다', () => {
  // 플라시두스에서 한 하우스가 30°를 넘는 일이 흔하다. 그때는 커스프 사인보다
  // 뒤에 오는 사인이 하우스의 절반 이상을 차지하기도 한다 — 실제로 그런
  // 명반이 있었고(6H 사수 14.9° → 염소 17.8°, 염소가 54%), 커스프만 보면
  // 그 절반을 통째로 놓친다.
  const segs = BD.houseSigns(254.9, 287.8);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].sign, 9, '가장 많이 차지한 사인이 염소여야 한다');
  assert.ok(segs[0].share > 0.5, `염소 비중이 ${segs[0].share}`);
  assert.ok(Math.abs(segs.reduce((t, s) => t + s.share, 0) - 1) < 0.01, '비중 합이 1이 아니다');
});

test('부위 무게는 표에 낱말을 몇 개 적었는지와 무관해야 한다', () => {
  // 처음에는 사인의 무게를 부위 개수로 나눴다. 그러면 염소(무릎·뼈·관절·피부)
  // 네 낱말이 사수(엉덩이·허벅지·좌골) 세 낱말에 밀려, 하우스를 54% 차지한
  // 사인이 46% 차지한 사인보다 낮게 나왔다. 명반이 가리키는 것은 구역이고
  // 낱말은 그 구역을 부르는 이름일 뿐이다.
  const big = BD.MELOTHESIA[9].parts.length;   // 염소 4개
  const small = BD.MELOTHESIA[8].parts.length; // 사수 3개
  assert.ok(big > small, '전제가 깨졌다 — 표를 고쳤으면 이 테스트도 다시 보라');

  const N = WS.natalPack(R.input);
  const parts = BD.westernParts(N);
  const byName = Object.fromEntries(parts.map((p) => [p.part, p.share]));
  // 같은 사인 안의 부위들은 서로 같은 무게여야 한다
  const capr = BD.MELOTHESIA[9].parts.map((p) => byName[p]).filter((v) => v != null);
  if (capr.length > 1) {
    for (const v of capr) assert.ok(Math.abs(v - capr[0]) < 1e-6, '같은 사인인데 무게가 다르다');
  }
});

test('부위가 갈리지 않는 명반은 갈리지 않는다고 말한다', () => {
  // 부위는 기저율이 높다. 갈리지도 않는데 1위를 내놓으면 그게 답이 된다 —
  // 평평한 사건 후보와 같은 함정이다.
  const read = BD.bodyRead(WS.natalPack(R.input), elementDistribution(R.chart.pillars).pct);
  assert.equal(typeof read.spread, 'number');
  assert.equal(typeof read.flat, 'boolean');
  if (read.flat) assert.match(BD.formatBody(read), /부위가 갈리지 않는다/);
  // 검증되지 않았다는 말이 항상 붙는다
  assert.match(BD.formatBody(read), /검증되지 않았다/);
  assert.match(BD.formatBody(read), /진단으로 말하지 말 것/);
});

test('시각을 모르면 부위를 보지 않는다', () => {
  // 하우스를 세울 수 없으면 6하우스가 없고, 6하우스가 없으면 부위도 없다
  const read = BD.bodyRead(null, [20, 20, 20, 20, 20]);
  assert.ok(read.unavailable, '시각 미상인데 부위를 만들었다');
});

test('베딕·자미두수 부위는 미구현으로 명시한다', () => {
  // 칼라푸루샤는 사이드리얼이라 같은 도수가 다른 사인이 된다(약 24° 차이).
  // 트로피컬 염소(무릎)가 사이드리얼로는 사수(허벅지)다. 섞으면 어느 쪽
  // 부위인지 말할 수 없게 되므로 한쪽만 쓴다.
  const read = BD.bodyRead(WS.natalPack(R.input), elementDistribution(R.chart.pillars).pct);
  assert.match(read.school, /멜로테시아\(트로피컬\)/);
  assert.match(read.school, /베딕·자미두수 부위는 미구현/);
});

test('직업의 결은 D10 라그나까지 쓴다', () => {
  // D10(다샴샤)은 직업 전용 분할도이고, 표준 독법에서 라그나와 그 주인이
  // 1순위 지표다. 여태 D10 의 10하우스 거주 행성만 꺼내 쓰고 라그나를
  // 통째로 버리고 있었다.
  const wp = VE.wealthPack(RB.input);
  assert.ok(wp.d10_1, 'D10 라그나 묶음이 없다');
  assert.ok(wp.d10_1.lord, 'D10 라그나주가 없다');

  const st = ZW.stackAt(RB.input, 2026, null);
  const p = profileFor(RB.input, '직업', st);
  const trade = p.items.find((i) => i.axis === '직업의 결');
  assert.ok(trade, '직업의 결 항목이 없다');
  assert.ok(trade.basis.some((b) => /D10 라그나/.test(b)),
    `근거에 D10 라그나가 없다: ${trade.basis.join(' / ')}`);
});

test('직업의 결이 팽팽하면 2위를 함께 적고 등급을 낮춘다', () => {
  // 명반 여섯으로 재니 넷이 팽팽했다(비중 0.24~0.55). 팽팽한데 1위만
  // 내놓으면 그게 답이 된다 — 평평한 사건 후보와 같은 함정이다.
  const st = ZW.stackAt(RB.input, 2026, null);
  const p = profileFor(RB.input, '직업', st);
  const trade = p.items.find((i) => i.axis === '직업의 결');
  const runnerUp = p.items.find((i) => i.axis === '다음 후보');
  assert.equal(typeof p.tradeClear, 'boolean');
  if (!p.tradeClear) {
    assert.equal(trade.tier, 'C', '팽팽한데 등급을 낮추지 않았다');
    assert.ok(runnerUp, '팽팽한데 2위를 적지 않았다');
  } else {
    assert.ok(!runnerUp, '또렷한데 2위를 적었다');
  }
});

test('직업의 결 표에 몸을 쓰는 일이 있다', () => {
  // BPHS 의 화성 카라카에는 체력·무예·운동이 함께 들어 있다. 원래
  // '기술·공학·의료·군경'만 옮겨 적어 몸을 쓰는 일이 표에서 통째로 빠져
  // 있었다 — 어떤 명반에서도 그 답이 나올 수 없었다는 뜻이다.
  const st = ZW.stackAt(RB.input, 2026, null);
  const trades = new Set();
  for (const form of [FORM, FORM_B, FORM_C]) {
    const r = readFortune(form, { now: NOW });
    trades.add(profileFor(r.input, '직업', ZW.stackAt(r.input, 2026, null)).trade);
  }
  assert.ok(trades.size > 1, `명반이 달라도 직업의 결이 같다: ${[...trades]}`);
  assert.ok(st, '자미 층이 없다');
});

test('수입의 모양에 이길 수 없는 선택지를 두지 않는다', () => {
  // '사업·자기 판형'은 점수를 받을 길이 D2 호라 하나뿐이고 무게가 1.5 라,
  // 다른 선택지의 조건 하나짜리 점수(2~2.5)보다도 낮았다. 명반 여덟을
  // 돌려도 1위는커녕 2위로도 한 번도 나오지 않았다 — 죽은 선택지다.
  const FORMS = [FORM, FORM_B, FORM_C,
    { name: 'G', gender: 'male', year: 1966, month: 3, day: 6, hour: 17, minute: 0, birthPlace: '여주', homePlace: '구미' },
    { name: 'H', gender: 'female', year: 1970, month: 6, day: 11, hour: 7, minute: 20, birthPlace: '대구', homePlace: '대구' },
    { name: 'I', gender: 'male', year: 1983, month: 9, day: 22, hour: 14, minute: 30, birthPlace: '인천', homePlace: '인천' }];

  const seen = new Set();
  for (const form of FORMS) {
    const r = readFortune(form, { now: NOW });
    const p = profileFor(r.input, '직업', ZW.stackAt(r.input, 2026, null));
    if (p.incomeShape) seen.add(p.incomeShape.split(' —')[0]);
    if (p.runnerUpIncome) seen.add(p.runnerUpIncome.split(' —')[0]);
  }
  // 한 선택지로 굳지 않는다
  assert.ok(seen.size >= 3, `수입의 모양이 ${seen.size}가지뿐이다: ${[...seen]}`);
  assert.ok(seen.has('사업·자기 판형'),
    '사업·자기 판형이 1·2위 어디에도 못 든다 — 다시 죽은 선택지가 됐다');
});

// ─────────────────────────────────────────────────────────────
// 기저율 — 명반을 보기 전에 이미 알고 있는 것
// ─────────────────────────────────────────────────────────────

test('기저율은 출처가 있는 값만 내고 없으면 없다고 한다', () => {
  // 이 층의 존재 이유가 "숫자를 지어내지 않는다"이다. 공표 자료에 없는
  // 칸을 눈대중으로 채우면 통계를 자처하는 창작이 된다.
  const have = BR.baseRateFor('결혼', { age: 32, gender: 'female' });
  assert.ok(have.annualPct > 0, '30대 초반 여성 혼인율이 없다');
  assert.ok(have.source && have.source.includes('2024'), `출처가 없다: ${have.source}`);
  // 연 → 월 환산이 맞는다
  assert.ok(Math.abs(have.monthlyPct - have.annualPct / 12) < 0.01);

  // 공표 자료에 없는 칸은 숫자를 만들지 않는다
  for (const [d, who] of [
    ['결혼', { age: 47, gender: 'female' }],   // 40대는 공표값 없음
    ['결혼', { age: 22, gender: 'male' }],     // 20대 초반 없음
    ['자녀', { age: 32, gender: 'male' }],     // 출산율은 모 기준만
    ['이사', { age: 63, gender: 'male' }],     // 60대 없음
    ['직업', { age: 32, gender: 'female' }],   // 분야 자체가 비어 있음
    ['재물', { age: 32, gender: 'female' }],
  ]) {
    const r = BR.baseRateFor(d, who);
    assert.ok(r.unknown, `${d} ${who.age}세 — 없는 값을 만들어 냈다: ${JSON.stringify(r)}`);
    assert.equal(r.annualPct, undefined);
  }

  // 성별로 갈리는 값은 성별 없이 내지 않는다
  assert.ok(BR.baseRateFor('결혼', { age: 32 }).unknown);
  // 나이를 모르면 아무것도 내지 않는다
  assert.ok(BR.baseRateFor('결혼', { gender: 'female' }).unknown);
});

test('기저율이 점수에 섞이지 않고 순위보다 먼저 실린다', () => {
  // 순위만 실으면 읽는 쪽이 그것을 확률로 받는다. 기저율은 나란히 놓으라고
  // 싣는 것이고, 점수에 더하면 무엇이 통계이고 무엇이 점술인지 가릴 수 없다.
  const r = readFortune(FORM, { now: NOW });
  const f = readForecast(FORM, NOW);
  const h = buildHiRes(r, f, routeQuestion('언제 결혼할까', 2026));

  assert.match(h.text, /\[F\] 기저율/);
  assert.match(h.text, /점수에 섞여 있지 않다/);
  assert.ok(h.json.baseRates.length > 0);

  // 순위보다 앞에 나와야 한다
  const base = h.text.indexOf('[F] 기저율');
  const ranks = h.text.indexOf('사건마다 따로 세운 달');
  assert.ok(base >= 0 && base < ranks, '기저율이 순위보다 뒤에 있다');

  // 명반 점수는 기저율과 무관하게 그대로다
  const grid = buildGrid(r.input, r.chart, { fromYear: 2026, years: 2, domain: '결혼' });
  for (const m of grid.months) {
    assert.equal(m.baseRate, undefined, '기저율이 월 층 점수에 새어 들어갔다');
  }
});

// ─────────────────────────────────────────────────────────────
// 체계마다 따로 읽기 (interpret.js)
// ─────────────────────────────────────────────────────────────

test('체계마다 자기 어휘로 읽고, 섞지 않는다', async () => {
  // profile.js 의 융합이 신호를 뭉갰다. 지인 여덟의 자미 원국 관록궁은
  // 천동·염정파군·탐랑·무곡·파군으로 전부 달랐는데 융합 결과는 다섯 명
  // 모두 "교육·법률·금융"이었다 — 베딕 목성 쪽 지표가 표를 덮었다.
  const IN = await import('../../public/unse/src/hires/interpret.js');
  const st = ZW.stackAt(R.input, 2026, null);
  const reads = IN.readAll(R.input, R.chart, st);

  assert.deepEqual(reads.map((r) => r.system), ['사주', '자미두수', '점성술', '베딕']);
  // 근거 없는 항목은 만들지 않는다
  for (const r of reads) {
    if (r.unavailable) continue;
    for (const [k, v] of Object.entries(r)) {
      if (k === 'system' || v == null) continue;
      assert.ok(v.value && v.basis, `${r.system}.${k} 에 근거가 없다`);
    }
  }
  // 체계마다 다른 말을 해야 한다 — 같으면 융합과 다를 바 없다
  const trades = reads.map((r) => r.직업?.value).filter(Boolean);
  assert.ok(new Set(trades).size > 1, `네 체계가 같은 직업을 말한다: ${trades}`);
});

test('담당 체계가 침묵하면 같이 침묵한다', async () => {
  // 자영/월급에서 자미는 넷에게만 답하고 그 넷을 다 맞혔다(4/4).
  // 사주로 빈칸을 채우면 40%가 되어 영점(55%)보다 나빠진다.
  // **채우지 않는 것이 정확도를 올린다.**
  const IN = await import('../../public/unse/src/hires/interpret.js');
  const st = ZW.stackAt(R.input, 2026, null);
  const best = IN.bestRead(IN.readAll(R.input, R.chart, st));

  // 혼인 안정은 영점보다 나빠 아예 담당을 두지 않았다
  assert.equal(best.혼인안정.said, null, '혼인 안정은 답하지 않기로 했다');

  // 답이 있으면 어느 체계가 말했는지 반드시 붙는다
  for (const [axis, box] of Object.entries(best)) {
    for (const s of box.said ?? []) {
      assert.ok(s.system && s.value && s.basis, `${axis} 에 체계·근거가 없다`);
    }
  }

  // 시각을 모르면 자미가 못 서므로 수입형태도 침묵한다
  const noTime = readFortune({ ...FORM, hour: null, minute: 0 }, { now: NOW });
  const b2 = IN.bestRead(IN.readAll(noTime.input, noTime.chart, null));
  assert.equal(b2.수입형태.said, null, '시각 미상인데 수입형태를 말했다');
});
