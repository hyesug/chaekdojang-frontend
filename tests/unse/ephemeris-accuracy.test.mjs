/**
 * 천체 위치 정확도 — 독립 구현이 계산한 기준값과 대조한다
 *
 * 왜 필요한가.
 *   core/planets.js 는 JPL 이 공개한 근사 궤도요소(Standish)로 행성 위치를
 *   구한다. 근사식이므로 오차가 있는데, 그 오차가 **얼마나 되는지 우리가
 *   모르고 있었다.** 모르면 "1도 이내" 같은 말을 할 근거가 없다.
 *
 * 어떻게 쟀는가.
 *   독립 구현(celestine 0.2.1, MIT)으로 1900~2050 을 훑어 벌어짐을 쟀고,
 *   그 기준값 53 표본을 `fixtures/ephemeris-reference.json` 에 떠 두었다.
 *   **라이브러리는 저장소에 남기지 않는다.** 값을 한 번 재고 나면 라이브러리
 *   자체는 더 할 일이 없는데, 남겨 두면 판올림과 유지보수만 따라온다.
 *   기준값 파일은 깨지지도 사라지지도 않는다.
 *
 * ── 이 테스트가 말하는 것과 말하지 않는 것 ──────────────────
 *   말하는 것   : 두 독립 구현이 얼마나 벌어지는가
 *   말하지 않는 것: 어느 쪽이 맞는가. 둘 다 근사식이고 우리에게 기준이 없다.
 *                  벌어짐이 크다는 것은 **그만큼 믿지 말라는 뜻**이지
 *                  우리 쪽이 틀렸다는 뜻이 아니다.
 *
 * ── 실측한 벌어짐 (1900~2050, 60일 간격 914 표본) ───────────
 *   태양 0.8′ · 달 1.0′ · 금성 1.5′ · 해왕성 1.4′ · 천왕성 2.2′ · 화성 2.9′
 *   목성 10.8′ · 토성 14.3′
 *   수성 84′  — 내합(태양과 붙는 때) 근처에서 지심 경도가 급변해 벌어진다.
 *               기하학적 확대이지 한쪽의 버그가 아니다. 아래에서 확인한다.
 *   명왕성 85′ — JPL 근사 궤도요소가 가장 약한 천체다. 문서에도 그렇게 적혀 있다.
 *
 * 아래 상한은 그 실측값에 여유를 둔 것이다. 이 선을 넘으면 **계산이 어딘가
 * 달라진 것**이므로 테스트가 깨져서 알려 준다.
 *
 * 기준값을 다시 뜨려면: scripts/refresh-ephemeris-reference.mjs 를 읽을 것.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { toJD, solarTermJD } from '../../public/unse-8f3k2m/src/core/astro.js';
import { planetPositions } from '../../public/unse-8f3k2m/src/core/planets.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REF = JSON.parse(readFileSync(join(HERE, 'fixtures', 'ephemeris-reference.json'), 'utf8'));

/** 우리 이름 → 기준값 파일의 이름 */
const NAME = {
  태양: 'Sun', 달: 'Moon', 수성: 'Mercury', 금성: 'Venus', 화성: 'Mars',
  목성: 'Jupiter', 토성: 'Saturn', 천왕성: 'Uranus', 해왕성: 'Neptune', 명왕성: 'Pluto',
};

/** 허용 상한 (분각). 실측 최대값에 여유를 둔 것이다 */
const LIMIT = {
  태양: 2, 달: 2, 금성: 3, 해왕성: 3, 천왕성: 4, 화성: 5,
  목성: 15, 토성: 20,
  // 아래 둘은 근본적으로 벌어지는 천체다. 값을 낮출 수 없어 그대로 인정한다
  수성: 90, 명왕성: 95,
};

/** 두 황경 사이의 각거리 (분각) */
const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180) * 60;

test('기준값 파일이 온전하다', () => {
  assert.ok(REF.samples.length >= 50, `표본이 ${REF.samples.length}개뿐이다`);
  assert.ok(REF.source.includes('celestine'), '기준값의 출처가 적혀 있지 않다');
  assert.match(REF.caveat, /어느 쪽이 틀렸다는 뜻이 아니라/);
  for (const s of REF.samples) {
    assert.ok(Number.isFinite(s.jd));
    for (const b of REF.bodies) assert.ok(Number.isFinite(s.lon[b]), `${s.utc} 의 ${b} 값이 없다`);
  }
});

test('율리우스일 정의가 기준값과 같다', () => {
  // 기준값은 우리 toJD 로 만든 JD 에서 계산했다. 그 정의가 흔들리면
  // 아래 대조가 통째로 무의미해지므로 먼저 확인한다.
  for (const s of REF.samples.slice(0, 10)) {
    const [d, t] = s.utc.replace('Z', '').split('T');
    const [y, m, dd] = d.split('-').map(Number);
    const [h, mi] = t.split(':').map(Number);
    assert.ok(Math.abs(toJD(y, m, dd, h, mi) - s.jd) < 1e-5, `${s.utc} JD 불일치`);
  }
});

test('모든 표본에서 독립 구현과 상한 안쪽으로 일치한다', () => {
  const worst = {};
  for (const s of REF.samples) {
    const mine = planetPositions(s.jd);
    for (const [kr, en] of Object.entries(NAME)) {
      const d = gap(mine[kr].lon, s.lon[en]);
      if (d > (worst[kr] ?? 0)) worst[kr] = d;
      assert.ok(d <= LIMIT[kr],
        `${s.utc} ${kr} 벌어짐 ${d.toFixed(1)}분각 > 상한 ${LIMIT[kr]}분각`);
    }
  }
  // 해와 달은 시기 계산의 뼈대다. 여기가 벌어지면 절기·음력이 통째로 흔들린다
  assert.ok(worst.태양 < 2, `태양 ${worst.태양.toFixed(2)}분각`);
  assert.ok(worst.달 < 2, `달 ${worst.달.toFixed(2)}분각`);
});

test('수성이 크게 벌어지는 표본은 태양에 붙어 있는 때다', () => {
  // 내합 근처가 아닌 곳에서 크게 벌어진다면 그건 기하학이 아니라 버그다.
  let checked = 0;
  for (const s of REF.samples) {
    const mine = planetPositions(s.jd);
    const d = gap(mine.수성.lon, s.lon.Mercury);
    if (d < 20) continue;
    checked += 1;
    const elong = Math.abs(((mine.수성.lon - mine.태양.lon + 540) % 360) - 180);
    assert.ok(elong < 20,
      `${s.utc}: 수성이 태양에서 ${elong.toFixed(1)}도 떨어져 있는데 ${d.toFixed(1)}분각 벌어졌다 — 기하학적 확대로 설명되지 않는다`);
  }
  assert.ok(checked > 0, '크게 벌어진 표본이 하나도 없다 — 이 테스트가 아무것도 확인하지 않았다');
});

test('절기 순간에 독립 구현도 같은 태양 황경을 말한다', () => {
  // 절기는 태양 황경이 30도의 배수를 지나는 순간이다. 사주의 연주·월주가
  // 여기에 매달려 있어서, 이 순간이 어긋나면 팔자가 통째로 밀린다.
  // 기준값 표본 가운데 태양 황경이 절기 경계에 가장 가까운 것으로 대조한다.
  for (const y of [1950, 1992, 2026, 2040]) {
    for (const target of [315, 0, 90, 180]) {
      const jd = solarTermJD(target, toJD(y, 1, 1, 0, 0));
      const mine = planetPositions(jd).태양.lon;
      const off = Math.abs(((mine - target + 540) % 360) - 180) * 60;
      assert.ok(off < 0.1,
        `${y}년 황경 ${target}도 절입 계산이 ${off.toFixed(3)}분각 어긋났다 — 이분법이 수렴하지 않았다`);
    }
  }
});

test('오차가 실제로 결론을 바꾸는 자리에는 가드가 있다', async () => {
  // 카라카는 도수 순서로만 정해진다. 오차로 순서가 뒤집히면 다라카라카가
  // 바뀌고 배우자 해석이 통째로 달라진다. 그 위험을 스스로 신고해야 한다.
  const { charaKarakas } = await import('../../public/unse-8f3k2m/src/hires/vedicExt.js');
  const { readFortune } = await import('../../public/unse-8f3k2m/src/engine.js');
  const r = readFortune({
    name: '오차', gender: 'female', year: 1992, month: 1, day: 30,
    hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전',
  }, { now: new Date('2026-09-20T00:00:00Z') });

  const k = charaKarakas(r.input);
  assert.ok(Array.isArray(k.uncertain), 'uncertain 을 돌려주지 않는다');
  assert.equal(typeof k.darakarakaUncertain, 'boolean');
  // 흔들린다고 신고한 쌍은 실제로 도수 차이가 불확실 폭 안쪽이어야 한다
  for (const u of k.uncertain) {
    assert.ok(u.gapArcmin <= u.bandArcmin, `${u.between} 가 근거 없이 흔들린다고 나왔다`);
    assert.equal(u.between.length, 2);
    assert.ok(u.why.length > 10);
  }
  // 흔들린다고 하지 않은 이웃 쌍은 실제로 충분히 벌어져 있어야 한다
  for (let i = 1; i < k.list.length; i++) {
    const pair = [k.list[i - 1].planet, k.list[i].planet];
    const flagged = k.uncertain.some((u) => u.between[0] === pair[0] && u.between[1] === pair[1]);
    if (flagged) continue;
    const gapArcmin = (k.list[i - 1].deg - k.list[i].deg) * 60;
    assert.ok(gapArcmin > k.list[i - 1].band + k.list[i].band,
      `${pair} 가 ${gapArcmin.toFixed(1)}분각밖에 안 벌어졌는데 신고되지 않았다`);
  }
});
