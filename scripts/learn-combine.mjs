/**
 * learn-combine.mjs — **열다섯을 어떻게 합쳐야 정답에 가까워지는가**
 *
 *   node scripts/learn-combine.mjs
 *
 * 정답표를 준 뜻은 "맞았나 틀렸나"를 세라는 것이 아니라 **합치는 법을
 * 배우라**는 것이다. 그런데 지금 학습기는 `driftCap` 에 묶여 가중치가
 * `1 ± 0.10` 밖으로 못 나간다. 그래서 배워도 결과가 거의 안 바뀐다
 * (보정 없음 0.175 → 보정 후 0.177).
 *
 * 그 묶음을 풀면 정말 배우는가? 여기서 잰다.
 *
 * ── 어떻게 재는가 ──────────────────────────────────────────
 * 사람이 열한 명뿐이고 자유도(체계 15 × 축 20)가 자료보다 훨씬 많다. 그래서
 * **적합값을 보면 안 된다.** 세게 배울수록 적합값은 반드시 올라간다.
 *
 *   ① 사람 단위 LOO — 그 사람을 뺀 열 명으로 배우고 그 사람에게 쓴다
 *   ② 라벨 섞기 — 정답을 사람끼리 뒤섞고 똑같이 배운다. 섞어도 같은
 *      점수가 나오면 배운 것이 아니라 외운 것이다
 *
 * ②가 핵심이다. 이 저장소는 "열다섯 중 제일 잘한 것 고르기"가 순열 검정에서
 * 사라지는 것을 이미 두 번 봤다(p=0.688, p=0.423).
 */
import { readFileSync, existsSync } from 'node:fs';
import { natalFortune } from '../public/unse-8f3k2m/src/semantic/index.js';
import { interpretCareer } from '../public/unse-8f3k2m/src/semantic/systems.js';
import { poolCareer } from '../public/unse-8f3k2m/src/semantic/ensemble.js';
import { measure, unitize, cosineOf } from '../public/unse-8f3k2m/src/semantic/calibration.js';
import { AXES } from '../public/unse-8f3k2m/src/semantic/axes.js';
import { seededRandom } from '../public/unse-8f3k2m/src/semantic/timing/schema.js';

const file = process.argv[2] ?? 'validation/people.json';
if (!existsSync(file)) { console.error(`${file} 이 없습니다.`); process.exit(1); }
const people = JSON.parse(readFileSync(file, 'utf8'));
const AX = AXES.career;
const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// ── 자료 ──
const rows = [];
for (const p of people) {
  const f = p.labels?.career?.features;
  if (!f) continue;
  let fortune = null; let stack = null;
  try { ({ fortune, stack } = natalFortune(p.birth)); } catch { continue; }
  rows.push({
    id: p.id, label: p.labels.career.occupationKey ?? p.id,
    truth: f, systems: interpretCareer(fortune, stack),
  });
}
if (rows.length < 4) { console.error('사람이 너무 적습니다.'); process.exit(1); }

/** 평균을 뺀 자리에서 잰다 — 안 빼면 모두에게 평균을 주는 것이 최선이 된다 */
const centre = (() => {
  const m = {};
  for (const ax of AX) m[ax] = mean(rows.map((r) => r.truth[ax] ?? 0));
  return m;
})();
const dev = (v) => Object.fromEntries(AX.map((ax) => [ax, (v?.[ax] ?? 0) - centre[ax]]));
const scoreOne = (truth, pred) => cosineOf(dev(unitize(truth)), dev(unitize(pred)), AX);

/**
 * 가중치를 만든다. `strength` 가 1 이면 지금과 같고, 키우면 더 세게 배운다.
 * `topK` 가 있으면 그 축에서 잘 읽은 상위 몇 체계만 남기고 나머지를 깎는다.
 */
function learn(trainRows, { strength = 1, topK = null, mode = 'axis' } = {}) {
  const m = measure(trainRows, 'career');
  const out = {};

  // ── 체계마다 하나씩만 배운다 (15개) ──
  // 축까지 나누면 300개를 열한 명으로 배우게 된다. 차원을 줄이면
  // 일반화될 수도 있다 — 그것도 재 본다
  if (mode === 'system') {
    const bySys = {};
    for (const ax of AX) {
      for (const r of m.byFeature[ax] ?? []) {
        if (!r.n) continue;
        (bySys[r.system] ??= []).push(r.readScore);
      }
    }
    const per = Object.entries(bySys).map(([sys, xs]) => ({ sys, s: mean(xs) }));
    if (!per.length) return {};
    const avg = mean(per.map((x) => x.s));
    const spread = Math.max(1e-6, Math.max(...per.map((x) => x.s)) - Math.min(...per.map((x) => x.s)));
    const ranked = per.slice().sort((a, b) => b.s - a.s);
    const keep = topK ? new Set(ranked.slice(0, topK).map((x) => x.sys)) : null;
    for (const x of per) {
      const lift = Math.max(-1, Math.min(1, (x.s - avg) / spread));
      let w = 1 + lift * 0.10 * strength;
      if (keep && !keep.has(x.sys)) w *= 0.25;
      out[x.sys] = Object.fromEntries(AX.map((ax) => [ax, Math.max(0, r3(w))]));
    }
    return out;
  }

  for (const ax of AX) {
    const list = (m.byFeature[ax] ?? []).filter((r) => r.n);
    if (!list.length) continue;
    const avg = mean(list.map((r) => r.readScore));
    const spread = Math.max(1e-6,
      Math.max(...list.map((r) => r.readScore)) - Math.min(...list.map((r) => r.readScore)));
    const ranked = list.slice().sort((a, b) => b.readScore - a.readScore);
    const keep = topK ? new Set(ranked.slice(0, topK).map((r) => r.system)) : null;
    for (const r of list) {
      const lift = Math.max(-1, Math.min(1, (r.readScore - avg) / spread));
      // 묶음을 strength 배로 푼다. 0 이면 학습 없음, 1 이면 지금 그대로
      let w = 1 + lift * 0.10 * strength;
      if (keep && !keep.has(r.system)) w *= 0.25;
      (out[r.system] ??= {})[ax] = Math.max(0, r3(w));
    }
  }
  return out;
}

/** 사람 단위 LOO — 그 사람을 빼고 배워서 그 사람에게 쓴다 */
function loo(data, opts) {
  const xs = [];
  for (let i = 0; i < data.length; i++) {
    const train = data.filter((_, j) => j !== i);
    const w = opts.strength === 0 && !opts.topK ? null : learn(train, opts);
    const p = poolCareer(data[i].systems, w);
    xs.push(scoreOne(data[i].truth, p.profile ?? {}));
  }
  return mean(xs);
}

console.log('# 합치는 법을 배울 수 있는가');
console.log('');
console.log(`사람 ${rows.length}명 · 축 ${AX.length}개 · 체계 15개.`);
console.log('자유도가 자료보다 훨씬 많으므로 **적합값이 아니라 LOO 로만** 읽습니다.');
console.log('');

// ── ① 묶음을 얼마나 풀면 좋아지는가 ──
const GRID = [
  ['학습 없음', { strength: 0 }],
  ['지금 (±0.10)', { strength: 1 }],
  ['3배 (±0.30)', { strength: 3 }],
  ['10배 (±1.0)', { strength: 10 }],
  ['상위 4체계만', { strength: 3, topK: 4 }],
  ['상위 2체계만', { strength: 3, topK: 2 }],
  ['상위 1체계만', { strength: 3, topK: 1 }],
  // 차원을 줄인 것 — 체계마다 가중치 하나 (15개)
  ['체계별 ±0.3', { strength: 3, mode: 'system' }],
  ['체계별 ±1.0', { strength: 10, mode: 'system' }],
  ['체계 상위 6', { strength: 3, topK: 6, mode: 'system' }],
  ['체계 상위 3', { strength: 3, topK: 3, mode: 'system' }],
];

console.log('## ① 얼마나 세게 배워야 하나');
console.log('');
console.log('  방법            적합값    LOO      차이(과적합)');
const results = [];
for (const [name, opts] of GRID) {
  const wAll = opts.strength === 0 && !opts.topK ? null : learn(rows, opts);
  const fit = mean(rows.map((r) => scoreOne(r.truth, poolCareer(r.systems, wAll).profile ?? {})));
  const lv = loo(rows, opts);
  results.push({ name, opts, fit, loo: lv });
  console.log(`  ${name.padEnd(14)} ${String(r3(fit)).padEnd(9)} ${String(r3(lv)).padEnd(8)} ${r3(fit - lv)}`);
}
const base = results[0].loo;
const best = results.slice().sort((a, b) => b.loo - a.loo)[0];
console.log('');
console.log(`  학습 없음 LOO ${r3(base)} · 가장 나은 것 "${best.name}" LOO ${r3(best.loo)}` +
  ` (차이 ${r3(best.loo - base)})`);
console.log('');

// ── ② 라벨을 섞어도 같은 점수가 나오는가 ──
console.log('## ② 정답을 뒤섞고 똑같이 배우면');
console.log('');
const rnd = seededRandom(20260924);
const ROUNDS = 200;
for (const { name, opts } of [results[0], best]) {
  const nulls = [];
  for (let t = 0; t < ROUNDS; t++) {
    const truths = rows.map((r) => r.truth);
    // 정답만 사람끼리 섞는다 (명반은 그대로)
    for (let i = truths.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [truths[i], truths[j]] = [truths[j], truths[i]];
    }
    const shuffled = rows.map((r, i) => ({ ...r, truth: truths[i] }));
    nulls.push(loo(shuffled, opts));
  }
  nulls.sort((a, b) => a - b);
  const obs = name === results[0].name ? base : best.loo;
  const above = nulls.filter((v) => v >= obs).length;
  const p = (above + 1) / (nulls.length + 1);
  console.log(`  ${name.padEnd(14)} 관측 ${String(r3(obs)).padEnd(7)}` +
    ` 섞었을 때 평균 ${String(r3(mean(nulls))).padEnd(7)}` +
    ` 95% ${r3(nulls[Math.floor(nulls.length * 0.025)])}~${r3(nulls[Math.floor(nulls.length * 0.975)])}` +
    `   p=${r3(p)}`);
}
console.log('');
console.log('  ※ 섞은 정답으로 배워도 같은 점수가 나오면, 배운 것이 아니라');
console.log('    명반끼리 원래 비슷한 것을 본 것입니다.');
console.log('');

// ── ③ 사람마다 ──
console.log('## ③ 사람마다 (가장 나은 방법으로)');
console.log('');
for (let i = 0; i < rows.length; i++) {
  const train = rows.filter((_, j) => j !== i);
  const w = best.opts.strength === 0 && !best.opts.topK ? null : learn(train, best.opts);
  const a = scoreOne(rows[i].truth, poolCareer(rows[i].systems, null).profile ?? {});
  const b = scoreOne(rows[i].truth, poolCareer(rows[i].systems, w).profile ?? {});
  console.log(`  ${rows[i].id.padEnd(5)} ${String(rows[i].label).padEnd(14)}` +
    ` 학습 없음 ${String(r3(a)).padStart(7)} → 배운 뒤 ${String(r3(b)).padStart(7)}` +
    `  ${b > a ? '↑' : b < a ? '↓' : '='}`);
}
console.log('');
console.log('## 읽는 법');
console.log('  · 적합값이 올라가는 것은 아무 뜻이 없습니다. 세게 배우면 반드시 올라갑니다.');
console.log('  · LOO 가 "학습 없음"보다 높고, **섞었을 때보다도 높아야** 배운 것입니다.');
console.log('  · 사람이 열한 명이라 p 값이 낮아도 "증명됐다"로 읽지 않습니다.');
