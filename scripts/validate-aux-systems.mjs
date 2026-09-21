/**
 * 연결되지 않은 열한 체계도 달을 고르는가
 *
 * 시기 판단에 들어가는 것은 열다섯 중 셋(사주·자미두수·점성술)뿐이다.
 * 나머지는 `forecast()` 가 있는데도 월 점수에 닿지 않는다. 그래서
 * "15체계로 예측도를 낸다"는 아직 시도된 적이 없다.
 *
 * **연결하기 전에 잰다.** 각 체계의 forecast 가 내는 영역 점수(areas)로
 * 달을 줄 세우고, 실제 사건이 그 목록의 몇 %에 있는지 본다. 순열 검정도
 * 체계마다 따로 돌린다 — 기준선이 체계마다 다르기 때문이다.
 *
 * 기준선을 넘는 체계가 있으면 그것만 연결한다. 하나도 없으면 연결해도
 * 그럴듯한 말만 늘어난다. 베딕을 재지 않고 핵심 넷에 앉혔던 실수를
 * 되풀이하지 않는다.
 */

import { readFileSync } from 'node:fs';
import { readFortune } from '../public/unse-8f3k2m/src/engine.js';
import { makePeriod, monthsOfYear } from '../public/unse-8f3k2m/src/forecast.js';

const ROUNDS = 300;
const CASES = JSON.parse(readFileSync('validation/cases.json', 'utf8'));

/** 분야 → 그 체계가 내는 영역 이름 (events.js 의 AREA_OF 와 같다) */
const AREA_OF = {
  직업: '직장운', 재물: '금전운', 관계: '애정운', 결혼: '애정운',
  주거: '총운', 이사: '총운', 건강: '건강운', 학업: '학업운', 자녀: '애정운',
};

// 타로는 뽑기라 뺀다. 나머지 열하나를 전부 본다.
const NAMES = ['kabbalah', 'sukyo', 'tojeong', 'yukim', 'hongguk',
               'juyeok', 'thai', 'gujeong', 'taeeul', 'mahabote', 'vedic'];

const MODS = {};
for (const n of NAMES) {
  MODS[n] = (await import(`../public/unse-8f3k2m/src/systems/${n}.js`)).default;
}

const years = CASES.flatMap((c) => c.events.map((e) => e.year));
const fromYear = Math.min(...years);
const toYear = Math.max(...years);
console.log(`사례 ${CASES.length}명 · 사건 ${CASES.reduce((t, c) => t + c.events.length, 0)}건 · ` +
  `기간 ${fromYear}~${toYear}\n`);

// ── 사람마다, 달마다, 체계마다 영역 점수를 뽑는다 ──
console.log('1단계 — 체계별 월 점수를 뽑습니다 (사건은 보지 않습니다)');
const perPerson = [];
for (const c of CASES) {
  process.stdout.write(`  ${c.id} …`);
  const r = readFortune(c.birth, { now: new Date(`${fromYear}-06-01T00:00:00Z`) });
  const months = [];
  for (let y = fromYear; y <= toYear; y++) {
    for (const p of monthsOfYear(y)) {
      const per = { y: p.termStart.y, m: p.termStart.m, s: {} };
      const period = makePeriod('month', { y: p.termStart.y, m: p.termStart.m, d: 15 }, p.jd);
      for (const n of NAMES) {
        try {
          const out = MODS[n].forecast(r.input, r.chart, period);
          per.s[n] = out?.areas ?? null;
        } catch { per.s[n] = null; }
      }
      months.push(per);
    }
  }
  perPerson.push(months);
  console.log(` 완료 (${months.length}달)`);
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

function pcts(months, events, sys) {
  const out = [];
  for (const ev of events) {
    const area = AREA_OF[ev.domain];
    const scored = months
      .map((mo) => ({ mo, v: mo.s[sys]?.[area] }))
      .filter((x) => typeof x.v === 'number');
    if (scored.length < 50) continue;
    scored.sort((a, b) => b.v - a.v);
    const i = scored.findIndex((x) => x.mo.y === ev.year && (ev.month == null || x.mo.m === ev.month));
    if (i < 0) continue;
    out.push(i / (scored.length - 1));
  }
  return out;
}

console.log('\n2단계 — 체계마다 따로 채점하고 순열 검정을 돌립니다\n');
console.log('체계          제대로 짝지음   섞었을 때(기준선)     p값    판정');
const eventSets = CASES.map((c) => c.events);

for (const sys of NAMES) {
  const all = perPerson.flatMap((mo, i) => pcts(mo, eventSets[i], sys));
  if (all.length < 10) { console.log(`${(MODS[sys].meta?.name ?? sys).padEnd(12)} 채점된 사건이 너무 적다 (${all.length}건)`); continue; }
  const real = mean(all);

  const nul = [];
  for (let r = 0; r < ROUNDS; r++) {
    const perm = eventSets.map((_, i) => i);
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    if (perm.filter((v, i) => v === i).length > perm.length / 4) { r--; continue; }
    const s = perPerson.flatMap((mo, i) => pcts(mo, eventSets[perm[i]], sys));
    if (s.length) nul.push(mean(s));
  }
  const better = nul.filter((s) => s <= real).length;
  const p = (better + 1) / (nul.length + 1);
  const base = mean(nul);
  const verdict = p < 0.05 ? '★ 신호 있음' : p < 0.2 ? '애매' : '구별 안 됨';
  console.log(`${(MODS[sys].meta?.name ?? sys).padEnd(12)} ${(real * 100).toFixed(1).padStart(8)}%  ` +
    `${(base * 100).toFixed(1).padStart(12)}%  ${p.toFixed(3).padStart(8)}   ${verdict}  (${all.length}건)`);
}

console.log('\n※ 백분위는 낮을수록 좋다. 기준선(섞었을 때)보다 낮아야 의미가 있다.');
console.log('※ 기준선을 넘는 체계만 월 점수에 연결한다. 재지 않고 넣으면 베딕 실수의 반복이다.');
