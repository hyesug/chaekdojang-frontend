/**
 * 체계 하나씩으로만 채점한다 — 41% 기준선을 넘는 게 있는가
 *
 * blind-validate.mjs 는 합산 점수(total)로 달을 줄 세운다. 여기서는 똑같은
 * 사건·똑같은 방식으로, **체계 하나의 점수만** 써서 줄을 세운다.
 *
 * 순열 검정도 체계마다 따로 돌린다. 기준선이 체계마다 다를 수 있기 때문이다
 * (합산의 기준선은 50%가 아니라 41.1% 였다 — 유명인 표본이 만든 쏠림이다).
 *
 * 격자는 사람·분야마다 한 번만 세우고 재활용한다. 비싼 것은 격자뿐이고
 * 채점과 순열은 싸다.
 */

import { readFileSync } from 'node:fs';
import { readFortune } from '../public/unse-8f3k2m/src/engine.js';
import { buildGrid } from '../public/unse-8f3k2m/src/hires/grid.js';
import { inferEvents } from '../public/unse-8f3k2m/src/hires/events.js';

const CHUNK = 6;
const ROUNDS = 500;
const CASES = JSON.parse(readFileSync('validation/cases.json', 'utf8'));

const domains = [...new Set(CASES.flatMap((c) => c.events.map((e) => e.domain)))];
const years = CASES.flatMap((c) => c.events.map((e) => e.year));
const fromYear = Math.min(...years);
const span = Math.max(...years) - fromYear + 1;

console.log(`사례 ${CASES.length}명 · 사건 ${CASES.reduce((t, c) => t + c.events.length, 0)}건 · ` +
  `분야 ${domains.join('·')} · 기간 ${fromYear}~${fromYear + span - 1} (${span}년)\n`);

// ── 격자 세우기 (비싼 부분, 한 번만) ──
console.log('1단계 — 사람마다 격자를 세웁니다 (사건은 보지 않습니다)');
const rowsOf = [];   // rowsOf[i][domain] = rows
for (const c of CASES) {
  process.stdout.write(`  ${c.id} …`);
  const r = readFortune(c.birth, { now: new Date(`${fromYear}-06-01T00:00:00Z`) });
  const per = {};
  for (const d of domains) {
    const rows = [];
    for (let y = fromYear; y <= fromYear + span - 1; y += CHUNK) {
      const s = Math.min(CHUNK, fromYear + span - y);
      rows.push(...inferEvents(buildGrid(r.input, r.chart, { fromYear: y, years: s, domain: d }), d).rows);
    }
    per[d] = rows;
  }
  rowsOf.push(per);
  console.log(' 완료');
}

const SYSTEMS = Object.keys(rowsOf[0][domains[0]][0].bySystem);
const KEYS = ['합산', ...SYSTEMS];
const scoreOf = (row, key) => (key === '합산' ? row.total : row.bySystem[key].score);

/** 한 사람의 격자를 한 사람의 사건들로 채점한다 */
function pcts(per, events, key) {
  const out = [];
  for (const ev of events) {
    const rows = per[ev.domain];
    if (!rows) continue;
    const ranked = rows.slice().sort((a, b) => scoreOf(b, key) - scoreOf(a, key));
    const idx = ranked.findIndex((x) => x.from.y === ev.year && (ev.month == null || x.from.m === ev.month));
    if (idx < 0) continue;
    out.push(idx / (ranked.length - 1));
  }
  return out;
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

console.log('\n2단계 — 체계 하나씩으로 채점하고, 체계마다 따로 순열 검정을 돌립니다\n');
console.log('체계          제대로 짝지음   섞었을 때(기준선)   p값      판정');
const eventSets = CASES.map((c) => c.events);

for (const key of KEYS) {
  const real = mean(rowsOf.flatMap((per, i) => pcts(per, eventSets[i], key)));

  const nul = [];
  for (let r = 0; r < ROUNDS; r++) {
    const perm = eventSets.map((_, i) => i);
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    // 자기 사건이 자기에게 돌아온 것이 많으면 기준선이 아니다
    if (perm.filter((v, i) => v === i).length > perm.length / 4) { r--; continue; }
    nul.push(mean(rowsOf.flatMap((per, i) => pcts(per, eventSets[perm[i]], key))));
  }
  const better = nul.filter((s) => s <= real).length;
  const p = (better + 1) / (nul.length + 1);
  const base = mean(nul);
  const verdict = p < 0.05 ? '신호 있음'
    : p < 0.2 ? '애매'
    : real < base ? '구별 안 됨'
    : '기준선보다 나쁨';
  console.log(`${key.padEnd(12)} ${(real * 100).toFixed(1).padStart(8)}%  ` +
    `${(base * 100).toFixed(1).padStart(12)}%  ${p.toFixed(3).padStart(8)}   ${verdict}`);
}

console.log('\n※ 백분위는 낮을수록 좋다. 기준선(섞었을 때)보다 낮아야 의미가 있다.');
console.log('※ 기준선이 50%가 아닌 것은 표본이 만든 쏠림이다 — 유명인 사건은 특정 나이대에 몰려 있다.');
